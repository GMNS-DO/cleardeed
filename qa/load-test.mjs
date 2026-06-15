#!/usr/bin/env node
/**
 * qa/load-test.mjs — A.4.6 load test
 *
 * Hammers the home page with N concurrent requests to verify the
 * deploy can handle traffic spikes. This is NOT a test of the
 * pipeline (which is 60-120s and rate-limited upstream). This is
 * a test of the static surface: the home page, the static assets,
 * the API gateway.
 *
 * For full-pipeline load testing, we'd need a staging environment
 * with 50 paid orders queued, which is too expensive to do for
 * launch-week. The Vercel dashboard's "functions" tab is the
 * real source of truth for production load.
 *
 * Usage:
 *   node qa/load-test.mjs [--base-url https://v0-cleardeed.vercel.app] [--concurrency 50] [--requests 200]
 *
 * Exit code:
 *   0 = all requests succeeded (no 5xx, p95 below target)
 *   1 = some requests failed or p95 exceeded target
 */

import { performance } from "node:perf_hooks";

function arg(name, fallback) {
  const flag = `--${name}`;
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === flag && process.argv[i + 1]) return process.argv[i + 1];
  }
  return fallback;
}

const BASE_URL = (arg("base-url") ?? process.env.CLEARDEED_BASE_URL ?? "https://v0-cleardeed.vercel.app").replace(/\/$/, "");
const CONCURRENCY = parseInt(arg("concurrency") ?? "50", 10);
const REQUESTS = parseInt(arg("requests") ?? "200", 10);
const TARGET_P95_MS = parseInt(arg("target-p95") ?? "3000", 10);

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.ceil((p / 100) * sortedArr.length) - 1);
  return sortedArr[idx];
}

async function fireOne() {
  const t0 = performance.now();
  try {
    const res = await fetch(`${BASE_URL}/`, { method: "GET" });
    const text = await res.text();
    const t1 = performance.now();
    return { ms: t1 - t0, status: res.status, ok: res.status === 200 && text.includes("Khordha") };
  } catch (err) {
    const t1 = performance.now();
    return { ms: t1 - t0, status: 0, ok: false, error: err.message };
  }
}

async function run() {
  console.log(`Load test: ${REQUESTS} requests, ${CONCURRENCY} concurrent, against ${BASE_URL}/`);
  const samples = [];
  let next = 0;
  let failed = 0;
  let statusCounts = {};

  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (true) {
      const i = next++;
      if (i >= REQUESTS) return;
      const r = await fireOne();
      samples.push(r.ms);
      statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
      if (!r.ok) failed++;
    }
  });
  await Promise.all(workers);

  samples.sort((a, b) => a - b);
  const sum = samples.reduce((a, b) => a + b, 0);
  const p50 = percentile(samples, 50);
  const p95 = percentile(samples, 95);
  const p99 = percentile(samples, 99);
  const avg = sum / samples.length;
  const max = samples[samples.length - 1];
  const min = samples[0];
  const rps = REQUESTS / (max / 1000) * (CONCURRENCY / CONCURRENCY); // rough

  console.log(`\nResults:`);
  console.log(`  total requests: ${REQUESTS}`);
  console.log(`  successful:     ${REQUESTS - failed}`);
  console.log(`  failed:         ${failed}`);
  console.log(`  status counts:  ${JSON.stringify(statusCounts)}`);
  console.log(`  min:            ${min.toFixed(0)}ms`);
  console.log(`  avg:            ${avg.toFixed(0)}ms`);
  console.log(`  p50:            ${p50.toFixed(0)}ms`);
  console.log(`  p95:            ${p95.toFixed(0)}ms`);
  console.log(`  p99:            ${p99.toFixed(0)}ms`);
  console.log(`  max:            ${max.toFixed(0)}ms`);

  const pass = failed === 0 && p95 <= TARGET_P95_MS;
  console.log(`\nTarget: p95 ≤ ${TARGET_P95_MS}ms with 0 failures`);
  console.log(pass ? `✓ PASS` : `✗ FAIL`);
  process.exit(pass ? 0 : 1);
}

run().catch(err => {
  console.error("FATAL:", err);
  process.exit(2);
});

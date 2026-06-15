#!/usr/bin/env node
/**
 * qa/perf-baseline.mjs — A.4.5 perf baseline
 *
 * Measures end-to-end latency of the buyer's golden path:
 *  1. Home page TTFB (target: <500 ms)
 *  2. /api/preview TTFB + Bhulekh fetcher round-trip (target: <8 s)
 *  3. /api/report/create TTFB + full pipeline (target: <120 s)
 *
 * Writes a JSON report to qa/perf-baseline-results.json with
 * min/avg/p50/p95/max so the founder can spot regressions week
 * over week.
 *
 * Usage:
 *   node qa/perf-baseline.mjs [--base-url https://v0-cleardeed.vercel.app] [--iterations 3]
 *
 * Requires:
 *   - CLEARDEED_BASE_URL (or --base-url) — the deployment to measure
 *   - REPORT_CREATE_TOKEN (or --token) — the auth token for /api/report/create
 *   - A real test plot (defaults to the P051 ground-truth plot)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const flag = `--${name}`;
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === flag && process.argv[i + 1]) return process.argv[i + 1];
  }
  return fallback;
}

const BASE_URL = (arg("base-url") ?? process.env.CLEARDEED_BASE_URL ?? "https://v0-cleardeed.vercel.app").replace(/\/$/, "");
const TOKEN = arg("token") ?? process.env.REPORT_CREATE_TOKEN ?? process.env.ADMIN_VIEW_TOKEN;
const ITERATIONS = parseInt(arg("iterations") ?? "3", 10);

if (!TOKEN) {
  console.error("FATAL: REPORT_CREATE_TOKEN (or ADMIN_VIEW_TOKEN) is not set");
  process.exit(1);
}

const P051 = {
  tehsil: "Bhubaneswar",
  tehsilValue: "01",
  village: "Bhubaneswar (M.Corp.)",
  villageCode: "0001",
  searchMode: "Plot",
  identifier: "1519",
};

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  const idx = Math.min(sortedArr.length - 1, Math.ceil((p / 100) * sortedArr.length) - 1);
  return sortedArr[idx];
}

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = samples.reduce((a, b) => a + b, 0);
  return {
    n: samples.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round(sum / samples.length),
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
  };
}

async function timeit(label, fn) {
  const t0 = Date.now();
  try {
    const result = await fn();
    const t1 = Date.now();
    console.log(`  ${label}: ${t1 - t0}ms (ok)`);
    return { ms: t1 - t0, ok: true, result };
  } catch (err) {
    const t1 = Date.now();
    console.log(`  ${label}: ${t1 - t0}ms (FAIL: ${err.message})`);
    return { ms: t1 - t0, ok: false, error: err.message };
  }
}

async function measureHomePage() {
  const samples = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/`, { method: "GET" });
    const text = await res.text();
    const t1 = Date.now();
    if (res.status !== 200) throw new Error(`home page returned ${res.status}`);
    if (!text.includes("Khordha")) throw new Error("home page missing Khordha");
    samples.push(t1 - t0);
  }
  return stats(samples);
}

async function measurePreview() {
  const samples = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/api/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(P051),
    });
    const t1 = Date.now();
    if (res.status !== 200 && res.status !== 429) {
      const body = await res.text();
      throw new Error(`preview returned ${res.status}: ${body.slice(0, 200)}`);
    }
    if (res.status === 429) {
      console.log(`  preview iter ${i}: rate-limited, skipping`);
      continue;
    }
    samples.push(t1 - t0);
  }
  return samples.length > 0 ? stats(samples) : { n: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0 };
}

async function measureReportCreate() {
  // Just 1 iteration — the full pipeline is expensive (60-120s)
  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}/api/report/create`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${TOKEN}`,
    },
    body: JSON.stringify(P051),
  });
  const t1 = Date.now();
  if (res.status !== 200) {
    const body = await res.text();
    throw new Error(`report/create returned ${res.status}: ${body.slice(0, 500)}`);
  }
  return stats([t1 - t0]);
}

const results = { baseUrl: BASE_URL, ranAt: new Date().toISOString(), iterations: ITERATIONS, sections: {} };

console.log(`Perf baseline against ${BASE_URL} (${ITERATIONS} iterations each)`);
console.log(`\n[1/3] Home page TTFB`);
results.sections.homePage = await measureHomePage();
console.log(`  p50=${results.sections.homePage.p50}ms p95=${results.sections.homePage.p95}ms`);

console.log(`\n[2/3] /api/preview (Bhulekh round-trip)`);
results.sections.preview = await measurePreview();
console.log(`  p50=${results.sections.preview.p50}ms p95=${results.sections.preview.p95}ms`);

console.log(`\n[3/3] /api/report/create (full pipeline, 1 iteration)`);
results.sections.reportCreate = await measureReportCreate();
console.log(`  total=${results.sections.reportCreate.avg}ms`);

const targets = { homePage: 500, preview: 8000, reportCreate: 120_000 };
const summary = {};
for (const [k, target] of Object.entries(targets)) {
  const s = results.sections[k];
  summary[k] = { p95: s.p95, target, pass: s.p95 <= target };
  if (!summary[k].pass) console.log(`  ⚠ ${k} p95=${s.p95}ms exceeds target=${target}ms`);
}
results.summary = summary;

const outPath = path.join(__dirname, "perf-baseline-results.json");
fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
console.log(`\nWrote ${outPath}`);

const allPass = Object.values(summary).every(s => s.pass);
process.exit(allPass ? 0 : 1);

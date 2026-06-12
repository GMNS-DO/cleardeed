#!/usr/bin/env node

/**
 * Sprint V4: Shadow runner report generator
 *
 * Reads a results.jsonl (produced by qa/shadow_runner.mjs) and writes three
 * Markdown reports into the same run directory:
 *
 *   coverage_heatmap.md     — per-tehsil × per-fetcher success rate
 *   failure_distribution.md — bucketed failure types with counts
 *   slow_plots.md           — top 10 slowest plots + dominant fetcher
 *
 * The report is intended to be read by a human after a 2,000-plot run. It is
 * deliberately Markdown (not a dashboard) so the founder can paste it into a
 * doc or PR comment.
 *
 * Usage:
 *   node qa/shadow_runner_report.mjs qa/shadow_runs/<run_id>/results.jsonl
 *   node qa/shadow_runner_report.mjs qa/shadow_runs/<run_id>/results.jsonl --top 25
 *
 * If no path is given, the latest run directory is used.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_RUNS_DIR = join(__dirname, "shadow_runs");

// ── CLI args ───────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { input: null, top: 10 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--top") out.top = parseInt(argv[++i], 10);
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: node qa/shadow_runner_report.mjs [results.jsonl] [--top N]`);
      process.exit(0);
    } else if (!out.input) {
      out.input = a;
    } else {
      console.error(`Unknown arg: ${a}`);
      process.exit(2);
    }
  }
  if (!out.input) {
    // Pick the most recent run
    if (!existsSync(DEFAULT_RUNS_DIR)) {
      console.error(`No runs directory at ${DEFAULT_RUNS_DIR}`);
      process.exit(2);
    }
    const runs = readdirSync(DEFAULT_RUNS_DIR)
      .filter((d) => existsSync(join(DEFAULT_RUNS_DIR, d, "results.jsonl")))
      .sort()
      .reverse();
    if (runs.length === 0) {
      console.error(`No runs found in ${DEFAULT_RUNS_DIR}`);
      process.exit(2);
    }
    out.input = join(DEFAULT_RUNS_DIR, runs[0], "results.jsonl");
    console.log(`[report] using latest run: ${runs[0]}`);
  }
  return out;
}

// ── Load ──────────────────────────────────────────────────────────────────
function loadResults(path) {
  if (!existsSync(path)) {
    console.error(`File not found: ${path}`);
    process.exit(2);
  }
  const lines = readFileSync(path, "utf-8").split("\n").filter(Boolean);
  const out = [];
  for (const line of lines) {
    try {
      out.push(JSON.parse(line));
    } catch (err) {
      console.warn(`Skipping malformed line: ${err.message}`);
    }
  }
  return out;
}

// ── Compute coverage heatmap ─────────────────────────────────────────────
function computeHeatmap(records) {
  const tahasils = new Set();
  const fetchers = new Set();
  const cells = new Map(); // key: "tahasil|fetcher" -> {ok, fail}

  for (const r of records) {
    const t = r.plot?.tahasil ?? "Unknown";
    tahasils.add(t);
    for (const [f, v] of Object.entries(r.fetcherResults ?? {})) {
      fetchers.add(f);
      const k = `${t}|${f}`;
      if (!cells.has(k)) cells.set(k, { ok: 0, fail: 0, total: 0 });
      const c = cells.get(k);
      c.total++;
      if (v?.status === "ok") c.ok++;
      else c.fail++;
    }
  }
  return { tahasils: [...tahasils].sort(), fetchers: [...fetchers].sort(), cells };
}

function renderHeatmap({ tahasils, fetchers, cells }) {
  if (tahasils.length === 0 || fetchers.length === 0) {
    return `# Coverage heatmap\n\n_No fetcher data found in results.jsonl._\n`;
  }
  const header = ["| Tehsil \\ Fetcher |", ...fetchers.map((f) => ` ${f} |`)].join("");
  const sep = ["|---|", ...fetchers.map(() => " --- |")].join("");
  const rows = tahasils.map((t) => {
    const cols = fetchers.map((f) => {
      const c = cells.get(`${t}|${f}`);
      if (!c || c.total === 0) return " n/a |";
      const pct = ((c.ok / c.total) * 100).toFixed(0);
      // Color: green >= 80, yellow 50-79, red < 50
      const emoji = pct >= 80 ? "🟢" : pct >= 50 ? "🟡" : "🔴";
      return ` ${emoji} ${pct}% (${c.ok}/${c.total}) |`;
    });
    return `| **${t}** |${cols.join("")}`;
  });
  return [
    `# Coverage heatmap`,
    ``,
    `Per-tehsil × per-fetcher success rate. 🟢 ≥ 80% · 🟡 50-79% · 🔴 < 50%.`,
    ``,
    header,
    sep,
    ...rows,
    ``,
  ].join("\n");
}

// ── Compute failure distribution ─────────────────────────────────────────
function computeFailures(records) {
  const buckets = new Map();
  for (const r of records) {
    if (r.pipelineStatus === "generated") continue;
    const key = r.error ? truncate(r.error, 80) : r.pipelineStatus;
    if (!buckets.has(key)) buckets.set(key, { count: 0, examples: [] });
    const b = buckets.get(key);
    b.count++;
    if (b.examples.length < 3) b.examples.push(`${r.plot?.tahasil}/${r.plot?.village}/${r.plot?.identifier}`);
  }
  return [...buckets.entries()]
    .map(([k, v]) => ({ error: k, count: v.count, examples: v.examples }))
    .sort((a, b) => b.count - a.count);
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n) + "..." : s;
}

function renderFailures(failures, total) {
  if (failures.length === 0) {
    return [
      `# Failure distribution`,
      ``,
      `_No failures observed. ${total} plots all generated successfully._`,
      ``,
    ].join("\n");
  }
  const rows = failures.map((f) => {
    return `| ${f.count} | ${f.error.replace(/\|/g, "\\|")} | ${f.examples.join(", ")} |`;
  });
  return [
    `# Failure distribution`,
    ``,
    `${failures.length} distinct error patterns across ${total} plots.`,
    ``,
    "| Count | Error | Example plots |",
    "| --- | --- | --- |",
    ...rows,
    ``,
  ].join("\n");
}

// ── Slow plots ────────────────────────────────────────────────────────────
function computeSlowPlots(records, top) {
  return [...records]
    .filter((r) => typeof r.durationMs === "number")
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, top);
}

function renderSlowPlots(records, top) {
  if (records.length === 0) {
    return `# Slowest plots\n\n_No plot records to rank._\n`;
  }
  const rows = records.map((r) => {
    const dominant = dominantFetcher(r.fetcherResults) ?? "n/a";
    const tahasil = r.plot?.tahasil ?? "?";
    const village = r.plot?.village ?? "?";
    const identifier = r.plot?.identifier ?? "?";
    const status = r.pipelineStatus ?? "?";
    const seconds = (r.durationMs / 1000).toFixed(2);
    return `| ${seconds}s | ${status} | ${tahasil} / ${village} / ${identifier} | ${dominant} |`;
  });
  return [
    `# Slowest plots (top ${top})`,
    ``,
    `Plots ranked by total round-trip duration. "Dominant fetcher" is the longest-named fetcher status (heuristic — replace with timing once fetchers report durations).`,
    ``,
    "| Duration | Status | Plot | Dominant fetcher |",
    "| --- | --- | --- | --- |",
    ...rows,
    ``,
  ].join("\n");
}

function dominantFetcher(fr) {
  if (!fr) return null;
  const entries = Object.entries(fr);
  if (entries.length === 0) return null;
  // Heuristic: prefer the one whose status is "failed" or longest key
  const failed = entries.find(([_, v]) => v?.status !== "ok");
  if (failed) return `${failed[0]} (${failed[1]?.status})`;
  return entries[0][0];
}

// ── Top-line summary ─────────────────────────────────────────────────────
function renderSummary(records) {
  const total = records.length;
  const generated = records.filter((r) => r.pipelineStatus === "generated").length;
  const errored = records.filter((r) => r.pipelineStatus === "error").length;
  const failed = total - generated - errored;
  const durations = records.map((r) => r.durationMs ?? 0).sort((a, b) => a - b);
  const median = durations.length > 0 ? durations[Math.floor(durations.length / 2)] : 0;
  const p95 = durations.length > 0 ? durations[Math.floor(durations.length * 0.95)] : 0;
  return [
    `# Shadow run summary`,
    ``,
    `- Total plots: **${total}**`,
    `- Generated: **${generated}** (${total > 0 ? ((generated / total) * 100).toFixed(1) : 0}%)`,
    `- Empty/failed: **${failed}**`,
    `- Errored: **${errored}**`,
    `- Median duration: **${(median / 1000).toFixed(2)}s**`,
    `- p95 duration: **${(p95 / 1000).toFixed(2)}s**`,
    ``,
  ].join("\n");
}

// ── Main ──────────────────────────────────────────────────────────────────
function main() {
  const args = parseArgs(process.argv);
  const records = loadResults(args.input);
  if (records.length === 0) {
    console.error("No records in input file.");
    process.exit(2);
  }

  const runDir = dirname(args.input);
  console.log(`[report] ${records.length} records from ${args.input}`);

  const summary = renderSummary(records);
  const heatmap = renderHeatmap(computeHeatmap(records));
  const failures = renderFailures(computeFailures(records), records.length);
  const slow = renderSlowPlots(computeSlowPlots(records, args.top), args.top);

  writeFileSync(join(runDir, "summary.md"), summary);
  writeFileSync(join(runDir, "coverage_heatmap.md"), heatmap);
  writeFileSync(join(runDir, "failure_distribution.md"), failures);
  writeFileSync(join(runDir, "slow_plots.md"), slow);

  console.log(`[report] wrote:`);
  console.log(`  ${join(runDir, "summary.md")}`);
  console.log(`  ${join(runDir, "coverage_heatmap.md")}`);
  console.log(`  ${join(runDir, "failure_distribution.md")}`);
  console.log(`  ${join(runDir, "slow_plots.md")}`);
  process.exit(0);
}

main();

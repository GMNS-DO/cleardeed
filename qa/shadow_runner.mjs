#!/usr/bin/env node

/**
 * Sprint V4: Shadow runner
 *
 * For every (tahasil, village, plot) combination in qa/khordha_inputs.json, run
 * the real V11 pipeline via HTTP against /api/report/pregenerate, record which
 * fetchers succeeded/failed, which fields were extracted, and which sections
 * degraded. Writes one JSONL line per plot to:
 *
 *   qa/shadow_runs/<run_id>/results.jsonl
 *
 * Shadow mode — this is NOT a test. The script exits 0 even when individual
 * plots fail. The whole point is to find scale-validation problems before a
 * buyer hits them.
 *
 * Per CLAUDE.md §3: no abstractions, no generalized framework. This is one
 * script with three CLI flags and one job.
 *
 * Why HTTP (not direct pipeline import)?
 *   /api/report/pregenerate is the production entry point. The direct TS import
 *   path lives behind a complex Next/Vitest alias graph that's expensive to
 *   invoke from a child process. Exercising the route tests the full request
 *   lifecycle — including the pre-payment validation gate from V4.
 *
 * Usage:
 *   pnpm dev   (in another terminal)
 *   node qa/shadow_runner.mjs
 *   node qa/shadow_runner.mjs --limit 5
 *   node qa/shadow_runner.mjs --limit 50 --concurrency 4
 *   node qa/shadow_runner.mjs --api-url http://localhost:3000
 *
 * Note: the HTTP response carries only the {reportId, status, error, title,
 * html, bhunakshaPolygon} shape (per the route contract). The shadow runner
 * parses the HTML to recover per-fetcher status (a `data-source-status` span
 * the consumer report renders) and validation findings. The fallback is to
 * record only what the route returns, which is still useful for end-to-end
 * timing and success-rate analysis.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const QA_DIR = __dirname;
const DEFAULT_INPUTS = join(QA_DIR, "khordha_inputs.json");
const DEFAULT_RUNS_DIR = join(QA_DIR, "shadow_runs");
const DEFAULT_API_URL = "http://localhost:3000";

// ── CLI args ───────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { limit: Infinity, concurrency: 4, apiUrl: DEFAULT_API_URL, inputs: DEFAULT_INPUTS };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit") out.limit = parseInt(argv[++i], 10);
    else if (a === "--concurrency") out.concurrency = parseInt(argv[++i], 10);
    else if (a === "--api-url") out.apiUrl = argv[++i];
    else if (a === "--inputs") out.inputs = argv[++i];
    else if (a === "--help" || a === "-h") {
      console.log(`Usage: node qa/shadow_runner.mjs [--limit N] [--concurrency N] [--api-url URL] [--inputs FILE]`);
      process.exit(0);
    } else {
      console.error(`Unknown flag: ${a}`);
      process.exit(2);
    }
  }
  if (!Number.isFinite(out.concurrency) || out.concurrency < 1) {
    console.error("--concurrency must be a positive integer");
    process.exit(2);
  }
  return out;
}

// ── Run ID + output paths ─────────────────────────────────────────────────
function newRunId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

// ── Lightweight HTML probing ──────────────────────────────────────────────
// The report HTML embeds the per-fetcher status as a data-source-status
// attribute on the source panel. We extract those without pulling in a parser.
function probeHtml(html) {
  const fetcherStatus = {};
  if (typeof html !== "string") return { fetcherStatus, degradedSections: [] };
  const re = /data-source="([a-z\-]+)"[^>]*data-source-status="([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    fetcherStatus[m[1]] = m[2];
  }
  // "degraded" sections: any data-section with status="degraded"
  const degradedSections = [];
  const de = /data-section="([^"]+)"[^>]*data-section-status="degraded"/g;
  while ((m = de.exec(html))) {
    degradedSections.push(m[1]);
  }
  return { fetcherStatus, degradedSections };
}

// ── Per-plot result ───────────────────────────────────────────────────────
function recordOne(plot, response, startedAt, finishedAt) {
  const probe = probeHtml(response?.html);
  const ok = response?.status === "generated";
  return {
    runId: null,
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
    plot: {
      tahasil: plot.tahasil,
      village: plot.village,
      searchMode: plot.searchMode,
      identifier: plot.identifier,
      tahasilCode: plot.metadata?.tahasilCode,
      villageCode: plot.metadata?.villageCode,
      patternCategory: plot.metadata?.patternCategory,
      notDigitized: plot.metadata?.notDigitized,
    },
    pipelineStatus: response?.status ?? "error",
    httpStatus: response?._httpStatus,
    reportId: response?.reportId ?? null,
    title: response?.title ?? null,
    error: response?.error ?? null,
    fetcherResults: probe.fetcherStatus,
    degradedSections: probe.degradedSections,
    htmlLength: typeof response?.html === "string" ? response.html.length : 0,
  };
}

// ── Per-plot execution ────────────────────────────────────────────────────
async function runOne(plot, apiUrl) {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(`${apiUrl}/api/report/pregenerate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tehsil: plot.tahasil,
        tehsilValue: plot.metadata?.tahasilCode,
        village: plot.village,
        villageCode: plot.metadata?.villageCode,
        searchMode: plot.searchMode,
        identifier: plot.identifier,
      }),
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Not JSON — treat as error
    }
    const finishedAt = Date.now();
    return recordOne(
      plot,
      { ...(json ?? {}), _httpStatus: res.status },
      startedAt,
      finishedAt
    );
  } catch (err) {
    const finishedAt = Date.now();
    return {
      runId: null,
      startedAt,
      finishedAt,
      durationMs: finishedAt - startedAt,
      plot: {
        tahasil: plot.tahasil,
        village: plot.village,
        searchMode: plot.searchMode,
        identifier: plot.identifier,
      },
      pipelineStatus: "error",
      error: err?.name === "AbortError" ? "timeout (90s)" : (err?.message ?? String(err)),
      fetcherResults: {},
      degradedSections: [],
      htmlLength: 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── Concurrency pool ─────────────────────────────────────────────────────
async function runWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function pump() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  const pumps = Array.from({ length: Math.min(concurrency, items.length) }, pump);
  await Promise.all(pumps);
  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);

  if (!existsSync(args.inputs)) {
    console.error(`Inputs file not found: ${args.inputs}`);
    console.error(`Run qa/scripts/enumerate_inputs.mjs first.`);
    process.exit(2);
  }

  const inputs = JSON.parse(readFileSync(args.inputs, "utf-8"));
  const plots = Array.isArray(inputs?.inputs) ? inputs.inputs : [];
  if (plots.length === 0) {
    console.error(`No inputs in ${args.inputs}. Expected { inputs: [...] } shape.`);
    process.exit(2);
  }

  const limit = Number.isFinite(args.limit) ? Math.min(args.limit, plots.length) : plots.length;
  const slice = plots.slice(0, limit);
  const runId = newRunId();
  const runDir = join(DEFAULT_RUNS_DIR, runId);
  mkdirSync(runDir, { recursive: true });
  const resultsPath = join(runDir, "results.jsonl");
  writeFileSync(resultsPath, "");

  // Persist run metadata
  writeFileSync(
    join(runDir, "run.json"),
    JSON.stringify(
      {
        runId,
        startedAt: new Date().toISOString(),
        inputFile: args.inputs,
        apiUrl: args.apiUrl,
        concurrency: args.concurrency,
        totalPlots: plots.length,
        plotsAttempted: slice.length,
        plotTahasilCounts: slice.reduce((acc, p) => {
          acc[p.tahasil] = (acc[p.tahasil] ?? 0) + 1;
          return acc;
        }, {}),
      },
      null,
      2
    )
  );

  console.log(`[shadow] runId=${runId}`);
  console.log(`[shadow] plots=${slice.length}/${plots.length} concurrency=${args.concurrency} api=${args.apiUrl}`);
  console.log(`[shadow] writing → ${resultsPath}`);

  const startMs = Date.now();
  let ok = 0;
  let failed = 0;
  let errored = 0;
  const writeLine = (rec) => appendFileSync(resultsPath, JSON.stringify(rec) + "\n");

  const worker = async (plot, idx) => {
    const rec = await runOne(plot, args.apiUrl);
    rec.runId = runId;
    rec.idx = idx;
    writeLine(rec);
    if (rec.pipelineStatus === "generated") ok++;
    else if (rec.pipelineStatus === "error") errored++;
    else failed++;
    const done = ok + failed + errored;
    if (done % 10 === 0 || done === slice.length) {
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      const rate = (done / Math.max(0.001, (Date.now() - startMs) / 1000)).toFixed(2);
      console.log(`[shadow] progress ${done}/${slice.length} ok=${ok} empty=${failed} errored=${errored} (${rate} plots/s, ${elapsed}s elapsed)`);
    }
    return rec;
  };

  await runWithConcurrency(slice, args.concurrency, worker);

  const totalMs = Date.now() - startMs;
  const summary = {
    runId,
    finishedAt: new Date().toISOString(),
    durationSec: (totalMs / 1000).toFixed(1),
    plotsAttempted: slice.length,
    pipelineGenerated: ok,
    pipelineEmpty: failed,
    pipelineErrored: errored,
    successRate: slice.length > 0 ? (ok / slice.length).toFixed(3) : null,
  };
  writeFileSync(join(runDir, "summary.json"), JSON.stringify(summary, null, 2));

  console.log(`[shadow] DONE in ${summary.durationSec}s — ${summary.pipelineGenerated} generated, ${summary.pipelineEmpty} empty, ${summary.pipelineErrored} errored`);
  console.log(`[shadow] Run dir: ${runDir}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[shadow] fatal:", err);
  process.exit(1);
});

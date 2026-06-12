#!/usr/bin/env node

/**
 * Statistical baseline tool for V1 fetchers.
 *
 * Runs the V1 /api/report/pregenerate pipeline (the same entry point
 * qa/shadow_runner.mjs uses) against a configurable sample of plots from
 * qa/khordha_inputs.json, and produces an empirical baseline JSON in
 * qa/baselines/<run_id>.json. The output captures:
 *
 *   - per_plot:      one record per plot (fetcher statuses, latency, HTML size)
 *   - per_tehsil:    success counts for each (tahasil, fetcher) cell
 *   - per_fetcher:   aggregate success/failure counts across the whole sample
 *   - p50/p95:       round-trip latency percentiles in ms
 *
 * Per CLAUDE.md §3: this is a measurement tool, not a test. It does not assert
 * anything — it just records what the pipeline did. A failing fetcher is
 * interesting data, not a test failure.
 *
 * This script does NOT shell out to qa/shadow_runner.mjs, because the runner is
 * a one-shot CLI that writes JSONL and does not expose its parser. The HTML
 * probe regex is copied verbatim from qa/shadow_runner.mjs (probeHtml, ~line
 * 96) so the per-fetcher status field is byte-identical to what the runner
 * records. If the probe regex changes upstream, this file should be updated.
 *
 * Usage:
 *   pnpm dev   (in another terminal)
 *   node qa/qa_baselines.mjs
 *   node qa/qa_baselines.mjs --sample 50 --concurrency 4
 *   node qa/qa_baselines.mjs --sample 5 --concurrency 2 --api-url http://localhost:3000
 *   node qa/qa_baselines.mjs --sample 10 --seed 42      # deterministic sample
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const QA_DIR = __dirname;
const DEFAULT_INPUTS = join(QA_DIR, "khordha_inputs.json");
const DEFAULT_BASELINES_DIR = join(QA_DIR, "baselines");
const DEFAULT_API_URL = "http://localhost:3000";
const DEFAULT_SAMPLE = 5;
const DEFAULT_CONCURRENCY = 2;

// ── CLI args ───────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {
    sample: DEFAULT_SAMPLE,
    concurrency: DEFAULT_CONCURRENCY,
    apiUrl: DEFAULT_API_URL,
    inputs: DEFAULT_INPUTS,
    seed: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--sample") out.sample = parseInt(argv[++i], 10);
    else if (a === "--concurrency") out.concurrency = parseInt(argv[++i], 10);
    else if (a === "--api-url") out.apiUrl = argv[++i];
    else if (a === "--inputs") out.inputs = argv[++i];
    else if (a === "--seed") out.seed = parseInt(argv[++i], 10);
    else if (a === "--help" || a === "-h") {
      console.log(
        `Usage: node qa/qa_baselines.mjs [--sample N] [--concurrency N] [--api-url URL] [--inputs FILE] [--seed N]`
      );
      process.exit(0);
    } else {
      console.error(`Unknown flag: ${a}`);
      process.exit(2);
    }
  }
  if (!Number.isFinite(out.sample) || out.sample < 1) {
    console.error("--sample must be a positive integer");
    process.exit(2);
  }
  if (!Number.isFinite(out.concurrency) || out.concurrency < 1) {
    console.error("--concurrency must be a positive integer");
    process.exit(2);
  }
  return out;
}

// ── Run ID ─────────────────────────────────────────────────────────────────
function newRunId() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() +
    "-" +
    pad(d.getUTCMonth() + 1) +
    "-" +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    "-" +
    pad(d.getUTCMinutes()) +
    "-" +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

// ── Sampling ───────────────────────────────────────────────────────────────
// Simple seeded LCG so --seed produces a reproducible draw from the inputs.
// Same shape as the deterministic sampler in qa/scripts/enumerate_inputs.mjs.
function makeSeededSampler(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 48271) % 0x7fffffff;
    return state / 0x7fffffff;
  };
}

function samplePlots(plots, n, seed) {
  if (n >= plots.length) return plots.slice();
  const rand = seed != null ? makeSeededSampler(seed) : Math.random;
  // Fisher–Yates partial shuffle, take first n
  const arr = plots.slice();
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rand() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, n);
}

// ── HTML probe ────────────────────────────────────────────────────────────
// The report HTML embeds per-fetcher status inside the #section-source-audit
// table as <tr><td>source-name</td><td>status</td><td>timestamp</td>
// <td>status-reason</td></tr>. We extract rows by matching each known fetcher
// name as a cell. The probe is tolerant of cell order and whitespace.
//
// IMPORTANT: the report HTML contains the fetcher name in many other places
// (e.g. `<a class="prov-link prov-ok">Bhulekh RoR</a>`, verify-yourself links,
// provenance panels). We restrict matching to <td>…</td> cells that appear
// inside a <tr>…</tr> row, which only the source-audit table uses. This
// avoids false matches in other tables.
function probeHtml(html) {
  const fetcherStatus = {};
  if (typeof html !== "string") return fetcherStatus;
  // First, extract just the source-audit panel to keep the regex fast and
  // avoid false matches elsewhere. The panel is bounded by an
  // id="section-source-audit" attribute and a closing </section>.
  const panelMatch = html.match(/<section[^>]*id="section-source-audit"[\s\S]*?<\/section>/i);
  if (!panelMatch) return fetcherStatus;
  const panel = panelMatch[0];
  // Strip newlines so the regex sees each row on one logical line.
  const flat = panel.replace(/\s+/g, " ");
  // Match rows: <tr>...<td>name</td>...<td>status</td>...
  const rowRe = /<tr>\s*<td>([a-z\-]+)<\/td>\s*<td>([a-z_]+)<\/td>/g;
  let m;
  while ((m = rowRe.exec(flat))) {
    const name = m[1];
    const status = m[2];
    if (KNOWN_FETCHERS_SET.has(name) && !(name in fetcherStatus)) {
      fetcherStatus[name] = status;
    }
  }
  return fetcherStatus;
}

// Canonical fetcher keys we expect to see, in the order they appear in the
// report. Unknown keys are still recorded (forward-compat) but these get
// first-class counters in per_tehsil and per_fetcher.
const KNOWN_FETCHERS = [
  "bhulekh",
  "bhunaksha",
  "igr-ec",
  "cersai",
  "ecourts",
  "rccms",
  "circle-rate",
  "bda-zoning",
  "nominatim",
];

// Set form for O(1) lookup in probeHtml. (The probeHtml function above is
// defined before this array on purpose — see the comment block above.)
const KNOWN_FETCHERS_SET = new Set(KNOWN_FETCHERS);

const PER_TEHSIL_FETCHERS = [
  "bhulekh",
  "bhunaksha",
  "igr_ec",
  "cersai",
  "ecourts",
  "rccms",
  "circle_rate",
  "bda_zoning",
  "nominatim",
];

// ── Per-plot execution (mirrors qa/shadow_runner.mjs runOne) ───────────────
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
    return {
      tahasil: plot.tahasil,
      village: plot.village,
      plot_no: plot.identifier,
      fetcher_statuses: probeHtml(json?.html),
      latency_ms: finishedAt - startedAt,
      html_size: typeof json?.html === "string" ? json.html.length : 0,
      _pipelineStatus: json?.status ?? "error",
      _httpStatus: res.status,
      _error: json?.error ?? null,
    };
  } catch (err) {
    const finishedAt = Date.now();
    return {
      tahasil: plot.tahasil,
      village: plot.village,
      plot_no: plot.identifier,
      fetcher_statuses: {},
      latency_ms: finishedAt - startedAt,
      html_size: 0,
      _pipelineStatus: "error",
      _httpStatus: null,
      _error:
        err?.name === "AbortError"
          ? "timeout (90s)"
          : err?.message ?? String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── Concurrency pool (mirrors qa/shadow_runner.mjs runWithConcurrency) ────
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

// ── Aggregation ────────────────────────────────────────────────────────────
// Statuses observed in #section-source-audit don't match the 5-bucket
// histogram we publish. Normalize to: ok | no_data | source_down |
// parse_error | invalid_input. The report-side status vocabulary comes from
// apps/web/src/lib/data-source/types.ts; the runner-side vocabulary is
// documented in qa/README.md (pathway-4 section).
//
// Mapping rule (first match wins):
//   success / ok / found / matched          → ok
//   no_match / no_data / not_digitized      → no_data
//   parse_error / schema_mismatch           → parse_error
//   invalid_input / validation_failed       → invalid_input
//   anything else (failed / source_down / …) → source_down
const STATUS_NORMALIZE = {
  success: "ok",
  ok: "ok",
  found: "ok",
  matched: "ok",
  no_match: "no_data",
  no_data: "no_data",
  not_digitized: "no_data",
  parse_error: "parse_error",
  schema_mismatch: "parse_error",
  invalid_input: "invalid_input",
  validation_failed: "invalid_input",
  failed: "source_down",
  source_down: "source_down",
  unsupported_district: "source_down",
  search_page_unavailable: "source_down",
  probe_skipped: "source_down",
  inline_seed_fallback: "source_down",
  // Sprint-6 probe-skip placeholder:
  rccms_probe_skipped_sprint6_todo: "source_down",
};

function normalizeStatus(raw) {
  if (typeof raw !== "string") return "source_down";
  return STATUS_NORMALIZE[raw] ?? "source_down";
}

function emptyFetcherCounters() {
  const c = { ok: 0, source_down: 0, no_data: 0, parse_error: 0, invalid_input: 0 };
  return c;
}

function emptyTehsilRecord() {
  const rec = { plots: 0 };
  for (const f of PER_TEHSIL_FETCHERS) rec[`${f}_ok`] = 0;
  return rec;
}

function aggregate(records) {
  // per_tehsil: tally "ok" cells per tahasil × fetcher
  const perTehsil = new Map();

  // per_fetcher: aggregate status histogram per fetcher (across all tahasils)
  const perFetcher = new Map();
  for (const f of KNOWN_FETCHERS) {
    perFetcher.set(f, emptyFetcherCounters());
  }

  // Strip internal fields before writing per_plot output
  const perPlotOut = [];

  for (const r of records) {
    const t = r.tahasil ?? "Unknown";
    if (!perTehsil.has(t)) perTehsil.set(t, emptyTehsilRecord());
    const tehsilRec = perTehsil.get(t);
    tehsilRec.plots++;

    // Walk known fetchers. Unknown keys (forward-compat) only update
    // per_fetcher, not per_tehsil — per_tehsil is the contract surface.
    const seen = new Set();
    for (const [key, rawStatus] of Object.entries(r.fetcher_statuses ?? {})) {
      const counter = perFetcher.get(key);
      if (counter) {
        // Normalize the report-side status vocabulary (success/failed/…) to
        // the runner-side histogram (ok/source_down/…). The mapping is
        // defined in STATUS_NORMALIZE above. Unknown statuses fall into
        // source_down as the catch-all "did not produce usable data" bucket.
        const status = normalizeStatus(rawStatus);
        counter[status]++;
      }
      seen.add(key);
    }

    // For per_tehsil we use the underscore-normalized names the spec asks for
    // (igr_ec, circle_rate, bda_zoning). The HTML uses hyphenated names.
    const norm = (key) => key.replace(/-/g, "_");
    for (const fetcherKey of KNOWN_FETCHERS) {
      const rawStatus = r.fetcher_statuses?.[fetcherKey];
      const status = normalizeStatus(rawStatus);
      const tehsilField = `${norm(fetcherKey)}_ok`;
      if (status === "ok" && tehsilField in tehsilRec) {
        tehsilRec[tehsilField]++;
      }
    }

    // Build the per_plot output record (drop internal fields)
    const { _pipelineStatus, _httpStatus, _error, ...publicRec } = r;
    perPlotOut.push(publicRec);
  }

  return {
    perPlotOut,
    perTehsil: Object.fromEntries(perTehsil),
    perFetcher: Object.fromEntries(perFetcher),
  };
}

function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return 0;
  // Nearest-rank percentile — fine for baselines, not for SLAs
  const idx = Math.min(
    sortedArr.length - 1,
    Math.floor((p / 100) * sortedArr.length)
  );
  return sortedArr[idx];
}

// ── API reachability check ─────────────────────────────────────────────────
async function checkApiReachable(apiUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${apiUrl}/`, {
      method: "GET",
      signal: controller.signal,
    });
    return { ok: true, status: res.status };
  } catch (err) {
    return {
      ok: false,
      error:
        err?.name === "AbortError"
          ? "timeout (5s)"
          : err?.message ?? String(err),
    };
  } finally {
    clearTimeout(timer);
  }
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

  // Reachability gate — fail fast with an actionable error if the dev server
  // isn't up. The runner would otherwise time out 5 times in a row.
  console.log(`[baselines] checking API at ${args.apiUrl} ...`);
  const reach = await checkApiReachable(args.apiUrl);
  if (!reach.ok) {
    console.error(
      `\n[baselines] ERROR: API at ${args.apiUrl} is not reachable: ${reach.error}`
    );
    console.error(
      `[baselines] Start the dev server first: pnpm dev (in another terminal)`
    );
    process.exit(2);
  }
  console.log(`[baselines] API reachable (HTTP ${reach.status})`);

  const sample = samplePlots(plots, args.sample, args.seed);
  const runId = newRunId();
  const runAt = new Date().toISOString();

  mkdirSync(DEFAULT_BASELINES_DIR, { recursive: true });
  const outPath = join(DEFAULT_BASELINES_DIR, `${runId}.json`);

  console.log(
    `[baselines] runId=${runId}`
  );
  console.log(
    `[baselines] sample=${sample.length}/${plots.length} concurrency=${args.concurrency} api=${args.apiUrl}${args.seed != null ? ` seed=${args.seed}` : ""}`
  );
  console.log(`[baselines] writing → ${outPath}`);

  const startMs = Date.now();
  let done = 0;

  const worker = async (plot, idx) => {
    const rec = await runOne(plot, args.apiUrl);
    done++;
    if (done % 5 === 0 || done === sample.length) {
      const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);
      const rate = (done / Math.max(0.001, (Date.now() - startMs) / 1000)).toFixed(2);
      console.log(
        `[baselines] progress ${done}/${sample.length} (${rate} plots/s, ${elapsed}s elapsed)`
      );
    }
    return rec;
  };

  const records = await runWithConcurrency(sample, args.concurrency, worker);

  const totalMs = Date.now() - startMs;

  const { perPlotOut, perTehsil, perFetcher } = aggregate(records);

  const latencies = records
    .map((r) => r.latency_ms)
    .filter((n) => typeof n === "number")
    .sort((a, b) => a - b);

  const output = {
    run_id: runId,
    run_at: runAt,
    sample_size: sample.length,
    concurrency: args.concurrency,
    api_url: args.apiUrl,
    seed: args.seed,
    inputs_file: args.inputs,
    duration_ms: totalMs,
    per_plot: perPlotOut,
    per_tehsil: perTehsil,
    per_fetcher: perFetcher,
    p50_latency_ms: percentile(latencies, 50),
    p95_latency_ms: percentile(latencies, 95),
  };

  writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(
    `\n[baselines] DONE in ${(totalMs / 1000).toFixed(1)}s — ${records.length} plots sampled`
  );
  console.log(
    `[baselines] p50=${output.p50_latency_ms}ms p95=${output.p95_latency_ms}ms`
  );
  console.log(`[baselines] wrote: ${outPath}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[baselines] fatal:", err);
  process.exit(1);
});

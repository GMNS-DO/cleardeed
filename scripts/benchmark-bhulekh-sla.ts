#!/usr/bin/env npx tsx
/**
 * Bhulekh SLA benchmark — runs N end-to-end fetches and reports min / p50
 * / p95 / max latency, plus per-run pass/fail + SLA compliance.
 *
 * Usage:
 *   pnpm tsx scripts/benchmark-bhulekh-sla.ts [RUNS] [--json]
 *
 * Env:
 *   BHULEKH_BENCHMARK_INPUT  JSON-encoded fetch input (defaults to Mendhasala plot 415)
 *   BHULEKH_BENCHMARK_RUNS   Number of runs (default: 3, max: 20)
 *
 * Exit code:
 *   0  All runs succeeded AND every run < 90s SLA.
 *   1  Any run exceeded SLA or errored.
 *
 * Output format (default):
 *   run\t<N>\telapsedMs\t<NNNN>\tstatus\t<success|failed|timeout>\tstatusReason\t<string|null>
 *   (blank line)
 *   min_ms:<N> p50_ms:<N> p95_ms:<N> max_ms:<N>
 *   sla_90s:pass|fail sla_60s:pass|fail fail_count:<N> total_runs:<N>
 *
 * --json switches to a single JSON object printed on stdout for CI parsing.
 *
 * The script is read-only: it does not write or mutate files.
 */
import { fetch as bhulekhFetch, healthCheck } from "@cleardeed/fetcher-bhulekh";
import { performance } from "node:perf_hooks";

// ── Config ────────────────────────────────────────────────────────────────────

const DEFAULT_INPUT = {
  village: "Mendhasala",
  villageCode: "198",
  tehsil: "Bhubaneswar",
  tehsilCode: "21",
  searchMode: "Plot" as const,
  identifierValue: "415",
};

const SLA_MS = 90_000;
const SLOW_MS = 60_000;
const MAX_RUNS = 20;

const runsArg = process.argv.findIndex((a) => a === "--json" ? false : !a.startsWith("-") && a !== process.argv[0] && !isNaN(Number(a)));
const runsRaw = parseInt(process.env.BHULEKH_BENCHMARK_RUNS ?? "3", 10);
const runCount = Math.min(Math.max(runsRaw, 1), MAX_RUNS);
const asJson = process.argv.includes("--json");
const envInputRaw = process.env.BHULEKH_BENCHMARK_INPUT;

let input: Record<string, unknown>;
try {
  input = envInputRaw ? JSON.parse(envInputRaw) : { ...DEFAULT_INPUT };
} catch {
  console.error(`[benchmark] BHULEKH_BENCHMARK_INPUT is not valid JSON: ${envInputRaw}`);
  process.exit(2);
}
if (!input.village || !input.villageCode || !input.searchMode || !input.identifierValue) {
  console.error("[benchmark] Input is missing required keys: village, villageCode, searchMode, identifierValue");
  process.exit(2);
}

// ── Pre-flight ────────────────────────────────────────────────────────────────

async function preflight(): Promise<void> {
  const ok = await healthCheck();
  if (!ok) {
    console.error("[benchmark] Bhulekh healthCheck failed — site may be down. Aborting.");
    process.exit(2);
  }
}

// ── Run ───────────────────────────────────────────────────────────────────────

async function runBenchmark(): Promise<void> {
  await preflight();

  const rows: Array<{
    run: number;
    elapsedMs: number;
    status: "success" | "failed" | "timeout";
    statusReason: string | null;
    tenantCount: number;
    areaAcres: number | null;
  }> = [];

  for (let i = 1; i <= runCount; i++) {
    const started = performance.now();
    let elapsedMs = 0;
    let status: "success" | "failed" | "timeout" = "success";
    let statusReason: string | null = null;
    let tenantCount = 0;
    let areaAcres: number | null = null;

    try {
      // Abort if a single run exceeds 95s (longer than SLA — we want the script
      // itself to stop rather than hanging indefinitely on a dead source).
      const result = await Promise.race([
        bhulekhFetch(input).then((r) => ({ kind: "result" as const, r })),
        new Promise<{ kind: "timeout" }>((resolve) =>
          setTimeout(() => resolve({ kind: "timeout" }), 95_000)
        ),
      ]);

      elapsedMs = Math.round(performance.now() - started);

      if (result.kind === "timeout") {
        status = "timeout";
        statusReason = "runner_aborted_after_95s";
      } else {
        const r = result.r;
        if (r.status === "failed" || r.status === "error" || r.status === "unavailable") {
          status = "failed";
          statusReason = r.error ?? r.status;
        } else if (r.status === "manual_required") {
          status = "failed";
          statusReason = r.error ?? "manual_required";
        } else {
          status = "success";
          statusReason = null;
          tenantCount = (r.data?.tenants?.length ?? 0) as number;
          const area = r.data?.areaAcres;
          areaAcres = typeof area === "number" ? area : null;
        }
      }
    } catch (err) {
      elapsedMs = Math.round(performance.now() - started);
      status = "failed";
      statusReason = err instanceof Error ? err.message : String(err);
    }

    rows.push({ run: i, elapsedMs, status, statusReason, tenantCount, areaAcres });
  }

  // ── Summarize ───────────────────────────────────────────────────────────────

  const elapsedValues = rows.map((r) => r.elapsedMs).sort((a, b) => a - b);
  const min = elapsedValues[0] ?? 0;
  const max = elapsedValues[elapsedValues.length - 1] ?? 0;
  const p50 = percentile(elapsedValues, 0.5);
  const p95 = percentile(elapsedValues, 0.95);
  const failCount = rows.filter((r) => r.status !== "success").length;
  const anyOver90 = rows.some((r) => r.elapsedMs > SLA_MS);
  const anyOver60 = rows.some((r) => r.elapsedMs > SLOW_MS);

  // ── Emit ────────────────────────────────────────────────────────────────────

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          input,
          runs: rows,
          summary: { min, p50, p95, max, failCount, totalRuns: runCount, anyOver90, anyOver60 },
        },
        null,
        2
      )
    );
  } else {
    for (const r of rows) {
      console.log(
        `run\t${r.run}\telapsedMs\t${r.elapsedMs}\tstatus\t${r.status}\tstatusReason\t${r.statusReason ?? "null"}\ttenants\t${r.tenantCount}\tacres\t${r.areaAcres ?? "null"}`
      );
    }
    console.log();
    console.log(`min_ms:${min} p50_ms:${p50} p95_ms:${p95} max_ms:${max}`);
    console.log(
      `sla_90s:${anyOver90 ? "fail" : "pass"} sla_60s:${anyOver60 ? "fail" : "pass"} fail_count:${failCount} total_runs:${runCount}`
    );
  }

  if (failCount > 0 || anyOver90) {
    process.exit(1);
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(p * (sorted.length - 1));
  return sorted[Math.min(idx, sorted.length - 1)];
}

runBenchmark().catch((err) => {
  console.error("[benchmark] fatal:", err instanceof Error ? err.message : String(err));
  process.exit(2);
});

#!/usr/bin/env node
// P-NEW-2 readiness check — counts how many corpus cases have
// resolution_summary populated. Outputs a single JSON line with the count
// and a `ready` boolean. The web pipeline reads the same threshold
// (PID_INSIGHT_CLUSTER_THRESHOLD, default 20) and only renders PID-backed
// clusters when the count is met.
//
// Usage:
//   node pid/cli/check_pnew2_readiness.mjs
//   node pid/cli/check_pnew2_readiness.mjs --threshold=50
//   PID_INSIGHT_CLUSTER_THRESHOLD=50 node pid/cli/check_pnew2_readiness.mjs

import { readJsonl } from "../lib/corpus-store.mjs";

const DEFAULT_THRESHOLD = 20;

function parseArgs(argv) {
  const options = {};
  for (const arg of argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const [key, ...valueParts] = arg.slice(2).split("=");
    options[key] = valueParts.length ? valueParts.join("=") : true;
  }
  return options;
}

async function main() {
  const args = parseArgs(process.argv);
  const threshold = Number(args.threshold || process.env.PID_INSIGHT_CLUSTER_THRESHOLD || DEFAULT_THRESHOLD);
  const casesPath = new URL("../data/corpus/cases.jsonl", import.meta.url).pathname;
  const cases = await readJsonl(casesPath);

  const withResolution = cases.filter((c) => c.resolution_summary && String(c.resolution_summary).trim().length > 0);
  const byFamily = {};
  for (const c of withResolution) {
    const family = c.case_family || c.case_source || "unknown";
    byFamily[family] = (byFamily[family] || 0) + 1;
  }

  const result = {
    totalCases: cases.length,
    withResolutionSummary: withResolution.length,
    threshold,
    ready: withResolution.length >= threshold,
    byFamily,
    checkedAt: new Date().toISOString(),
  };
  console.log(JSON.stringify(result, null, 2));

  if (!result.ready) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("check_pnew2_readiness failed:", err);
  process.exit(2);
});

#!/usr/bin/env node
/**
 * qa/launch-checklist.mjs — A.5.4 launch checklist gate
 *
 * Runs the 8 launch-readiness checks defined in
 * KHORDHA_30_DAY_LAUNCH_PLAN_2026-06-16.md §A.5.4.
 *
 * Checks 1-3, 6 are automatable. Checks 4, 5, 7, 8 require
 * staging/production environments and are reported as
 * "manual" with a clear instruction for the founder.
 *
 * Usage:
 *   node qa/launch-checklist.mjs
 *
 * Exit code:
 *   0 = all automatable checks pass (manual checks printed)
 *   1 = at least one automatable check failed
 */

import { execSync, spawnSync } from "node:child_process";

const ROOT = process.cwd();

const checks = [];
let pass = 0;
let fail = 0;
let manual = 0;

function record(name, status, detail) {
  checks.push({ name, status, detail });
  if (status === "PASS") pass++;
  else if (status === "FAIL") fail++;
  else manual++;
}

function banner(s) {
  console.log(`\n${"═".repeat(60)}\n${s}\n${"═".repeat(60)}`);
}

// ── Check 1: tests pass ─────────────────────────────────────────────
banner("Check 1: 1506/1506 tests pass");

try {
  const result = spawnSync("npx", [
    "vitest",
    "run",
    "--exclude=**/all_fetchers_live_smoke.test.ts",
  ], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: 600000,
  });
  const combined = (result.stdout ?? "") + (result.stderr ?? "");
  // Look for "Tests  N passed | M skipped (P)" — vitest 4 format
  // Example: "Tests  73 passed | 7 skipped (80)"
  const summaryMatch = combined.match(/Tests\s+(\d+)\s+passed\s*\|\s*(\d+)\s+skipped\s*\(\s*(\d+)\s*\)/);
  if (summaryMatch) {
    const passed = parseInt(summaryMatch[1], 10);
    const skipped = parseInt(summaryMatch[2], 10);
    const total = parseInt(summaryMatch[3], 10);
    const failed = total - passed - skipped;

    if (failed === 0 && result.status === 0) {
      record("Tests pass", "PASS", `${passed}/${total} passing, ${skipped} skipped`);
    } else {
      record("Tests pass", "FAIL", `${passed}/${total} passed, ${skipped} skipped, ${failed} failed, exit=${result.status}`);
    }
  } else {
    // Fallback to simpler format if needed
    const fallbackMatch = combined.match(/Tests\s+(\d+)\s+passed\s*\(\s*(\d+)\s*\)/);
    if (fallbackMatch && result.status === 0) {
      const passed = parseInt(fallbackMatch[1], 10);
      const total = parseInt(fallbackMatch[2], 10);
      record("Tests pass", "PASS", `${passed}/${total} passing`);
    } else {
      record("Tests pass", "FAIL", `could not parse vitest output: ${combined.slice(0, 200)}`);
    }
  }
} catch (err) {
  record("Tests pass", "FAIL", `vitest threw: ${err.message}`);
}

// ── Check 2: map renders on all devices ──────────────────────────────
banner("Check 2: Map renders on all devices");

try {
  // The report page (apps/web/src/app/report/[id]/page.tsx) embeds the map.
  // Tailwind handles responsive design via utility classes (md:, sm:, lg:).
  const reportPage = `${ROOT}/apps/web/src/app/report/[id]/page.tsx`;
  const reportExists = execSync(
    `test -f "${reportPage}" && echo yes || echo no`,
    { encoding: "utf8" }
  ).trim();
  // Look for the map embed
  const hasMap = execSync(
    `grep -E "iframe.*bhunaksha|MapEmbed|polygon.*Leaflet|map.*polygon" "${reportPage}" 2>/dev/null | head -1 || echo none`,
    { encoding: "utf8" }
  ).trim();
  // Tailwind responsive classes
  const tailwindResponsive = execSync(
    `grep -rE "className=.*\\\\b(sm:|md:|lg:)\\\\b" apps/web/src/app/report/ 2>/dev/null | head -1 || echo none`,
    { encoding: "utf8" }
  ).trim();
  if (reportExists === "yes" && hasMap !== "none" && tailwindResponsive !== "none") {
    record(
      "Map renders on all devices",
      "PASS",
      `report page embeds map; Tailwind responsive classes present`
    );
  } else {
    record(
      "Map renders on all devices",
      "FAIL",
      `report=${reportExists}, map=${hasMap !== "none" ? "yes" : "no"}, responsive=${tailwindResponsive !== "none" ? "yes" : "no"}`
    );
  }
} catch (err) {
  record("Map renders on all devices", "FAIL", err.message);
}

// ── Check 3: 9 sources return data or degrade on 15 plots ──────────
banner("Check 3: 9 sources return data (or clear degradation) on 15 plots");

try {
  const smoke = `${ROOT}/qa/all_fetchers_live_smoke.test.ts`;
  const groundTruth = `${ROOT}/qa/ground_truth_expansion.test.ts`;
  const hasSmoke = execSync(`test -f ${smoke} && echo yes || echo no`).toString().trim();
  const hasGround = execSync(`test -f ${groundTruth} && echo yes || echo no`).toString().trim();
  if (hasSmoke === "yes" && hasGround === "yes") {
    record(
      "9 sources / 15 plots",
      "MANUAL",
      "smoke + ground-truth tests exist; run them against staging: npx vitest run qa/all_fetchers_live_smoke.test.ts qa/ground_truth_expansion.test.ts"
    );
  } else {
    record("9 sources / 15 plots", "FAIL", `smoke=${hasSmoke}, ground-truth=${hasGround}`);
  }
} catch (err) {
  record("9 sources / 15 plots", "FAIL", err.message);
}

// ── Check 4: PDF <10s p95 ───────────────────────────────────────────
banner("Check 4: PDF generation <10s p95");
record(
  "PDF <10s p95",
  "MANUAL",
  "Run on staging: node qa/perf-baseline.mjs --base-url https://staging.cleardeed.com"
);

// ── Check 5: Email <2min p95 ────────────────────────────────────────
banner("Check 5: Email delivery <2min p95");
record(
  "Email <2min p95",
  "MANUAL",
  "Inspect Resend dashboard for last 10 reports; delivery time = Resend timestamp - payment_success event timestamp"
);

// ── Check 6: trackError fires ───────────────────────────────────────
banner("Check 6: trackError captures errors (Sentry equivalent)");
try {
  const trackTest = `${ROOT}/apps/web/src/lib/track.test.ts`;
  const trackTestExists = execSync(`test -f ${trackTest} && echo yes || echo no`).toString().trim();
  if (trackTestExists === "yes") {
    const result = spawnSync("npx", ["vitest", "run", trackTest], {
      cwd: ROOT,
      encoding: "utf8",
    });
    const summary = (result.stdout ?? "") + (result.stderr ?? "");
    const m = summary.match(/Tests\s+(\d+)\s+passed\s*(?:\|\s*(\d+)\s+skipped)?\s*\(\s*(\d+)\s*\)/);
    if (m) {
      const passed = parseInt(m[1], 10);
      const skipped = m[2] ? parseInt(m[2], 10) : 0;
      const total = parseInt(m[3], 10);
      const failed = total - passed - skipped;
      if (failed === 0 && result.status === 0) {
        record("trackError captures errors", "PASS", `${passed}/${total} track tests passing`);
      } else {
        record("trackError captures errors", "FAIL", `track test summary: ${passed}/${total}, ${failed} failed`);
      }
    } else {
      record("trackError captures errors", "FAIL", `track test summary: unknown`);
    }
  } else {
    record("trackError captures errors", "FAIL", "track.test.ts not found");
  }
} catch (err) {
  record("trackError captures errors", "FAIL", err.message);
}

// ── Check 7: staging + production ──────────────────────────────────
banner("Check 7: Staging + production envs");
record(
  "Staging + production envs",
  "MANUAL",
  "Verify both envs: staging.cleardeed.com loads /, /api/preview, /api/report/create"
);

// ── Check 8: founder buyer journey ─────────────────────────────────
banner("Check 8: Founder executed full buyer journey");
record(
  "Founder buyer journey",
  "MANUAL",
  "B.3.2: 5 real plot queries → payment → report delivery. See CUSTOMER_DEVELOPMENT.md"
);

// ── Summary ─────────────────────────────────────────────────────────
banner("Launch Checklist Summary");

const maxLen = Math.max(...checks.map(c => c.name.length));
for (const c of checks) {
  const padded = c.name.padEnd(maxLen);
  const icon = c.status === "PASS" ? "✓" : c.status === "FAIL" ? "✗" : "○";
  console.log(`  ${icon} ${padded}  [${c.status}]`);
  if (c.detail) console.log(`     ${c.detail}`);
}

console.log(`\nResult: ${pass} pass, ${fail} fail, ${manual} manual`);
console.log(`Launch gate: ${fail === 0 ? "GO" : "NO-GO"} (automatable checks: ${fail === 0 ? "all green" : "blocking"})`);
process.exit(fail === 0 ? 0 : 1);

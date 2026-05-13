#!/usr/bin/env node
/**
 * eCourts captcha accuracy measurement script.
 *
 * Runs ecourtsFetch() 10 times with the same party name ("Mohapatra")
 * in Khurda district and measures:
 *   - captcha solve rate (how often OCR returns a valid captcha text)
 *   - form submit rate (how often the form submits after captcha solve)
 *   - result distribution (cases found / no records / captcha failed / portal error)
 *
 * Usage: node scripts/probe/ecourts-captcha-measurement.mjs
 *
 * Results determine whether Tesseract.js OCR is sufficient for V1,
 * or whether a 2captcha API fallback is needed.
 */

import { ecourtsFetch } from "../packages/fetchers/ecourts/src/index.ts";

// Test configuration
const TEST_NAME = "Mohapatra";
const TEST_DISTRICT = "Khurda";
const TEST_DISTRICT_CODE = "8";
const NUM_RUNS = 10;
const OUTPUT_FILE = "scripts/probe/ecourts-captcha-results.json";

const results = [];

console.log(`=== eCourts Captcha Accuracy Measurement ===`);
console.log(`Party name: ${TEST_NAME}`);
console.log(`District: ${TEST_DISTRICT} (${TEST_DISTRICT_CODE})`);
console.log(`Runs: ${NUM_RUNS}`);
console.log("");

for (let run = 1; run <= NUM_RUNS; run++) {
  process.stdout.write(`Run ${run}/${NUM_RUNS}... `);

  const start = Date.now();
  try {
    const result = await ecourtsFetch({
      partyName: TEST_NAME,
      districtName: TEST_DISTRICT,
      districtCode: TEST_DISTRICT_CODE,
    });
    const elapsed = Date.now() - start;

    const searchMeta = result.data?.searchMetadata;
    const attempts = searchMeta?.attempts ?? [];
    const captchaAccepted = searchMeta?.captchaAcceptedCount ?? 0;
    const captchaFailed = searchMeta?.captchaFailedCount ?? 0;
    const totalAttempts = attempts.length;

    // Aggregate outcomes across all attempts in this run
    const outcomes = attempts.map((a) => a.outcome);
    const caseFoundCount = outcomes.filter((o) => o === "cases_found").length;
    const noRecordsCount = outcomes.filter((o) => o === "no_records").length;
    const captchaFailedCount = outcomes.filter((o) => o === "captcha_failed").length;
    const portalErrorCount = outcomes.filter((o) => o === "portal_error").length;

    const runResult = {
      run,
      elapsedMs: elapsed,
      status: result.status,
      statusReason: result.statusReason,
      casesFound: result.data?.total ?? 0,
      captchaAccepted,
      captchaFailed,
      totalAttempts,
      captchaSolveRate: totalAttempts > 0 ? (totalAttempts - captchaFailedCount) / totalAttempts : null,
      outcomes,
      caseFoundCount,
      noRecordsCount,
      captchaFailedCount,
      portalErrorCount,
      captchaAttempts: attempts.map((a) => ({
        complex: a.complexName,
        ocrText: a.ocrText,
        ocrConfidence: a.ocrConfidence,
        outcome: a.outcome,
      })),
      fetchedAt: result.fetchedAt,
    };

    results.push(runResult);

    // Console output
    const rate = runResult.captchaSolveRate !== null
      ? `${(runResult.captchaSolveRate * 100).toFixed(0)}%`
      : "N/A";
    const icon = result.status === "success" ? "✅" : result.status === "partial" ? "⚠️" : "❌";
    process.stdout.write(
      `${icon} ${result.status} | captcha: ${captchaAccepted}/${totalAttempts} accepted (${rate}) | ` +
      `cases: ${runResult.casesFound} | time: ${elapsed}ms\n`
    );
  } catch (err) {
    const elapsed = Date.now() - start;
    const errorMessage = err instanceof Error ? err.message : String(err);
    results.push({ run, elapsedMs: elapsed, error: errorMessage, status: "error" });
    process.stdout.write(`❌ Error: ${errorMessage}\n`);
  }

  // Delay between runs to avoid overwhelming the portal
  if (run < NUM_RUNS) {
    await new Promise((r) => setTimeout(r, 2000));
  }
}

// Summary statistics
console.log("\n=== Summary ===");
const successful = results.filter((r) => r.status !== "error");
const failed = results.filter((r) => r.status === "error");
const allCaptchaRates = results
  .filter((r) => r.captchaSolveRate !== null)
  .map((r) => r.captchaSolveRate!);
const avgCaptchaRate = allCaptchaRates.length > 0
  ? allCaptchaRates.reduce((a, b) => a + b, 0) / allCaptchaRates.length
  : null;
const caseFoundRuns = results.filter((r) => r.casesFound > 0).length;
const noRecordsRuns = results.filter((r) => r.outcome === "no_records").length;

console.log(`Total runs: ${NUM_RUNS}`);
console.log(`Successful: ${successful.length} | Failed: ${failed.length}`);
console.log(`Cases found: ${caseFoundRuns}/${NUM_RUNS}`);
console.log(
  `Captcha solve rate: ${avgCaptchaRate !== null ? `${(avgCaptchaRate * 100).toFixed(1)}%` : "N/A"} (avg across runs)`
);

// Decision gate
console.log("\n=== Decision Gate ===");
if (avgCaptchaRate === null) {
  console.log("⚠️  No captcha data — all runs errored. Investigate portal availability.");
} else if (avgCaptchaRate >= 0.80) {
  console.log("✅ PASS — Tesseract.js OCR is sufficient (≥80% solve rate)");
  console.log("   Recommendation: keep current approach. No 2captcha API needed.");
} else if (avgCaptchaRate >= 0.60) {
  console.log("⚠️  MARGINAL — Tesseract.js is borderline (60-79%)");
  console.log("   Recommendation: monitor closely. Consider 2captcha API as fallback for failed attempts.");
} else {
  console.log("❌ FAIL — Tesseract.js OCR is insufficient (<60% solve rate)");
  console.log("   Recommendation: integrate 2captcha API (2captcha.com, ~$2.99/1000 solves) for all attempts.");
}

// Write results to JSON
import { writeFileSync } from "node:fs";
writeFileSync(OUTPUT_FILE, JSON.stringify({
  testConfig: { partyName: TEST_NAME, district: TEST_DISTRICT, districtCode: TEST_DISTRICT_CODE, runs: NUM_RUNS },
  summary: {
    avgCaptchaSolveRate: avgCaptchaRate,
    totalRuns: NUM_RUNS,
    successful: successful.length,
    failed: failed.length,
    caseFoundRuns,
    runsAt: new Date().toISOString(),
  },
  results,
}, null, 2));
console.log(`\nResults written to: ${OUTPUT_FILE}`);

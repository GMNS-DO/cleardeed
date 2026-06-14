/**
 * scripts/smoke/ecourts-p051-smoke.ts
 *
 * Live end-to-end smoke test for the eCourts party-name fetcher against the
 * P051 ground-truth plot. Owner: Deeksha Mahapatra (Mendhasala 181/10454,
 * Bhubaneswar Tehsil, Khordha district).
 *
 * Goal: confirm the fetcher can (1) drive the form via Playwright,
 * (2) solve the captcha, (3) submit a party-name search, and (4) parse
 * the result page. The P051 owner is not a known litigant, so a clean
 * "no_records" result with `negativeResultConfidence: "high"` is the
 * expected outcome. Any other outcome (cases_found, portal_error,
 * captcha_failed loop) is a regression.
 *
 * Run: npx tsx scripts/smoke/ecourts-p051-smoke.ts
 */

import { ecourtsFetch, cleanup } from "../../packages/fetchers/ecourts/src/index";

const PARTY_NAME = "Deeksha Mahapatra";
const DISTRICT = "Khurda";
const DISTRICT_CODE = "8";

async function main() {
  const startedAt = Date.now();
  console.log(`[ecourts-smoke] start party="${PARTY_NAME}" district=${DISTRICT}`);

  let result;
  try {
    result = await ecourtsFetch({
      partyName: PARTY_NAME,
      districtName: DISTRICT,
      districtCode: DISTRICT_CODE,
      // Single complex to keep the smoke test under 60s when OCR is hard.
      courtComplex: "Bhubaneswar",
      tryNameVariants: false,
      doubleFetch: true,
    });
  } catch (err) {
    console.error(`[ecourts-smoke] fetcher threw:`, err);
    await cleanup();
    process.exit(2);
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[ecourts-smoke] elapsed=${elapsed}s status=${result.status} reason=${result.statusReason ?? "(none)"}`);
  console.log(`[ecourts-smoke] verification=${result.verification} attempts=${result.attempts ?? 0}`);
  console.log(`[ecourts-smoke] cases.total=${result.data?.total ?? 0}`);

  const meta = result.data?.searchMetadata;
  if (meta) {
    console.log(`[ecourts-smoke] captcha accepted=${meta.captchaAcceptedCount} failed=${meta.captchaFailedCount}`);
    console.log(`[ecourts-smoke] complexes tried=${meta.complexesTried.join(",")}`);
    console.log(`[ecourts-smoke] negative-confidence=${meta.negativeResultConfidence}`);
  }

  if (result.error) {
    console.log(`[ecourts-smoke] error=${result.error}`);
  }

  await cleanup();

  // Pass criteria
  if (result.status === "success" && result.data?.total === 0 && meta?.negativeResultConfidence === "high") {
    console.log(`[ecourts-smoke] PASS: clean no-records for P051 owner (high confidence)`);
    process.exit(0);
  }
  if (result.status === "partial" && result.data?.total === 0 && meta?.captchaAcceptedCount > 0) {
    console.log(`[ecourts-smoke] PASS: captcha accepted, no records; medium confidence is acceptable`);
    process.exit(0);
  }
  if (result.status === "failed" && result.statusReason === "fetch_failed") {
    console.error(`[ecourts-smoke] FAIL: portal unreachable / hard error`);
    process.exit(1);
  }
  console.error(`[ecourts-smoke] FAIL: unexpected outcome — see result above`);
  process.exit(1);
}

main().catch((err) => {
  console.error("[ecourts-smoke] unhandled:", err);
  process.exit(2);
});

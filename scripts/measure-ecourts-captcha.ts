/**
 * scripts/measure-ecourts-captcha.ts
 *
 * Measures eCourts captcha solve rate over 10+ searches with different surnames.
 * Tests Tesseract.js OCR accuracy with and without image preprocessing.
 *
 * Run: npx tsx scripts/measure-ecourts-captcha.ts
 */

import { chromium } from "playwright";
import { createWorker } from "tesseract.js";

const BASE_URL = "https://services.ecourts.gov.in/ecourtindia_v6";
const ODISHA_STATE_CODE = "11";
const KHURDA_DISTRICT_CODE = "8";
const USER_AGENT = "ClearDeed/1.0 (captcha measurement; contact@cleardeed.in)";

const TEST_SURNAMES = [
  "Mohapatra",
  "Panda",
  "Das",
  "Nayak",
  "Pradhan",
  "Rout",
  "Ray",
  "Swain",
  "Barik",
  "Palei",
];

const COURT_COMPLEXES = [
  { name: "Bhubaneswar", value: "1110045@2,3,4@Y" },
  { name: "Khurda", value: "1110044@5,6,7@Y" },
];

// ─── Image preprocessing strategies ──────────────────────────────────────────

interface PreprocessingResult {
  strategy: string;
  imageDataUrl: string;
  text: string;
  confidence: number;
  isValid: boolean;
}

/**
 * Pre-process captcha image before OCR.
 * Strategies:
 * 1. original — raw image
 * 2. grayscale — convert to grayscale for better OCR
 * 3. contrast — increase contrast 2x
 * 4. threshold — binarize (black/white)
 * 5. invert + threshold — for light-background captchas
 */
async function preprocessCaptchaImage(
  imageUrl: string,
  page: { evaluate: (fn: (...args: unknown[]) => Promise<unknown>, url: string) => Promise<string> }
): Promise<PreprocessingResult[]> {
  const fullUrl = imageUrl.startsWith("http") ? imageUrl : `${BASE_URL}${imageUrl}`;

  // Capture raw image
  const original = await page.evaluate(async (url: string) => {
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.src = url;
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = rej;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  }, fullUrl);

  // Preprocess with canvas filters
  const preprocessed = await page.evaluate(async (url: string) => {
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.src = url;
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = rej;
    });

    const results: Array<{ strategy: string; imageDataUrl: string }> = [];

    const strategies = [
      {
        name: "original",
        filter: "",
      },
      {
        name: "grayscale",
        filter: "grayscale(100%)",
      },
      {
        name: "contrast+200",
        filter: "contrast(200%)",
      },
      {
        name: "brightness+150",
        filter: "brightness(150%)",
      },
      {
        name: "threshold-bw",
        filter: "grayscale(100%) contrast(300%)",
      },
    ];

    for (const s of strategies) {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.filter = s.filter;
      ctx.drawImage(img, 0, 0);
      results.push({ strategy: s.name, imageDataUrl: c.toDataURL("image/png") });
    }

    return results;
  }, fullUrl);

  // Run OCR on each preprocessed variant
  const ocrResults: PreprocessingResult[] = [];
  for (const variant of preprocessed) {
    const worker = await createWorker("eng");
    const { data } = await worker.recognize(variant.imageDataUrl);
    await worker.terminate();

    const rawText = data.text ?? "";
    const confidence = data.confidence ?? 0;
    const cleaned = rawText.replace(/[^A-Z0-9]/gi, "").toUpperCase().substring(0, 8);
    const isValid = /^[A-Z0-9]{4,8}$/i.test(cleaned) && cleaned.length >= 4;

    ocrResults.push({
      strategy: variant.strategy,
      imageDataUrl: variant.imageDataUrl,
      text: cleaned,
      confidence,
      isValid,
    });
  }

  return ocrResults;
}

// ─── Run single search ─────────────────────────────────────────────────────────

interface CaptchaRunResult {
  surname: string;
  captchaTexts: string[];
  confidences: number[];
  attempts: number;
  success: boolean;
  validCaptchas: number;
  bestStrategy: string;
  bestText: string;
  bestConfidence: number;
  casesFound: boolean;
  caseCount: number;
  error?: string;
}

async function runCaptchaTest(surname: string): Promise<CaptchaRunResult> {
  const browser = await chromium.launch({ headless: true });
  let page = await browser.newPage();
  await page.setExtraHTTPHeaders({ "User-Agent": USER_AGENT });

  const runResult: CaptchaRunResult = {
    surname,
    captchaTexts: [],
    confidences: [],
    attempts: 0,
    success: false,
    validCaptchas: 0,
    bestStrategy: "unknown",
    bestText: "",
    bestConfidence: 0,
    casesFound: false,
    caseCount: 0,
  };

  try {
    // Setup form
    await page.goto(`${BASE_URL}/?p=casestatus/index`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    await page.waitForTimeout(500);

    await page.selectOption("#sess_state_code", ODISHA_STATE_CODE);
    await page.waitForFunction(
      () => document.querySelectorAll("#sess_dist_code option").length > 2,
      { timeout: 15_000 }
    );
    await page.selectOption("#sess_dist_code", KHURDA_DISTRICT_CODE);
    await page.waitForFunction(
      () => document.querySelectorAll("#court_complex_code option").length > 1,
      { timeout: 15_000 }
    );

    // Select first court complex
    const complex = COURT_COMPLEXES[0];
    await page.selectOption("#court_complex_code", complex.value);
    await page.waitForTimeout(500);

    // Focus party name field to trigger captcha render
    await page.focus("#petres_name");
    await page.waitForSelector("#captcha_image", { timeout: 10_000 });
    await page.waitForTimeout(500);

    // Get captcha image URL
    const captchaImgSrc = await page.$eval("#captcha_image", (el) => (el as HTMLImageElement).src);

    // Run preprocessing + OCR on captcha
    const ocrResults = await preprocessCaptchaImage(captchaImgSrc, page as any);
    runResult.attempts = ocrResults.length;
    runResult.captchaTexts = ocrResults.map((r) => r.text);
    runResult.confidences = ocrResults.map((r) => r.confidence);
    runResult.validCaptchas = ocrResults.filter((r) => r.isValid).length;

    // Find best result
    const validResults = ocrResults.filter((r) => r.isValid);
    if (validResults.length > 0) {
      const best = validResults.reduce((a, b) =>
        (a.confidence ?? 0) > (b.confidence ?? 0) ? a : b
      );
      runResult.bestStrategy = best.strategy;
      runResult.bestText = best.text;
      runResult.bestConfidence = best.confidence ?? 0;
      runResult.success = best.confidence !== undefined && best.confidence > 75;
    } else if (ocrResults.length > 0) {
      const best = ocrResults.reduce((a, b) =>
        (a.confidence ?? 0) > (b.confidence ?? 0) ? a : b
      );
      runResult.bestStrategy = best.strategy;
      runResult.bestText = best.text;
      runResult.bestConfidence = best.confidence ?? 0;
    }

    // Submit search if we have a valid captcha
    if (runResult.success && runResult.bestText) {
      await page.fill("#petres_name", surname);
      await page.fill("#fcaptcha_code", runResult.bestText);
      await page.click('button[value="Go"]');
      await page.waitForTimeout(3_000);

      const resultHtml = await page.$eval("#res_party", (el) => el.innerHTML);
      const caseCount = (resultHtml.match(/<tr[^>]*>/gi) ?? []).filter(
        (tr) => !tr.includes("No records") && !tr.includes("No Cases") && tr.includes("<td")
      ).length;

      runResult.casesFound = caseCount > 0;
      runResult.caseCount = caseCount;
    }

  } catch (err) {
    runResult.error = err instanceof Error ? err.message : String(err);
  } finally {
    await page?.close();
    await browser.close();
  }

  return runResult;
}

// ─── Main measurement ──────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  eCourts Captcha Solve Rate Measurement — ClearDeed");
  console.log("  Date:", new Date().toISOString());
  console.log("  Surnames:", TEST_SURNAMES.join(", "));
  console.log("═══════════════════════════════════════════════════════════════\n");

  const results: CaptchaRunResult[] = [];

  for (let i = 0; i < TEST_SURNAMES.length; i++) {
    const surname = TEST_SURNAMES[i];
    process.stdout.write(`  [${i + 1}/${TEST_SURNAMES.length}] Testing "${surname}"... `);

    const result = await runCaptchaTest(surname);
    results.push(result);

    const status = result.success
      ? `✓ captcha solved (${result.bestText}, conf: ${result.bestConfidence.toFixed(1)}%, strategy: ${result.bestStrategy})`
      : `✗ captcha failed (best: "${result.bestText}", conf: ${result.bestConfidence.toFixed(1)}%)`;
    const casesStr = result.casesFound ? `, ${result.caseCount} case(s)` : "";

    console.log(status + casesStr);

    // Small delay between tests
    await new Promise((res) => setTimeout(res, 1000));
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  RESULTS SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const totalRuns = results.length;
  const solvedRuns = results.filter((r) => r.success).length;
  const failedRuns = totalRuns - solvedRuns;
  const totalAttempts = results.reduce((sum, r) => sum + r.attempts, 0);
  const validCaptchaAttempts = results.reduce((sum, r) => sum + r.validCaptchas, 0);
  const avgConfidence = results.reduce((sum, r) => sum + r.bestConfidence, 0) / totalRuns;

  // Strategy breakdown
  const strategyCounts: Record<string, number> = {};
  const strategyConfidences: Record<string, number[]> = {};
  for (const r of results) {
    const s = r.bestStrategy;
    strategyCounts[s] = (strategyCounts[s] ?? 0) + 1;
    if (!strategyConfidences[s]) strategyConfidences[s] = [];
    strategyConfidences[s].push(r.bestConfidence);
  }

  const solveRate = (solvedRuns / totalRuns) * 100;
  const validRate = (validCaptchaAttempts / totalAttempts) * 100;

  console.log(`  Total runs:        ${totalRuns}`);
  console.log(`  Captcha solved:    ${solvedRuns} (${solveRate.toFixed(1)}%)`);
  console.log(`  Captcha failed:    ${failedRuns} (${(100 - solveRate).toFixed(1)}%)`);
  console.log(`  Total attempts:   ${totalAttempts} (${validCaptchaAttempts} valid format)`);
  console.log(`  Valid rate:        ${validRate.toFixed(1)}%`);
  console.log(`  Avg confidence:    ${avgConfidence.toFixed(1)}%`);
  console.log("");

  console.log("  Strategy breakdown:");
  for (const [strategy, count] of Object.entries(strategyCounts).sort((a, b) => b[1] - a[1])) {
    const confs = strategyConfidences[strategy] ?? [];
    const avg = confs.reduce((a, b) => a + b, 0) / confs.length;
    console.log(`    ${strategy}: ${count}x (avg conf: ${avg.toFixed(1)}%)`);
  }

  console.log("");
  console.log("  Per-surname results:");
  for (const r of results) {
    const icon = r.success ? "✓" : "✗";
    const confStr = r.bestConfidence > 0 ? ` conf: ${r.bestConfidence.toFixed(1)}%` : "";
    console.log(
      `    ${icon} ${r.surname.padEnd(10)} | captcha: "${r.bestText.padEnd(8)}"${confStr} | valid-fmt: ${r.validCaptchas}/${r.attempts} | cases: ${r.casesFound ? r.caseCount : "0"}`
    );
  }

  // Recommendations
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  RECOMMENDATIONS");
  console.log("═══════════════════════════════════════════════════════════════\n");

  if (solveRate >= 80) {
    console.log("  [OK] Captcha solve rate >= 80% — current Tesseract.js approach is adequate.");
  } else if (solveRate >= 60) {
    console.log("  [WARN] Captcha solve rate 60-80% — consider enhanced preprocessing or 2captcha API.");
    console.log("         Current: Tesseract.js with preprocessing");
    console.log("         Upgrade path: 2captcha API (~$2.99/1000 solves) for failed captchas.");
  } else {
    console.log("  [FAIL] Captcha solve rate < 60% — significant search coverage gaps.");
    console.log("         Recommendation: Implement 2captcha API fallback for retry scenarios.");
  }

  console.log("");
  if (avgConfidence < 70) {
    console.log("  [WARN] Average confidence < 70% — captcha quality is poor.");
    console.log("         Consider requesting new captcha image (page refresh) before OCR.");
  }

  // Find best strategy
  const bestStrategy = Object.entries(strategyCounts).sort((a, b) => b[1] - a[1])[0];
  if (bestStrategy) {
    console.log(`\n  Best preprocessing strategy: "${bestStrategy[0]}" (${bestStrategy[1]}/${totalRuns} runs)`);
  }

  // Cases found summary
  const casesFound = results.filter((r) => r.casesFound).length;
  console.log(`\n  Court cases found: ${casesFound}/${totalRuns} searches returned cases.`);

  console.log("\n═══════════════════════════════════════════════════════════════\n");

  return results;
}

main().catch(console.error);
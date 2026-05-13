// eCourts Party Name Search fetcher
// State: Odisha (code 11), District: Khurda (code 8, eCourts spells it "Khurda")
// eCourts blocks external requests. Playwright with OCR is the only path.
//
// Key findings from probe (2026-04-17):
// - AJAX district dropdown only works via Playwright selectOption(), not evaluate()
// - Captcha is lazy-loaded: focus petres_name first to trigger captcha render
// - Tesseract.js v5 handles the captcha OCR
// - Court complexes for Khurda: Bhubaneswar, Khurda, Banapur, Jatni, Tangi
//
// Enhanced (2026-04-30) — captcha retry, name variants, double-fetch:
// - Captcha retry: up to 3 attempts per search with image preprocessing
// - Name variants: generate spelling variants including Odia→Latin transliteration patterns
// - Double-fetch: for negative results, confirm with second independent search per complex
// - Negative-result metadata: explicit fields for captcha attempts, variants tried, confidence

import { z } from "zod";
import { createHash } from "node:crypto";
import { chromium, type Browser, type Page } from "playwright";
import { createWorker } from "tesseract.js";
import { CourtCaseResult } from "@cleardeed/schema";

const BASE_URL = "https://services.ecourts.gov.in/ecourtindia_v6";
const USER_AGENT = "ClearDeed/1.0 (property due-diligence; contact@cleardeed.in)";
const PARSER_VERSION = "ecourts-party-table-parser-v2";
const MAX_CAPTCHA_ATTEMPTS = 3;
const MAX_NAME_VARIANTS = 4;
const ODISHA_STATE_CODE = "11";
const KHURDA_DISTRICT_CODE = "8";

// --- Name variant generation ---

/**
 * Generate spelling variants of a party name to improve search coverage.
 * Covers common transliteration patterns and spelling variations.
 */
export function generateNameVariants(name: string): string[] {
  const normalized = name.trim();
  if (!normalized) return [];

  const variants = new Set<string>();
  variants.add(normalized);

  const tokens = normalized.split(/\s+/);

  // Common Odia surname transliteration patterns
  const odiaSurnameVariants: Record<string, string[]> = {
    mohapatra: ["mohapatra", "mohapatra", "mohapatra", "mohapatra"],
    barajena: ["barajena", "barajena", "barajena", "barajena"],
    behera: ["behera", "behera", "behera", "behera"],
    das: ["das", "dass", "dash"],
    raut: ["raut", "rout", "raut"],
    sahoo: ["sahoo", "sahu", "sahoo"],
    swain: ["swain", "swan", "swain"],
    nayak: ["nayak", "naik", "nayak"],
  };

  const lastToken = tokens[tokens.length - 1].toLowerCase();
  if (odiaSurnameVariants[lastToken]) {
    for (const surnameVariant of odiaSurnameVariants[lastToken]) {
      const rest = tokens.slice(0, -1);
      if (rest.length > 0) {
        variants.add([...rest, surnameVariant].join(" "));
      }
    }
  }

  // Try without middle names
  if (tokens.length > 1) {
    variants.add(lastToken);
  }

  // Try first-name-only search
  if (tokens.length === 2) {
    variants.add(tokens[0]);
  }

  // Abbreviation patterns: Bikash Chandra Mohapatra -> B C Mohapatra
  if (tokens.length >= 3) {
    const initials = tokens.slice(0, -1).map((t) => t[0]?.toUpperCase() ?? "").join(" ");
    variants.add(`${initials} ${lastToken}`);
  }

  return Array.from(variants).slice(0, MAX_NAME_VARIANTS);
}

// --- Captcha solving with preprocessing + retry ---

interface CaptchaSolveResult {
  text: string;
  confidence: number;
  imageHash: string;
  attempt: number;
  preprocessing: string;
  strategyLabel: string;
}

/** Preprocessing strategies for eCourts captchas (alphanumeric, ~6 chars, light bg). */
type CaptchaStrategy =
  | "original"   // Raw image
  | "grayscale"  // Grayscale conversion
  | "contrast200" // 2x contrast
  | "threshold"  // Grayscale + 3x contrast (binarize-like)
  | "invert";    // Invert colors for dark-on-light captchas

const CAPTCHA_CHARSET = /^[A-Z0-9]{4,8}$/i;

/**
 * Apply canvas filter for a given preprocessing strategy.
 */
function applyCanvasFilter(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  strategy: CaptchaStrategy
): void {
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.filter = filterForStrategy(strategy);
  ctx.drawImage(img, 0, 0);
}

function filterForStrategy(s: CaptchaStrategy): string {
  switch (s) {
    case "original": return "";
    case "grayscale": return "grayscale(100%)";
    case "contrast200": return "contrast(200%)";
    case "threshold": return "grayscale(100%) contrast(300%)";
    case "invert": return "invert(100%) grayscale(50%)";
  }
}

/**
 * Capture captcha image from page as data URL.
 */
async function captureCaptchaImage(page: Page, imageUrl: string): Promise<string> {
  const fullUrl = imageUrl.startsWith("http") ? imageUrl : `${BASE_URL}${imageUrl}`;
  return page.evaluate(async (url) => {
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
}

/**
 * Run OCR with Tesseract.js and return cleaned captcha text + confidence.
 */
async function runOcr(imageDataUrl: string): Promise<{ text: string; confidence: number }> {
  const worker = await createWorker("eng");
  const { data } = await worker.recognize(imageDataUrl);
  await worker.terminate();

  const rawText = data.text ?? "";
  const confidence = data.confidence ?? 0;
  // Character whitelist: A-Z, 0-9 only (eCourts captcha is alphanumeric uppercase)
  const cleaned = rawText.replace(/[^A-Z0-9]/gi, "").toUpperCase().substring(0, 8);

  return { text: cleaned, confidence };
}

/**
 * Run all preprocessing strategies on a captcha image and return the best result.
 * This is the "multi-strategy" approach: run OCR on all strategies, pick the best.
 */
async function solveCaptchaMultiStrategy(
  imageUrl: string,
  page: Page
): Promise<CaptchaSolveResult> {
  const screenshot = await captureCaptchaImage(page, imageUrl);
  const imageHash = sha256(screenshot);

  // Strategies to try (in order of expected effectiveness)
  const strategies: CaptchaStrategy[] = [
    "contrast200",
    "grayscale",
    "original",
    "threshold",
    "invert",
  ];

  const results: Array<{ strategy: CaptchaStrategy; text: string; confidence: number }> = [];

  for (const strategy of strategies) {
    // Pre-process: render with canvas filter
    const preprocessed = await page.evaluate(
      async ({ screenshotData, strat }: { screenshotData: string; strat: CaptchaStrategy }) => {
        const img = new Image();
        img.src = screenshotData;
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = rej;
        });
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.filter = (() => {
          switch (strat) {
            case "original": return "";
            case "grayscale": return "grayscale(100%)";
            case "contrast200": return "contrast(200%)";
            case "threshold": return "grayscale(100%) contrast(300%)";
            case "invert": return "invert(100%) grayscale(50%)";
          }
        })();
        ctx.drawImage(img, 0, 0);
        return canvas.toDataURL("image/png");
      },
      { screenshotData: screenshot, strat: strategy }
    );

    const ocr = await runOcr(preprocessed);
    results.push({ strategy, text: ocr.text, confidence: ocr.confidence });
  }

  // Pick best result: prefer valid-format results with highest confidence
  const validResults = results.filter((r) => CAPTCHA_CHARSET.test(r.text) && r.text.length >= 4);
  const best = validResults.length > 0
    ? validResults.reduce((a, b) => (a.confidence > b.confidence ? a : b))
    : results.reduce((a, b) => (a.confidence > b.confidence ? a : b));

  return {
    text: best.text,
    confidence: best.confidence,
    imageHash,
    attempt: 1,
    preprocessing: "multi-strategy",
    strategyLabel: best.strategy,
  };
}

/**
 * Classic retry approach: fetch fresh captcha image each attempt.
 * Used as fallback after multi-strategy if confidence is still low.
 */
async function solveCaptchaWithRetry(
  imageUrl: string,
  page: Page,
  maxAttempts: number
): Promise<CaptchaSolveResult> {
  // Multi-strategy is the primary approach (all strategies on same image)
  const multiResult = await solveCaptchaMultiStrategy(imageUrl, page);

  // If high confidence and valid format, return immediately
  if (multiResult.text.length >= 4 && multiResult.confidence > 80) {
    return multiResult;
  }

  // If low confidence, try fetching a fresh captcha image and rerun multi-strategy
  if (multiResult.confidence < 60 && maxAttempts > 1) {
    try {
      // Click captcha image to refresh it
      await page.click("#captcha_image");
      await page.waitForTimeout;
      const newSrc = await page.$eval("#captcha_image", (el) => (el as HTMLImageElement).src);
      const freshResult = await solveCaptchaMultiStrategy(newSrc, page);
      // Pick the better of the two
      return freshResult.confidence > multiResult.confidence ? freshResult : multiResult;
    } catch {
      // Refresh failed, return the multi-strategy result anyway
    }
  }

  return multiResult;
}

// --- Core types ---

interface CourtComplex {
  name: string;
  value: string;
  estCodes: string;
}

interface ECourtsInput {
  partyName: string;
  districtName?: string;
  districtCode?: string;
  courtComplex?: string;
  tryNameVariants?: boolean;
  doubleFetch?: boolean;
}

type CaptchaSearchOutcome = "captcha_failed" | "no_records" | "cases_found" | "portal_error" | "unknown" | "name_variant";

interface ECourtsAttemptMetadata {
  complexName: string;
  complexCode: string;
  partyNameVariant: string;
  ocrText?: string;
  ocrConfidence?: number;
  outcome: CaptchaSearchOutcome;
  rawArtifactHash?: string;
  captchaImageHash?: string;
  submittedPayloadHash?: string;
  fullPageHash?: string;
  statusReason?: string;
  captchaAttempts: number;
  doubleFetchAttempt?: number;
}

interface NameVariantAttempt {
  variant: string;
  searchAttempts: ECourtsAttemptMetadata[];
  casesFound: number;
  outcome: CaptchaSearchOutcome;
}

interface DoubleFetchResult {
  firstSearch: ECourtsAttemptMetadata[];
  secondSearch: ECourtsAttemptMetadata[];
  confirmedNegative: boolean;
}

const COURT_COMPLEXES: CourtComplex[] = [
  { name: "Bhubaneswar", value: "1110045@2,3,4@Y", estCodes: "2,3,4" },
  { name: "Khurda", value: "1110044@5,6,7@Y", estCodes: "5,6,7" },
  { name: "Banapur", value: "1110043@9,10,11@Y", estCodes: "9,10,11" },
  { name: "Jatni", value: "1110046@8@N", estCodes: "8" },
  { name: "Tangi", value: "1110132@12@N", estCodes: "12" },
];

let browser: Browser | null = null;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

export async function cleanup() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

async function setupForm(page: Page, districtCode: string): Promise<void> {
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

  await page.selectOption("#sess_dist_code", districtCode);
  await page.waitForFunction(
    () => document.querySelectorAll("#court_complex_code option").length > 1,
    { timeout: 15_000 }
  );

  await page.focus("#petres_name");
  await page.waitForSelector("#captcha_image", { timeout: 10_000 });
  await page.waitForTimeout(500);
}

// --- Main fetch function ---

export async function ecourtsFetch(
  input: ECourtsInput
): Promise<z.infer<typeof CourtCaseResult>> {
  const fetchedAt = new Date().toISOString();
  const { partyName, courtComplex, tryNameVariants = true, doubleFetch = true } = input;

  const districtName = input.districtName ?? "Khurda";
  const districtCode = input.districtCode ?? KHURDA_DISTRICT_CODE;
  const complexesToTry = resolveCourtComplexes(courtComplex);
  const inputsTried: Array<{ label: string; input: Record<string, unknown> }> = [];

  const allSearchAttempts: ECourtsAttemptMetadata[] = [];
  const allCases: Array<{
    caseNo: string; caseType: string; court: string; filingDate: string;
    status: string; parties: Array<{ name: string; role: "petitioner" | "respondent" | "other" }>;
  }> = [];
  const rawFragments: string[] = [];
  const variantAttempts: NameVariantAttempt[] = [];
  const doubleFetchResults: DoubleFetchResult[] = [];

  try {
    if (districtCode !== KHURDA_DISTRICT_CODE || !/khurda|khordha/i.test(districtName)) {
      return {
        source: "ecourts", status: "failed", statusReason: "unsupported_district",
        verification: "manual_required", fetchedAt, attempts: 0,
        inputsTried: [{ label: "party_name_search", input: { partyName, stateCode: ODISHA_STATE_CODE, districtCode, districtName, courtComplexes: complexesToTry.map((c) => c.name) } }],
        parserVersion: PARSER_VERSION,
        data: { cases: [], total: 0, searchMetadata: { districtName, districtCode, complexesTried: [], captchaAcceptedCount: 0, captchaFailedCount: 0, attempts: [], nameVariantsTried: [], doubleFetchResults: [], negativeResultConfidence: "unconfirmed" } },
        error: "ClearDeed V1 eCourts fetcher supports only Khurda district.",
      };
    }

    const nameVariants = generateNameVariants(partyName);
    inputsTried.push({ label: "name_variants_generated", input: { variants: nameVariants, tryNameVariants, doubleFetch } });

    let casesFound = false;

    for (const complex of complexesToTry) {
      if (casesFound) break;

      for (const variant of nameVariants) {
        if (casesFound) break;

        const variantAttempt: NameVariantAttempt = { variant, searchAttempts: [], casesFound: 0, outcome: "unknown" };

        const firstSearchAttempt = await runECourtsSearchAttempt({
          partyName: variant, courtComplex: complex, districtCode,
        });

        allSearchAttempts.push(firstSearchAttempt.metadata);
        rawFragments.push(firstSearchAttempt.resultHtml);
        variantAttempt.searchAttempts.push(firstSearchAttempt.metadata);

        if (firstSearchAttempt.outcome === "cases_found") {
          allCases.push(...firstSearchAttempt.cases);
          variantAttempt.casesFound = firstSearchAttempt.cases.length;
          variantAttempt.outcome = "cases_found";
          variantAttempts.push(variantAttempt);
          casesFound = true;
          break;
        }

        if (firstSearchAttempt.outcome === "no_records" && doubleFetch) {
          const secondSearchAttempt = await runECourtsSearchAttempt({
            partyName: variant, courtComplex: complex, districtCode, doubleFetchAttempt: 2,
          });

          allSearchAttempts.push(secondSearchAttempt.metadata);
          rawFragments.push(secondSearchAttempt.resultHtml);
          variantAttempt.searchAttempts.push(secondSearchAttempt.metadata);

          const doubleResult: DoubleFetchResult = {
            firstSearch: [firstSearchAttempt.metadata],
            secondSearch: [secondSearchAttempt.metadata],
            confirmedNegative: secondSearchAttempt.outcome === "no_records" || secondSearchAttempt.outcome === "captcha_failed",
          };
          doubleFetchResults.push(doubleResult);

          if (secondSearchAttempt.outcome === "cases_found") {
            allCases.push(...secondSearchAttempt.cases);
            variantAttempt.casesFound = secondSearchAttempt.cases.length;
            variantAttempt.outcome = "cases_found";
            variantAttempts.push(variantAttempt);
            casesFound = true;
            break;
          }

          variantAttempt.casesFound = 0;
          variantAttempt.outcome = "no_records";
        } else if (firstSearchAttempt.outcome === "no_records") {
          variantAttempt.casesFound = 0;
          variantAttempt.outcome = "no_records";
        }

        if (firstSearchAttempt.outcome === "captcha_failed" && tryNameVariants && nameVariants.indexOf(variant) < nameVariants.length - 1) {
          variantAttempt.outcome = "name_variant";
        }

        variantAttempts.push(variantAttempt);
      }
    }

    const captchaAcceptedCount = allSearchAttempts.filter((a) => a.outcome === "cases_found" || a.outcome === "no_records").length;
    const captchaFailedCount = allSearchAttempts.filter((a) => a.outcome === "captcha_failed").length;
    const rawArtifactHash = rawFragments.length > 0 ? sha256(rawFragments.join("\n---complex---\n")) : undefined;
    const allPortalErrors = allSearchAttempts.length > 0 && allSearchAttempts.every((a) => a.outcome === "portal_error");

    let negativeResultConfidence: "high" | "medium" | "low" | "unconfirmed" = "unconfirmed";
    if (allCases.length === 0) {
      if (doubleFetchResults.length > 0 && doubleFetchResults.every((d) => d.confirmedNegative)) {
        negativeResultConfidence = "high";
      } else if (captchaAcceptedCount >= 2) {
        negativeResultConfidence = "medium";
      } else if (captchaFailedCount > 0) {
        negativeResultConfidence = "low";
      }
    }

    if (allPortalErrors) {
      return {
        source: "ecourts", status: "failed", statusReason: "fetch_failed",
        verification: "manual_required", fetchedAt, attempts: allSearchAttempts.length,
        inputsTried, parserVersion: PARSER_VERSION,
        validators: [{ name: "captcha_search_attempts_recorded", status: "failed", raw: { attempts: allSearchAttempts } }],
        data: { cases: [], total: 0, searchMetadata: { districtName, districtCode, complexesTried: complexesToTry.map((c) => c.name), captchaAcceptedCount: 0, captchaFailedCount, attempts: allSearchAttempts, nameVariantsTried: variantAttempts, doubleFetchResults, negativeResultConfidence } },
        error: allSearchAttempts[0]?.statusReason ?? "eCourts search failed",
      };
    }

    return {
      source: "ecourts",
      status: allCases.length > 0 ? "success" : "partial",
      statusReason: allCases.length > 0 ? "cases_found" : captchaAcceptedCount > 0 ? "no_cases_found_captcha_accepted" : captchaFailedCount > 0 ? "captcha_failed" : "no_cases_found_unclassified",
      verification: allCases.length > 0 ? "verified" : "manual_required",
      fetchedAt, attempts: allSearchAttempts.length, inputsTried, rawArtifactHash, parserVersion: PARSER_VERSION,
      validators: [
        { name: "captcha_search_attempts_recorded", status: captchaAcceptedCount > 0 || allCases.length > 0 ? "passed" : "warning", raw: { attempts: allSearchAttempts } },
        { name: "name_variants_recorded", status: variantAttempts.length > 1 ? "passed" : "skipped", raw: { variants: variantAttempts } },
        { name: "double_fetch_recorded", status: doubleFetchResults.length > 0 ? "passed" : "skipped", raw: { doubleFetch: doubleFetchResults } },
        { name: "negative_result_confidence", status: allCases.length > 0 ? "skipped" : negativeResultConfidence === "high" ? "passed" : negativeResultConfidence === "medium" ? "warning" : "failed", raw: { confidence: negativeResultConfidence } },
      ],
      data: {
        cases: allCases.map((c) => ({ caseNo: c.caseNo, caseType: c.caseType, court: c.court, filingDate: c.filingDate || undefined, status: c.status, parties: c.parties })),
        total: allCases.length,
        searchMetadata: { districtName, districtCode, complexesTried: complexesToTry.map((c) => c.name), captchaAcceptedCount, captchaFailedCount, attempts: allSearchAttempts, nameVariantsTried: variantAttempts, doubleFetchResults, negativeResultConfidence },
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      source: "ecourts", status: "failed", statusReason: "fetch_failed",
      verification: "manual_required", fetchedAt,
      attempts: Array.isArray((err as { attempts?: unknown }).attempts) ? ((err as { attempts: unknown[] }).attempts.length) : allSearchAttempts.length || 1,
      inputsTried, parserVersion: PARSER_VERSION,
      validators: Array.isArray((err as { attempts?: unknown }).attempts) ? [{ name: "retry_attempts_recorded", status: "failed", raw: { attempts: (err as { attempts: unknown[] }).attempts } }] : undefined,
      data: { cases: [], total: 0, searchMetadata: { districtName: input.districtName ?? "Khurda", districtCode, complexesTried: complexesToTry.map((c) => c.name), captchaAcceptedCount: 0, captchaFailedCount: allSearchAttempts.filter((a) => a.outcome === "captcha_failed").length, attempts: allSearchAttempts, nameVariantsTried: variantAttempts, doubleFetchResults, negativeResultConfidence: "unconfirmed" } },
      error: errorMessage,
    };
  }
}

function resolveCourtComplexes(input?: string): CourtComplex[] {
  if (!input) return COURT_COMPLEXES;
  const normalized = input.trim().toLowerCase();
  const match = COURT_COMPLEXES.find((complex) => complex.value === input || complex.name.toLowerCase() === normalized);
  return match ? [match] : COURT_COMPLEXES;
}

async function runECourtsSearchAttempt(input: {
  partyName: string; courtComplex: CourtComplex; districtCode: string; doubleFetchAttempt?: number;
}): Promise<{
  resultHtml: string;
  cases: Array<{ caseNo: string; caseType: string; court: string; filingDate: string; status: string; parties: Array<{ name: string; role: "petitioner" | "respondent" | "other" }> }>;
  outcome: CaptchaSearchOutcome;
  metadata: ECourtsAttemptMetadata;
}> {
  let page: Awaited<ReturnType<Browser["newPage"]>> | null = null;
  try {
    const bro = await getBrowser();
    page = await bro.newPage();
    await page.setExtraHTTPHeaders({ "User-Agent": USER_AGENT });

    await setupForm(page, input.districtCode);
    await page.selectOption("#court_complex_code", input.courtComplex.value);
    await page.waitForTimeout(500);

    const captchaImgSrc = await page.$eval("#captcha_image", (el) => (el as HTMLImageElement).src);
    const captcha = await solveCaptchaWithRetry(captchaImgSrc, page, MAX_CAPTCHA_ATTEMPTS);

    const submittedPayloadHash = sha256(JSON.stringify({
      partyName: input.partyName, courtComplex: input.courtComplex.name,
      courtComplexCode: input.courtComplex.value, districtCode: input.districtCode,
      captchaText: captcha.text, captchaConfidence: captcha.confidence,
      captchaAttempts: captcha.attempt, preprocessing: captcha.preprocessing,
    }));

    await page.fill("#petres_name", input.partyName);
    await page.fill("#fcaptcha_code", captcha.text);
    await page.click('button[value="Go"]');
    await page.waitForTimeout(3_000);

    const resultHtml = await page.$eval("#res_party", (el) => el.innerHTML);
    const fullPageHtml = await page.content();
    const { cases } = parsePartyTable(resultHtml);
    const outcome = classifyResultPanel(resultHtml, cases.length);

    return {
      resultHtml, cases, outcome,
      metadata: {
        complexName: input.courtComplex.name, complexCode: input.courtComplex.value,
        partyNameVariant: input.partyName, ocrText: captcha.text, ocrConfidence: captcha.confidence,
        outcome, rawArtifactHash: sha256(resultHtml), captchaImageHash: captcha.imageHash,
        submittedPayloadHash, fullPageHash: sha256(fullPageHtml), captchaAttempts: captcha.attempt,
        doubleFetchAttempt: input.doubleFetchAttempt,
      },
    };
  } catch (error) {
    const fullPageHtml = page ? await page.content().catch(() => null) : null;
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
      ecourtsMetadata: {
        complexName: input.courtComplex.name, complexCode: input.courtComplex.value,
        partyNameVariant: input.partyName, outcome: "portal_error",
        rawArtifactHash: fullPageHtml ? sha256(fullPageHtml) : undefined,
        fullPageHash: fullPageHtml ? sha256(fullPageHtml) : undefined,
        captchaAttempts: 0, doubleFetchAttempt: input.doubleFetchAttempt,
      } satisfies Partial<ECourtsAttemptMetadata>,
    });
  } finally {
    await page?.close();
  }
}

// --- Parser ---

export function parsePartyTable(html: string): {
  cases: Array<{ caseNo: string; caseType: string; court: string; filingDate: string; status: string; parties: Array<{ name: string; role: "petitioner" | "respondent" | "other" }> }>;
} {
  const cases: Array<{ caseNo: string; caseType: string; court: string; filingDate: string; status: string; parties: Array<{ name: string; role: "petitioner" | "respondent" | "other" }> }> = [];

  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[1];
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const cells: string[] = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1].trim());
    }
    if (cells.length < 5) continue;
    if (cells[0].includes("No records found") || cells[0].includes("No Cases")) continue;
    if (!cells[0] || cells[0] === "") continue;

    const caseMatch = cells[0].match(/(?:CNR\s*)?([A-Z]{2}\d+\/\d+|[A-Z]{2}\d+)/);
    const caseTypeMatch = cells[0].match(/\(([^)]+)\)/);
    const caseNo = caseMatch ? caseMatch[0].replace(/\s+/g, "") : cells[0].replace(/<[^>]+>/g, "");
    const caseType = caseTypeMatch ? caseTypeMatch[1] : "";

    const partyParts = cells[1].split(/<br\s*\/?>/i);
    const parties = partyParts
      .map((p) => {
        const clean = p.replace(/<[^>]+>/g, "").trim();
        if (!clean) return null;
        const roleMatch = clean.match(/^(Petitioner|Respondent|Applicant|Complainant|Accused|Other)[:\-]?\s*/i);
        const role = normalizePartyRole(roleMatch?.[1]);
        const name = clean.replace(/^(Petitioner|Respondent|Applicant|Complainant|Accused|Other)[:\-]?\s*/i, "").trim();
        return { name, role };
      })
      .filter(Boolean) as Array<{ name: string; role: "petitioner" | "respondent" | "other" }>;

    const filingDate = cells[2].replace(/<[^>]+>/g, "").trim();
    const status = cells[3].replace(/<[^>]+>/g, "").trim();
    const court = cells[4].replace(/<[^>]+>/g, "").trim();

    cases.push({ caseNo, caseType, court, filingDate, status, parties });
  }

  return { cases };
}

function normalizePartyRole(role: string | undefined): "petitioner" | "respondent" | "other" {
  const normalized = role?.toLowerCase();
  if (normalized === "petitioner" || normalized === "applicant" || normalized === "complainant") return "petitioner";
  if (normalized === "respondent" || normalized === "accused") return "respondent";
  return "other";
}

export function classifyResultPanel(html: string, caseCount: number): CaptchaSearchOutcome {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (/invalid captcha|captcha.*(wrong|incorrect|mismatch)|enter valid captcha|please enter captcha/.test(text)) return "captcha_failed";
  if (caseCount > 0) return "cases_found";
  if (/no records found|no cases found|record not found|no case found/.test(text)) return "no_records";
  if (/error|temporarily unavailable|try again|server/.test(text)) return "portal_error";
  return "unknown";
}

function isRetryableECourtsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (/browser unavailable|executable doesn't exist|failed to launch/i.test(message)) return false;
  return /timeout|navigation|net::|captcha|Target closed|Execution context was destroyed|fetch failed/i.test(message);
}

export async function healthCheck(): Promise<boolean> {
  try {
    const bro = await getBrowser();
    const page = await bro.newPage();
    await page.goto(`${BASE_URL}/?p=casestatus/index`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    await page.waitForTimeout(500);
    const ready = await page.$("#sess_state_code");
    await page.close();
    return ready !== null;
  } catch {
    return false;
  }
}

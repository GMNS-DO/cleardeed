// Orissa High Court party-name search fetcher
// Portal: hcservices.ecourts.gov.in/ecourtindiaHC (same e-Courts platform as district courts)
// Orissa High Court jurisdiction: all of Odisha
// ClearDeed V1 focus: Khordha district — High Court searches are broader
//
// Key findings from probe (2026-04-30):
// - Same e-Courts platform as district courts: hcservices.ecourts.gov.in/ecourtindiaHC
// - Party name search: ki_petres.php — GET or POST with state_cd=11, court_code=1
// - Has securimage CAPTCHA (same family as district eCourts)
// - Form: petres_name (>=3 chars), rgyear (4-digit year), f (Pending/Disposed/Both radio), captcha
// - Results in HTML table format
// - e-Courts blocks external requests. Playwright + Tesseract OCR is required.

import { createHash } from "node:crypto";
import { chromium, type Browser, type Page } from "playwright";
import { createWorker } from "tesseract.js";
import { CourtCaseResult } from "@cleardeed/schema";
import { z } from "zod";

const BASE_URL = "https://hcservices.ecourts.gov.in/ecourtindiaHC";
const USER_AGENT = "ClearDeed/1.0 (property due-diligence; contact@cleardeed.in)";
const PARSER_VERSION = "high-court-party-parser-v1";
const MAX_ATTEMPTS = 2;

// Odisha state code
const ODISHA_STATE_CODE = "11";
// Orissa High Court code = 1 in e-Courts
const HIGH_COURT_CODE = "1";

interface HighCourtInput {
  /** Party name to search (partial match supported) */
  partyName: string;
  /** e-Courts state code. Default: 11 (Odisha) */
  stateCode?: string;
  /** Year for search (4 digits). If omitted, searches all years. */
  year?: string;
  /** Case status filter: Pending, Disposed, or Both. Default: Both */
  caseStatus?: "Pending" | "Disposed" | "Both";
  /** Try name variants (initials, last-name-only) */
  tryNameVariants?: boolean;
}

type HCOutcome = "captcha_failed" | "no_records" | "cases_found" | "portal_error" | "unknown";

interface HCAttemptMetadata {
  partyName: string;
  year: string;
  caseStatus: string;
  ocrText?: string;
  ocrConfidence?: number;
  outcome: HCOutcome;
  rawArtifactHash?: string;
  captchaImageHash?: string;
  captchaAttempts: number;
  statusReason?: string;
}

interface NameVariantAttempt {
  variant: string;
  searchAttempts: HCAttemptMetadata[];
  casesFound: number;
  outcome: HCOutcome;
}

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

// --- Name variant generation (same as eCourts) ---

export function generateNameVariants(fullName: string): string[] {
  if (!fullName || fullName.trim().length < 2) return [];
  const tokens = fullName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const variants = new Set<string>();
  variants.add(fullName.trim());

  if (tokens.length > 1) {
    const last = tokens[tokens.length - 1].toLowerCase();
    const rest = tokens.slice(0, -1);
    variants.add(`${rest.join(" ")} ${last}`);
    // Surname-only (often sufficient for High Court broad search)
    variants.add(last);
  }

  if (tokens.length >= 2) {
    variants.add(tokens[0]); // First name only
  }

  if (tokens.length >= 3) {
    // Initials: Bikash Chandra Mohapatra -> B C Mohapatra
    const initials = tokens.slice(0, -1).map((t) => t[0]?.toUpperCase() ?? "").join(" ");
    variants.add(`${initials} ${tokens[tokens.length - 1]}`);
    // Bikash Chandra Mohapatra -> B.C. Mohapatra
    variants.add(
      tokens
        .slice(0, -1)
        .map((t) => `${t[0]?.toUpperCase()}.`)
        .join("") + ` ${tokens[tokens.length - 1]}`
    );
  }

  return Array.from(variants).slice(0, 8);
}

// --- CAPTCHA solving (securimage, same as district eCourts) ---

interface CaptchaResult {
  text: string;
  confidence: number;
  imageHash: string;
}

async function solveCaptcha(page: Page, maxAttempts = 3): Promise<CaptchaResult> {
  const captchaImg = await page.$("#captcha_image");
  if (!captchaImg) return { text: "", confidence: 0, imageHash: "" };

  const screenshot = await page.evaluate(async () => {
    const img = document.createElement("img");
    const src = (document.querySelector("#captcha_image") as HTMLImageElement | null)?.src ?? "";
    if (!src) return null;
    img.src = src;
    img.crossOrigin = "anonymous";
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = rej;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || 200;
    canvas.height = img.naturalHeight || 60;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  });

  if (!screenshot) return { text: "", confidence: 0, imageHash: "" };
  const imageHash = sha256(screenshot);

  let bestText = "";
  let bestConfidence = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const worker = await createWorker("eng");
    const { data } = await worker.recognize(screenshot);
    await worker.terminate();

    const cleaned = (data.text ?? "")
      .replace(/[^A-Z0-9]/gi, "")
      .toUpperCase()
      .substring(0, 8);

    const valid = /^[A-Z0-9]{4,8}$/.test(cleaned) && cleaned.length >= 4;
    const confidence = data.confidence ?? 0;

    if (valid && confidence > bestConfidence) {
      bestText = cleaned;
      bestConfidence = confidence;
    }

    if (valid && confidence > 75) {
      break;
    }

    // Refresh captcha for retry
    if (attempt < maxAttempts - 1) {
      await page.evaluate(() => {
        const img = document.querySelector("#captcha_image") as HTMLImageElement | null;
        if (img) img.src = "/ecourtindiaHC/securimage/securimage_show.php?" + Math.random();
      });
      await page.waitForTimeout(600);
    }
  }

  return { text: bestText, confidence: bestConfidence, imageHash };
}

// --- Page setup ---

async function setupPage(page: Page, stateCode: string): Promise<void> {
  const url = `${BASE_URL}/cases/ki_petres.php?state_cd=${stateCode}&dist_cd=1&court_code=${HIGH_COURT_CODE}&stateNm=Odisha`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(800);

  // Trigger captcha by focusing the party name field
  await page.focus("#petres_name");
  await page.waitForTimeout(500);

  // Confirm form elements are present
  const petresName = await page.$("#petres_name");
  const captchaImg = await page.$("#captcha_image");
  if (!petresName || !captchaImg) {
    throw new Error("High Court search form did not load correctly");
  }
}

// --- Single search attempt ---

async function runHCSearchAttempt(input: {
  page: Page;
  partyName: string;
  year: string;
  caseStatus: "Pending" | "Disposed" | "Both";
}): Promise<{
  resultHtml: string;
  cases: Array<{
    caseNo: string;
    caseType: string;
    court: string;
    filingDate: string;
    status: string;
    parties: Array<{ name: string; role: "petitioner" | "respondent" | "other" }>;
  }>;
  outcome: HCOutcome;
  metadata: HCAttemptMetadata;
}> {
  const { page, partyName, year, caseStatus } = input;

  // Fill form
  await page.fill("#petres_name", partyName);
  if (year) await page.fill("#rgyear", year);

  // Select case status radio
  const radioValue = caseStatus === "Pending" ? "Pending" : caseStatus === "Disposed" ? "Disposed" : "Both";
  await page.click(`input[name="f"][value="${radioValue}"]`);

  // Solve captcha
  const captcha = await solveCaptcha(page);

  if (!captcha.text) {
    return {
      resultHtml: "",
      cases: [],
      outcome: "captcha_failed",
      metadata: {
        partyName,
        year,
        caseStatus,
        outcome: "captcha_failed",
        captchaAttempts: 3,
        statusReason: "captcha_ocr_failed",
      },
    };
  }

  await page.fill("#captcha", captcha.text);
  await page.waitForTimeout(300);

  // Submit
  await page.click('input[name="submit1"]');
  await page.waitForTimeout;

  // Get result HTML
  const resultHtml = await page.evaluate(() => {
    const panel = document.querySelector(".table-responsive") ?? document.querySelector("table");
    return panel?.innerHTML ?? "";
  });

  const rawArtifactHash = sha256(resultHtml);

  // Parse cases
  const cases = parseHCTable(resultHtml);

  // Classify outcome
  let outcome: HCOutcome = "unknown";
  if (resultHtml.includes("No records found") || resultHtml.includes("no record")) {
    outcome = "no_records";
  } else if (resultHtml.includes("Invalid captcha") || resultHtml.includes("Captcha")) {
    outcome = "captcha_failed";
  } else if (cases.length > 0) {
    outcome = "cases_found";
  } else if (resultHtml.length > 200) {
    outcome = "cases_found"; // Non-empty table without "no records" likely has cases
  }

  return {
    resultHtml,
    cases,
    outcome,
    metadata: {
      partyName,
      year,
      caseStatus,
      ocrText: captcha.text,
      ocrConfidence: captcha.confidence,
      outcome,
      rawArtifactHash,
      captchaImageHash: captcha.imageHash,
      captchaAttempts: 1,
      statusReason: outcome === "captcha_failed" ? "captcha_rejected" : undefined,
    },
  };
}

// --- HTML table parser ---

function parseHCTable(html: string): Array<{
  caseNo: string;
  caseType: string;
  court: string;
  filingDate: string;
  status: string;
  parties: Array<{ name: string; role: "petitioner" | "respondent" | "other" }>;
}> {
  const cases: Array<{
    caseNo: string;
    caseType: string;
    court: string;
    filingDate: string;
    status: string;
    parties: Array<{ name: string; role: "petitioner" | "respondent" | "other" }>;
  }> = [];

  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    if (row.toLowerCase().includes("no record")) continue;

    const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? [];
    if (cells.length < 4) continue;

    // Extract cell text
    const extract = (cell: string) =>
      cell.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();

    const [caseCell, partyCell, dateCell, statusCell, courtCell] = cells.map(extract);

    if (!caseCell || caseCell.length < 3) continue;

    // Parse case number
    const caseNoMatch = caseCell.match(/([A-Z]+[A-Z0-9/()-]+)/i);
    const caseNo = caseNoMatch?.[1] ?? caseCell.substring(0, 30);

    // Parse case type from case number
    const caseTypeMatch = caseCell.match(/\(([^)]+)\)/);
    const caseType = caseTypeMatch?.[1] ?? "";

    // Parse parties: "Petitioner: Name<br>Respondent: Name" format
    const parties: Array<{ name: string; role: "petitioner" | "respondent" | "other" }> = [];
    const partyParts = partyCell.split(/<br\s*\/?>/i).concat(partyCell.split(/\n/));
    for (const part of partyParts) {
      const clean = part.replace(/<[^>]+>/g, "").trim();
      if (!clean || clean.length < 2) continue;
      if (/^petitioner\s*:/i.test(clean)) {
        parties.push({ name: clean.replace(/^petitioner\s*:/i, "").trim(), role: "petitioner" });
      } else if (/^respondent\s*:/i.test(clean)) {
        parties.push({ name: clean.replace(/^respondent\s*:/i, "").trim(), role: "respondent" });
      } else if (/^applicant\s*:/i.test(clean)) {
        parties.push({ name: clean.replace(/^applicant\s*:/i, "").trim(), role: "petitioner" });
      } else if (/^accused\s*:/i.test(clean)) {
        parties.push({ name: clean.replace(/^accused\s*:/i, "").trim(), role: "respondent" });
      } else if (/^complainant\s*:/i.test(clean)) {
        parties.push({ name: clean.replace(/^complainant\s*:/i, "").trim(), role: "petitioner" });
      } else if (clean.length > 2 && clean.length < 100) {
        parties.push({ name: clean, role: "other" });
      }
    }

    const filingDate = dateCell.match(/\d{2}[-/]\d{2}[-/]\d{2,4}/) ? dateCell : "";
    const status = statusCell.toLowerCase().includes("pend") ? "Pending" : statusCell.toLowerCase().includes("dispos") ? "Disposed" : statusCell;
    const court = courtCell || "Orissa High Court, Cuttack";

    cases.push({ caseNo, caseType, court, filingDate, status, parties });
  }

  return cases;
}

// --- Main export ---

export async function highCourtFetch(
  input: HighCourtInput
): Promise<z.infer<typeof CourtCaseResult>> {
  const fetchedAt = new Date().toISOString();
  const {
    partyName,
    stateCode = ODISHA_STATE_CODE,
    year = "",
    caseStatus = "Both",
    tryNameVariants = true,
  } = input;

  const inputsTried: Array<{ label: string; input: Record<string, unknown> }> = [];

  try {
    const nameVariants = tryNameVariants ? generateNameVariants(partyName) : [partyName];
    inputsTried.push({
      label: "name_variants",
      input: { variants: nameVariants, tryNameVariants },
    });

    let page: Awaited<ReturnType<Browser["newPage"]>> | null = null;
    try {
      const browserInst = await getBrowser();
      page = await browserInst.newPage();
      await page.setExtraHTTPHeaders({ "User-Agent": USER_AGENT });

      await setupPage(page, stateCode);

      const allCases: Array<{
        caseNo: string; caseType: string; court: string; filingDate: string;
        status: string; parties: Array<{ name: string; role: "petitioner" | "respondent" | "other" }>;
      }> = [];
      const rawFragments: string[] = [];
      const variantAttempts: NameVariantAttempt[] = [];
      let captchaAcceptedCount = 0;
      let captchaFailedCount = 0;

      for (const variant of nameVariants) {
        const attempt = await runHCSearchAttempt({
          page,
          partyName: variant,
          year,
          caseStatus,
        });

        rawFragments.push(attempt.resultHtml);
        variantAttempts.push({
          variant,
          searchAttempts: [attempt.metadata],
          casesFound: attempt.cases.length,
          outcome: attempt.outcome,
        });

        if (attempt.outcome === "cases_found") {
          allCases.push(...attempt.cases);
          captchaAcceptedCount++;
          break;
        } else if (attempt.outcome === "no_records") {
          captchaAcceptedCount++;
        } else if (attempt.outcome === "captcha_failed") {
          captchaFailedCount++;
        }

        // Reset form for next variant
        await page.fill("#petres_name", "");
        await page.fill("#rgyear", "");
        await page.fill("#captcha", "");
        await page.waitForTimeout(500);
      }

      const rawArtifactHash = rawFragments.length > 0 ? sha256(rawFragments.join("\n")) : undefined;

      return {
        source: "high_court",
        status: allCases.length > 0 ? "success" : "partial",
        statusReason:
          allCases.length > 0
            ? "cases_found"
            : captchaFailedCount > 0
            ? "captcha_failed"
            : "no_cases_found",
        verification: allCases.length > 0 ? "verified" : "manual_required",
        fetchedAt,
        attempts: nameVariants.length,
        inputsTried,
        rawArtifactHash,
        parserVersion: PARSER_VERSION,
        validators: [
          {
            name: "hc_captcha_accepted",
            status: captchaAcceptedCount > 0 ? "passed" : "failed",
            raw: { captchaAcceptedCount, captchaFailedCount },
          },
          {
            name: "hc_name_variants",
            status: nameVariants.length > 1 ? "passed" : "skipped",
            raw: { variants: nameVariants },
          },
        ],
        data: {
          cases: allCases.map((c) => ({
            caseNo: c.caseNo,
            caseType: c.caseType,
            court: c.court,
            filingDate: c.filingDate || undefined,
            status: c.status,
            parties: c.parties,
          })),
          total: allCases.length,
          searchMetadata: {
            courtName: "Orissa High Court",
            stateCode,
            year,
            caseStatus,
            nameVariantsTried: variantAttempts,
            captchaAcceptedCount,
            captchaFailedCount,
            negativeResultConfidence:
              allCases.length === 0
                ? captchaAcceptedCount >= 2
                  ? "medium"
                  : "low"
                : "high",
          },
        },
      };
    } finally {
      if (page) await page.close();
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      source: "high_court",
      status: "failed",
      statusReason: "fetch_failed",
      verification: "manual_required",
      fetchedAt,
      attempts: 1,
      inputsTried,
      parserVersion: PARSER_VERSION,
      data: {
        cases: [],
        total: 0,
        searchMetadata: {
          courtName: "Orissa High Court",
          stateCode,
          year,
          caseStatus,
          nameVariantsTried: [],
          captchaAcceptedCount: 0,
          captchaFailedCount: 0,
          negativeResultConfidence: "unconfirmed",
        },
      },
      error: errorMessage,
    };
  }
}

// --- Health check ---

export async function healthCheck(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const browserInst = await chromium.launch({ headless: true });
    const page = await browserInst.newPage();
    await page.goto(`${BASE_URL}/cases/ki_petres.php?state_cd=${ODISHA_STATE_CODE}&dist_cd=1&court_code=${HIGH_COURT_CODE}&stateNm=Odisha`, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
    const petresName = await page.$("#petres_name");
    await page.close();
    await browserInst.close();
    return petresName ? { ok: true } : { ok: false, reason: "form_elements_missing" };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

// eCourts Party Name Search fetcher
// State: Odisha (code 11), District: Khurda (code 8, eCourts spells it "Khurda")
// eCourts blocks external requests. Playwright with OCR is the only path.
//
// Key findings from probe (2026-04-17):
// - AJAX district dropdown only works via Playwright selectOption(), not evaluate()
// - Captcha is lazy-loaded: focus petres_name first to trigger captcha render
// - Tesseract.js v5 handles the captcha OCR
// - Court complexes for Khurda: Bhubaneswar, Khurda, Banapur, Jatni, Tangi

import { z } from "zod";
import { chromium, type Browser, type Page } from "playwright";
import { createWorker } from "tesseract.js";
import { CourtCaseResult } from "@cleardeed/schema";

const BASE_URL = "https://services.ecourts.gov.in/ecourtindia_v6";
const USER_AGENT = "ClearDeed/1.0 (property due-diligence; contact@cleardeed.in)";

const ODISHA_STATE_CODE = "11";
const KHURDA_DISTRICT_CODE = "8"; // eCourts spells it "Khurda"

interface CourtComplex {
  name: string;
  value: string;
  estCodes: string;
}

interface ECourtsInput {
  /** Party name to search (partial match supported) */
  partyName: string;
  /** Optional court complex override */
  courtComplex?: string;
}

const COURT_COMPLEXES: CourtComplex[] = [
  { name: "Bhubaneswar", value: "1110045@2,3,4@Y", estCodes: "2,3,4" },
  { name: "Khurda", value: "1110044@5,6,7@Y", estCodes: "5,6,7" },
  { name: "Banapur", value: "1110043@9,10,11@Y", estCodes: "9,10,11" },
  { name: "Jatni", value: "1110046@8@N", estCodes: "8" },
  { name: "Tangi", value: "1110132@12@N", estCodes: "12" },
];

let browser: Browser | null = null;

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

/**
 * Solve a captcha image via Tesseract OCR.
 * Returns the recognized text (uppercase, alphanumeric, stripped of noise).
 */
async function solveCaptcha(imageUrl: string, page: Page): Promise<string> {
  const fullUrl = imageUrl.startsWith("http")
    ? imageUrl
    : `${BASE_URL}${imageUrl}`;

  const screenshot = await page.evaluate(async (url) => {
    const img = document.createElement("img");
    img.src = url;
    img.crossOrigin = "anonymous";
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

  const worker = await createWorker("eng");
  const {
    data: { text },
  } = await worker.recognize(screenshot);
  await worker.terminate();

  // Clean: remove spaces, make uppercase, keep only captcha-safe chars
  return text
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .substring(0, 6);
}

/**
 * Navigate to case status page, select Odisha + Khurda, wait for form to be ready.
 * Returns the page object ready for party name entry + captcha.
 */
async function setupForm(
  page: Page,
  districtCode: string
): Promise<void> {
  await page.goto(`${BASE_URL}/?p=casestatus/index`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  await page.waitForTimeout(500);

  // Select state (triggers AJAX to load districts)
  await page.selectOption("#sess_state_code", ODISHA_STATE_CODE);
  await page.waitForFunction(
    () => document.querySelectorAll("#sess_dist_code option").length > 2,
    { timeout: 15_000 }
  );

  // Select district (triggers AJAX to load court complexes)
  await page.selectOption("#sess_dist_code", districtCode);
  await page.waitForFunction(
    () => document.querySelectorAll("#court_complex_code option").length > 1,
    { timeout: 15_000 }
  );

  // Focus party name to trigger lazy captcha loading
  await page.focus("#petres_name");
  await page.waitForSelector("#captcha_image", { timeout: 10_000 });
  await page.waitForTimeout(500);
}

/**
 * Parse the HTML table returned by eCourts into structured case objects.
 */
export function parsePartyTable(html: string): {
  cases: Array<{
    caseNo: string;
    caseType: string;
    court: string;
    filingDate: string;
    status: string;
    parties: Array<{ name: string; role: string }>;
  }>;
} {
  const cases: Array<{
    caseNo: string;
    caseType: string;
    court: string;
    filingDate: string;
    status: string;
    parties: Array<{ name: string; role: string }>;
  }> = [];

  // eCourts returns a table. Parse each <tr> into a case.
  const rowRegex =
    /<tr[^>]*>(.*?)<\/tr>/gis;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[1];
    const cellRegex = /<td[^>]*>(.*?)<\/td>/gis;
    const cells: string[] = [];
    let cellMatch;
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1].trim());
    }
    if (cells.length < 5) continue;
    if (cells[0].includes("No records found") || cells[0].includes("No Cases")) continue;
    if (!cells[0] || cells[0] === "") continue;

    // First cell: case number + type
    const caseMatch = cells[0].match(
      /(?:CNR\s*)?([A-Z]{2}\d+\/\d+|[A-Z]{2}\d+)/
    );
    const caseTypeMatch = cells[0].match(/\(([^)]+)\)/);
    const caseNo = caseMatch ? caseMatch[0].replace(/\s+/g, "") : cells[0].replace(/<[^>]+>/g, "");
    const caseType = caseTypeMatch ? caseTypeMatch[1] : "";

    // Second cell: parties (separated by <br>)
    const partyParts = cells[1].split(/<br\s*\/?>/i);
    const parties = partyParts
      .map((p) => {
        const clean = p.replace(/<[^>]+>/g, "").trim();
        if (!clean) return null;
        const roleMatch = clean.match(
          /^(Petitioner|Respondent|Applicant|Complainant|Accused|Other)[:\-]?\s*/i
        );
        const role = roleMatch
          ? (roleMatch[1].toLowerCase() as "petitioner" | "respondent" | "other")
          : ("other" as const);
        const name = clean.replace(
          /^(Petitioner|Respondent|Applicant|Complainant|Accused|Other)[:\-]?\s*/i,
          ""
        ).trim();
        return { name, role };
      })
      .filter(Boolean) as Array<{ name: string; role: string }>;

    const filingDate = cells[2].replace(/<[^>]+>/g, "").trim();
    const status = cells[3].replace(/<[^>]+>/g, "").trim();
    const court = cells[4].replace(/<[^>]+>/g, "").trim();

    cases.push({ caseNo, caseType, court, filingDate, status, parties });
  }

  return { cases };
}

export async function ecourtsFetch(
  input: ECourtsInput
): Promise<z.infer<typeof CourtCaseResult>> {
  const fetchedAt = new Date().toISOString();
  const { partyName, courtComplex } = input;

  const districtCode = KHURDA_DISTRICT_CODE;

  let page: Awaited<ReturnType<Browser["newPage"]>> | null = null;
  try {
    const bro = await getBrowser();
    page = await bro.newPage();
    await page.setExtraHTTPHeaders({ "User-Agent": USER_AGENT });

    await setupForm(page, districtCode);

    const complexCode = courtComplex || COURT_COMPLEXES[0].value;

    // Optionally select a court complex
    if (courtComplex) {
      await page.selectOption("#court_complex_code", complexCode);
      await page.waitForTimeout(500);
    }

    // Get captcha image URL
    const captchaImgSrc = await page.$eval(
      "#captcha_image",
      (el) => (el as HTMLImageElement).src
    );

    const captchaCode = await solveCaptcha(captchaImgSrc, page);

    // Fill and submit
    await page.fill("#petres_name", partyName);
    await page.fill("#fcaptcha_code", captchaCode);
    await page.click('button[value="Go"]');
    await page.waitForTimeout(3_000);

    const resultHtml = await page.$eval("#res_party", (el) => el.innerHTML);
    const { cases } = parsePartyTable(resultHtml);

    return {
      source: "ecourts",
      status: cases.length > 0 ? "success" : "partial",
      verification: cases.length > 0 ? "verified" : "manual_required",
      fetchedAt,
      data: {
        cases: cases.map((c) => ({
          caseNo: c.caseNo,
          caseType: c.caseType,
          court: c.court,
          filingDate: c.filingDate || undefined,
          status: c.status,
          parties: c.parties,
        })),
        total: cases.length,
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      source: "ecourts",
      status: "failed",
      verification: "manual_required",
      fetchedAt,
      error: errorMessage,
    };
  } finally {
    await page?.close();
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const bro = await getBrowser();
    const page = await bro.newPage();
    await page.goto(`${BASE_URL}/?p=casestatus/index`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await page.waitForTimeout(500);
    const ready = await page.$("#sess_state_code");
    await page.close();
    return ready !== null;
  } catch {
    return false;
  }
}

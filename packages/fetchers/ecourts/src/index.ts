import { CourtCaseResult } from "@cleardeed/schema";
import { z } from "zod";
import { chromium, Browser, Page } from "playwright";

export interface ECourtsInput {
  /** Party name to search (partial match supported) */
  partyName: string;
  /** State code: "11" for Odisha (from eCourts dropdown) */
  stateCode?: string;
  /** District code — probe fillDistrict to get codes */
  districtCode?: string;
  /** Court complex code */
  courtComplexCode?: string;
  /** Establishment code */
  estCode?: string;
  /** Registration year filter */
  year?: string;
  /** Case status filter */
  caseStatus?: "Pending" | "Disposed";
}

const BASE_URL = "https://services.ecourts.gov.in/ecourtindia_v6";
const USER_AGENT =
  "ClearDeed/1.0 (property due-diligence; contact@cleardeed.in)";

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

async function cleanup() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Navigate to casestatus page and return the page object with state/district loaded.
 * State must be set before district codes can be obtained.
 */
async function navigateToCaseStatus(
  page: Page,
  stateCode: string
): Promise<void> {
  await page.goto(
    `${BASE_URL}/?p=casestatus/index`,
    { waitUntil: "networkidle", timeout: 20_000 }
  );
  await page.selectOption("#sess_state_code", stateCode);
  await page.waitForTimeout(1_500); // wait for district dropdown to populate
}

/**
 * Fill district and court complex, then get the captcha image.
 * Returns the page ready for captcha entry.
 */
async function setupSearchForm(
  page: Page,
  districtCode: string,
  courtComplexCode?: string
): Promise<void> {
  await page.selectOption("#sess_dist_code", districtCode);
  await page.waitForTimeout(1_500);
  if (courtComplexCode) {
    await page.selectOption("#court_complex_code", courtComplexCode);
    await page.waitForTimeout(500);
  }
}

/**
 * Submit party name search and parse the result table.
 */
async function submitAndParse(
  page: Page,
  partyName: string,
  captchaCode: string,
  year?: string,
  caseStatus?: "Pending" | "Disposed"
): Promise<{
  partyData: string;
  newCaptchaHtml: string;
  success: boolean;
}> {
  await page.fill("#petres_name", partyName);
  if (year) await page.fill("#rgyearP", year);
  if (caseStatus === "Disposed") {
    await page.click("#radD");
  }
  await page.fill("#fcaptcha_code", captchaCode);
  await page.click('button[value="Go"]');
  await page.waitForTimeout(3_000);

  const newCaptchaHtml = await page.$eval(
    "#div_captcha_party",
    (el) => el.innerHTML
  );
  const partyData = await page.$eval("#res_party", (el) => el.innerHTML);
  const hasError = await page.$eval("#res_party", (el) =>
    el.textContent?.includes("Invalid captcha")
  );

  return {
    partyData,
    newCaptchaHtml,
    success: !hasError,
  };
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

  // eCourts returns a table with class "table" or similar
  const rowRegex =
    /<tr[^>]*>.*?<td[^>]*>(.*?)<\/td>.*?<td[^>]*>(.*?)<\/td>.*?<td[^>]*>(.*?)<\/td>.*?<td[^>]*>(.*?)<\/td>.*?<td[^>]*>(.*?)<\/td>.*?<\/tr>/gis;
  let match;
  while ((match = rowRegex.exec(html)) !== null) {
    const [td1, td2, td3, td4, td5] = [
      (match[1] || "").trim(),
      (match[2] || "").trim(),
      (match[3] || "").trim(),
      (match[4] || "").trim(),
      (match[5] || "").trim(),
    ];
    if (!td1 || td1 === "" || td1.includes("No records found")) continue;

    // Parse first cell for case number and type
    const caseMatch = td1.match(
      /(?:CNR\s*)?([A-Z]{2}\d+\/\d+|[A-Z]{2}\d+)/
    );
    const caseTypeMatch = td1.match(/\(([^)]+)\)/);
    const caseNo = caseMatch ? caseMatch[0] : td1;
    const caseType = caseTypeMatch ? caseTypeMatch[1] : "";

    // Parse party info from second cell
    const partyParts = td2.split(/<br\s*\/?>/i);
    const parties = partyParts
      .map((p) => {
        const roleMatch = p.match(
          /(Petitioner|Respondent|Applicant|Complainant|Accused|Other)/i
        );
        const nameMatch = p.replace(/<[^>]+>/g, "").trim();
        if (!nameMatch) return null;
        return {
          name: nameMatch,
          role: roleMatch
            ? (roleMatch[0].toLowerCase() as
                | "petitioner"
                | "respondent"
                | "other")
            : ("other" as const),
        };
      })
      .filter(Boolean) as Array<{ name: string; role: string }>;

    // filing date from third cell, status from fourth
    const filingDate = td3.replace(/<[^>]+>/g, "").trim();
    const status = td4.replace(/<[^>]+>/g, "").trim();
    const court = td5.replace(/<[^>]+>/g, "").trim();

    cases.push({ caseNo, caseType, court, filingDate, status, parties });
  }

  return { cases };
}

export async function ecourtsFetch(
  input: ECourtsInput
): Promise<z.infer<typeof CourtCaseResult>> {
  const fetchedAt = new Date().toISOString();
  const {
    partyName,
    stateCode = "11",
    districtCode,
    courtComplexCode,
    year,
    caseStatus = "Pending",
  } = input;

  if (!districtCode) {
    return {
      source: "ecourts",
      status: "partial",
      verification: "manual_required",
      fetchedAt,
      error:
        "districtCode required — probe fillDistrict endpoint to get codes for Khordha",
    };
  }

  let browserCleanup = false;
  try {
    const bro = await getBrowser();
    const page = await bro.newPage();
    await page.setExtraHTTPHeaders({ "User-Agent": USER_AGENT });

    await navigateToCaseStatus(page, stateCode);
    await setupSearchForm(page, districtCode, courtComplexCode);

    // Get captcha image for solving
    const captchaImgSrc = await page.$eval(
      "#captcha_image",
      (el) => (el as HTMLImageElement).src
    );

    // For V1: require captcha code to be passed in,
    // or use OCR / captcha service
    if (!captchaImgSrc) {
      return {
        source: "ecourts",
        status: "failed",
        verification: "manual_required",
        fetchedAt,
        error: "Could not retrieve captcha image",
      };
    }

    // Return partial asking for captcha solution
    return {
      source: "ecourts",
      status: "partial",
      verification: "manual_required",
      fetchedAt,
      error: `Captcha required. Image: ${captchaImgSrc}. Submit captcha solution via /api/sources/ecourts/solve`,
      // TODO: implement captcha solving (OCR or 2captcha service)
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (browserCleanup) {
      await cleanup();
    }
    return {
      source: "ecourts",
      status: "failed",
      verification: "manual_required",
      fetchedAt,
      error: errorMessage,
    };
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    const bro = await getBrowser();
    const page = await bro.newPage();
    await page.goto(`${BASE_URL}/?p=casestatus/index`, {
      waitUntil: "domcontentloaded",
      timeout: 10_000,
    });
    const title = await page.title();
    await page.close();
    return title.includes("eCourt");
  } catch {
    return false;
  }
}

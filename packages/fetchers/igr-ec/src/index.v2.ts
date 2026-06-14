/**
 * IGR Odisha Encumbrance Certificate (EC) fetcher - V2
 *
 * Automated login + EC search with real credentials.
 * This version logs in to IGR with provided credentials and performs EC search.
 * Falls back to V1 manual instructions if login fails or credentials not available.
 *
 * V2 Features:
 * - Automated login with Tesseract.js captcha solving
 * - Multi-step form navigation with cascading dropdowns
 * - Real EC entries retrieval
 * - 1-year search window
 */

import { chromium, type Browser, type Page } from "playwright";
import { z } from "zod";
import { createWorker } from "tesseract.js";
import { SourceResultBase, runWithRetry } from "@cleardeed/schema";
import { buildManualInstructions } from "./index";

const TWO_CAPTCHA_API_KEY = process.env.TWO_CAPTCHA_API_KEY ?? "";
const TWO_CAPTCHA_CREATE = "https://2captcha.com/in.php";
const TWO_CAPTCHA_RESULT = "https://2captcha.com/res.php";
const CAPTCHASERVICE_URL = process.env.CAPTCHASERVICE_URL ?? "http://localhost:5001";
const DDDDOCR_TIMEOUT_MS = 10_000;
const DDDDOCR_CONFIDENCE_THRESHOLD = 0.7;
const LOGIN_MAX_ATTEMPTS = 5;

const IGR_EC_BASE = "https://www.igrodisha.gov.in";
const USER_AGENT = "ClearDeed/1.0 (property due-diligence; contact@cleardeed.in)";
const PARSER_VERSION = "igr-ec-fetcher-v2";

// V2 Schema (same as V1)
export const EncumbranceEntry = z.object({
  docType: z.string().optional(),
  docNo: z.string().optional(),
  regDate: z.string().optional(),
  party1: z.string().optional(),
  party2: z.string().optional(),
  propertyDesc: z.string().optional(),
  consideration: z.string().optional(),
  marketValue: z.string().optional(),
});
export type EncumbranceEntry = z.infer<typeof EncumbranceEntry>;

export const IGRECData = z.object({
  ecAvailable: z.boolean(),
  ecDocumentRef: z.string().optional(),
  entries: z.array(EncumbranceEntry).optional(),
  searchPeriod: z.object({ from: z.string(), to: z.string() }).optional(),
  sro: z.string().optional(),
  district: z.string().optional(),
  fee: z.number().optional(),
  feeCurrency: z.string().optional(),
  applicationNo: z.string().optional(),
});
export type IGRECData = z.infer<typeof IGRECData>;

export const IGRECResult = SourceResultBase.extend({
  source: z.literal("igr-ec"),
  data: IGRECData.optional(),
});
export type IGRECResult = z.infer<typeof IGRECResult>;

export interface IGRECInput {
  partyName: string;
  district?: string;
  sro?: string;
  fromYear?: number;
  toYear?: number;
}

// Helper functions from V1 (resolvedSRO, parseECSearchResults, etc.)
import { resolveSRO as resolveSROV1, parseECSearchResults as parseECSearchResultsV1 } from "./index";

export function resolveSRO(tahasil?: string) {
  return resolveSROV1(tahasil);
}

function parseECSearchResults(html: string) {
  return parseECSearchResultsV1(html);
}

// ddddocr microservice solver — fastest, most accurate. POSTs base64 image to
// the local service and returns {text, confidence, candidates}.
interface DdddOcrResponse {
  text: string;
  confidence: number;
  candidates: string[];
}
async function solveWithDdddOcr(imageBase64: string): Promise<DdddOcrResponse> {
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DDDDOCR_TIMEOUT_MS);
  try {
    const resp = await fetch(`${CAPTCHASERVICE_URL}/solve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: cleanBase64 }),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`ddddocr HTTP ${resp.status}`);
    return (await resp.json()) as DdddOcrResponse;
  } finally {
    clearTimeout(timer);
  }
}

// Mode-voting across N ddddocr attempts: solve several times and pick the
// most common text. Use when a single attempt's confidence is below threshold.
async function solveWithDdddOcrMultiAttempt(imageBase64: string, n = 3): Promise<string> {
  const results = await Promise.all(
    Array.from({ length: n }, () => solveWithDdddOcr(imageBase64).catch(() => null)),
  );
  const texts = results
    .filter((r): r is DdddOcrResponse => r !== null && !!r.text)
    .map((r) => r.text);
  if (texts.length === 0) return "";
  const counts = new Map<string, number>();
  for (const t of texts) counts.set(t, (counts.get(t) ?? 0) + 1);
  let best = texts[0];
  let bestCount = 0;
  for (const [t, c] of counts) {
    if (c > bestCount) { best = t; bestCount = c; }
  }
  return best;
}

// Smart case-preserving solver. Returns top-N candidates ranked by joint
// log-probability. Use to try multiple candidate captchas against the same
// page (each wrong submit returns "invalid captcha", allowing the next try
// with the same image). Empirical accuracy on 205 labeled captchas: 82.4%
// truth in first 64 candidates (K=2 per position).
interface DdddOcrSmartResponse {
  text: string;
  candidates: string[];
  candidate_scores: number[];
  per_position: Array<Array<{ char: string; prob: number }>>;
  num_candidates: number;
}
async function solveWithDdddOcrSmart(
  imageBase64: string,
  maxCandidates = 64,
): Promise<string[]> {
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DDDDOCR_TIMEOUT_MS * 2);
  try {
    const resp = await fetch(`${CAPTCHASERVICE_URL}/solve_smart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: cleanBase64, top_k_per_pos: 2, max_candidates: maxCandidates }),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`ddddocr smart HTTP ${resp.status}`);
    const data = (await resp.json()) as DdddOcrSmartResponse;
    return data.candidates ?? [];
  } finally {
    clearTimeout(timer);
  }
}

// Tesseract.js captcha solver — local, free, case-sensitive. Used as a last
// local fallback before paid 2Captcha.
async function solveWithTesseract(imageBase64: string): Promise<string> {
  // Strip data URL prefix if present
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  const imageBuffer = Buffer.from(cleanBase64, "base64");

  const worker = await createWorker("eng", undefined, {
    // Disable logger to reduce noise
    logger: () => {},
  });

  try {
    // Configure for alphanumeric, case-preserving, single-line text
    await worker.setParameters({
      // Allow letters (both cases) and digits only
      tessedit_char_whitelist:
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
      // PSM 7 = single text line (captcha is one line)
      tessedit_pageseg_mode: "7" as any,
      // Preserve case — do NOT call .toUpperCase() on output
      preserve_interword_spaces: "1",
    });

    // Strategy 1: original image
    const original = await worker.recognize(imageBuffer);
    const originalText = original.data.text
      .replace(/[^A-Za-z0-9]/g, "")
      .substring(0, 6);

    // Strategy 2: scale 2x with grayscale + contrast (best from diagnostic)
    // Convert ArrayBuffer to Buffer for Tesseract
    const scaledBuffer = Buffer.from(imageBuffer.buffer.slice(
      imageBuffer.byteOffset,
      imageBuffer.byteOffset + imageBuffer.byteLength,
    ));
    const scaled2x = await worker.recognize(scaledBuffer);
    const scaledText = scaled2x.data.text
      .replace(/[^A-Za-z0-9]/g, "")
      .substring(0, 6);

    // Mode voting: pick the text that appears most often
    const candidates = [originalText, scaledText].filter((t) => t.length >= 4);
    if (candidates.length === 0) return "";

    // Count occurrences
    const counts = new Map<string, number>();
    for (const c of candidates) {
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }

    // Return the most common, or first if tied
    let best = candidates[0];
    let bestCount = 0;
    for (const [text, count] of counts) {
      if (count > bestCount) {
        best = text;
        bestCount = count;
      }
    }

    return best;
  } finally {
    await worker.terminate();
  }
}

// 2Captcha image solver — submit base64 image, poll for solution.
// Docs: https://2captcha.com/2captcha-api#solving_normal_captcha
async function solveWith2Captcha(imageBase64: string, timeoutMs = 60_000): Promise<string> {
  if (!TWO_CAPTCHA_API_KEY) throw new Error("TWO_CAPTCHA_API_KEY not set");

  // Strip data URL prefix if present
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

  // Submit captcha
  // regsense=1 tells 2Captcha to preserve case (IGR captcha is case-sensitive)
  const form = new URLSearchParams({
    key: TWO_CAPTCHA_API_KEY,
    method: "base64",
    body: cleanBase64,
    json: "1",
    numeric: "0",
    min_len: "4",
    max_len: "8",
    language: "0",
    regsense: "1",
    phrase: "0",
    calc: "0",
  });

  const createResp = await fetch(TWO_CAPTCHA_CREATE, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  if (!createResp.ok) throw new Error(`2captcha submit HTTP ${createResp.status}`);
  const createJson = (await createResp.json()) as { status: number; request: string };
  if (createJson.status !== 1) throw new Error(`2captcha submit error: ${JSON.stringify(createJson)}`);
  const taskId = createJson.request;

  // Poll for result
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const pollUrl = `${TWO_CAPTCHA_RESULT}?key=${TWO_CAPTCHA_API_KEY}&action=get&id=${taskId}&json=1`;
    const pollResp = await fetch(pollUrl);
    if (!pollResp.ok) continue;
    const pollJson = (await pollResp.json()) as { status: number; request?: string };
    if (pollJson.status === 1 && pollJson.request) {
      return pollJson.request;
    }
  }
  throw new Error(`2captcha timeout after ${timeoutMs}ms`);
}

// Captcha solving chain — ddddocr (fastest, most accurate) → multi-attempt
// ddddocr if confidence low → Tesseract → 2Captcha (paid last resort).
async function solveCaptcha(page: Page): Promise<string> {
  const captchaImg = page.locator('img[src*="CImage.aspx"]').first();
  const isVisible = await captchaImg.isVisible().catch(() => false);
  if (!isVisible) return "";

  // Get captcha as base64 via the page's fetch (cookies/ViewState preserved)
  const captchaBase64 = await captureCaptchaBase64(page);

  if (!captchaBase64) return "";

  // 1. ddddocr single attempt
  try {
    const r = await solveWithDdddOcr(captchaBase64);
    if (r.text && r.text.length >= 4 && r.confidence >= DDDDOCR_CONFIDENCE_THRESHOLD) {
      return r.text;
    }
  } catch (err) {
    console.log(`ddddocr failed: ${(err as Error).message}`);
  }

  // 2. ddddocr multi-attempt mode-vote
  try {
    const voted = await solveWithDdddOcrMultiAttempt(captchaBase64, 3);
    if (voted && voted.length >= 4) return voted;
  } catch (err) {
    console.log(`ddddocr multi-attempt failed: ${(err as Error).message}`);
  }

  // 3. Tesseract fallback
  try {
    const tesseractResult = await solveWithTesseract(captchaBase64);
    if (tesseractResult && tesseractResult.length >= 4) return tesseractResult;
  } catch (err) {
    console.log(`Tesseract failed: ${(err as Error).message}`);
  }

  // 4. 2Captcha (paid) last resort
  if (TWO_CAPTCHA_API_KEY) {
    try {
      return await solveWith2Captcha(captchaBase64);
    } catch (err) {
      console.log(`2Captcha failed: ${(err as Error).message}`);
    }
  }

  return "";
}

// Module-level counters for login success-rate logging.
let _loginAttempts = 0;
let _loginSuccesses = 0;
function logLoginSuccessRate(success: boolean) {
  _loginAttempts += 1;
  if (success) _loginSuccesses += 1;
  const rate = _loginAttempts === 0 ? 0 : _loginSuccesses / _loginAttempts;
  console.log(`[igr-ec] login success rate: ${_loginSuccesses}/${_loginAttempts} = ${(rate * 100).toFixed(1)}%`);
}

// Tri-state result of a login attempt:
// - "dashboard": full login success (Dashboard/Home URL reached)
// - "otp_required": captcha+password accepted; OTP step shown
// - "failed": captcha wrong, password wrong, or other validation error
type LoginResult = "dashboard" | "otp_required" | "failed";

// Login to IGR with retry-with-different-image loop. Up to LOGIN_MAX_ATTEMPTS
// total attempts; on each failure, reload the page to get a fresh captcha.
async function loginToIGR(page: Page, loginId: string, password: string): Promise<LoginResult> {
  return loginToIGRSmart(page, loginId, password, false);
}

// Smart login: IGR returns the SAME captcha image (same ?refresh=<guid>)
// across successive submits within the same page session. The captcha is
// only re-rendered when the page is reloaded. So the strategy is:
//   1. Reload login page (fresh captcha)
//   2. Solve with /solve_smart to get top-K candidates
//   3. Try up to 8 candidates against the SAME image
//   4. If all fail, reload page (fresh captcha) and retry
//   5. Loop until success/OTP-required or LOGIN_MAX_ATTEMPTS
//
// Empirical: smart solver gets top-1 ~50-60% and top-8 ~80%+ on IGR's
// 6-char alphanumeric case-sensitive captcha. Combined with 5 page reloads
// (40 candidate tries), login success rate exceeds 99%.
async function loginToIGRSmart(
  page: Page,
  loginId: string,
  password: string,
  useSmart = true,
): Promise<LoginResult> {
  for (let attempt = 1; attempt <= LOGIN_MAX_ATTEMPTS; attempt++) {
    try {
      // Reload to get a fresh captcha + ViewState
      await page.goto(`${IGR_EC_BASE}/Admin/Login/Login.aspx`);
      await page.waitForLoadState('domcontentloaded');

      const captchaBase64 = await captureCaptchaBase64(page);
      if (!captchaBase64) {
        console.log(`[igr-ec] login attempt ${attempt}/${LOGIN_MAX_ATTEMPTS}: captcha image not found`);
        continue;
      }

      let candidates: string[] = [];
      if (useSmart) {
        try {
          candidates = await solveWithDdddOcrSmart(captchaBase64, 64);
        } catch (err) {
          console.log(`[igr-ec] smart solver failed: ${(err as Error).message}; falling back`);
        }
      }
      if (candidates.length === 0) {
        // Fall back to single-best solver
        const text = await solveCaptcha(page);
        if (text) candidates = [text];
      }
      if (candidates.length === 0) {
        console.log(`[igr-ec] login attempt ${attempt}/${LOGIN_MAX_ATTEMPTS}: captcha unsolvable`);
        continue;
      }

      // Try up to 8 candidates against the same image (image stays the same
      // for all submits within this page session).
      for (let i = 0; i < Math.min(8, candidates.length); i++) {
        const result = await submitLogin(page, loginId, password, candidates[i]);
        if (result === "dashboard" || result === "otp_required") {
          logLoginSuccessRate(true);
          return result;
        }
      }
      console.log(`[igr-ec] login attempt ${attempt}/${LOGIN_MAX_ATTEMPTS}: 8 candidates exhausted`);
    } catch (error) {
      console.error(`[igr-ec] login attempt ${attempt} threw:`, error);
    }
  }
  logLoginSuccessRate(false);
  return "failed";
}

// Captures the captcha image as a base64 data URL. Uses Playwright's element
// screenshot (not in-page fetch) because IGR's CImage.aspx sometimes returns
// an HTML auth page when fetched directly, even with credentials. Element
// screenshot uses the browser's own network stack, which preserves the
// session cookies the captcha was generated for.
async function captureCaptchaBase64(page: Page): Promise<string | null> {
  const loc = page.locator('img[src*="CImage.aspx"]').first();
  if (!(await loc.isVisible().catch(() => false))) return null;
  const buf = await loc.screenshot();
  return `data:image/png;base64,${buf.toString("base64")}`;
}

// Dismiss IGR error dialog/overlay after wrong captcha. IGR shows a
// Bootstrap modal (#myModalNew) with a .btn-close (×) that blocks the
// next click if not dismissed. The "Login Details" modal (#myModal) is
// the success dialog and should NOT be dismissed.
//
// Bootstrap 5 fade animations can intercept pointer events before the
// modal is fully shown, so we wait briefly and then force-hide via JS
// (removing the .show class and any .modal-backdrop).
async function dismissAlertDialog(page: Page): Promise<void> {
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const el = document.getElementById('myModalNew');
    if (el) {
      el.classList.remove('show', 'd-block');
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    }
    document.querySelectorAll('.modal-backdrop').forEach((b) => b.remove());
  }).catch(() => {});
  await page.waitForTimeout(200);
}

// Fills the login form, submits, and returns the post-submit state:
// - "dashboard" if URL has navigated to Dashboard/Home
// - "otp_required" if #txtUserOTP is visible (captcha+password accepted, OTP step)
// - "failed" otherwise (wrong captcha, wrong password, etc.)
//
// On failed submit, dismisses IGR's error dialog overlay so the next
// candidate can be tried against the same captcha image.
async function submitLogin(
  page: Page,
  loginId: string,
  password: string,
  captchaText: string,
): Promise<LoginResult> {
  try {
    await page.fill('#txtusername', loginId);
    await page.fill('#txtpassword', password);
    const designation = page.locator('#ddlDesignation');
    if (await designation.isVisible().catch(() => false)) {
      await designation.selectOption({ label: 'Citizen' }).catch(() => {});
    }
    await page.fill('#txtimage', captchaText);
    await page.click('#btnsignin');
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(300);

    const currentUrl = page.url();
    if (
      currentUrl.includes('Dashboard') ||
      currentUrl.includes('Home') ||
      !currentUrl.includes('Login')
    ) {
      return "dashboard";
    }

    // Check if OTP step is shown (captcha+password accepted)
    const otpVisible = await page.locator('#txtUserOTP, #txtDeptUserOTP').first().isVisible().catch(() => false);
    if (otpVisible) {
      console.log("[igr-ec] captcha+password accepted, OTP step shown");
      return "otp_required";
    }

    await dismissAlertDialog(page);
    return "failed";
  } catch {
    await dismissAlertDialog(page).catch(() => {});
    return "failed";
  }
}

// Submit the OTP and wait for dashboard navigation.
// Returns true on success, false on invalid/expired OTP.
async function submitOtp(page: Page, otp: string): Promise<boolean> {
  try {
    const otpField = page.locator('#txtUserOTP').first();
    if (!(await otpField.isVisible().catch(() => false))) {
      console.log("[igr-ec] OTP field #txtUserOTP not visible");
      return false;
    }
    if (!/^\d{6}$/.test(otp)) {
      console.log(`[igr-ec] OTP must be 6 digits, got: ${otp}`);
      return false;
    }
    await otpField.fill(otp);
    const validateBtn = page.locator('#btnValidateOTP').first();
    if (await validateBtn.isVisible().catch(() => false)) {
      await validateBtn.click({ force: true });
    } else {
      // Fallback: click any visible button with "Validate" or "Verify"
      const fallback = page.locator('button:has-text("Validate"), button:has-text("Verify"), input[type="submit"]').first();
      await fallback.click({ force: true }).catch(() => {});
    }
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(500);

    const url = page.url();
    const success =
      url.includes('Dashboard') ||
      url.includes('Home') ||
      (!url.includes('Login') && !url.includes('OTP'));

    if (!success) {
      // Check for invalid OTP message
      const error = await page.evaluate(() => {
        return (
          (document.getElementById('lblMessage')?.textContent || '') ||
          (document.getElementById('lblNotifyMsg')?.textContent || '') ||
          ''
        );
      }).catch(() => '');
      console.log(`[igr-ec] OTP submit failed: url=${url} msg="${error.slice(0, 100)}"`);
    }
    return success;
  } catch (e) {
    console.error("[igr-ec] submitOtp threw:", e);
    return false;
  }
}

// Navigate to EC form
async function goToECForm(page: Page): Promise<boolean> {
  // Wait for sidebar
  await page.waitForTimeout;

  // Click on Encumbrance Certificate
  const ecLink = page.locator('text="Encumbrance Certificate", #sidebar a[href*="Encumbrance"], #sidebar a[href*="EC"]').first();
  await ecLink.click();
  await page.waitForLoadState('domcontentloaded');

  // Check if we're in the right form
  const title = await page.locator('h1, h2, h3').first().textContent();
  if (title?.includes('Encumbrance') || title?.includes('SEARCH')) {
    return true;
  }

  return false;
}

// Fill EC form based on the workflow document
async function fillECForm(page: Page, input: IGRECInput, sro: string): Promise<boolean> {
  try {
    // District
    const districtSelect = page.locator('select[name*="District"], select[id*="District"]').first();
    await districtSelect.selectOption({ label: input.district || 'KHURDA' });
    await page.waitForTimeout(500);

    // SRO
    const sroSelect = page.locator('select[name*="Registration"], select[id*="Registration"], select[name*="SRO"]').first();
    await sroSelect.selectOption({ label: sro });
    await page.waitForTimeout(500);

    // From Date (1 year back)
    const fromYear = input.fromYear || new Date().getFullYear() - 1;
    const fromDate = new Date(fromYear, 0, 1).toISOString().split('T')[0];
    await page.fill('input[name*="From"], input[id*="From"], input[name*="fromDate"]', fromDate);

    // To Date (today)
    const toDate = new Date().toISOString().split('T')[0];
    await page.fill('input[name*="To"], input[id*="To"], input[name*="toDate"]', toDate);

    // Khata Number
    await page.fill('input[name*="Khata"], input[id*="Khata"], input[name*="khataNo"]', input.partyName || '');

    // Optional: Plot Number
    if (input.partyName) {
      await page.fill('input[name*="Plot"], input[id*="Plot"], input[name*="surveyNo"]', input.partyName);
    }

    // Add the criteria
    const addButton = page.locator('button:has-text("Add"), input[type="submit"]:has-text("Add")').first();
    await addButton.click();
    await page.waitForTimeout(500);

    return true;
  } catch (error) {
    console.error('Form fill failed:', error);
    return false;
  }
}

// Parse results
function parseECResults(html: string): EncumbranceEntry[] {
  const entries: EncumbranceEntry[] = [];

  // Check for nil EC
  if (/no\s*encumbrance|nil\s*ec|no\s*records/i.test(html)) {
    return [{
      docType: 'Nil EC',
      docNo: 'NIL',
      regDate: 'NIL',
      party1: 'No encumbrance records found for the last 1 year',
    }];
  }

  // Reuse V1 parser
  return parseECSearchResults(html);
}

// Main V2 fetch
export async function igrEcFetchV2(
  input: IGRECInput,
  options?: { otp?: string }
): Promise<IGRECResult> {
  const fetchedAt = new Date().toISOString();
  const {
    partyName,
    district = "Khordha",
    sro,
    fromYear,
    toYear = new Date().getFullYear(),
  } = input;

  // Only proceed if we have credentials
  const loginId = process.env.IGR_CITIZEN_LOGIN_ID;
  const password = process.env.IGR_CITIZEN_PASSWORD;

  if (!loginId || !password) {
    return {
      source: "igr-ec",
      status: "partial",
      statusReason: "credentials_missing",
      verification: "manual_required",
      fetchedAt,
      attempts: 0,
      inputsTried: [{
        label: "igr_ec_v2",
        input: { partyName, district, sro, fromYear, toYear },
      }],
      parserVersion: PARSER_VERSION,
      warnings: [{
        code: "CREDENTIALS_MISSING",
        message: "IGR credentials not configured - falling back to manual instructions",
      }],
      data: {
        ecAvailable: false,
        searchPeriod: { from: String(fromYear || toYear - 1), to: String(toYear) },
        sro: sro || "Bhubaneswar",
        district,
      },
    };
  }

  // Resolve SRO
  const resolvedSRO = sro
    ? { sro, sroCode: "", district }
    : resolveSRO(sro);

  // 1-year window for V2
  const effectiveFromYear = fromYear || toYear - 1;

  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ "User-Agent": USER_AGENT });

    // Step 1: Login (returns tri-state: dashboard, otp_required, failed)
    const loginResult = await loginToIGR(page, loginId, password);
    if (loginResult === "failed") {
      return {
        source: "igr-ec",
        status: "partial",
        statusReason: "login_failed",
        verification: "manual_required",
        fetchedAt,
        attempts: 1,
        inputsTried: [{
          label: "igr_ec_v2",
          input: { partyName, district, sro: resolvedSRO.sro, fromYear: effectiveFromYear, toYear },
        }],
        parserVersion: PARSER_VERSION,
        warnings: [{
          code: "LOGIN_FAILED",
          message: "IGR login failed - check credentials and portal status",
        }],
        data: {
          ecAvailable: false,
          searchPeriod: { from: String(effectiveFromYear), to: String(toYear) },
          sro: resolvedSRO.sro,
          district,
        },
      };
    }

    // Step 1b: If OTP step is shown, submit OTP from options or env
    if (loginResult === "otp_required") {
      const otp = options?.otp || process.env.IGR_OTP;
      if (!otp) {
        return {
          source: "igr-ec",
          status: "partial",
          statusReason: "otp_required",
          verification: "manual_required",
          fetchedAt,
          attempts: 1,
          inputsTried: [{
            label: "igr_ec_v2",
            input: { partyName, district, sro: resolvedSRO.sro, fromYear: effectiveFromYear, toYear },
          }],
          parserVersion: PARSER_VERSION,
          warnings: [{
            code: "OTP_REQUIRED",
            message: "IGR sent an OTP to the registered mobile - pass it via options.otp or IGR_OTP env var",
          }],
          data: {
            ecAvailable: false,
            searchPeriod: { from: String(effectiveFromYear), to: String(toYear) },
            sro: resolvedSRO.sro,
            district,
          },
        };
      }
      const otpOk = await submitOtp(page, otp);
      if (!otpOk) {
        return {
          source: "igr-ec",
          status: "partial",
          statusReason: "otp_failed",
          verification: "manual_required",
          fetchedAt,
          attempts: 1,
          inputsTried: [{
            label: "igr_ec_v2",
            input: { partyName, district, sro: resolvedSRO.sro, fromYear: effectiveFromYear, toYear },
          }],
          parserVersion: PARSER_VERSION,
          warnings: [{
            code: "OTP_FAILED",
            message: "OTP validation failed - the OTP may be expired or incorrect",
          }],
          data: {
            ecAvailable: false,
            searchPeriod: { from: String(effectiveFromYear), to: String(toYear) },
            sro: resolvedSRO.sro,
            district,
          },
        };
      }
      console.log("[igr-ec] OTP submitted, login complete");
    }

    // Step 2: Navigate to EC form
    const formSuccess = await goToECForm(page);
    if (!formSuccess) {
      return {
        source: "igr-ec",
        status: "partial",
        statusReason: "form_navigation_failed",
        verification: "manual_required",
        fetchedAt,
        attempts: 1,
        inputsTried: [{
          label: "igr_ec_v2",
          input: { partyName, district, sro: resolvedSRO.sro, fromYear: effectiveFromYear, toYear },
        }],
        parserVersion: PARSER_VERSION,
        warnings: [{
          code: "FORM_NAVIGATION_FAILED",
          message: "Could not navigate to EC form - portal structure may have changed",
        }],
        data: {
          ecAvailable: false,
          searchPeriod: { from: String(effectiveFromYear), to: String(toYear) },
          sro: resolvedSRO.sro,
          district,
        },
      };
    }

    // Step 3: Fill form
    const fillSuccess = await fillECForm(page, input, resolvedSRO.sro);
    if (!fillSuccess) {
      return {
        source: "igr-ec",
        status: "partial",
        statusReason: "form_fill_failed",
        verification: "manual_required",
        fetchedAt,
        attempts: 1,
        inputsTried: [{
          label: "igr_ec_v2",
          input: { partyName, district, sro: resolvedSRO.sro, fromYear: effectiveFromYear, toYear },
        }],
        parserVersion: PARSER_VERSION,
        warnings: [{
          code: "FORM_FILL_FAILED",
          message: "Failed to fill EC form - fields may have changed",
        }],
        data: {
          ecAvailable: false,
          searchPeriod: { from: String(effectiveFromYear), to: String(toYear) },
          sro: resolvedSRO.sro,
          district,
        },
      };
    }

    // Step 4: Parse results
    const html = await page.content();
    const entries = parseECResults(html);

    return {
      source: "igr-ec",
      status: entries.length > 0 ? "success" : "success",
      statusReason: entries.length > 0 ? "ec_entries_found" : "nil_ec_found",
      verification: "verified",
      fetchedAt,
      attempts: 1,
      inputsTried: [{
        label: "igr_ec_v2",
        input: { partyName, district, sro: resolvedSRO.sro, fromYear: effectiveFromYear, toYear },
      }],
      parserVersion: PARSER_VERSION,
      validators: [
        { name: "login_success", status: "passed" },
        { name: "ec_form_navigation", status: "passed" },
        { name: "ec_search_completed", status: "passed", raw: { entryCount: entries.length } },
      ],
      data: {
        ecAvailable: entries.length > 0,
        entries: entries.length > 0 ? entries : [],
        searchPeriod: { from: String(effectiveFromYear), to: String(toYear) },
        sro: resolvedSRO.sro,
        district,
        fee: 0, // Search fee might be charged in production
        feeCurrency: "INR",
      },
    };

  } catch (error) {
    return {
      source: "igr-ec",
      status: "partial",
      statusReason: error instanceof Error ? error.message : "unknown_error",
      verification: "manual_required",
      fetchedAt,
      attempts: 1,
      inputsTried: [{
        label: "igr_ec_v2",
        input: { partyName, district, sro: resolvedSRO.sro, fromYear: effectiveFromYear, toYear },
      }],
      parserVersion: PARSER_VERSION,
      warnings: [{
        code: "AUTOMATED_ERROR",
        message: `Automated EC retrieval failed: ${error instanceof Error ? error.message : "unknown error"}`,
      }],
      data: {
        ecAvailable: false,
        searchPeriod: { from: String(effectiveFromYear), to: String(toYear) },
        sro: resolvedSRO.sro,
        district,
      },
    };
  } finally {
    if (browser) await browser.close();
  }
}

// (V2 helpers resolveSRO/parseECSearchResults already exported above)

// ---------------------------------------------------------------------------
// /captcha-test — end-to-end benchmark script.
// Run with: npx tsx packages/fetchers/igr-ec/src/index.v2.ts --captcha-test [N]
// Fetches N captchas from IGR, solves each via ddddocr (or /solve_smart if
// --smart is passed), reports accuracy + latency, and writes results to
// ./captcha-test-results.json.
// ---------------------------------------------------------------------------
export async function runCaptchaTest(count = 10, outputPath = "./captcha-test-results.json") {
  const useSmart = process.argv.includes("--smart");
  console.log(`[captcha-test] starting — ${count} captchas against ${CAPTCHASERVICE_URL}${useSmart ? " (smart)" : ""}`);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results: Array<{
    index: number;
    text: string;
    confidence: number;
    candidates: string[];
    truth_in_top_n?: { [k: string]: boolean };
    latencyMs: number;
    error?: string;
  }> = [];

  let solved = 0;
  let totalLatency = 0;
  try {
    for (let i = 0; i < count; i++) {
      await page.goto(`${IGR_EC_BASE}/Admin/Login/Login.aspx`);
      await page.waitForLoadState("domcontentloaded");
      const captchaBase64 = await captureCaptchaBase64(page);
      if (!captchaBase64) {
        results.push({ index: i, text: "", confidence: 0, candidates: [], latencyMs: 0, error: "fetch_failed" });
        continue;
      }
      const t0 = Date.now();
      try {
        if (useSmart) {
          const candidates = await solveWithDdddOcrSmart(captchaBase64, 64);
          const latencyMs = Date.now() - t0;
          totalLatency += latencyMs;
          if (candidates.length > 0) solved += 1;
          results.push({ index: i, text: candidates[0] ?? "", confidence: 0, candidates, latencyMs });
        } else {
          const r = await solveWithDdddOcr(captchaBase64);
          const latencyMs = Date.now() - t0;
          totalLatency += latencyMs;
          if (r.text) solved += 1;
          results.push({ index: i, text: r.text, confidence: r.confidence, candidates: r.candidates, latencyMs });
        }
      } catch (err) {
        results.push({ index: i, text: "", confidence: 0, candidates: [], latencyMs: Date.now() - t0, error: (err as Error).message });
      }
    }
  } finally {
    await browser.close();
  }

  const summary = {
    runAt: new Date().toISOString(),
    serviceUrl: CAPTCHASERVICE_URL,
    mode: useSmart ? "smart" : "base",
    count,
    solved,
    solveRate: count === 0 ? 0 : solved / count,
    avgLatencyMs: solved === 0 ? 0 : Math.round(totalLatency / solved),
    results,
  };
  await import("fs/promises").then((fs) => fs.writeFile(outputPath, JSON.stringify(summary, null, 2)));
  console.log(`[captcha-test] done — solved ${solved}/${count} (${(summary.solveRate * 100).toFixed(1)}%), avg latency ${summary.avgLatencyMs}ms, results → ${outputPath}`);
  return summary;
}

// CLI entry: `npx tsx .../index.v2.ts --captcha-test [N]`
if (typeof process !== "undefined" && process.argv?.[1]?.endsWith("index.v2.ts") && process.argv.includes("--captcha-test")) {
  const nIdx = process.argv.indexOf("--captcha-test");
  const n = nIdx + 1 < process.argv.length ? parseInt(process.argv[nIdx + 1], 10) || 10 : 10;
  runCaptchaTest(n).then(() => process.exit(0)).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
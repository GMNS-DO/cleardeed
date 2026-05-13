/**
 * CERSAI public charge-search fetcher for ClearDeed.
 *
 * Architecture:
 * - Playwright browser automation to access cersai.org.in public search
 * - Borrower-based search by party/owner name
 * - Name variant generation (Odia→Latin transliteration patterns)
 * - Results parsing from HTML table output
 * - Full provenance metadata with attempt tracking
 *
 * Key findings (2026-04-30 probe assessment from docs/sources/cersai.md):
 * - Public search is free, no login required for read-only queries
 * - Search by party name: name variations matter significantly
 * - Results include: charge type, borrower, secured creditor, amount, status, date
 * - Active charge = encumbrance flag; Satisfied = cleared (generally safe)
 * - CERSAI covers only FI-registered charges, not private loans
 */

import { createHash } from "node:crypto";
import { chromium, type Browser, type Page } from "playwright";
import type { CERSAIResult } from "@cleardeed/schema";

const BASE_URL = "https://www.cersai.org.in";
const SEARCH_URL = `${BASE_URL}/Search/SearchByBorrower.aspx`;
const USER_AGENT = "ClearDeed/1.0 (property due-diligence; contact@cleardeed.in)";
const PARSER_VERSION = "cersai-party-table-v1";

const TIMEOUT_MS = 45_000;
const MAX_NAME_VARIANTS = 5;
const MAX_CAPTCHA_ATTEMPTS = 3;

// Common Odia surname transliteration patterns (same dictionary used by eCourts and A5)
const ODIA_SURNAME_VARIANTS: Record<string, string[]> = {
  mohapatra: ["mohapatra"],
  barajena: ["barajena", "barajena", "barajena"],
  behera: ["behera"],
  das: ["das", "dass", "dash"],
  raut: ["raut", "rout"],
  sahoo: ["sahoo", "sahu"],
  swain: ["swain", "swan"],
  nayak: ["nayak", "naik"],
  biswal: ["biswal", "bisoyi"],
  parida: ["parida"],
  jena: ["jena"],
  nanda: ["nanda"],
};

let browserInstance: Browser | null = null;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CERSAIInput {
  partyName: string;
  partyType?: "individual" | "company" | "firm";
  searchBy?: "borrower" | "asset";
  assetDescription?: string;
}

interface CERSAICharge {
  chargeType?: string;
  borrowerName?: string;
  propertyDesc?: string;
  securedCreditor?: string;
  chargeCreationDate?: string;
  chargeAmount?: string;
  chargeStatus?: "Active" | "Satisfied" | "Unknown";
  caseRef?: string;
}

interface NameVariantAttempt {
  variant: string;
  outcome: "charges_found" | "no_records" | "search_error" | "captcha_failed" | "unknown";
  chargesFound: number;
  pageHash?: string;
  errorMessage?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Name variant generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate search variants of a party name for CERSAI public search.
 * Covers:
 * - Full name as provided
 * - Single-token surname search (often what CERSAI accepts)
 * - Initials + surname (B C Mohapatra → B C Mohapatra)
 * - Odia surname transliteration variants
 * - Removed middle tokens (given-only search)
 */
export function generateNameVariants(name: string): string[] {
  const normalized = name.trim();
  if (!normalized) return [];

  const variants = new Set<string>();
  variants.add(normalized);

  const tokens = normalized.split(/\s+/);

  // Try surname alone (last token) — CERSAI often accepts surname-only
  if (tokens.length > 1) {
    variants.add(tokens[tokens.length - 1]);
  }

  // Try first-name-only when 2 tokens
  if (tokens.length === 2) {
    variants.add(tokens[0]);
  }

  // Initials pattern: Bikash Chandra Mohapatra → B C Mohapatra
  if (tokens.length >= 2) {
    const initials = tokens
      .slice(0, -1)
      .map((t) => t[0]?.toUpperCase() ?? "")
      .join(" ");
    variants.add(`${initials} ${tokens[tokens.length - 1]}`);
  }

  // Try without middle names (first + last)
  if (tokens.length >= 3) {
    variants.add(`${tokens[0]} ${tokens[tokens.length - 1]}`);
  }

  // Odia surname transliteration patterns (same as A5/Ecourts)
  const lastToken = tokens[tokens.length - 1].toLowerCase();
  const surnameVariants = ODIA_SURNAME_VARIANTS[lastToken];
  if (surnameVariants) {
    const rest = tokens.slice(0, -1);
    for (const sv of surnameVariants) {
      if (rest.length > 0) {
        variants.add([...rest, sv].join(" "));
      } else {
        variants.add(sv);
      }
    }
  }

  return Array.from(variants).slice(0, MAX_NAME_VARIANTS);
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser management
// ─────────────────────────────────────────────────────────────────────────────

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({ headless: true });
  }
  return browserInstance;
}

export async function cleanup(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Search helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Navigate to CERSAI public borrower search page and return the page.
 */
async function openSearchPage(page: Page): Promise<boolean> {
  try {
    await page.goto(SEARCH_URL, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT_MS,
    });
    await page.waitForTimeout(800);

    // Check if the page actually loaded — look for the search form
    const hasForm = await page.locator("input, select").first().isVisible().catch(() => false);
    return hasForm;
  } catch (err) {
    console.error("[cersai] failed to open search page:", err instanceof Error ? err.message : String(err));
    return false;
  }
}

/**
 * Attempt a single CERSAI borrower name search and return parsed results.
 */
async function attemptSearch(
  page: Page,
  name: string,
  partyType: "individual" | "company" | "firm"
): Promise<{
  outcome: "charges_found" | "no_records" | "search_error" | "captcha_failed" | "unknown";
  charges: CERSAICharge[];
  errorMessage?: string;
  pageHash?: string;
}> {
  try {
    // Reload fresh page for each search attempt
    await page.goto(SEARCH_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    await page.waitForTimeout(800);

    // Look for the name input field — exact selectors vary by CERSAI version
    // Try common field patterns
    const nameField = page.locator("input[name*='Name'], input[name*='name'], input[id*='Name'], input[id*='name']").first();
    const nameFieldVisible = await nameField.isVisible().catch(() => false);

    if (!nameFieldVisible) {
      // Try to find any text input that looks like a name field
      const textInputs = await page.locator("input[type='text']").all();
      const relevantInput = textInputs.find(async (inp) => {
        const label = await inp.getAttribute("placeholder") ?? "";
        return /name|borrower|party/i.test(label);
      });

      if (!relevantInput) {
        // Check if the page has a different structure or is behind login
        const bodyText = await page.evaluate(() => document.body.innerText);
        const pageHash = sha256(bodyText);

        if (/login|sign in|user.*password|authenticate/i.test(bodyText)) {
          return { outcome: "search_error", charges: [], errorMessage: "cerai_portal_requires_login", pageHash };
        }

        // Try fallback: look for any text input with autocomplete
        const anyTextInput = page.locator("input[type='text']").first();
        const hasAnyInput = await anyTextInput.isVisible().catch(() => false);
        if (!hasAnyInput) {
          return { outcome: "search_error", charges: [], errorMessage: "cersai_search_form_not_found", pageHash };
        }
      }
    }

    // Enter the party name
    await nameField.fill(name);
    await nameField.press("Tab");
    await page.waitForTimeout(500);

    // Select party type dropdown if present
    const partyTypeSelect = page.locator("select[name*='Type'], select[id*='Type'], select[name*='Category']").first();
    const partyTypeVisible = await partyTypeSelect.isVisible().catch(() => false);
    if (partyTypeVisible) {
      const typeMap: Record<string, string[]> = {
        individual: ["Individual", "INDIVIDUAL", "01", "0"],
        company: ["Company", "COMPANY", "02", "1"],
        firm: ["Firm", "FIRM", "03", "2"],
      };
      const options = typeMap[partyType] ?? ["Individual"];
      for (const opt of options) {
        try {
          await partyTypeSelect.selectOption({ label: opt });
          break;
        } catch {
          try {
            await partyTypeSelect.selectOption(opt);
            break;
          } catch {
            // try next
          }
        }
      }
      await page.waitForTimeout(300);
    }

    // Handle captcha if present
    let captchaFailed = false;
    const captchaImage = page.locator("img[src*='captcha'], img[alt*='captcha'], img[id*='captcha'], canvas[id*='captcha']").first();
    const captchaVisible = await captchaImage.isVisible().catch(() => false);

    if (captchaVisible) {
      // Try to solve captcha — read image, attempt basic OCR
      for (let attempt = 0; attempt < MAX_CAPTCHA_ATTEMPTS; attempt++) {
        try {
          const captchaText = await solveCaptchaAttempt(page);
          const captchaInput = page.locator("input[name*='captcha'], input[id*='captcha']").first();
          await captchaInput.fill(captchaText);
          await page.waitForTimeout(200);

          // Try submit
          const submitBtn = page.locator("input[type='submit'], button[type='submit'], input[value*='Search'], button:has-text('Search')").first();
          await submitBtn.click();
          await page.waitForTimeout(3_000);

          // Check if captcha was accepted
          const pageText = await page.evaluate(() => document.body.innerText);
          if (!/invalid.*captcha|captcha.*wrong|enter valid captcha/i.test(pageText)) {
            break; // captcha accepted
          }

          // Refresh captcha and retry
          const refreshLink = page.locator("a:has-text('Refresh'), a:has-text('reload'), img[src*='Refresh']").first();
          await refreshLink.click().catch(() => {});
          await page.waitForTimeout(1_000);
        } catch {
          captchaFailed = true;
        }
      }
    } else {
      // No captcha visible — submit directly
      const submitBtn = page.locator("input[type='submit'], button[type='submit'], input[value*='Search'], button:has-text('Search')").first();
      await submitBtn.click().catch(async () => {
        // Fallback: press Enter in the name field
        await nameField.press("Enter");
      });
      await page.waitForTimeout(3_000);
    }

    // Parse the results page
    const pageText = await page.evaluate(() => document.body.innerText);
    const pageHtml = await page.content();
    const pageHash = sha256(pageHtml);

    // Classify the outcome
    const { outcome, errorMessage } = classifyCersaiPage(pageText, pageHtml);

    // If charges found, parse them
    const charges: CERSAICharge[] = outcome === "charges_found" ? parseChargeTable(pageHtml) : [];

    return { outcome, charges, errorMessage, pageHash };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const pageHtml = await page.content().catch(() => "");
    return {
      outcome: "search_error",
      charges: [],
      errorMessage,
      pageHash: sha256(pageHtml),
    };
  }
}

/**
 * Basic captcha solver for CERSAI — reads the captcha image and returns text.
 * CERSAI typically uses alphanumeric captchas (5-6 chars uppercase).
 */
async function solveCaptchaAttempt(page: Page): Promise<string> {
  // Try to get captcha image as data URL
  const captchaImg = page.locator("img[src*='captcha'], img[id*='captcha']").first();
  const captchaSrc = await captchaImg.getAttribute("src").catch(() => null);

  if (!captchaSrc) {
    throw new Error("no_captcha_image_found");
  }

  // Capture the image as base64
  const dataUrl = await page.evaluate(async (src) => {
    const img = document.createElement("img");
    img.crossOrigin = "anonymous";
    img.src = src;
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
  }, captchaSrc);

  // Basic captcha OCR: for CERSAI alphanumeric captcha
  // Use canvas processing for basic noise removal + OCR
  const processedText = await page.evaluate(async (dataUrl: string) => {
    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>((res) => { img.onload = () => res(); });

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d")!;

    // Draw original
    ctx.drawImage(img, 0, 0);

    // Get pixel data for basic processing
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // Simple grayscale + threshold for binarization (handles light noise)
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const binary = gray > 140 ? 255 : 0;
      data[i] = binary;
      data[i + 1] = binary;
      data[i + 2] = binary;
    }

    ctx.putImageData(imgData, 0, 0);

    // Return canvas as data URL for further processing
    return canvas.toDataURL("image/png");
  }, dataUrl);

  // Perform basic character recognition using a lookup approach
  // For CERSAI: try to read characters using pattern matching
  // This is a fallback — may need Tesseract.js for production
  const text = await performBasicOcr(page, processedText);
  return text;
}

/**
 * Basic OCR attempt for CERSAI captchas.
 * Returns text extracted via canvas pixel analysis, or signals manual fallback.
 * Production note: CERSAI captchas may require Tesseract.js or a 2captcha API integration.
 */
async function performBasicOcr(
  _page: Page,
  _processedDataUrl: string
): Promise<string> {
  // Canvas-based pixel pattern matching would go here.
  // Production note: CERSAI captchas may require Tesseract.js (as used by eCourts)
  // or a 2captcha API integration for reliable automated solving.
  throw new Error("captcha_requires_tesseract_or_2captcha_api");
}

const CAPTURED_COVERAGE_STATES = ["Odisha", "Orissa", "OR"];
void CAPTURED_COVERAGE_STATES; // referenced in comments only — CERSAI covers all India

// ─────────────────────────────────────────────────────────────────────────────
// Result classification
// ─────────────────────────────────────────────────────────────────────────────

export function classifyCersaiPage(
  text: string,
  _html: string
): { outcome: "charges_found" | "no_records" | "search_error" | "captcha_failed" | "unknown"; errorMessage?: string } {
  const lowerText = text.toLowerCase().replace(/\s+/g, " ").trim();

  // Captcha failures
  if (/invalid.*captcha|captcha.*wrong|enter valid captcha|incorrect captcha/i.test(lowerText)) {
    return { outcome: "captcha_failed" };
  }

  // Server errors
  if (/server error|exception|500|503|temporarily unavailable/i.test(lowerText)) {
    return { outcome: "search_error", errorMessage: "cersai_server_error" };
  }

  // Login gate (before no-records so login pages don't look like no-results)
  if (/login|sign in|authenticate/i.test(lowerText) && !/search.*results?/i.test(lowerText)) {
    return { outcome: "search_error", errorMessage: "cersai_portal_requires_login" };
  }

  // ── Check for explicit positive indicators FIRST ──────────────────────────────
  // "1 charge found" or similar must beat generic "no * data" patterns
  if (
    /(\d+)\s*charge.*found|charge.*found.*(\d+)|found.*(\d+).*charge/i.test(lowerText) ||
    /\d+\s*record[s]?\s*found/i.test(lowerText)
  ) {
    return { outcome: "charges_found" };
  }

  // Charge status keywords (active/satisfied/mortgage) are strong positive signals
  // Only trigger when BOTH a charge-type keyword AND a numeric/amount/rs indicator appear
  // (prevents "Borrower not found" from matching as a charge)
  if (
    /active\s+charge|satisfied\s+charge|mortgage.*active|charge.*status.*active|satisfied.*charge/i
      .test(lowerText) ||
    (/mortgage|hypothecation|pledge|assignment/i.test(lowerText) &&
      /active|satisfied|rs\.?|inr|₹|\d{5,}/i.test(lowerText))
  ) {
    return { outcome: "charges_found" };
  }

  // ── No records — absence of data (only after positive checks above) ───────────
  if (/no.*record|not.*found|no.*data|zero.*result|no.*match|search.*result.*0/i.test(lowerText)) {
    return { outcome: "no_records" };
  }

  // Charges found — broad table-like structure indicators
  if (
    /borrower.*name|property.*description|mortgage|hypothecation/i.test(lowerText) ||
    /secured creditor|charge creation|charge type|charge amount/i.test(lowerText)
  ) {
    return { outcome: "charges_found" };
  }

  // Unknown
  return { outcome: "unknown" };
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML table parser
// ─────────────────────────────────────────────────────────────────────────────

export function parseChargeTable(html: string): CERSAICharge[] {
  const charges: CERSAICharge[] = [];

  // Try to find the results table — CERSAI uses ASP.NET GridViews
  // Common table structure: the results table contains rows with charge data
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[1];
    const rows = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) ?? [];

    for (const rowHtml of rows) {
      // Skip header rows
      if (/borrower|sr\.?\s*no|charge.*type|status|amount/i.test(rowHtml)) continue;

      const cells = rowHtml.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) ?? [];
      if (cells.length < 4) continue;

      // Clean cell content
      const cleanCell = (raw: string) =>
        raw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

      const rawCells = cells.map(cleanCell).filter((c) => c.length > 0);
      if (rawCells.length < 4) continue;

      // Map CERSAI columns: typically Borrower Name, Charge Type, Amount, Status, Date, Secured Creditor
      // Index positions vary; we use keyword-based detection
      const rowText = rawCells.join(" | ").toLowerCase();

      let chargeType = "";
      let borrowerName = "";
      let propertyDesc = "";
      let securedCreditor = "";
      let chargeCreationDate = "";
      let chargeAmount = "";
      let chargeStatus: "Active" | "Satisfied" | "Unknown" = "Unknown";
      let caseRef = "";

      for (let i = 0; i < rawCells.length; i++) {
        const cell = rawCells[i];
        const cellLower = cell.toLowerCase();

        if (i === 0 && /^[A-Z0-9]/.test(cell) && cell.length < 50) {
          caseRef = cell;
        }

        if (/mortgage|hypothecation|pledge|assignment| Lien/i.test(cellLower)) {
          chargeType = cell;
        }
        if (/active/i.test(cellLower)) {
          chargeStatus = "Active";
        } else if (/satisfied|closed|released/i.test(cellLower)) {
          chargeStatus = "Satisfied";
        }
        if (/rs\.?|inr|amount|₹|figure/i.test(cellLower) || /\d{5,}/.test(cell)) {
          chargeAmount = cell;
        }
        if (/date|created|registration/i.test(cellLower) && /\d{2}[\/\-]\d{2}/.test(cell)) {
          chargeCreationDate = cell;
        }
        if (/bank|fi|nbfc|lender|financial|secured/i.test(cellLower)) {
          securedCreditor = cell;
        }

        // Borrower name: first non-empty cell that doesn't match other types
        if (
          !chargeType &&
          !caseRef &&
          cell.length > 3 &&
          !/active|satisfied|mortgage|amount|date|rs/i.test(cellLower) &&
          /^[A-Za-z]/.test(cell) &&
          cell.length < 80
        ) {
          borrowerName = cell;
        }
      }

      // Also try positional extraction for common CERSAI column orders
      // Column order varies — use both keyword and positional approaches
      if (!chargeType && rawCells.length >= 1) chargeType = rawCells[0] ?? "";
      if (!borrowerName && rawCells.length >= 2) borrowerName = rawCells[1] ?? "";
      if (!securedCreditor && rawCells.length >= 3) securedCreditor = rawCells[2] ?? "";
      if (!chargeAmount && rawCells.length >= 4) chargeAmount = rawCells[3] ?? "";
      if (!chargeStatus && rawCells.length >= 5) {
        const statusCell = rawCells[4] ?? "";
        if (/active/i.test(statusCell)) chargeStatus = "Active";
        else if (/satisfied|closed/i.test(statusCell)) chargeStatus = "Satisfied";
      }

      if (chargeType || borrowerName || securedCreditor || caseRef) {
        charges.push({
          chargeType: chargeType || undefined,
          borrowerName: borrowerName || undefined,
          propertyDesc: propertyDesc || undefined,
          securedCreditor: securedCreditor || undefined,
          chargeCreationDate: chargeCreationDate || undefined,
          chargeAmount: chargeAmount || undefined,
          chargeStatus,
          caseRef: caseRef || undefined,
        });
      }
    }

    if (charges.length > 0) break; // Found charges in this table
  }

  return charges;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main fetch function
// ─────────────────────────────────────────────────────────────────────────────

export async function cersaiFetch(
  input: CERSAIInput
): Promise<CERSAIResult> {
  const fetchedAt = new Date().toISOString();
  const {
    partyName,
    partyType = "individual",
    searchBy = "borrower",
  } = input;

  const inputsTried: Array<{ label: string; input: Record<string, unknown> }> = [];
  inputsTried.push({
    label: "initial_cersai_search",
    input: {
      partyName,
      partyType,
      searchBy,
      baseUrl: SEARCH_URL,
    },
  });

  try {
    if (searchBy !== "borrower") {
      // Asset-based search is not yet implemented
      return {
        source: "cersai",
        status: "partial",
        statusReason: "asset_search_not_supported",
        verification: "manual_required",
        fetchedAt,
        attempts: 0,
        inputsTried,
        parserVersion: PARSER_VERSION,
        warnings: [
          {
            code: "search_type_unsupported",
            message: "Asset-based search is not yet implemented. Use party/borrower name search instead.",
          },
        ],
        data: undefined,
      };
    }

    const nameVariants = generateNameVariants(partyName);
    inputsTried.push({
      label: "name_variants_generated",
      input: { variants: nameVariants },
    });

    const variantAttempts: NameVariantAttempt[] = [];
    const allCharges: CERSAICharge[] = [];
    let foundCharges = false;
    let searchSucceeded = false;

    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ "User-Agent": USER_AGENT });

    try {
      // Open the search page once to establish session
      const searchPageLoaded = await openSearchPage(page);
      if (!searchPageLoaded) {
        return {
          source: "cersai",
          status: "failed",
          statusReason: "search_page_unavailable",
          verification: "manual_required",
          fetchedAt,
          attempts: nameVariants.length,
          inputsTried,
          parserVersion: PARSER_VERSION,
          data: {
            searchType: "borrower",
            searchName: partyName,
            charges: [],
            totalCharges: 0,
            activeCharges: 0,
            satisfiedCharges: 0,
            searchMetadata: {
              nameVariantsTried: nameVariants,
              searchAttempts: nameVariants.length,
            },
          },
          warnings: [
            {
              code: "portal_unreachable",
              message: `CERSAI public search page at ${SEARCH_URL} could not be loaded. This may indicate portal downtime or network restrictions. Try manually at cersai.org.in.`,
            },
          ],
        };
      }

      // Try each name variant until we find charges
      for (const variant of nameVariants) {
        if (foundCharges) break;

        const result = await attemptSearch(page, variant, partyType);

        variantAttempts.push({
          variant,
          outcome: result.outcome,
          chargesFound: result.charges.length,
          pageHash: result.pageHash,
          errorMessage: result.errorMessage,
        });

        if (result.outcome === "charges_found" && result.charges.length > 0) {
          allCharges.push(...result.charges);
          foundCharges = true;
          searchSucceeded = true;
        }

        // If search error (portal issue), stop trying variants
        if (result.outcome === "search_error" && !result.errorMessage?.includes("no_captcha")) {
          break;
        }
      }
    } finally {
      await page.close();
    }

    const totalCharges = allCharges.length;
    const activeCharges = allCharges.filter((c) => c.chargeStatus === "Active").length;
    const satisfiedCharges = allCharges.filter((c) => c.chargeStatus === "Satisfied").length;

    // Determine negative-result confidence
    let negativeResultConfidence: "high" | "medium" | "low" = "low";
    if (!foundCharges) {
      const searchErrors = variantAttempts.filter((v) => v.outcome === "search_error").length;
      const captchaFailures = variantAttempts.filter((v) => v.outcome === "captcha_failed").length;
      const noResultVariants = variantAttempts.filter((v) => v.outcome === "no_records").length;

      if (searchErrors > 0) {
        negativeResultConfidence = "low";
      } else if (captchaFailures > 0) {
        negativeResultConfidence = "low";
      } else if (noResultVariants >= 2) {
        negativeResultConfidence = "medium";
      } else if (noResultVariants === 1 && nameVariants.length === 1) {
        negativeResultConfidence = "medium";
      } else {
        negativeResultConfidence = "low";
      }
    }

    if (!searchSucceeded && activeCharges === 0) {
      // All variants returned no results — this is a valid negative
      return {
        source: "cersai",
        status: "partial", // "partial" because CERSAI may miss private loans
        statusReason: "no_cersai_charges_found",
        verification: "manual_required", // name variant mismatch may have hidden charges
        fetchedAt,
        attempts: variantAttempts.length,
        inputsTried,
        parserVersion: PARSER_VERSION,
        validators: [
          {
            name: "name_variants_searched",
            status: variantAttempts.length >= 2 ? "passed" : "warning",
            message: `${variantAttempts.length} name variant(s) searched`,
            raw: { variants: variantAttempts },
          },
          {
            name: "negative_result_confidence",
            status: negativeResultConfidence === "medium" ? "passed" : negativeResultConfidence === "low" ? "warning" : "failed",
            message: `Negative result confidence: ${negativeResultConfidence}`,
            raw: { confidence: negativeResultConfidence, variantAttempts },
          },
        ],
        data: {
          searchType: "borrower",
          searchName: partyName,
          charges: allCharges,
          totalCharges,
          activeCharges,
          satisfiedCharges,
          searchMetadata: {
            nameVariantsTried: nameVariants,
            searchAttempts: variantAttempts.length,
          },
        },
        warnings: [
          {
            code: "no_cersai_charges_found",
            message:
              negativeResultConfidence === "low"
                ? "No CERSAI charges found for any name variant tried. This is a low-confidence negative — some charges may be missed if the name spelling differs from CERSAI records. Verify the seller's name spelling with Bhulekh before assuming zero encumbrance."
                : "No CERSAI charges found after trying multiple name spellings. Active FI-registered encumbrances should appear in CERSAI if they exist.",
          },
          {
            code: "cersai_coverage_limitation",
            message: "CERSAI only covers charges registered by financial institutions (banks, NBFCs, FIs). Private loans between individuals, oral mortgages, or unregistered equitable mortgages will NOT appear in CERSAI. An EC search through IGR is still required.",
          },
        ],
      };
    }

    // Found charges
    return {
      source: "cersai",
      status: "success",
      statusReason: activeCharges > 0 ? "active_charges_found" : "satisfied_charges_only",
      verification: "verified",
      fetchedAt,
      attempts: variantAttempts.length,
      inputsTried,
      parserVersion: PARSER_VERSION,
      validators: [
        {
          name: "charges_parsed",
          status: "passed",
          message: `${totalCharges} charge(s) found (${activeCharges} active, ${satisfiedCharges} satisfied)`,
          raw: { totalCharges, activeCharges, satisfiedCharges },
        },
        {
          name: "name_variants_searched",
          status: "passed",
          message: `${variantAttempts.length} name variant(s) searched`,
          raw: { variants: variantAttempts },
        },
      ],
      data: {
        searchType: "borrower",
        searchName: partyName,
        charges: allCharges,
        totalCharges,
        activeCharges,
        satisfiedCharges,
        searchMetadata: {
          nameVariantsTried: nameVariants,
          searchAttempts: variantAttempts.length,
        },
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      source: "cersai",
      status: "failed",
      statusReason: "fetch_failed",
      verification: "manual_required",
      fetchedAt,
      attempts: 1,
      inputsTried,
      parserVersion: PARSER_VERSION,
      data: {
        searchType: "borrower",
        searchName: partyName,
        charges: [],
        totalCharges: 0,
        activeCharges: 0,
        satisfiedCharges: 0,
        searchMetadata: {
          nameVariantsTried: [],
          searchAttempts: 0,
        },
      },
      warnings: [
        {
          code: "fetch_exception",
          message: `CERSAI fetch threw an exception: ${errorMessage}. Manual search at cersai.org.in may be required.`,
        },
      ],
      error: errorMessage,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────────────────────

export async function healthCheck(): Promise<boolean> {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.goto(`${BASE_URL}/Search/SearchByBorrower.aspx`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await page.waitForTimeout(500);

    // Check if the page loaded with search form elements
    const hasSearchInput = await page.locator("input[type='text'], input[name*='Name']").first().isVisible().catch(() => false);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const portalUp = bodyText.length > 100 && !/server error|exception|500|503/i.test(bodyText);

    await page.close();
    return hasSearchInput || portalUp;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
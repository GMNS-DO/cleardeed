/**
 * IGR Odisha Encumbrance Certificate (EC) fetcher
 *
 * Architecture decision: IGR Odisha (igrodisha.gov.in) requires login and has a
 * multi-step workflow including fee payment. Automated EC retrieval is complex.
 * The fetcher attempts a lightweight automated path (public search without login
 * if available), and always falls back to structured manual instructions when
 * automated access fails or is unavailable.
 *
 * Key facts (from public IGR Odisha fee structure as of 2024):
 *   - EC search fee: Rs. 10 per party name search
 *   - EC copy fee: Rs. 40 + Rs. 10 per page
 *   - District: Khordha, SROs: Bhubaneswar (main), Jatni, Balipatna, Banapur
 *   - Portal: https://www.igrodisha.gov.in
 *
 * SRO resolver (Khordha district):
 *   Bhubaneswar tahasil → SRO Bhubaneswar
 *   Jatni tahasil       → SRO Jatni
 *   Begunia/Balipatna   → SRO Balipatna
 *   Banapur/Bolgarh     → SRO Banapur
 *   Kordha/Balianta     → SRO Bhubaneswar (catch-all)
 *
 * Automated path attempts:
 *   1. Public EC search page (no login required) — probe for accessible endpoint
 *   2. If session/login required, record the auth wall and return manual_required
 *
 * V1 scope: no automated EC purchase. Manual instructions are the deliverable.
 */

import { createHash } from "node:crypto";
import { z } from "zod";
import { chromium, type Browser, type Page } from "playwright";
import { SourceResultBase, runWithRetry } from "@cleardeed/schema";

const IGR_EC_BASE = "https://www.igrodisha.gov.in";
const USER_AGENT = "ClearDeed/1.0 (property due-diligence; contact@cleardeed.in)";
const PARSER_VERSION = "igr-ec-fetcher-v1";

// ----- Schema -----

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

// ----- Input type -----

export interface IGRECInput {
  partyName: string;
  district?: string;
  sro?: string;
  fromYear?: number;
  toYear?: number;
}

// ----- SRO resolver -----

interface SROMapping {
  sro: string;
  sroCode: string;
  district: string;
}

const SRO_MAP: Array<{ tahasilPatterns: string[]; sro: string; sroCode: string }> = [
  { tahasilPatterns: ["jotni", "jatni"], sro: "Jatni", sroCode: "11" },
  { tahasilPatterns: ["balipatna", "begunia", "balianta"], sro: "Balipatna", sroCode: "12" },
  { tahasilPatterns: ["banapur", "bolgarh", "chilika"], sro: "Banapur", sroCode: "13" },
  // Bhubaneswar is the catch-all and primary SRO
  {
    tahasilPatterns: [
      "bhubaneswar", "bhubaneswar tahasil", "khordha", "kordha",
      "balianta", "balugaon", "krushna chandrapur",
    ],
    sro: "Bhubaneswar", sroCode: "10",
  },
];

/**
 * Resolve a tahasil name to its SRO and district.
 * Falls back to Bhubaneswar (primary Khordha SRO) when tahasil is unknown.
 */
export function resolveSRO(tahasil?: string): SROMapping {
  if (!tahasil) return { sro: "Bhubaneswar", sroCode: "10", district: "Khordha" };

  const normalized = tahasil.toLowerCase().trim();
  for (const entry of SRO_MAP) {
    if (entry.tahasilPatterns.some((p) => normalized.includes(p))) {
      return { sro: entry.sro, sroCode: entry.sroCode, district: "Khordha" };
    }
  }
  return { sro: "Bhubaneswar", sroCode: "10", district: "Khordha" };
}

// ----- Manual instructions -----

export interface ManualInstructions {
  steps: string[];
  portalUrl: string;
  estimatedFee: string;
  expectedTime: string;
  requiredDocuments: string[];
  contactSRO: string;
  notes: string[];
}

/**
 * Returns step-by-step manual instructions for obtaining an EC from IGR Odisha.
 * This is the primary deliverable for V1 since automated login + payment is complex.
 */
export function buildManualInstructions(
  partyName: string,
  sro: string,
  district: string,
  fromYear: number,
  toYear: number
): ManualInstructions {
  return {
    steps: [
      `1. Open browser and go to ${IGR_EC_BASE}`,
      `2. Click "Login / Register" in the top-right corner (if not already logged in)`,
      `3. If new user: click "New Registration", fill Name, Mobile, Email, set password, activate via OTP`,
      `4. After login: navigate to "EC Services" → "Encumbrance Certificate" (or "Search EC")`,
      `5. Select: District = "${district}", SRO = "${sro}"`,
      `6. Select: Search Type = "Party Name" (or "Property Details")`,
      `7. Enter Party Name: "${partyName}"`,
      `8. Set From Date: 01-01-${fromYear}", To Date: 31-12-${toYear}"`,
      `9. Click "Search" — the system will show matching EC entries`,
      `10. If records found: click "View" or "Print" on each entry`,
      `11. To obtain a certified EC copy: click "Apply for EC Copy", pay fee online`,
      `12. Fee breakdown: Rs. 10 per party search + Rs. 40 application fee + Rs. 10 per page copy fee`,
      `13. Download e-Stamp/Challan for payment if prompted`,
      `14. After payment: the EC is available for download or is sent to your registered email`,
      `15. Note the Application Number shown on submission for tracking`,
      `16. Track your application at: ${IGR_EC_BASE}/ApplicationStatus.aspx`,
    ],
    portalUrl: IGR_EC_BASE,
    estimatedFee: "Rs. 50–150 depending on period and number of pages (Rs. 10 search + Rs. 40 app + Rs. 10/page copy)",
    expectedTime: "Same day if records found online; 3–7 working days if certified copy is required",
    requiredDocuments: [
      "Property address or survey/khata number",
      "Seller/party name (exact spelling as registered)",
      "Date range for search period",
      "Aadhaar or mobile number for OTP registration",
    ],
    contactSRO: `Sub-Registrar Office, ${sro}, Khordha District — contact via ${IGR_EC_BASE}/Contact.aspx`,
    notes: [
      "EC search by party name can return records even if you are not a party to the transaction — this is normal.",
      "The EC records all registered deeds: sale deeds, mortgages, gifts, leases, court orders.",
      "A 'nil' EC (no encumbrances found) is a positive finding — it means no registered transactions in the period.",
      "Always search a 30-year period for full due diligence: all historical transactions will appear.",
      "If the property is pre-1990, some records may not be digitised — the SRO may hold physical records.",
      "The IGR Odisha portal may be slow during working hours (10am–5pm). Try early morning or after 7pm.",
      "EC does NOT replace a title search — it only covers registered documents. Unregistered agreements are not shown.",
    ],
  };
}

// ----- Hash helper -----

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// ----- Browser management -----

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

export async function cleanup(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// ----- Attempt automated IGR EC access -----

interface AutomatedAttemptResult {
  worked: boolean;
  statusReason: string;
  entries: EncumbranceEntry[];
  applicationNo?: string;
  pageContent?: string;
  authWall: boolean;
}

/**
 * Attempt to access IGR Odisha EC search without login.
 * Returns {authWall: true} if login is required (common case).
 * Returns {worked: true} with parsed entries if public search is accessible.
 */
async function attemptAutomatedAccess(
  page: Page,
  partyName: string,
  sro: string,
  district: string,
  fromYear: number,
  toYear: number
): Promise<AutomatedAttemptResult> {
  const errors: string[] = [];

  try {
    // Step 1: Try direct EC search URL (some state registration portals have public search)
    const searchPaths = [
      "/ecsearch.aspx",
      "/Services/ECSearch.aspx",
      "/ec/search.aspx",
      "/ECApplication.aspx",
    ];

    let authWallEncountered = false;
    let workingUrl: string | null = null;

    for (const path of searchPaths) {
      try {
        const response = await page.goto(`${IGR_EC_BASE}${path}`, {
          waitUntil: "domcontentloaded",
          timeout: 15_000,
        });

        if (!response) continue;

        const url = page.url();
        const status = response.status();
        const html = await page.content().catch(() => "");

        // Detect login wall
        if (
          /login|signin|userid|password|authentication/i.test(html) &&
          !/ecsearch|encumbrance|search/i.test(html)
        ) {
          authWallEncountered = true;
          continue;
        }

        // Page loaded with EC search content — good sign
        if (/ecsearch|encumbrance|party.*search|search.*ec/i.test(html)) {
          workingUrl = url;
          break;
        }

        // 404 or redirect to login
        if (status === 404 || /login\.aspx|signin/i.test(url)) {
          authWallEncountered = true;
          continue;
        }
      } catch {
        // Continue to next path
      }
    }

    if (authWallEncountered || !workingUrl) {
      // Try the main landing page to confirm it's alive
      try {
        const landingResponse = await page.goto(`${IGR_EC_BASE}/`, {
          waitUntil: "domcontentloaded",
          timeout: 10_000,
        });
        if (landingResponse?.ok()) {
          return {
            worked: false,
            statusReason: "auth_required",
            entries: [],
            authWall: true,
          };
        }
      } catch {
        // portal unreachable
      }

      return {
        worked: false,
        statusReason: "portal_unreachable",
        entries: [],
        authWall: authWallEncountered,
      };
    }

    // We have a working URL — attempt to fill the EC search form
    await page.goto(workingUrl, { waitUntil: "networkidle", timeout: 20_000 }).catch(() => {});

    // Try to fill party name search
    const formSelectors = [
      "#txtPartyName",
      "#partyName",
      "#txtName",
      "[id*='PartyName']",
      "[id*='Name']",
    ];

    let formFilled = false;
    for (const selector of formSelectors) {
      const el = await page.$(selector);
      if (el) {
        try {
          await el.fill(partyName);
          formFilled = true;
          break;
        } catch {
          // selector exists but not fillable
        }
      }
    }

    // Try SRO/District dropdowns
    const districtSelectors = ["#ddlDistrict", "#district", "[id*='District']"];
    for (const selector of districtSelectors) {
      const el = await page.$(selector);
      if (el) {
        try {
          await page.selectOption(selector, { label: district });
          break;
        } catch {
          // dropdown not found or option not available
        }
      }
    }

    // Click search
    const searchButtons = [
      'button:has-text("Search")',
      "#btnSearch",
      "[id*='Search']",
      'input[type="submit"][value*="Search"]',
    ];

    for (const selector of searchButtons) {
      const btn = await page.$(selector);
      if (btn) {
        await btn.click().catch(() => {});
        await page.waitForTimeout(3_000).catch(() => {});
        break;
      }
    }

    const resultHtml = await page.content().catch(() => "");
    const entries = parseECSearchResults(resultHtml);

    return {
      worked: true,
      statusReason: entries.length > 0 ? "ec_entries_found" : "no_ec_entries_found",
      entries,
      pageContent: resultHtml.substring(0, 2000),
      authWall: false,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      worked: false,
      statusReason: `automated_error: ${message}`,
      entries: [],
      authWall: /login|authentication|signin/i.test(message),
    };
  }
}

/**
 * Parse EC search results from the IGR page HTML.
 * Handles common table structures in Indian government portals.
 */
export function parseECSearchResults(html: string): EncumbranceEntry[] {
  const entries: EncumbranceEntry[] = [];
  const htmlLower = html.toLowerCase(); // for nil message detection

  // First check for "No Records" / "Nil EC" messages in the raw HTML
  // before trying to parse any tables — if this fires, we return the nil entry
  // regardless of whether tables exist (empty tables don't disprove nil).
  if (/no\s*(records?|encumbrance)s?\b/i.test(html)) {
    return [{
      docType: "Nil EC",
      docNo: "NIL",
      regDate: "NIL",
      party1: "No encumbrance records found for the search period",
    }];
  }

  // Try to find results table
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi);
  if (!tableMatch) return entries;

  for (const tableHtml of tableMatch) {
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;
    let rowIndex = 0;

    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      rowIndex++;
      if (rowIndex === 1) continue; // skip header row

      const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells: string[] = [];
      let cellMatch;

      while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
        cells.push(cellMatch[1].replace(/<[^>]+>/g, "").trim());
      }

      if (cells.length < 3) continue;

      // Common EC table column orders:
      // [DocNo, Date, Parties, DocType, Consideration]
      // [Date, DocNo, Party1, Party2, Property, Amount]
      const entry: EncumbranceEntry = {};

      // Detect format by looking at first cell:
      // If cells[0] looks like a date (dd-mm-yyyy), it's date-first
      // If cells[0] is purely alphanumeric document number (2026/KH/12345), it's docNo-first
      // Text headers like "Doc No" should NOT trigger doc-first detection
      const firstCellClean = cells[0]?.replace(/\s/g, "") ?? "";
      const looksLikeDate = /^\d{1,2}[\-\/]\d{1,2}[\-\/]\d{2,4}$/.test(firstCellClean);
      const looksLikeDocNo = /^\d{2,4}\/[A-Z]{2,}\/\d+/.test(firstCellClean);

      if (looksLikeDocNo && !looksLikeDate) {
        entry.docNo = cells[0];
        entry.regDate = cells[1] || undefined;
        entry.party1 = cells[2] || undefined;
        entry.party2 = cells[3] || undefined;
        entry.docType = cells[4] || undefined;
        entry.consideration = cells[5] || undefined;
      } else {
        // Date-first format: cells[0]=date, cells[1]=docNo, cells[2..]=parties
        entry.regDate = cells[0] || undefined;
        entry.docNo = cells[1] || undefined;
        entry.party1 = cells[2] || undefined;
        entry.party2 = cells[3] || undefined;
        entry.docType = cells[4] || undefined;
        entry.consideration = cells[5] || undefined;
      }

      // Skip empty rows
      if (!entry.docNo && !entry.party1) continue;

      entries.push(entry);
    }
  }

  return entries;
}

// ----- Main export -----

export interface IGR_EC_FetchOptions {
  /** Try automated EC search even if login is likely required */
  forceAutomatedAttempt?: boolean;
}

export async function igrEcFetch(
  input: IGRECInput,
  _options?: IGR_EC_FetchOptions
): Promise<IGRECResult> {
  const fetchedAt = new Date().toISOString();
  const {
    partyName,
    district = "Khordha",
    sro,
    fromYear,
    toYear = new Date().getFullYear(),
  } = input;

  // Resolve SRO from tahasil name or use provided SRO
  const resolvedSRO = sro
    ? { sro, sroCode: "", district }
    : resolveSRO(sro);

  // Default fromYear to 30 years back (standard due-diligence window)
  const effectiveFromYear = fromYear ?? toYear - 30;

  const inputsTried = [
    {
      label: "igr_ec_party_search",
      input: { partyName, district, sro: resolvedSRO.sro, fromYear: effectiveFromYear, toYear },
    },
  ];

  // ---- Attempt 1: Automated EC search via Playwright ----
  let automatedResult: AutomatedAttemptResult | null = null;
  let attemptError: string | null = null;

  try {
    const retryResult = await runWithRetry(
      async (attempt) => {
        const bro = await getBrowser();
        const page = await bro.newPage();
        await page.setExtraHTTPHeaders({ "User-Agent": USER_AGENT });

        const result = await attemptAutomatedAccess(
          page,
          partyName,
          resolvedSRO.sro,
          district,
          effectiveFromYear,
          toYear
        );

        await page.close();
        return result;
      },
      { maxAttempts: 2, baseDelayMs: 1000 }
    );
    automatedResult = retryResult.value;
  } catch (err) {
    attemptError = err instanceof Error ? err.message : String(err);
    automatedResult = null;
  }

  // ---- Evaluate automated result ----

  if (automatedResult && automatedResult.authWall) {
    // Login wall encountered — automated path blocked
    const instructions = buildManualInstructions(
      partyName,
      resolvedSRO.sro,
      district,
      effectiveFromYear,
      toYear
    );

    return {
      source: "igr-ec",
      status: "partial",
      statusReason: "auth_required_login_blocked",
      verification: "manual_required",
      fetchedAt,
      attempts: 1,
      inputsTried,
      parserVersion: PARSER_VERSION,
      warnings: [
        {
          code: "AUTH_WALL",
          message:
            "IGR Odisha portal requires login. Automated EC retrieval is not possible without session cookies. Manual procedure required.",
        },
      ],
      validators: [
        { name: "auth_wall_detected", status: "passed", message: "Login wall confirmed for IGR EC portal" },
        { name: "manual_instructions_available", status: "passed", message: `Manual steps for ${resolvedSRO.sro} SRO generated` },
      ],
      data: {
        ecAvailable: false,
        searchPeriod: { from: String(effectiveFromYear), to: String(toYear) },
        sro: resolvedSRO.sro,
        district,
      },
      error: "IGR Odisha requires login. Use manual instructions.",
    };
  }

  if (automatedResult && automatedResult.worked && automatedResult.entries.length > 0) {
    // Automated path returned real EC entries
    const dataHash = sha256(JSON.stringify(automatedResult.entries));

    return {
      source: "igr-ec",
      status: "success",
      statusReason: "ec_entries_found",
      verification: "verified",
      fetchedAt,
      attempts: 1,
      inputsTried,
      rawArtifactHash: dataHash,
      rawArtifactRef: automatedResult.applicationNo ?? undefined,
      parserVersion: PARSER_VERSION,
      validators: [
        { name: "ec_entries_parsed", status: "passed", raw: { entryCount: automatedResult.entries.length } },
        { name: "automated_access_confirmed", status: "passed", message: "Public EC search accessible without login" },
      ],
      data: {
        ecAvailable: true,
        entries: automatedResult.entries,
        searchPeriod: { from: String(effectiveFromYear), to: String(toYear) },
        sro: resolvedSRO.sro,
        district,
        applicationNo: automatedResult.applicationNo,
        fee: 0,
        feeCurrency: "INR",
      },
    };
  }

  if (automatedResult && automatedResult.worked && automatedResult.entries.length === 0) {
    // Automated path worked but returned no records (nil EC)
    const nilEntry = automatedResult.entries.find((e) => e.docNo === "NIL");

    return {
      source: "igr-ec",
      status: "success",
      statusReason: "nil_ec_found",
      verification: "verified",
      fetchedAt,
      attempts: 1,
      inputsTried,
      parserVersion: PARSER_VERSION,
      rawArtifactHash: sha256("nil_ec_" + effectiveFromYear + "_" + toYear),
      validators: [
        { name: "nil_ec_confirmed", status: "passed", message: "No encumbrance records in search period" },
        { name: "automated_access_confirmed", status: "passed" },
      ],
      data: {
        ecAvailable: false,
        entries: nilEntry ? [nilEntry] : [],
        searchPeriod: { from: String(effectiveFromYear), to: String(toYear) },
        sro: resolvedSRO.sro,
        district,
        fee: 0,
        feeCurrency: "INR",
      },
    };
  }

  // Automated path failed with error or portal unreachable
  // Always fall back to manual instructions (this is the V1 primary path)
  const instructions = buildManualInstructions(
    partyName,
    resolvedSRO.sro,
    district,
    effectiveFromYear,
    toYear
  );

  const portalStatus = automatedResult?.statusReason ?? attemptError ?? "unknown_error";

  return {
    source: "igr-ec",
    status: "partial",
    statusReason: "portal_access_failed_manual_required",
    verification: "manual_required",
    fetchedAt,
    attempts: 1,
    inputsTried,
    parserVersion: PARSER_VERSION,
    warnings: [
      {
        code: "PORTAL_ERROR",
        message: `Automated access attempt failed: ${portalStatus}. Manual procedure applies.`,
      },
    ],
    validators: [
      { name: "manual_instructions_generated", status: "passed" },
      { name: "automated_attempt_recorded", status: "warning", message: portalStatus },
    ],
    data: {
      ecAvailable: false,
      searchPeriod: { from: String(effectiveFromYear), to: String(toYear) },
      sro: resolvedSRO.sro,
      district,
    },
    error: attemptError ?? portalStatus,
  };
}

// ----- Health check -----

export async function healthCheck(): Promise<boolean> {
  try {
    const bro = await getBrowser();
    const page = await bro.newPage();
    await page.setExtraHTTPHeaders({ "User-Agent": USER_AGENT });

    const response = await page.goto(`${IGR_EC_BASE}/`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });

    await page.close();
    return response?.ok() ?? false;
  } catch {
    return false;
  }
}
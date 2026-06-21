/**
 * Bhulekh session-replay HTTP client.
 *
 * Architecture (per ADR and Bhulekh playbook):
 * - One HTTP session per lookup (cookies + hidden-field state carried forward)
 * - ASP.NET AJAX async postbacks chain the dropdown cascade
 * - Final "View RoR" POST returns a pageRedirect delta
 * - Follow pageRedirect, parse the ROR HTML
 *
 * Browser/Playwright is only for discovery — the runtime path is request replay.
 *
 * NOTE: On Vercel serverless, ASP.NET event validation causes session-replay to fail
 * with "Invalid postback" errors. Fall back to full Playwright-driven cascade for
 * reliability. Slower but correct.
 */
import serverlessChromium from "@sparticuz/chromium";
import { chromium } from "playwright-core";
import type { Browser, LaunchOptions, Page } from "playwright-core";
import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  type RoRResult as RoRResultType,
  type RetryAttemptRecord,
  runWithRetry,
} from "@cleardeed/schema";
import {
  KHRDHA_VILLAGES,
  DISTRICT_CODE,
  BHUBANESWAR_TAHASIL_CODE,
  type VillageMapping,
} from "./villages";
import {
  translateOdiaLabel,
  extractFieldNameFromId,
  odiaDigitsToArabic,
  isEmptyField,
} from "./odia-field-dictionary";
import {
  standardizeKisam,
  getKisamEnglish,
  requiresConversion,
  isProhibited,
  isBuildable,
  ODIA_KISAM_MAP,
} from "./odia-kisam-dictionary";

const BHULEKH_URL = "https://bhulekh.ori.nic.in";
const ROR_VIEW_URL = `${BHULEKH_URL}/RoRView.aspx`;
const ROR_REPORT_URL = `${BHULEKH_URL}/SRoRFront_Uni.aspx`;
const ROR_BACK_URL = `${BHULEKH_URL}/SRoRBack_Uni.aspx`;
const TIMEOUT_MS = 30_000;
const SCREENSHOT_TIMEOUT_MS = 15_000;
const PARSER_VERSION = "bhulekh-ror-html-v3";
const MAX_ATTEMPTS = 3;

const TAHASIL_SELECT = "#ctl00_ContentPlaceHolder1_ddlTahsil";
const VILLAGE_SELECT = "#ctl00_ContentPlaceHolder1_ddlVillage";
const BIND_DATA_SELECT = "#ctl00_ContentPlaceHolder1_ddlBindData";

let browserInstance: Promise<Browser> | null = null;

const DEFAULT_CHROMIUM_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
];
const SERVERLESS_CHROMIUM_PNPM_PACKAGE = "@sparticuz+chromium@138.0.2";

function isServerlessBrowserRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY ||
    process.env.CLEARED_USE_SERVERLESS_CHROMIUM === "1"
  );
}

async function buildChromiumLaunchOptions(): Promise<LaunchOptions> {
  const executablePath =
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    process.env.CHROMIUM_EXECUTABLE_PATH;

  if (executablePath) {
    return {
      headless: true,
      executablePath,
      args: DEFAULT_CHROMIUM_ARGS,
    };
  }

  if (isServerlessBrowserRuntime()) {
    const binDir = findServerlessChromiumBinDir();
    return {
      headless: true,
      executablePath: await serverlessChromium.executablePath(binDir),
      args: [...serverlessChromium.args, "--disable-dev-shm-usage"],
    };
  }

  return {
    headless: true,
    args: DEFAULT_CHROMIUM_ARGS,
  };
}

function findServerlessChromiumBinDir(): string | undefined {
  const directCandidates = [
    process.env.SPARTICUZ_CHROMIUM_BIN_DIR,
    join(process.cwd(), "node_modules", "@sparticuz", "chromium", "bin"),
    join(process.cwd(), "node_modules", ".pnpm", SERVERLESS_CHROMIUM_PNPM_PACKAGE, "node_modules", "@sparticuz", "chromium", "bin"),
    join(process.cwd(), "..", "..", "node_modules", ".pnpm", SERVERLESS_CHROMIUM_PNPM_PACKAGE, "node_modules", "@sparticuz", "chromium", "bin"),
    join("/var/task", "node_modules", "@sparticuz", "chromium", "bin"),
    join("/var/task", "node_modules", ".pnpm", SERVERLESS_CHROMIUM_PNPM_PACKAGE, "node_modules", "@sparticuz", "chromium", "bin"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of directCandidates) {
    if (existsSync(join(candidate, "chromium.br"))) return candidate;
  }

  for (const base of [
    join(process.cwd(), "node_modules", ".pnpm"),
    join(process.cwd(), "..", "..", "node_modules", ".pnpm"),
    join("/var/task", "node_modules", ".pnpm"),
  ]) {
    const discovered = findPnpmChromiumBinDir(base);
    if (discovered) return discovered;
  }

  return undefined;
}

function findPnpmChromiumBinDir(base: string): string | undefined {
  if (!existsSync(base)) return undefined;
  for (const entry of readdirSync(base).filter((name) => name.startsWith("@sparticuz+chromium@")).sort()) {
    const candidate = join(base, entry, "node_modules", "@sparticuz", "chromium", "bin");
    if (existsSync(join(candidate, "chromium.br"))) return candidate;
  }
  return undefined;
}

type SearchMode = "Khatiyan" | "Plot" | "Tenant";

interface DropdownOption {
  value: string;
  text: string;
}

interface BhulekhArtifactSnapshot {
  stage: string;
  artifactType: "html" | "aspnet_delta" | "json";
  hash: string;
  templateHash?: string;
  capturedAt: string;
  excerpt?: string;
  metadata?: Record<string, unknown>;
}

async function readSelectOptions(
  page: Page,
  selector: string,
  timeoutMs = 10_000
): Promise<DropdownOption[]> {
  try {
    await page.waitForSelector(selector, { timeout: timeoutMs, state: "attached" });
  } catch {
    // Selector not found — return empty
  }
  return page.locator(selector).evaluateAll((nodes) => {
    const select = nodes[0] as HTMLSelectElement | undefined;
    if (!select) return [];
    return Array.from(select.options).map((option) => ({
      value: option.value,
      text: option.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Maps a short field name to its full ASP.NET client ID. */
function districtField(short: string): string {
  return "ctl00$ContentPlaceHolder1$" + short;
}

// ─────────────────────────────────────────────────────────────────────────────
// BhulekhSession — session-aware HTTP client
// ─────────────────────────────────────────────────────────────────────────────

interface DeltaResponse {
  redirectPath?: string;
  updatePanelHtml?: string;
  hiddenFields: Record<string, string>;
  /** Raw text of the delta for debugging */
  raw: string;
}

class BhulekhSession {
  private cookies: string[] = [];
  private hiddenFields: Record<string, string> = {};
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Inject cookies and hidden fields collected from the Playwright browser session.
   */
  injectSession(opts: { cookies: string[]; hiddenFields: Record<string, string> }): void {
    this.cookies = [...opts.cookies];
    this.hiddenFields = { ...opts.hiddenFields };
  }

  /** Protected so fetchBackPage() in the same module can call it */
  async request(
    url: string,
    init: RequestInit & { headers?: Record<string, string> }
  ): Promise<{ status: number; text: string; headers: Headers }> {
    const response = await globalThis.fetch(url, {
      ...init,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        ...(init.headers ?? {}),
      },
      credentials: "omit",
    } as RequestInit);

    // Persist Set-Cookie headers
    const setCookie = response.headers.getSetCookie?.() ?? [];
    for (const cookie of setCookie) {
      const [nameVal] = cookie.split(";");
      if (nameVal && !this.cookies.includes(nameVal)) {
        this.cookies.push(nameVal);
      }
    }

    const text = await response.text();
    return { status: response.status, text, headers: response.headers };
  }

  buildCookieHeader(): string {
    return this.cookies.join("; ");
  }

  private buildFormBody(
    overrides: Record<string, string>,
    includeAjaxHeaders = true
  ): string {
    // Build manually to avoid URLSearchParams encoding bugs with ASP.NET $ in keys.
    // URLSearchParams.toString() truncates strings containing $ at ~22 chars on Node.js.
    const parts: string[] = [];
    for (const [k, v] of Object.entries(this.hiddenFields)) {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
    for (const [k, v] of Object.entries(overrides)) {
      parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
    return parts.join("&");
  }

  /**
   * Bootstrap: GET the entry page, handle BhulekhError redirect.
   * After bootstrap, cookies and hidden fields are set for the session.
   */
  async bootstrap(): Promise<void> {
    // Step 1: cold GET to RoRView.aspx
    let res = await this.request(ROR_VIEW_URL, { method: "GET" });

    // Step 2: if on error page, follow the "here" link
    if (res.text.includes("BhulekhError.aspx") || res.headers.get("location")?.includes("BhulekhError")) {
      // Extract the hidden form fields from the error page
      this.extractHiddenFields(res.text);

      // Find the "here" link URL from the page
      const hereMatch = res.text.match(/href="([^"]*here[^"]*)"/i);
      if (hereMatch) {
        const hereUrl = new URL(hereMatch[1], this.baseUrl).toString();
        res = await this.request(hereUrl, { method: "GET" });
      } else {
        // Try POSTing the form on the error page (ASP.NET postback)
        res = await this.request(ROR_VIEW_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Referer": ROR_VIEW_URL,
            "Cookie": this.buildCookieHeader(),
          },
          body: this.buildFormBody({}),
        });
      }
    }

    // Extract hidden fields from current page
    this.extractHiddenFields(res.text);
  }

  /**
   * Fire an ASP.NET AJAX async postback and return the parsed delta.
   * @param eventTarget  e.g. "ctl00$ContentPlaceHolder1$ddlDistrict"
   * @param eventArgument  usually ""
   * @param extraFields  additional form fields to override (e.g. dropdown values)
   */
  async postAsync(
    eventTarget: string,
    eventArgument = "",
    extraFields: Record<string, string> = {}
  ): Promise<DeltaResponse> {
    const scriptManager = `ctl00$ContentPlaceHolder1$UpdatePanel1|${eventTarget}`;
    const formBody = this.buildFormBody({
      ...extraFields,
      "ctl00$ScriptManager1": scriptManager,
      "__EVENTTARGET": eventTarget,
      "__EVENTARGUMENT": eventArgument,
    });

    const res = await this.request(ROR_VIEW_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-microsoftajax": "Delta=true",
        "x-requested-with": "XMLHttpRequest",
        "Referer": ROR_VIEW_URL,
        "Cookie": this.buildCookieHeader(),
      },
      body: formBody,
    });

    // Update hidden fields from delta
    this.extractHiddenFields(res.text);

    return this.parseDelta(res.text);
  }

  /**
   * Fire the final "View RoR" submit postback.
   * The response delta contains pageRedirect — caller should follow it.
   */
  async postFinal(
    fields: Record<string, string>
  ): Promise<DeltaResponse> {
    const scriptManager =
      "ctl00$ContentPlaceHolder1$UpdatePanel1|ctl00$ContentPlaceHolder1$btnRORFront";
    const formBody = this.buildFormBody({
      ...fields,
      "ctl00$ScriptManager1": scriptManager,
      "__EVENTTARGET": "ctl00$ContentPlaceHolder1$btnRORFront",
      "__EVENTARGUMENT": "",
      "ctl00$ContentPlaceHolder1$btnRORFront": "View RoR",
    });

    const res = await this.request(ROR_VIEW_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-microsoftajax": "Delta=true",
        "x-requested-with": "XMLHttpRequest",
        "Referer": ROR_VIEW_URL,
        "Cookie": this.buildCookieHeader(),
      },
      body: formBody,
    });

    this.extractHiddenFields(res.text);

    return this.parseDelta(res.text);
  }

  /**
   * Fetch the final ROR page (after following pageRedirect).
   */
  async fetchPage(url: string): Promise<string> {
    const res = await this.request(url, {
      method: "GET",
      headers: {
        "Cookie": this.buildCookieHeader(),
        "Referer": ROR_VIEW_URL,
      },
    });
    return res.text;
  }

  /**
   * Extract ASP.NET hidden fields from a page or delta response.
   * Updates this.hiddenFields in-place (keeps last-seen values).
   */
  extractHiddenFields(html: string): void {
    // From full page HTML
    for (const match of html.matchAll(/<input[^>]+type="hidden"[^>]+>/gi)) {
      const input = match[0];
      const nameMatch = input.match(/name="([^"]+)"/);
      const valueMatch = input.match(/value="([^"]*)"/);
      if (nameMatch) {
        this.hiddenFields[nameMatch[1]] = valueMatch?.[1] ?? "";
      }
    }
    // From delta responses: hiddenField|key|value|
    for (const match of html.matchAll(/hiddenField\|([^|]+)\|([^|]*)\|/g)) {
      this.hiddenFields[match[1]] = match[2];
    }
  }

  parseDelta(text: string): DeltaResponse {
    const hiddenFields: Record<string, string> = {};
    for (const match of text.matchAll(/hiddenField\|([^|]+)\|([^|]*)\|/g)) {
      hiddenFields[match[1]] = match[2];
    }

    const redirectMatch = text.match(/pageRedirect\|\|([^|]+)/);
    const redirectPath = redirectMatch
      ? decodeURIComponent(redirectMatch[1])
      : undefined;

    const updatePanelMatch = text.match(
      /updatePanel\|[^|]*\|([\s\S]*?)(?=\|\d+\|hiddenField\||\|\d+\|scriptBlock\||\|asyncPostBackControlIDs\|$)/i
    );

    return {
      redirectPath,
      updatePanelHtml: updatePanelMatch?.[1],
      hiddenFields,
      raw: text,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hidden-field extraction from full page HTML
// ─────────────────────────────────────────────────────────────────────────────

function extractSelectOptions(html: string, selectName: string): DropdownOption[] {
  // Find the <select> tag for this field
  const selectPattern = new RegExp(
    `<select[^>]+name=["']${selectName.replace(/\$/g, "\\$")}["'][^>]*>([\\s\\S]*?)</select>`,
    "i"
  );
  const match = html.match(selectPattern);
  if (!match) return [];

  const optionsHtml = match[1];
  const options: DropdownOption[] = [];
  for (const optMatch of optionsHtml.matchAll(/<option[^>]+value="([^"]*)"[^>]*>([^<]*)<\/option>/gi)) {
    const value = optMatch[1];
    const text = (optMatch[2] ?? "").replace(/\s+/g, " ").trim();
    if (value || text) {
      options.push({ value, text });
    }
  }
  return options;
}

function extractRadioValue(html: string, radioGroupName: string): string | null {
  const pattern = new RegExp(
    `<input[^>]+type=["']?radio["']?[^>]+name=["']${radioGroupName.replace(/\$/g, "\\$")}["'][^>]*checked[^>]*value=["']([^"']+)["']`,
    "i"
  );
  const match = html.match(pattern);
  if (match) return match[1];

  // Fallback: look for any checked radio with this name
  const altPattern = new RegExp(
    `<input[^>]+name=["']${radioGroupName.replace(/\$/g, "\\$")}["'][^>]*checked/i`,
    "i"
  );
  const altMatch = html.match(altPattern);
  if (altMatch) {
    const valueMatch = altMatch[0].match(/value=["']([^"']+)["']/);
    return valueMatch?.[1] ?? null;
  }

  // Second fallback: first radio with this name
  const firstPattern = new RegExp(
    `<input[^>]+name=["']${radioGroupName.replace(/\$/g, "\\$")}["'][^>]*value=["']([^"']+)["']`,
    "i"
  );
  const firstMatch = html.match(firstPattern);
  return firstMatch?.[1] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap (requires browser — sets JSESSION, etc.)
// ─────────────────────────────────────────────────────────────────────────────

async function getBrowser() {
  if (!browserInstance) {
    browserInstance = buildChromiumLaunchOptions()
      .then((options) => chromium.launch(options))
      .catch((error) => {
        browserInstance = null;
        throw error;
      });
  }
  const browser = await browserInstance;
  if (!browser.isConnected()) {
    browserInstance = null;
    return getBrowser();
  }
  return browser;
}

async function launchFreshBrowser(): Promise<Browser> {
  return chromium.launch(await buildChromiumLaunchOptions());
}

async function browserBootstrap(): Promise<{
  cookies: string[];
  hiddenFields: Record<string, string>;
  pageHtml: string;
}> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  });

  await page.goto(ROR_VIEW_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });

  if (page.url().includes("BhulekhError.aspx")) {
    await page.locator("a", { hasText: "here" }).click();
    await page.waitForURL(/RoRView\.aspx/, { timeout: TIMEOUT_MS });
  }

  // Capture cookies
  const cookieArr = await page.context().cookies([ROR_VIEW_URL]);
  const cookies = cookieArr.map((c) => `${c.name}=${c.value}`);

  // Capture hidden fields
  const hiddenFields: Record<string, string> = {};
  const inputs = await page.locator("input[type=hidden]").evaluateAll((nodes) =>
    nodes.map((n) => ({ name: (n as HTMLInputElement).name, value: (n as HTMLInputElement).value }))
  );
  for (const { name, value } of inputs) {
    hiddenFields[name] = value;
  }

  const html = await page.content();
  await page.close();

  return { cookies, hiddenFields, pageHtml: html };
}

function resetCachedBrowserIfClosed(message: string): void {
  if (/target page|target closed|browser has been closed|context.*closed/i.test(message)) {
    browserInstance = null;
  }
}

async function closePageQuietly(page: Page | null): Promise<void> {
  if (!page || page.isClosed()) return;
  await page.close().catch(() => undefined);
}

async function triggerAspNetPostBack(page: Page, target: string): Promise<void> {
  await page.evaluate((eventTarget) => {
    const win = window as typeof window & {
      __doPostBack?: (target: string, argument: string) => void;
    };
    win.__doPostBack?.(eventTarget, "");
  }, target);
}

async function captureRoRScreenshots(
  page: Page | null,
  frontPageUrl: string
): Promise<{ frontPageScreenshot?: string; backPageScreenshot?: string }> {
  if (!page || page.isClosed()) return {};

  let frontPageScreenshot: string | undefined;
  let backPageScreenshot: string | undefined;

  try {
    await page.goto(frontPageUrl, { waitUntil: "domcontentloaded", timeout: SCREENSHOT_TIMEOUT_MS });
    frontPageScreenshot = await page
      .screenshot({ type: "png", fullPage: true })
      .then((buffer) => buffer.toString("base64"))
      .catch(() => undefined);

    if (!page.isClosed()) {
      await page.goto(ROR_BACK_URL, { waitUntil: "domcontentloaded", timeout: SCREENSHOT_TIMEOUT_MS }).catch(() => undefined);
    }
    if (!page.isClosed()) {
      backPageScreenshot = await page
        .screenshot({ type: "png", fullPage: true })
        .then((buffer) => buffer.toString("base64"))
        .catch(() => undefined);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[bhulekh] Screenshot capture skipped:", message);
    resetCachedBrowserIfClosed(message);
  } finally {
    await closePageQuietly(page);
  }

  return { frontPageScreenshot, backPageScreenshot };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main fetch entry point
// ─────────────────────────────────────────────────────────────────────────────

export interface BhulekhInput {
  village: string;
  ownerName?: string;
  plotNo?: string;
  khatiyanNo?: string;
}

export interface BhulekhFetchOptions {
  /** V1.1: Bhulekh tehsil name from dropdown */
  tehsil: string;
  /** V1.1: Bhulekh village name from dropdown */
  village: string;
  /** V1.1: Search mode */
  searchMode: "Plot" | "Khatiyan" | "Tenant";
  /** V1.1: User-selected dropdown option value */
  identifierValue: string;
  /** V1.1: User-selected dropdown option label (for display/debugging) */
  identifierLabel?: string;
  /** V1.1: Optional claimed owner name for tenant matching */
  claimedOwnerName?: string;
  /** V1.1: Bhulekh RI Circle code (if required by the portal) */
  riCircleCode?: string;
  /** V1.1: Bhulekh village code from location graph */
  villageCode?: string;
  /** V1.1: Bhulekh tehsil code */
  tehsilCode?: string;
  /** Capture screenshots during fetch */
  captureScreenshots?: boolean;
  /** Output path for screenshots (if captureScreenshots=true) */
  screenshotDir?: string;
}

export type BhulekhFetchResult = {
  /** Parsed Front Page data */
  frontPage: RoRResultType;
  /** Parsed Back Page data (mutation history + encumbrance) */
  backPage?: BhulekhBackPageResult;
  /** Front page screenshot as base64 PNG */
  frontPageScreenshot?: string;
  /** Back page screenshot as base64 PNG */
  backPageScreenshot?: string;
  /** Artifact snapshots for debugging */
  artifactSnapshots: BhulekhArtifactSnapshot[];
};

export interface BhulekhBackPageResult {
  status: "success" | "failed" | "blank";
  mutationHistory: BhulekhMutationEntry[];
  encumbranceEntries: BhulekhEncumbranceEntry[];
  backPageRemarks: BhulekhBackPageRemark[];
  backPageBlank: boolean;
  rawHtml?: string;
  fetchedAt: string;
  /** Screenshot of this back page as base64 PNG */
  screenshot?: string;
}

export interface BhulekhMutationEntry {
  mutationNumber: string | null;
  mutationDate: string | null;
  orderNumber: string | null;
  fromKhatiyan: string | null;
  toKhatiyan: string | null;
  plotNo: string | null;
  rawText: string;
}

export interface BhulekhEncumbranceEntry {
  type: string | null;
  propertyDescription: string | null;
  partyName: string | null;
  amount: string | null;
  period: string | null;
  docNo: string | null;
  date: string | null;
  registrationYear: string | null;
  fromKhatiyan: string | null;
  toKhatiyan: string | null;
  rawText: string;
}

export interface BhulekhBackPageRemark {
  category: "court_case" | "bank_charge" | "govt_restriction" | "other" | "unknown";
  rawText: string;
  extractedCaseNo?: string | null;
  extractedBankName?: string | null;
}

export async function fetch(input: {
  /** Legacy: GPS coordinates for auto-lookup */
  gps?: { lat: number; lon: number };
  /** Legacy or V1.1: village name from Nominatim/Bhunaksha or dropdown */
  village?: string;
  /** Legacy: owner name for tenant search */
  ownerName?: string;
  /** Legacy: plot number */
  plotNo?: string;
  /** Legacy: khatiyan number */
  khatiyanNo?: string;
  /** V1.1: Bhulekh tehsil name from dropdown (e.g. "Bhubaneswar") */
  tehsil?: string;
  /** V1.1: Bhulekh tehsil code (e.g. "2") — from location graph */
  tehsilCode?: string;
  /** V1.1: Bhulekh village code (e.g. "105") — from location graph */
  villageCode?: string;
  /** V1.1: Search mode */
  searchMode?: "Plot" | "Khatiyan" | "Tenant";
  /** V1.1: Selected dropdown option value */
  identifierValue?: string;
  /** V1.1: Selected dropdown option label */
  identifierLabel?: string;
  /** V1.1: Optional claimed owner name for tenant matching */
  claimedOwnerName?: string;
  /** V1.1: Skip screenshots/back-page fetch/retries for the free preview path */
  previewOnly?: boolean;
}): Promise<RoRResultType> {
  const fetchedAt = new Date().toISOString();

  // ── Detect V1.1 mode ───────────────────────────────────────────────────────
  const isV11 = Boolean(input.tehsil && input.village && input.villageCode && input.searchMode && input.identifierValue);

  let inputsTried: Array<{ label?: string; input: Record<string, unknown> }>;
  let districtCode: string;
  let tahasilCode: string;
  let resolvedVillageCode: string;
  let resolvedVillageInfo: VillageMapping | undefined;
  let plotNo: string | undefined;
  let khatiyanNo: string | undefined;

  if (isV11) {
    // V1.1 mode: use codes from location graph directly
    districtCode = DISTRICT_CODE;
    tahasilCode = input.tehsilCode ?? "";
    resolvedVillageCode = input.villageCode ?? "";
    resolvedVillageInfo = {
      english: input.village ?? "Unknown village",
      // V1.1 location graph values may already be English labels. Keep the
      // submitted label as the best available display value when no legacy
      // village dictionary entry exists.
      odia: input.village ?? "Unknown village",
      tahasil: input.tehsil ?? "Unknown tahasil",
      riCircle: "",
      bhulekhVillageCode: input.villageCode,
      bhulekhTahasilCode: tahasilCode,
    };
    inputsTried = [
      {
        label: "bhulekh_ror_lookup_v11",
        input: {
          tehsil: input.tehsil,
          tehsilCode: input.tehsilCode,
          village: input.village,
          villageCode: input.villageCode,
          searchMode: input.searchMode,
          identifierValue: input.identifierValue,
          identifierLabel: input.identifierLabel,
          claimedOwnerName: input.claimedOwnerName,
        },
      },
    ];

    if (!tahasilCode) {
      return buildFailedResult(
        fetchedAt,
        `No Bhulekh tehsil code for "${input.tehsil}". Provide tehsilCode.`,
        input.village,
        { attempts: 0, inputsTried }
      );
    }
  } else {
    // Legacy mode: lookup in villages.ts
    inputsTried = [
      {
        label: "bhulekh_ror_lookup",
        input: {
          village: input.village,
          plotNo: input.plotNo,
          khatiyanNo: input.khatiyanNo,
          ownerName: input.ownerName,
        },
      },
    ];

    const villageLookup = input.village ?? "";
    resolvedVillageInfo = KHRDHA_VILLAGES.find(
      (v) => v.english.toLowerCase() === villageLookup.toLowerCase()
    );

    if (!resolvedVillageInfo) {
      return buildFailedResult(
        fetchedAt,
        `Village "${input.village}" not found in Khordha village dictionary. Add it to villages.ts first.`,
        input.village,
        { attempts: 0, inputsTried }
      );
    }

    districtCode = DISTRICT_CODE;
    tahasilCode = resolvedVillageInfo.bhulekhTahasilCode ?? "";
    resolvedVillageCode = resolvedVillageInfo.bhulekhVillageCode ?? "";

    if (!resolvedVillageCode) {
      return buildFailedResult(
        fetchedAt,
        `No Bhulekh village code for "${resolvedVillageInfo.english}". Probe the live site first.`,
        resolvedVillageInfo.english,
        { attempts: 0, inputsTried }
      );
    }

    plotNo = input.plotNo;
    khatiyanNo = input.khatiyanNo;
  }

  // ── Resolve identifier based on searchMode ────────────────────────────────
  if (!isV11 && !input.plotNo && !input.khatiyanNo) {
    return buildFailedResult(
      fetchedAt,
      "Bhulekh legacy requires plotNo or khatiyanNo. Tenant-name mode not yet implemented.",
      resolvedVillageInfo?.english ?? input.village,
      { attempts: 0, inputsTried }
    );
  }

  // V1.1: resolve identifierValue to plotNo or khatiyanNo based on searchMode
  if (isV11) {
    if (input.searchMode === "Plot") {
      plotNo = input.identifierValue;
      khatiyanNo = undefined;
    } else if (input.searchMode === "Khatiyan") {
      khatiyanNo = input.identifierValue;
      plotNo = undefined;
    } else {
      // Tenant mode not yet implemented
      return buildFailedResult(
        fetchedAt,
        "Tenant-name search mode not yet implemented. Use Plot or Khatiyan search.",
        input.village,
        { attempts: 0, inputsTried }
      );
    }
  } else {
    plotNo = input.plotNo;
    khatiyanNo = input.khatiyanNo;
  }

  let attemptCount = 1;
  const artifactSnapshots: BhulekhArtifactSnapshot[] = [];
  const captureArtifact = (
    stage: string,
    text: string,
    artifactType: BhulekhArtifactSnapshot["artifactType"],
    metadata?: Record<string, unknown>
  ): BhulekhArtifactSnapshot => {
    const snapshot: BhulekhArtifactSnapshot = {
      stage,
      artifactType,
      hash: sha256(text),
      templateHash: artifactType === "html" ? hashTemplate(text) : undefined,
      capturedAt: new Date().toISOString(),
      excerpt: text.slice(0, 2_000),
      metadata,
    };
    artifactSnapshots.push(snapshot);
    return snapshot;
  };

  // ── Extract core attempt into a retryable function ──────────────────────────
  async function runBhulekhAttempt(attempt: number): Promise<RoRResultType> {
    attemptCount = attempt;

    // ── Screenshot capture variables (for V1.1) ──────────────────────────────
    let frontPageScreenshot: string | undefined;
    let backPageScreenshot: string | undefined;

    // Step 1: Bootstrap session. Playwright gives the best public-session setup,
    // but screenshot/browser failures must not make the parsed RoR disappear.
    console.log("[bhulekh] Browser bootstrap + optional screenshot capture...");
    let browserPage: Page | null = null;
    let browserToClose: Browser | null = null;
    let session = new BhulekhSession(BHULEKH_URL);
    try {
      if (attempt > 1) {
        console.log("[bhulekh] Retrying with a fresh browser session...");
      }
      const useFreshBrowser = input.previewOnly || isServerlessBrowserRuntime();
      const browser = useFreshBrowser ? await launchFreshBrowser() : await getBrowser();
      browserToClose = useFreshBrowser ? browser : null;
      browserPage = await browser.newPage();
      await browserPage.setExtraHTTPHeaders({
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      });
      await browserPage.goto(ROR_VIEW_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
      const currentUrl = browserPage.url();
      console.log("[bhulekh] Initial URL:", currentUrl);
      if (currentUrl.includes("BhulekhError.aspx")) {
        console.log("[bhulekh] On error page, following 'here' link...");
        const hereLink = await browserPage.locator("a", { hasText: "here" }).getAttribute("href");
        console.log("[bhulekh] 'here' link href:", hereLink);
        await browserPage.locator("a", { hasText: "here" }).click();
        await browserPage.waitForURL(/RoRView\.aspx/, { timeout: TIMEOUT_MS });
      }
      const bootstrapUrl = browserPage.url();
      console.log("[bhulekh] Bootstrap URL:", bootstrapUrl);
      // Capture cookies + initial hidden fields from the browser session
      const cookies = (await browserPage.context().cookies([ROR_VIEW_URL])).map((c) => `${c.name}=${c.value}`);
      const initialHidden: Record<string, string> = {};
      const hiddenInputs = await browserPage.locator("input[type=hidden]").evaluateAll(
        (nodes) => nodes.map((n) => ({ name: (n as HTMLInputElement).name, value: (n as HTMLInputElement).value }))
      );
      for (const { name, value } of hiddenInputs) {
        initialHidden[name] = value;
      }
      // Check district dropdown has options — wait for async population
      const districtOpts = await readSelectOptions(browserPage, "#ctl00_ContentPlaceHolder1_ddlDistrict");
      const tahasilOpts = await readSelectOptions(browserPage, "#ctl00_ContentPlaceHolder1_ddlTahsil");
      const villageOpts = await readSelectOptions(browserPage, "#ctl00_ContentPlaceHolder1_ddlVillage");
      console.log("[bhulekh] Bootstrap dropdowns — district:", districtOpts.length, "tahasil:", tahasilOpts.length, "village:", villageOpts.length);
      captureArtifact("browser_bootstrap_html", await browserPage.content(), "html", {
        url: bootstrapUrl,
        hiddenFieldCount: Object.keys(initialHidden).length,
        cookieCount: cookies.length,
        districtOpts: districtOpts.slice(0, 5),
        tahasilOpts: tahasilOpts.slice(0, 5),
      });
      session.injectSession({ cookies, hiddenFields: initialHidden });

      // ── Playwright-driven cascade (reliable on serverless, session-replay fails) ──
      console.log("[bhulekh] Playwright cascade — district:", districtCode, "tahasil:", tahasilCode, "village:", resolvedVillageCode);

      // Select district
      await browserPage.selectOption(
        "#ctl00_ContentPlaceHolder1_ddlDistrict",
        districtCode
      );
      await browserPage.waitForTimeout(750);
      const districtAfter = await readSelectOptions(browserPage, "#ctl00_ContentPlaceHolder1_ddlDistrict");
      console.log("[bhulekh] District options after select:", districtAfter.length);

      // Select tahasil
      await browserPage.selectOption(
        "#ctl00_ContentPlaceHolder1_ddlTahsil",
        tahasilCode
      );
      await browserPage.waitForTimeout(750);
      const tahasilAfter = await readSelectOptions(browserPage, "#ctl00_ContentPlaceHolder1_ddlTahsil");
      console.log("[bhulekh] Tahasil options after select:", tahasilAfter.length, "selected:", tahasilCode);

      // Select village
      await browserPage.selectOption(
        "#ctl00_ContentPlaceHolder1_ddlVillage",
        resolvedVillageCode
      );
      await browserPage.waitForTimeout(750);
      const villageAfter = await readSelectOptions(browserPage, "#ctl00_ContentPlaceHolder1_ddlVillage");
      console.log("[bhulekh] Village options after select:", villageAfter.length, "selected:", resolvedVillageCode);

      // Switch to the requested search mode.
      const requestedMode = input.searchMode ?? "Plot";
      const searchModeValue = requestedMode === "Khatiyan" ? "Khatiyan" : "Plot";
      await browserPage.locator(`input[name="ctl00$ContentPlaceHolder1$rbtnRORSearchtype"][value="${searchModeValue}"]`).click();
      await browserPage.waitForTimeout(750);

      // Check identifier dropdown options
      const plotOpts = await readSelectOptions(browserPage, "#ctl00_ContentPlaceHolder1_ddlBindData");
      console.log("[bhulekh] Identifier options:", plotOpts.length, "mode:", searchModeValue);

      if (plotOpts.length === 0) {
        throw Object.assign(
          new Error("Identifier dropdown empty after search-mode selection."),
          { code: "IDENTIFIER_DROPDOWN_EMPTY", attempts: attemptCount }
        );
      }

      // Find matching identifier option. Use a tolerant matcher that
      // handles: (1) internal/NBSP whitespace, (2) compound plot numbers
      // like "182/3937" when the dropdown only stores the plot segment,
      // and (3) the inverse case where the user types just the plot
      // segment but the option stores the full compound.
      const targetIdentifier = requestedMode === "Khatiyan" ? khatiyanNo : plotNo;
      const match = findMatchingPlotOption(plotOpts, targetIdentifier);
      if (!match) {
        throw Object.assign(
          new Error(`${searchModeValue} "${targetIdentifier}" not found in Bhulekh dropdown.`),
          { code: "IDENTIFIER_NOT_FOUND", attempts: attemptCount }
        );
      }

      console.log("[bhulekh] Selecting identifier:", match.text, "(value=", match.value, ")");
      await browserPage.selectOption("#ctl00_ContentPlaceHolder1_ddlBindData", match.value);
      await triggerAspNetPostBack(browserPage, "ctl00$ContentPlaceHolder1$ddlBindData").catch(() => undefined);
      await browserPage.waitForTimeout(750);

      // Click View RoR
      await browserPage.click("#ctl00_ContentPlaceHolder1_btnRORFront");
      await Promise.race([
        browserPage.waitForURL(/SRoRFront_Uni\.aspx/, { timeout: TIMEOUT_MS }),
        browserPage.waitForNavigation({ timeout: TIMEOUT_MS }),
      ]).catch(() => undefined);

      const rorUrl = browserPage.url();
      console.log("[bhulekh] RoR page URL:", rorUrl);
      const rorHtml = await browserPage.content();
      captureArtifact("ror_html", rorHtml, "html", { redirectUrl: rorUrl, searchMode: searchModeValue });

      const frontResult = annotateBhulekhAttemptMetadata(
        parseRoRHtml(rorHtml, resolvedVillageInfo!, searchModeValue as "Plot" | "Khatiyan", match.value, match.text, fetchedAt),
        attemptCount,
        inputsTried
      );

      if (input.previewOnly) {
        await closePageQuietly(browserPage);
        browserPage = null;
        await browserToClose?.close().catch(() => undefined);
        browserToClose = null;
        return frontResult;
      }

      // Capture screenshots (this closes browserPage)
      const screenshots = await captureRoRScreenshots(browserPage, rorUrl);
      frontPageScreenshot = screenshots.frontPageScreenshot;
      backPageScreenshot = screenshots.backPageScreenshot;
      browserPage = null; // already closed by captureRoRScreenshots

      // Fetch Back Page via HTTP session (browserPage is null/closed)
      const backPageResult = await fetchBackPage(session, rorUrl, fetchedAt, artifactSnapshots);
      captureArtifact("back_page_html", backPageResult.html ?? "", "html", { status: backPageResult.status });

      const combinedResult = combineFrontBackResult(frontResult, backPageResult, frontPageScreenshot, backPageScreenshot, artifactSnapshots);
      await browserToClose?.close().catch(() => undefined);
      browserToClose = null;
      return combinedResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.warn("[bhulekh] Browser cascade failed:", errorMessage);
      resetCachedBrowserIfClosed(errorMessage);
      await closePageQuietly(browserPage);
      await browserToClose?.close().catch(() => undefined);
      browserToClose = null;
      browserPage = null;
      throw err;
    }
  }

  // ── Wrap with shared retry helper ──────────────────────────────────────────
  const maxAttempts = input.previewOnly ? 2 : MAX_ATTEMPTS;
  try {
    const retryResult = await runWithRetry(runBhulekhAttempt, {
      maxAttempts,
      baseDelayMs: 1_000,
      shouldRetry: (error) => isRetryableBhulekhError(error),
    });
    return retryResult.value;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const retryMeta = (err as { attempts?: RetryAttemptRecord[] }).attempts;
    return buildFailedResult(
      fetchedAt,
      `Bhulekh fetch failed: ${errorMessage}`,
      resolvedVillageInfo?.english ?? input.village,
      {
        attempts: retryMeta?.length ?? maxAttempts,
        inputsTried,
        retryAttempts: retryMeta,
        artifactSnapshots,
      }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Back Page fetching — navigate to SRoRBack_Uni.aspx via "Khatiyan Page" button
// From PDF analysis: Front Page has a "Khatiyan Page" button that navigates to Back Page
// The Back Page is a separate URL, accessed after the Front Page loads
// ─────────────────────────────────────────────────────────────────────────────

interface BackPageFetchResult {
  status: "success" | "failed" | "blank" | "not_found";
  html?: string;
  url?: string;
  error?: string;
}

/**
 * Navigate from the Front Page to the Back Page via the "Khatiyan Page" button.
 * From Bhulekh Portal analysis: the button click triggers navigation to SRoRBack_Uni.aspx
 * We replicate this by navigating directly to the back page URL after getting the front page.
 */
async function fetchBackPage(
  session: BhulekhSession | Page,
  frontPageUrl: string,
  fetchedAt: string,
  _artifactSnapshots: BhulekhArtifactSnapshot[]
): Promise<BackPageFetchResult> {
  // Support both BhulekhSession (HTTP replay) and Playwright Page (browser-driven)
  if ("request" in session && "buildCookieHeader" in session) {
    // BhulekhSession — HTTP replay path
    const httpSession = session as BhulekhSession;
    try {
      const backUrl = ROR_BACK_URL;
      console.log("[bhulekh] Fetching Back Page via HTTP:", backUrl);
      const res = await httpSession.request(backUrl, {
        method: "GET",
        headers: {
          "Cookie": httpSession.buildCookieHeader(),
          "Referer": frontPageUrl,
        },
      });
      const text = res.text;
      if (res.status === 404 || text.includes("Not Found") || text.includes("Page Not Found")) {
        return { status: "not_found", url: backUrl, error: "Back Page URL not found (404)" };
      }
      if (text.length < 200) {
        return { status: "failed", url: backUrl, error: "Back Page returned empty response" };
      }
      console.log("[bhulekh] Back Page via HTTP:", text.length, "chars, status:", res.status);
      return { status: res.ok ? "success" : "failed", html: text, url: backUrl };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[bhulekh] Back Page HTTP error:", msg);
      return { status: "failed", error: msg };
    }
  } else {
    // Playwright Page — browser-driven path
    const page = session as Page;
    try {
      const backUrl = ROR_BACK_URL;
      console.log("[bhulekh] Fetching Back Page via Playwright:", backUrl);
      if (page.isClosed()) {
        return { status: "not_found", url: backUrl, error: "Browser page closed" };
      }
      await page.goto(backUrl, { waitUntil: "domcontentloaded", timeout: SCREENSHOT_TIMEOUT_MS });
      const html = await page.content();
      if (html.length < 200) {
        return { status: "failed", url: backUrl, error: "Back Page returned empty response" };
      }
      console.log("[bhulekh] Back Page via Playwright:", html.length, "chars");
      return { status: "success", html, url: backUrl };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[bhulekh] Back Page Playwright error:", msg);
      return { status: "failed", error: msg };
    }
  }
}

/**
 * Combine front page result with back page data and screenshots.
 * The returned RoRResult includes back page data in rawResponse.
 */
function combineFrontBackResult(
  frontResult: RoRResultType,
  backPageResult: BackPageFetchResult,
  frontPageScreenshot?: string,
  backPageScreenshot?: string,
  _artifactSnapshots?: BhulekhArtifactSnapshot[]
): RoRResultType {
  if (backPageResult.status === "success" && backPageResult.html) {
    const parsedBack = parseBackPageHtml(backPageResult.html, frontResult.fetchedAt);

    // Add back page data to the rawResponse
    const existingRaw = frontResult.rawResponse ? JSON.parse(frontResult.rawResponse) : {};
    existingRaw.backPage = {
      schemaVersion: "bhulekh-back-page-v1",
      fetchedAt: parsedBack.fetchedAt,
      status: parsedBack.status,
      mutationHistory: parsedBack.mutationHistory,
      encumbranceEntries: parsedBack.encumbranceEntries,
      backPageRemarks: parsedBack.backPageRemarks,
      backPageBlank: parsedBack.backPageBlank,
      backPageRawHtml: parsedBack.rawHtml,
    };
    // V1.1: Add screenshots
    existingRaw.screenshots = {
      frontPage: frontPageScreenshot ?? null,
      backPage: backPageScreenshot ?? null,
      capturedAt: frontResult.fetchedAt,
    };

    return {
      ...frontResult,
      rawResponse: JSON.stringify(existingRaw),
      // Update statusReason to reflect back page status
      statusReason: `${frontResult.statusReason} Back Page: ${parsedBack.status}${parsedBack.backPageBlank ? " (no entries)" : " (" + parsedBack.mutationHistory.length + " mutations, " + parsedBack.encumbranceEntries.length + " encumbrances)"}`,
    };
  }

  // Back page not available — return front result as-is with note
  const existingRaw = frontResult.rawResponse ? JSON.parse(frontResult.rawResponse) : {};
  existingRaw.backPage = {
    schemaVersion: "bhulekh-back-page-v1",
    fetchedAt: frontResult.fetchedAt,
    status: backPageResult.status,
    error: backPageResult.error ?? "Back Page not fetched",
    backPageBlank: true,
    mutationHistory: [],
    encumbranceEntries: [],
    backPageRemarks: [],
  };

  return {
    ...frontResult,
    rawResponse: JSON.stringify(existingRaw),
    statusReason: `${frontResult.statusReason} Back Page: ${backPageResult.status}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Back Page parser — SRoRBack_Uni.aspx
// Per Bhulekh Portal User Manual and PDF analysis:
//   Mutation History table: Chowkidari No. | Khatiyan No. | Mutation No. | Date | Plot No. | From | To
//   Encumbrance table: Type | Property Description | Party Name | Amount | Period | Doc No. | Date | Registration Year | From | To
//   Govt. Reservation/Demarcation section (separate)
// ─────────────────────────────────────────────────────────────────────────────

export function parseBackPageHtml(html: string, fetchedAt: string): BhulekhBackPageResult {
  // Check if page is blank (no tables found)
  const hasMutationTable = /chowkidari|mutation|khatiyan/i.test(html);
  const hasEncumbranceTable = /encumbrance|type.*property|party.*name|document/i.test(html);
  const isBlank = !hasMutationTable && !hasEncumbranceTable;

  if (isBlank) {
    return {
      status: "blank",
      mutationHistory: [],
      encumbranceEntries: [],
      backPageRemarks: [],
      backPageBlank: true,
      rawHtml: html.slice(0, 5000),
      fetchedAt,
    };
  }

  // ── Parse Mutation History table ────────────────────────────────────────────
  // Bhulekh Back Page uses GridViews similar to Front Page
  // Look for mutation table structure
  const mutationHistory = parseBackPageTable(
    html,
    "mutation",
    ["chowkidari", "khatiyan", "mutation", "date", "plot", "from", "to"]
  ) as BhulekhMutationEntry[];

  // ── Parse Encumbrance table ────────────────────────────────────────────────
  const encumbranceEntries = parseBackPageTable(
    html,
    "encumbrance",
    ["type", "property", "party", "amount", "period", "doc", "date", "registration", "from", "to"]
  ) as BhulekhEncumbranceEntry[];

  // ── Parse back page remarks / reservation section ────────────────────────
  const backPageRemarks = parseBackPageRemarks(html);

  // Determine status
  const hasData = mutationHistory.length > 0 || encumbranceEntries.length > 0 || backPageRemarks.length > 0;

  return {
    status: hasData ? "success" : "blank",
    mutationHistory,
    encumbranceEntries,
    backPageRemarks,
    backPageBlank: !hasData,
    rawHtml: html.slice(0, 5000),
    fetchedAt,
  };
}

function parseBackPageTable(
  html: string,
  tableType: "mutation" | "encumbrance",
  _columnHints: string[]
): Array<BhulekhMutationEntry | BhulekhEncumbranceEntry> {
  // Bhulekh Back Page tables are standard HTML tables with GridView-like structure
  // Try to find tables in the HTML
  const tableMatches = html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi);
  const entries: Array<BhulekhMutationEntry | BhulekhEncumbranceEntry> = [];

  for (const tableMatch of tableMatches) {
    const tableHtml = tableMatch[1];
    const rows = tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);

    let headerCells: string[] = [];
    let rowIndex = 0;

    for (const rowMatch of rows) {
      const rowContent = rowMatch[1];
      const cells = Array.from(rowContent.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi))
        .map((cell) => htmlToText(cell[1]).trim())
        .filter(Boolean);

      if (rowIndex === 0) {
        // Header row — store for reference
        headerCells = cells.map((c) => c.toLowerCase());
        rowIndex++;
        continue;
      }

      if (cells.length === 0) continue;

      if (tableType === "mutation") {
        // Mutation table: typically has Chowkidari No., Khatiyan No., Mutation No., Date, Plot No., From, To
        const entry: BhulekhMutationEntry = {
          mutationNumber: cells[2] ?? null,      // Mutation No.
          mutationDate: cells[3] ?? null,      // Date
          orderNumber: null,
          fromKhatiyan: cells[5] ?? null,      // From
          toKhatiyan: cells[6] ?? null,        // To
          plotNo: cells[4] ?? null,            // Plot No.
          rawText: cells.join(" | "),
        };
        if (entry.mutationNumber || entry.mutationDate || entry.plotNo) {
          entries.push(entry);
        }
      } else {
        // Encumbrance table: Type | Property Description | Party Name | Amount | Period | Doc No. | Date | Registration Year | From | To
        const entry: BhulekhEncumbranceEntry = {
          type: cells[0] ?? null,
          propertyDescription: cells[1] ?? null,
          partyName: cells[2] ?? null,
          amount: cells[3] ?? null,
          period: cells[4] ?? null,
          docNo: cells[5] ?? null,
          date: cells[6] ?? null,
          registrationYear: cells[7] ?? null,
          fromKhatiyan: cells[8] ?? null,
          toKhatiyan: cells[9] ?? null,
          rawText: cells.join(" | "),
        };
        if (entry.type || entry.partyName || entry.docNo) {
          entries.push(entry);
        }
      }
      rowIndex++;
    }
  }

  return entries;
}

function parseBackPageRemarks(html: string): BhulekhBackPageRemark[] {
  const remarks: BhulekhBackPageRemark[] = [];

  // Bhulekh Back Page may have a separate "Govt. Reservation/Demarcation" section
  // Look for labeled sections or standalone text blocks

  // Pattern for court case mentions
  const courtPattern = /(court|case|litigation|suit|petition|revision|appeal)/gi;
  const bankPattern = /(bank|mortgage|charge|hypothecation|security|loan)/gi;
  const govtPattern = /(govt\.|government|reservation|demarcation|acquisition|restriction)/gi;

  // Extract text from table cells and paragraph sections
  const textBlocks = html.matchAll(/<(?:p|div|span|td)[^>]*>([\s\S]*?)<\/(?:p|div|span|td)>/gi);

  for (const block of textBlocks) {
    const text = htmlToText(block[1]).trim();
    if (text.length < 10) continue; // Skip short fragments

    let category: BhulekhBackPageRemark["category"] = "unknown";

    if (courtPattern.test(text)) {
      category = "court_case";
    } else if (bankPattern.test(text)) {
      category = "bank_charge";
    } else if (govtPattern.test(text)) {
      category = "govt_restriction";
    } else {
      category = "other";
    }

    // Only include if it has substantive content
    if (text.length > 20) {
      remarks.push({
        category,
        rawText: text.slice(0, 500),
        extractedCaseNo: extractCaseNo(text),
        extractedBankName: extractBankName(text),
      });
    }
  }

  // Deduplicate by rawText
  const seen = new Set<string>();
  return remarks.filter((r) => {
    const key = r.rawText.slice(0, 100);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractCaseNo(text: string): string | null {
  // Common case number patterns in Indian courts
  const patterns = [
    /C\.?M\.?\s*No\.?\s*[:\s]*([A-Za-z0-9/.\-]+)/i,
    /C\.?S\.?\s*No\.?\s*[:\s]*([A-Za-z0-9/.\-]+)/i,
    /W\.?P\.?\s*(?:No\.?)?\s*([A-Za-z0-9/.\-]+)/i,
    /G\.?R\.?\s*(?:No\.?)?\s*([A-Za-z0-9/.\-]+)/i,
    /\d{4}\s*[\/]\s*\d+/,  // e.g. 2024/1234
    /\d+\s*[\/]\s*\d+/,    // e.g. 123/4567
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[0];
  }
  return null;
}

function extractBankName(text: string): string | null {
  // Common bank name patterns
  const bankNames = [
    "SBI", "State Bank", "HDFC", "ICICI", "Axis", "Punjab National",
    "Bank of Baroda", "Canara", "Union Bank", "Indian Bank",
    "Central Bank", "UCO Bank", "IDBI", "Bank of India",
  ];

  for (const bank of bankNames) {
    if (text.toLowerCase().includes(bank.toLowerCase())) {
      return bank;
    }
  }
  return null;
}

function isRetryableBhulekhError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string }).code;
  // Only retry on transient errors — not on "not found" class errors
  if (code && ["PLOT_NOT_FOUND", "KHATIYAN_NOT_FOUND"].includes(code)) {
    return false;
  }
  if (code && ["VILLAGE_DROPDOWN_EMPTY", "PLOT_DROPDOWN_EMPTY"].includes(code)) {
    return true;
  }
  return /EVENTVALIDATION|TIMEOUT|fetch failed|network|socket|ECONNRESET|ETIMEDOUT/i.test(message);
}

// ─────────────────────────────────────────────────────────────────────────────
// RoR HTML parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bhulekh SRoRFront_Uni.aspx page structure:
 * Header section:
 *   gvfront_ctl02_lblMouja           → Village name (Odia)
 *   gvfront_ctl02_lblTehsil           → Tehsil name (Odia)
 *   gvfront_ctl02_lblThana            → Thana/RI name (Odia)
 *   gvfront_ctl02_lblLandlordName     → Khatiyan landlord (e.g. "ଓଡିଶା ସରକାର ଖେୱାଟ ନମ୍ବର 1")
 *   gvfront_ctl02_lblKhatiyanslNo      → Khatiyan number ("830")
 *   gvfront_ctl02_lblName             → Tenant name (Odia)
 *   gvfront_ctl02_lblStatua           → Land class — often empty; land type is per-plot
 *   gvfront_ctl02_lblLastPublishDate  → Last publication date
 *
 * Plot table (gvRorBack GridView), per row (ctl**):
 *   lblPlotNo     → Plot number (inside <a> postback link, extract from anchor text)
 *   lbllType      → Land type (e.g. ଦଣ୍ଡା = irrigated, ବାଣ ଦଣ୍ଡା = single crop irrigated)
 *   lblAcre       → Area in acres (integer)
 *   lblDecimil    → Area in decimals (1 acre = 100 decimals)
 *   lblHector     → Area in hectares
 *
 * Bhulekh dropdown: "Select Khatiyan" + sequential plot numbers (not Bhatiyan codes).
 * The Bhatiyan for plot 128 in Mendhasala is 830. Bhunaksha returns plot 128;
 * caller should look up Bhatiyan via Bhulekh plot dropdown or pass khatiyanNo directly.
 */
export function parseRoRHtml(
  html: string,
  villageInfo: VillageMapping,
  searchMode: SearchMode,
  targetValue: string,
  targetDisplayValue: string,
  fetchedAt: string
): RoRResultType {
  const getSpanHtml = (id: string): string | null => {
    // Match <span id="ID"...>content</span> — content may contain nested HTML
    const escaped = id.replace(/\$/g, "\\$");
    const pattern = new RegExp(`<span[^>]+id=["']${escaped}["'][^>]*>([\\s\\S]*?)</span>`, "i");
    const match = html.match(pattern);
    return match?.[1] ?? null;
  };
  const getSpan = (id: string): string | null => {
    const spanHtml = getSpanHtml(id);
    return spanHtml ? htmlToText(spanHtml) : null;
  };

  // Header fields
  const tenantBlockRawOdia = getSpan("gvfront_ctl02_lblName");
  const ownerBlocks = parseOwnerBlocks(getSpanHtml("gvfront_ctl02_lblName"));
  const primaryOwner = ownerBlocks[0];
  const tenantNameOdia = primaryOwner?.tenantNameOdia ?? tenantBlockRawOdia ?? "Unknown";
  const guardianNameOdia = primaryOwner?.guardianNameOdia;
  const guardianRelationOdia = primaryOwner?.guardianRelationOdia;
  const khataNo = getSpan("gvfront_ctl02_lblKhatiyanslNo") ?? undefined;
  const landlordOdia = getSpan("gvfront_ctl02_lblLandlordName") ?? undefined;
  const lastPublishDate = getSpan("gvfront_ctl02_lblLastPublishDate") ?? undefined;
  const generatedAtRaw = getSpan("lblCurrDate") ?? undefined;
  const rightsOdia = getSpan("gvfront_ctl02_lblStatua") ?? undefined;
  const mouzaOdia = getSpan("gvfront_ctl02_lblMouja");
  const tehsilOdia = getSpan("gvfront_ctl02_lblTehsil");
  const thanaOdia = getSpan("gvfront_ctl02_lblThana");
  const tehsilNo = getSpan("gvfront_ctl02_lblTesilNo");
  const thanaNo = getSpan("gvfront_ctl02_lblThanano");
  const districtOdia = getSpan("gvfront_ctl02_lblDist");

  // Plot table — Bhulekh uses gvRorBack GridView with gvRorBack_ctl** rows
  // Each row has: PlotNo(a), Chak, LType(span), Kisama(n+e+s+w spans), Acre(span), Decimil(span), Hector(span), Remarks
  // Column indices in the <tr>: 0=PlotNo, 1=Chak, 2=LType, 3=Kisama(n+e+s+w), 4=Acre, 5=Decimil, 6=Hector, 7=Remarks
  const plotRows: {
    plotNo: string;
    chakNameOdia: string | null;
    landTypeOdia: string | null;
    northBoundaryOdia: string | null;
    southBoundaryOdia: string | null;
    eastBoundaryOdia: string | null;
    westBoundaryOdia: string | null;
    areaAcres: string | null;
    areaDecimals: string | null;
    areaHectares: string | null;
    areaUnitRaw: string | null;
    areaComputation: string | null;
    sourceRowHash: string | null;
    remarksOdia: string | null;
    raw: Record<string, string | null>;
  }[] = [];
  let plotTableHeaders: string[] = [];

  // Match gvRorBack table
  const gvRorBackMatch = html.match(/<table[^>]+id="gvRorBack"[^>]*>([\s\S]*?)<\/table>/i);
  if (gvRorBackMatch) {
    const tableBody = gvRorBackMatch[1];
    const headerRowMatch = tableBody.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
    plotTableHeaders = headerRowMatch
      ? extractCellTexts(headerRowMatch[1]).filter((header) => header.length > 0)
      : [];
    // Each data row: gvRorBack_ctl** pattern
    for (const rowMatch of tableBody.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/gi)) {
      const rowContent = rowMatch[0];

      // Extract PlotNo from the <a> inside the first <td>
      const plotNoMatch = rowContent.match(/<a[^>]+id="gvRorBack_[^_]+_lblPlotNo"[^>]*>([^<]+)<\/a>/i);
      if (!plotNoMatch) continue;
      const plotNo = plotNoMatch[1].replace(/\s+/g, " ").trim();
      if (!/^\d/.test(plotNo)) continue; // skip header/empty rows

      const getRowSpan = (prefix: string): string | null => {
        const m = rowContent.match(
          new RegExp(`<span[^>]+id="gvRorBack_[^_]+_${prefix}"[^>]*>([\\s\\S]*?)</span>`, "i")
        );
        return m ? (m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() || null) : null;
      };

      const chakNameOdia = getRowSpan("lblchaka");
      const landTypeOdia = getRowSpan("lbllType");
      const northBoundaryOdia = getRowSpan("lbln_occu") ?? getRowSpan("lblKisama");
      const southBoundaryOdia = getRowSpan("lbls_occu");
      const eastBoundaryOdia = getRowSpan("lble_occu");
      const westBoundaryOdia = getRowSpan("lblw_occu");
      const areaAcres = getRowSpan("lblAcre") ?? null;
      const areaDecimals = getRowSpan("lblDecimil") ?? null;
      const areaHectares = getRowSpan("lblHector") ?? null;
      const remarksOdia = getRowSpan("lblPlotRemarks");

      plotRows.push({
        plotNo,
        chakNameOdia,
        landTypeOdia,
        northBoundaryOdia,
        southBoundaryOdia,
        eastBoundaryOdia,
        westBoundaryOdia,
        areaAcres,
        areaDecimals,
        areaHectares,
        areaUnitRaw: "acre+decimal",
        areaComputation: "acres_plus_decimal_column_over_10000",
        sourceRowHash: hashPlotRow({
          plotNo,
          chakNameOdia,
          landTypeOdia,
          northBoundaryOdia,
          southBoundaryOdia,
          eastBoundaryOdia,
          westBoundaryOdia,
          areaAcres,
          areaDecimals,
          areaHectares,
          remarksOdia,
        }),
        remarksOdia,
        raw: {
          plotNo,
          chakNameOdia,
          landTypeOdia,
          northBoundaryOdia,
          southBoundaryOdia,
          eastBoundaryOdia,
          westBoundaryOdia,
          areaAcres,
          areaDecimals,
          areaHectares,
          areaUnitRaw: "acre+decimal",
          areaComputation: "acres_plus_decimal_column_over_10000",
          remarksOdia,
        },
      });
    }
  }

  const matchingPlotRow = findMatchingPlotRow(plotRows, targetDisplayValue || targetValue);
  const specialRemarksRawOdia = getSpan("gvfront_ctl02_lblSpecialCase");
  const mutationReferences = extractMutationReferences({
    specialRemarksRawOdia,
    plotRows,
  });
  const tenantRows = searchMode === "Plot" && matchingPlotRow ? [matchingPlotRow] : plotRows;
  // In Plot mode, the area should be the TARGET PLOT's area, not the whole-khata sum.
  // In Khatiyan mode, we typically want the whole-khata area (all plots under this khatiyan).
  // For Plot mode search: use matching plot row's area only.
  // For Khatiyan mode search: use all plot rows sum (whole khata).
  // Target-plot isolation (DPR-LOC-005): we want matching row for Plot mode.
  const totalArea = searchMode === "Plot" && matchingPlotRow
    ? plotRowArea(matchingPlotRow)
    : tenantRows.reduce((sum, row) => sum + plotRowArea(row), 0);
  const fallbackPlotNo =
    searchMode === "Plot"
      ? targetDisplayValue || targetValue
      : plotRows.map((row) => row.plotNo).filter(Boolean).join(", ") || targetDisplayValue || targetValue;

  // DPR-LOC-005: landClass comes from the matching plot row when in Plot mode.
  // For Khatiyan mode, fall back to the first plot row's land type.
  const perPlotLandClass =
    matchingPlotRow?.landTypeOdia ??
    firstDistinctValue(tenantRows.map((row) => row.landTypeOdia)) ??
    rightsOdia ??
    "ସ୍ଥିତିବାନ";

  // Standardize the raw Odia land class to Odisha Kisam 2024-2026 categories
  const perPlotLandClassStandardized = standardizeKisam(perPlotLandClass);

  const tenantAreaSource =
    searchMode === "Plot" && matchingPlotRow
      ? buildAreaSourceMetadata(matchingPlotRow)
      : {
          areaUnitRaw: "acre+decimal",
          areaComputation: "sum_unique_plot_rows_acres_plus_decimal_column_over_10000",
        };

  const tenants = (ownerBlocks.length > 0 ? ownerBlocks : [{ tenantNameOdia }]).map((owner) => {
    const ownerRecord = owner as ParsedOwnerBlock;
    const ownerName = ownerRecord.tenantNameOdia || tenantNameOdia;
    // Use standardized Kisam for landClass (Odia → Odisha Kisam 2024-2026)
    const rawLandClassOdia = perPlotLandClass;
    return {
      surveyNo: matchingPlotRow?.plotNo ?? fallbackPlotNo,
      area: Math.round(totalArea * 10_000) / 10_000,
      unit: "acre" as const,
      ...tenantAreaSource,
      landClass: perPlotLandClassStandardized,
      landClassOdia: rawLandClassOdia,
      landClassEnglish: getKisamEnglish(perPlotLandClassStandardized),
      conversionRequired: requiresConversion(perPlotLandClassStandardized),
      prohibited: isProhibited(perPlotLandClassStandardized),
      buildable: isBuildable(perPlotLandClassStandardized),
      tenantName: ownerName,
      fatherHusbandName: ownerRecord.guardianNameOdia,
    };
  });

  if (tenants.length === 0 && plotRows.length > 0) {
    const row = matchingPlotRow ?? plotRows[0];
    const rawLandClass = row.landTypeOdia ?? perPlotLandClass;
    const stdLandClass = standardizeKisam(rawLandClass);
    tenants.push({
      surveyNo: row.plotNo,
      area: Math.round(plotRowArea(row) * 10_000) / 10_000,
      unit: "acre" as const,
      ...buildAreaSourceMetadata(row),
      landClass: stdLandClass,
      landClassOdia: rawLandClass,
      landClassEnglish: getKisamEnglish(stdLandClass),
      conversionRequired: requiresConversion(stdLandClass),
      prohibited: isProhibited(stdLandClass),
      buildable: isBuildable(stdLandClass),
      tenantName: tenantNameOdia,
      fatherHusbandName: guardianNameOdia,
    });
  }

  const resolvedPlotNo =
    searchMode === "Plot"
      ? targetDisplayValue || targetValue
      : matchingPlotRow?.plotNo ?? plotRows[0]?.plotNo ?? khataNo ?? targetDisplayValue ?? targetValue;

  const hasData = tenants.length > 0;
  const rawArtifactHash = sha256(html);
  const rawArtifactRef = `sha256:${rawArtifactHash}`;
  const rawDocument = {
    schemaVersion: "bhulekh-ror-v1",
    source: {
      lookupMode: searchMode.toLowerCase(),
      finalUrl: ROR_REPORT_URL,
      fetchedAt,
      artifactType: "html",
      rawArtifactHash,
      rawArtifactRef,
    },
    location: {
      mouzaOdia,
      tehsilOdia,
      thanaOdia,
      districtOdia,
      tehsilNo,
      thanaNo,
    },
    record: {
      khatiyanNo: khataNo ?? null,
      zamindarKhewatOdia: landlordOdia ?? null,
      tenantNameOdia,
      guardianNameOdia: guardianNameOdia ?? null,
      guardianRelationOdia: guardianRelationOdia ?? null,
      casteOdia: primaryOwner?.casteOdia ?? null,
      residenceOdia: primaryOwner?.residenceOdia ?? null,
      rightsOdia: rightsOdia ?? null,
      tenantBlockRawOdia: tenantBlockRawOdia ?? null,
      ownerBlocks,
    },
    dues: {
      jalkar: getSpan("gvfront_ctl02_lblWaterTax"),
      khajana: getSpan("gvfront_ctl02_lblTax"),
      cess: getSpan("gvfront_ctl02_lblSes"),
      otherCess: getSpan("gvfront_ctl02_lblOtherses"),
      total: getSpan("gvfront_ctl02_lblTotal"),
    },
    remarks: {
      progressiveRentRawOdia: getSpan("gvfront_ctl02_lblDescription"),
      specialRemarksRawOdia,
      finalPublicationDate: lastPublishDate ?? null,
      revenueAssessmentDate: getSpan("gvfront_ctl02_lblTaxDate"),
      generatedAtRaw: generatedAtRaw ?? null,
    },
    mutationReferences,
    plotTable: {
      headersOdia: plotTableHeaders ?? [],
      rows: plotRows,
      totals: {
        plotCount: plotRows.length ? String(plotRows.length) : null,
        areaAcres: plotRows.length ? String(Math.round(plotRows.reduce((sum, row) => sum + plotRowArea(row), 0) * 10_000) / 10_000) : null,
        areaDecimals: null,
        areaHectares: firstDistinctValue(plotRows.map((row) => row.areaHectares)) ?? null,
        rawTotalRowOdia: null,
      },
    },
    raw: {
      fullTextOdia: htmlToText(html).slice(0, 25_000),
      rawHtml: html.slice(0, 25_000),
      rawPdfTextOdia: null,
    },
  };

  return {
    source: "bhulekh",
    status: hasData ? "success" : "partial",
    statusReason: hasData
      ? `Parsed ${tenants.length} owner block(s) and ${plotRows.length} plot row(s).`
      : "RoR page parsed but no owner block or plot row was found.",
    verification: hasData ? "verified" : "manual_required",
    fetchedAt,
    rawArtifactHash,
    rawArtifactRef,
    parserVersion: PARSER_VERSION,
    templateHash: hashTemplate(html),
    rawResponse: JSON.stringify(rawDocument),
    data: {
      plotNo: resolvedPlotNo,
      khataNo,
      village: villageInfo.english,
      tenants,
      lastUpdated: lastPublishDate?.slice(0, 10),
      sourceDocument: ROR_REPORT_URL,
      mutationReferences: mutationReferences.length > 0 ? mutationReferences : undefined,
    },
  };
}

function extractMutationReferences(input: {
  specialRemarksRawOdia: string | null;
  plotRows: Array<{ plotNo?: string | null; remarksOdia?: string | null }>;
}): Array<{
  caseType?: string;
  caseNo?: string;
  orderDate?: string;
  plotNo?: string;
  sourceField: string;
  rawText: string;
}> {
  const references: Array<{
    caseType?: string;
    caseNo?: string;
    orderDate?: string;
    plotNo?: string;
    sourceField: string;
    rawText: string;
  }> = [];

  if (input.specialRemarksRawOdia) {
    references.push(
      ...extractReferencesFromText(input.specialRemarksRawOdia, "specialRemarksRawOdia")
    );
  }

  for (const row of input.plotRows) {
    if (!row.remarksOdia) continue;
    references.push(
      ...extractReferencesFromText(row.remarksOdia, "plotRemarks", row.plotNo ?? undefined)
    );
  }

  const seen = new Set<string>();
  return references.filter((reference) => {
    const key = [
      reference.sourceField,
      reference.plotNo ?? "",
      reference.caseType ?? "",
      reference.caseNo ?? "",
      reference.orderDate ?? "",
      reference.rawText,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractReferencesFromText(
  rawText: string,
  sourceField: string,
  plotNo?: string
): Array<{
  caseType?: string;
  caseNo?: string;
  orderDate?: string;
  plotNo?: string;
  sourceField: string;
  rawText: string;
}> {
  const normalized = rawText.replace(/\s+/g, " ").trim();
  if (!normalized) return [];

  const references: Array<{
    caseType?: string;
    caseNo?: string;
    orderDate?: string;
    plotNo?: string;
    sourceField: string;
    rawText: string;
  }> = [];
  const englishCasePattern =
    /((?:D\.\s*)?(?:Reservation|Alienation|Dereservation|Mutation|DR|D\.R\.|ଡି\.ଆର\.)\s*(?:Case|କେସ|କେଶ)?(?:\s*No\.?|\s*ନଂ|\s*ନମ୍ବର)?\s*[:#-]?\s*([A-Za-z0-9./-]+))/gi;
  for (const match of normalized.matchAll(englishCasePattern)) {
    references.push({
      caseType: cleanCaseType(match[1].replace(match[2], "")),
      caseNo: match[2],
      orderDate: extractNearbyDate(normalized, match.index ?? 0),
      plotNo,
      sourceField,
      rawText: clipReferenceText(normalized, match.index ?? 0),
    });
  }

  const odiaCasePattern = /((?:କେସ|କେଶ|ନଥି)[^।;]{0,40}?(?:ନଂ|ନମ୍ବର)\s*[:#-]?\s*([A-Za-z0-9./-]+))/g;
  for (const match of normalized.matchAll(odiaCasePattern)) {
    references.push({
      caseType: cleanCaseType(match[1].replace(match[2], "")),
      caseNo: match[2],
      orderDate: extractNearbyDate(normalized, match.index ?? 0),
      plotNo,
      sourceField,
      rawText: clipReferenceText(normalized, match.index ?? 0),
    });
  }

  return references;
}

function cleanCaseType(value: string): string | undefined {
  const cleaned = value.replace(/\s+/g, " ").replace(/(?:No\.?|ନଂ|ନମ୍ବର|[:#-])/gi, "").trim();
  return cleaned || undefined;
}

function extractNearbyDate(text: string, index: number): string | undefined {
  const window = text.slice(Math.max(0, index - 60), index + 140);
  return window.match(/\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/)?.[0];
}

function clipReferenceText(text: string, index: number): string {
  return text.slice(Math.max(0, index - 40), index + 180).trim();
}

interface ParsedOwnerBlock {
  tenantNameOdia: string;
  guardianNameOdia?: string;
  guardianRelationOdia?: string;
  casteOdia?: string;
  residenceOdia?: string;
  rawOdia?: string;
}

function parseOwnerBlocks(ownerHtml: string | null): ParsedOwnerBlock[] {
  if (!ownerHtml) return [];

  const lines = ownerHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .split(/\n+/)
    .map((line) => htmlToText(line))
    .filter(Boolean);

  return lines.map(parseOwnerBlock).filter((owner) => owner.tenantNameOdia);
}

function parseOwnerBlock(rawOdia: string): ParsedOwnerBlock {
  const text = normalizeText(rawOdia);
  const markerPattern = /(ସ୍ଵା|ସ୍ୱାମୀ|ସ୍ୱା|ପିତା|ପି|ବାପା|ଜା|ବା)\s*[:：]/g;
  const markers = Array.from(text.matchAll(markerPattern)).map((match) => ({
    label: match[1],
    index: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));

  if (markers.length === 0) {
    return { tenantNameOdia: text, rawOdia: text };
  }

  const tenantNameOdia = text.slice(0, markers[0].index).trim() || text;
  const fields: ParsedOwnerBlock = { tenantNameOdia, rawOdia: text };

  for (let i = 0; i < markers.length; i += 1) {
    const current = markers[i];
    const next = markers[i + 1];
    const value = text.slice(current.end, next?.index ?? text.length).trim() || undefined;
    if (!value) continue;

    if (["ସ୍ଵା", "ସ୍ୱା", "ସ୍ୱାମୀ", "ପିତା", "ପି", "ବାପା"].includes(current.label)) {
      fields.guardianNameOdia = value;
      fields.guardianRelationOdia = normalizeGuardianRelation(current.label);
    } else if (current.label === "ଜା") {
      fields.casteOdia = value;
    } else if (current.label === "ବା") {
      fields.residenceOdia = value;
    }
  }

  return fields;
}

function normalizeGuardianRelation(label: string): string {
  if (["ସ୍ଵା", "ସ୍ୱା", "ସ୍ୱାମୀ"].includes(label)) return "spouse";
  if (["ପିତା", "ପି", "ବାପା"].includes(label)) return "father";
  return label;
}

function htmlToText(fragment: string): string {
  return normalizeText(
    decodeHtmlEntities(
      fragment
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

function extractCellTexts(rowHtml: string): string[] {
  return Array.from(rowHtml.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi))
    .map((match) => htmlToText(match[1]))
    .filter(Boolean);
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function findMatchingPlotRow<T extends { plotNo: string }>(rows: T[], target: string): T | undefined {
  const normalizedTarget = normalizePlotNo(target);
  return rows.find((row) => normalizePlotNo(row.plotNo) === normalizedTarget);
}

function normalizePlotNo(text: string): string {
  return text.replace(/\s+/g, "").trim();
}

/**
 * Locate a Bhulekh dropdown option matching the user's typed identifier.
 *
 * The Bhulekh ASP.NET dropdown for plot/khatiyan selection
 * (`#ctl00_ContentPlaceHolder1_ddlBindData`) sometimes renders options
 * with internal whitespace, NBSP (`\xa0`), or stores only the plot
 * segment of a compound plot number like "182/3937". A strict `.trim()`
 * compare misses all three cases and surfaces as
 * `IDENTIFIER_NOT_FOUND` even though the plot is in the dropdown.
 *
 * Three-tier fallback (most specific first):
 *   1. Exact — normalized equality on text or value, whitespace-stripped.
 *   2. Compound tail — if target contains "/", match on the segment after
 *      the last "/". Handles "182/3937" → option "3937".
 *   3. Pure-digit suffix — if target is digits (length ≥ 2), match any
 *      option whose normalized text or value ends with it. Handles the
 *      inverse: target "3937" → option "182/3937". The digit/length guard
 *      prevents "1" from spuriously matching "182".
 */
export function findMatchingPlotOption(
  opts: DropdownOption[],
  target: string | undefined
): DropdownOption | undefined {
  if (!target) return undefined;
  const norm = (s: string) => s.replace(/\s+/g, "").trim();
  const normTarget = norm(target);

  // 1. exact
  const exact = opts.find(
    (o) => norm(o.text) === normTarget || norm(o.value) === normTarget
  );
  if (exact) return exact;

  // 2. compound: "182/3937" → try "3937" (tail) first, then "182" (head)
  //    The dropdown may store only the khata portion or only the plot
  //    portion. Head-match is tried after tail-match because tail is
  //    usually the more specific identifier the user is targeting.
  if (normTarget.includes("/")) {
    const parts = normTarget.split("/").filter(Boolean);
    const tail = parts[parts.length - 1] ?? "";
    const head = parts[0] ?? "";
    if (tail && tail !== normTarget) {
      const tailMatch = opts.find(
        (o) => norm(o.text) === tail || norm(o.value) === tail
      );
      if (tailMatch) return tailMatch;
    }
    if (head && head !== normTarget) {
      const headMatch = opts.find(
        (o) => norm(o.text) === head || norm(o.value) === head
      );
      if (headMatch) return headMatch;
    }
  }

  // 3. pure-digit suffix (length ≥ 2)
  if (/^\d{2,}$/.test(normTarget)) {
    const suffixMatch = opts.find(
      (o) => norm(o.text).endsWith(normTarget) || norm(o.value).endsWith(normTarget)
    );
    if (suffixMatch) return suffixMatch;
  }

  return undefined;
}

function plotRowArea(row: { areaAcres: string | null; areaDecimals: string | null }): number {
  const acres = parseAreaComponent(row.areaAcres ?? "");
  const decimalColumn = parseAreaComponent(row.areaDecimals ?? "");
  return acres + decimalColumn / 10_000;
}

function buildAreaSourceMetadata(row: {
  plotNo: string | null;
  areaAcres: string | null;
  areaDecimals: string | null;
  areaHectares: string | null;
  sourceRowHash?: string | null;
}): {
  areaAcresRaw?: string;
  areaDecimalsRaw?: string;
  areaHectaresRaw?: string;
  areaUnitRaw: string;
  areaComputation: string;
  sourcePlotNo?: string;
  sourceRowHash?: string;
} {
  return {
    areaAcresRaw: row.areaAcres ?? undefined,
    areaDecimalsRaw: row.areaDecimals ?? undefined,
    areaHectaresRaw: row.areaHectares ?? undefined,
    areaUnitRaw: "acre+decimal",
    areaComputation: "acres_plus_decimal_column_over_10000",
    sourcePlotNo: row.plotNo ?? undefined,
    sourceRowHash: row.sourceRowHash ?? hashPlotRow(row),
  };
}

function hashPlotRow(row: Record<string, unknown>): string {
  return sha256(JSON.stringify(row, Object.keys(row).sort()));
}

function firstDistinctValue(values: Array<string | null | undefined>): string | undefined {
  const distinct = [...new Set(values.filter((value): value is string => Boolean(value)))];
  return distinct.length === 1 ? distinct[0] : distinct[0];
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function hashTemplate(html: string): string {
  const ids = Array.from(html.matchAll(/\sid=["']([^"']+)["']/gi))
    .map((match) => match[1])
    .filter((id) => id.startsWith("gvfront_") || id.startsWith("gvRorBack_"))
    .map((id) => id.replace(/_ctl\d+_/g, "_ctlXX_"))
    .sort();
  return sha256([...new Set(ids)].join("\n"));
}

function* tableMatchAll(
  text: string,
  pattern: RegExp
): Generator<RegExpMatchArray> {
  let match: RegExpMatchArray | null;
  const re = new RegExp(pattern.source, pattern.flags);
  while ((match = re.exec(text)) !== null) {
    yield match;
  }
}

function parseAreaComponent(text: string): number {
  if (!text) return 0;
  // Bhulekh may use Odia digits — convert to Arabic before parsing
  const normalized = odiaDigitsToArabic(text).replace(/[^0-9.]/g, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildFailedResult(
  fetchedAt: string,
  error: string,
  village = "",
  provenance: {
    attempts?: number;
    inputsTried?: Array<{ label?: string; input: Record<string, unknown> }>;
    retryAttempts?: RetryAttemptRecord[];
    artifactSnapshots?: BhulekhArtifactSnapshot[];
  } = {}
): RoRResultType {
  const artifactSnapshots = provenance.artifactSnapshots ?? [];
  // Include diagnostic excerpts from artifact snapshots in the error message
  const diagnosticLines: string[] = [];
  for (const snap of artifactSnapshots) {
    if (snap.stage === "select_tahasil_delta" || snap.stage === "select_village_delta") {
      const excerpt = snap.excerpt ?? snap.raw ?? "";
      if (excerpt) diagnosticLines.push(`[${snap.stage}] ${excerpt.slice(0, 200)}`);
    }
  }
  const fullError = diagnosticLines.length > 0
    ? `${error}\n--- Diagnostic ---\n${diagnosticLines.join("\n")}`
    : error;
  const failureDocument = {
    schemaVersion: "bhulekh-failure-v1",
    source: {
      fetchedAt,
      artifactType: artifactSnapshots.at(-1)?.artifactType ?? "json",
      rawArtifactHash: artifactSnapshots.at(-1)?.hash,
      rawArtifactRef: artifactSnapshots.at(-1) ? `sha256:${artifactSnapshots.at(-1)?.hash}` : undefined,
    },
    statusReason: fullError,
    village,
    artifactSnapshots,
    inputsTried: provenance.inputsTried ?? [],
    retryAttempts: provenance.retryAttempts ?? [],
  };
  const fallbackHash = sha256(JSON.stringify(failureDocument));
  const lastArtifact = artifactSnapshots.at(-1);
  const rawArtifactHash = lastArtifact?.hash ?? fallbackHash;
  failureDocument.source.rawArtifactHash = rawArtifactHash;
  failureDocument.source.rawArtifactRef = `sha256:${rawArtifactHash}`;
  const failureRawResponse = JSON.stringify(failureDocument);

  return {
    source: "bhulekh",
    status: "failed",
    verification: "manual_required",
    fetchedAt,
    statusReason: fullError,
    attempts: provenance.attempts,
    inputsTried: provenance.inputsTried,
    retryAttempts: provenance.retryAttempts,
    rawArtifactHash,
    rawArtifactRef: `sha256:${rawArtifactHash}`,
    templateHash: lastArtifact?.templateHash,
    rawResponse: failureRawResponse,
    parserVersion: PARSER_VERSION,
    data: {
      plotNo: "",
      village,
      tenants: [],
    },
    error: fullError,
  };
}

function annotateBhulekhAttemptMetadata(
  result: RoRResultType,
  attemptCount: number,
  inputsTried: Array<{ label?: string; input: Record<string, unknown> }>
): RoRResultType {
  return {
    ...result,
    attempts: attemptCount,
    inputsTried: [...(result.inputsTried ?? []), ...inputsTried],
    validators: [
      ...(result.validators ?? []),
      {
        name: "attempts_recorded",
        status: "passed",
        raw: { attemptCount },
      },
    ],
  };
}

export async function healthCheck(): Promise<boolean> {
  try {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.goto(ROR_VIEW_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    if (page.url().includes("BhulekhError.aspx")) {
      await page.locator("a", { hasText: "here" }).click();
      await page.waitForURL(/RoRView\.aspx/, { timeout: TIMEOUT_MS });
    }
    const ok = page.url().includes("RoRView.aspx");
    await page.close();
    return ok;
  } catch {
    return false;
  }
}

export async function cleanup(): Promise<void> {
  if (browserInstance) {
    await (await browserInstance).close();
    browserInstance = null;
  }
}

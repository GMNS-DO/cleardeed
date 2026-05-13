// DRT Bhubaneswar/Cuttack party-name search fetcher
// DRT-2 Cuttack has jurisdiction for Odisha state
// Portal: cis.drt.gov.in/drtlive (NICCI-managed, no captcha)
//
// Key findings from probe (2026-04-30):
// - CIS DRT portal: https://cis.drt.gov.in/drtlive/
// - DRT Cuttack schemaname value = 20 (confirmed in dropdown list)
// - Free text search (party name + case no + diary no): ./order/page1_advocate.php
// - Form: POST with schemaname (required), case_type (AJAX-populated), party_name/free text
// - No captcha on CIS DRT portal — simpler than district courts or High Court
// - case_type dropdown is AJAX-populated after schemaname selection (requires Playwright)
// - Results in HTML table
// - DRT main portal drt.gov.in requires login; CIS DRT is the public-facing portal

import { createHash } from "node:crypto";
import { chromium, type Browser, type Page } from "playwright";
import { CourtCaseResult } from "@cleardeed/schema";
import { z } from "zod";

const BASE_URL = "https://cis.drt.gov.in/drtlive";
const USER_AGENT = "ClearDeed/1.0 (property due-diligence; contact@cleardeed.in)";
const PARSER_VERSION = "drt-party-parser-v1";
const MAX_ATTEMPTS = 2;

// DRT Cuttack (DRT-2, Odisha jurisdiction) schemaname value
const DRT_CUTTACK_CODE = "20";
// DRAT New Delhi (appellate for Odisha) — optional escalation
const DRAT_DELHI_CODE = "100";

interface DRTInput {
  /** Party name to search */
  partyName: string;
  /** DRT schemaname code. Default: 20 (DRT Cuttack) */
  drtCode?: string;
  /** Also search DRAT appellate (DRAT New Delhi) */
  includeDRAT?: boolean;
  /** Case type filter (optional, defaults to all types) */
  caseType?: string;
  /** Try name variants */
  tryNameVariants?: boolean;
}

type DRTOutcome = "no_records" | "cases_found" | "portal_error" | "unknown";

interface DRTAttemptMetadata {
  drtCode: string;
  drtName: string;
  partyName: string;
  caseType: string;
  outcome: DRTOutcome;
  rawArtifactHash?: string;
  statusReason?: string;
}

interface NameVariantAttempt {
  variant: string;
  searchAttempts: DRTAttemptMetadata[];
  casesFound: number;
  outcome: DRTOutcome;
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

// --- Name variant generation ---

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
    variants.add(last);
  }

  if (tokens.length >= 2) {
    variants.add(tokens[0]);
  }

  if (tokens.length >= 3) {
    const initials = tokens.slice(0, -1).map((t) => t[0]?.toUpperCase() ?? "").join(" ");
    variants.add(`${initials} ${tokens[tokens.length - 1]}`);
  }

  return Array.from(variants).slice(0, 8);
}

// --- Page setup: select DRT and wait for case_type cascade ---

async function setupDRTSearch(page: Page, drtCode: string): Promise<void> {
  const url = `${BASE_URL}/order/page1_advocate.php`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForTimeout(800);

  // Select DRT/DRAT name — this triggers AJAX to populate case_type
  await page.selectOption("#schemaname", drtCode);

  // Wait for case_type dropdown to be populated
  await page.waitForFunction(
    () => {
      const select = document.querySelector("#case_type") as HTMLSelectElement | null;
      return select && select.options.length > 1;
    },
    { timeout: 15_000 }
  );
  await page.waitForTimeout(500);
}

// --- Single search attempt ---

async function runDRTSearchAttempt(input: {
  page: Page;
  partyName: string;
  drtCode: string;
  drtName: string;
  caseType: string;
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
  outcome: DRTOutcome;
  metadata: DRTAttemptMetadata;
}> {
  const { page, partyName, drtCode, drtName, caseType } = input;

  // Clear and fill search fields
  await page.fill('input[name="petitioner respondent"]', partyName);

  // Submit form
  await page.click('input[type="submit"]');
  await page.waitForTimeout; // Wait for server response

  // Capture result HTML
  const resultHtml = await page.evaluate(() => {
    const table = document.querySelector("table")?.innerHTML ?? "";
    const msg = document.querySelector(".alert, .notice, [class*='no-record']")?.textContent ?? "";
    return table || msg;
  });

  const rawArtifactHash = sha256(resultHtml);
  const cases = parseDRTTable(resultHtml);

  let outcome: DRTOutcome = "unknown";
  if (cases.length > 0) {
    outcome = "cases_found";
  } else if (
    resultHtml.toLowerCase().includes("no record") ||
    resultHtml.toLowerCase().includes("not found") ||
    resultHtml.toLowerCase().includes("0 record") ||
    resultHtml === ""
  ) {
    outcome = "no_records";
  } else if (resultHtml.length > 100) {
    outcome = "cases_found";
  } else {
    outcome = "no_records";
  }

  return {
    resultHtml,
    cases,
    outcome,
    metadata: {
      drtCode,
      drtName,
      partyName,
      caseType,
      outcome,
      rawArtifactHash,
      statusReason:
        outcome === "no_records"
          ? "no_cases_found_for_party"
          : outcome === "cases_found"
          ? "cases_found"
          : "result_unclassified",
    },
  };
}

// --- HTML table parser ---

function parseDRTTable(html: string): Array<{
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
    if (
      row.toLowerCase().includes("no record") ||
      row.toLowerCase().includes("not found") ||
      row.toLowerCase().includes("sr no") ||
      row.toLowerCase().includes("sno")
    )
      continue;

    const cells = row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? [];
    if (cells.length < 3) continue;

    const extract = (cell: string) =>
      cell
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .trim();

    // DRT table format varies — try to find case number and party columns
    const cellTexts = cells.map(extract).filter(Boolean);
    if (cellTexts.length < 3) continue;

    // First text-like cell is often the case number
    const caseNoRaw = cellTexts[0];
    const caseNoMatch = caseNoRaw.match(/([A-Z]*\/?[A-Z0-9()-]+)/i);
    const caseNo = caseNoMatch?.[1] ?? caseNoRaw.substring(0, 30);

    // Parties: find the cell with names (often has "Vs" or contains multiple names)
    let parties: Array<{ name: string; role: "petitioner" | "respondent" | "other" }> = [];
    for (const cellText of cellTexts) {
      if (cellText.toLowerCase().includes(" vs ") || cellText.toLowerCase().includes(" versus ")) {
        const parts = cellText.split(/\b\s+(?:vs|versus)\s+\b/i);
        if (parts.length >= 2) {
          parties.push({ name: parts[0].trim(), role: "petitioner" });
          parties.push({ name: parts[1].trim(), role: "respondent" });
        } else if (cellText.length < 200) {
          parties.push({ name: cellText, role: "other" });
        }
        break;
      }
    }

    // If no "Vs" found, use the second cell as party
    if (parties.length === 0 && cellTexts[1] && cellTexts[1].length < 150) {
      const parts = cellTexts[1].split(/\n|<br\s*\/?>/i).filter((p) => p.trim().length > 2);
      for (const p of parts) {
        const clean = p.trim().replace(/<[^>]+>/g, "");
        if (clean.length > 2 && clean.length < 100) {
          parties.push({ name: clean, role: "other" });
        }
      }
    }

    // Filing date: look for date pattern
    let filingDate = "";
    for (const ct of cellTexts) {
      if (/\d{2}[-/]\d{2}[-/]\d{2,4}/.test(ct)) {
        filingDate = ct;
        break;
      }
    }

    // Status: last column or last text cell
    const status = cellTexts[cellTexts.length - 1]?.toLowerCase().includes("pend")
      ? "Pending"
      : cellTexts[cellTexts.length - 1]?.toLowerCase().includes("dispos")
      ? "Disposed"
      : cellTexts[cellTexts.length - 1] ?? "";

    cases.push({
      caseNo,
      caseType: cellTexts.find((ct) => ct.length < 30 && /\b(ARBITRATION|SUIT|REGULAR|CIVIL|CASE)\b/i.test(ct)) ?? "",
      court: "DRT Cuttack",
      filingDate,
      status,
      parties,
    });
  }

  return cases;
}

// --- Main export ---

export async function drtFetch(input: DRTInput): Promise<z.infer<typeof CourtCaseResult>> {
  const fetchedAt = new Date().toISOString();
  const {
    partyName,
    drtCode = DRT_CUTTACK_CODE,
    includeDRAT = false,
    caseType = "",
    tryNameVariants = true,
  } = input;

  const drtCodes: Array<{ code: string; name: string }> = [
    { code: drtCode, name: getDRTName(drtCode) },
  ];

  if (includeDRAT) {
    drtCodes.push({ code: DRAT_DELHI_CODE, name: "DRAT New Delhi" });
  }

  const inputsTried: Array<{ label: string; input: Record<string, unknown> }> = [];

  try {
    const nameVariants = tryNameVariants ? generateNameVariants(partyName) : [partyName];
    inputsTried.push({
      label: "name_variants",
      input: { variants: nameVariants, tryNameVariants, drtCodes },
    });

    const allCases: Array<{
      caseNo: string; caseType: string; court: string; filingDate: string;
      status: string; parties: Array<{ name: string; role: "petitioner" | "respondent" | "other" }>;
    }> = [];
    const rawFragments: string[] = [];
    const allAttempts: DRTAttemptMetadata[] = [];
    let portalErrorCount = 0;

    for (const drt of drtCodes) {
      if (allCases.length > 0 && !includeDRAT) break;

      let page: Awaited<ReturnType<Browser["newPage"]>> | null = null;
      try {
        const browserInst = await getBrowser();
        page = await browserInst.newPage();
        await page.setExtraHTTPHeaders({ "User-Agent": USER_AGENT });

        await setupDRTSearch(page, drt.code);

        for (const variant of nameVariants) {
          if (allCases.length > 0) break;

          const attempt = await runDRTSearchAttempt({
            page,
            partyName: variant,
            drtCode: drt.code,
            drtName: drt.name,
            caseType,
          });

          rawFragments.push(attempt.resultHtml);
          allAttempts.push(attempt.metadata);

          if (attempt.outcome === "cases_found") {
            allCases.push(...attempt.cases);
          } else if (attempt.outcome === "portal_error") {
            portalErrorCount++;
          }

          // Reset form for next variant
          await page.fill('input[name="petitioner respondent"]', "");
          await page.waitForTimeout(500);
        }
      } catch (err) {
        portalErrorCount++;
      } finally {
        if (page) await page.close();
      }
    }

    const rawArtifactHash = rawFragments.length > 0 ? sha256(rawFragments.join("\n")) : undefined;

    return {
      source: "drt",
      status: portalErrorCount > drtCodes.length ? "failed" : allCases.length > 0 ? "success" : "partial",
      statusReason:
        allCases.length > 0
          ? "cases_found"
          : portalErrorCount > 0
          ? "portal_error"
          : "no_cases_found",
      verification: allCases.length > 0 ? "verified" : "manual_required",
      fetchedAt,
      attempts: nameVariants.length * drtCodes.length,
      inputsTried,
      rawArtifactHash,
      parserVersion: PARSER_VERSION,
      validators: [
        {
          name: "drt_cases_found",
          status: allCases.length > 0 ? "passed" : "failed",
          raw: { totalCases: allCases.length, attempts: allAttempts },
        },
        {
          name: "drt_name_variants",
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
          drtCodes,
          partyName,
          nameVariantsTried: nameVariants,
          attempts: allAttempts,
          negativeResultConfidence:
            allCases.length === 0
              ? portalErrorCount > 0
                ? "unconfirmed"
                : "medium"
              : "high",
        },
      },
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      source: "drt",
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
          drtCodes,
          partyName,
          nameVariantsTried: [],
          attempts: [],
          negativeResultConfidence: "unconfirmed",
        },
      },
      error: errorMessage,
    };
  }
}

function getDRTName(code: string): string {
  const names: Record<string, string> = {
    "20": "DRT Cuttack",
    "100": "DRAT New Delhi",
    "104": "DRAT Kolkata",
    "1": "DRT Delhi-1",
    "2": "DRT Delhi-2",
  };
  return names[code] ?? `DRT-${code}`;
}

// --- Health check ---

export async function healthCheck(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const browserInst = await chromium.launch({ headless: true });
    const page = await browserInst.newPage();
    await page.goto(`${BASE_URL}/order/page1_advocate.php`, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
    const schemaname = await page.$("#schemaname");
    await page.close();
    await browserInst.close();
    return schemaname ? { ok: true } : { ok: false, reason: "form_elements_missing" };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

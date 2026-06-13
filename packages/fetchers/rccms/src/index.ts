/**
 * RCCMS Odisha — Revenue Court Case Management System
 *
 * Probes rccms.odisha.gov.in for available search endpoints.
 * Returns real data if the portal is reachable, otherwise structured manual instructions.
 *
 * RCCMS covers revenue court cases: land disputes, mutations, ceiling surplus,
 * bandar/bel/forest land matters, and other revenue jurisdiction cases.
 * These are separate from civil/criminal cases in eCourts.
 */

import { createHash } from "node:crypto";

const RCCMS_BASE = "https://rccms.odisha.gov.in";
const USER_AGENT = "ClearDeed/1.0 (property due-diligence; contact@cleardeed.in)";
const PARSER_VERSION = "rccms-probe-v1";

const SEARCH_PATHS = [
  "/CaseStatus.aspx",
  "/CaseSearch.aspx",
  "/Public/CaseStatus.aspx",
  "/Home/CaseSearch.aspx",
];

interface RCCMSCase {
  caseNo: string;
  plotNo?: string;
  caseType: string;
  filingDate?: string;
  status: string;
  court: string;
  /**
   * Local extension — not part of the shared @cleardeed/schema contract.
   * Preserves the subject line (e.g. mutation order, ceiling surplus) the
   * RCCMS portal renders in the table, since it is useful context for the
   * reasoner and for future buyer report display. Stripped before being
   * mapped to the V2 contract envelope.
   */
  subject?: string;
  /**
   * Local extension — not part of the shared @cleardeed/schema contract.
   * Petitioner/respondent names that the portal does render today. Kept
   * here so we don't lose data we already have; the V2 contract omits
   * party names by design (KI-002). Add to the shared schema in a
   * follow-up if the reasoner actually needs them.
   */
  parties?: Array<{ name: string; role: "petitioner" | "respondent" }>;
}

interface RCCMSInput {
  district: string;
  tahasil: string;
  village: string;
  khataNo?: string;
  plotNo?: string;
}

interface ProbeResult {
  url: string;
  status: number;
  hasSearchForm: boolean;
  html: string;
}

/**
 * Probe the RCCMS portal for accessible search endpoints.
 * Returns the first working endpoint found.
 */
async function probePortal(): Promise<ProbeResult | null> {
  // Use Promise.race with 3s timeout to avoid hanging on slow portal
  const probePromises = SEARCH_PATHS.map(async (path) => {
    try {
      const res = await fetch(`${RCCMS_BASE}${path}`, {
        signal: AbortSignal.timeout(3_000),
        headers: { "User-Agent": USER_AGENT },
      });
      if (res.ok || res.status === 401) {
        const html = await res.text();
        const hasSearchForm = /input|select|form|search/i.test(html);
        return { url: `${RCCMS_BASE}${path}`, status: res.status, hasSearchForm, html };
      }
      return null;
    } catch {
      return null;
    }
  });

  // Return first successful result within overall 3s budget
  return await Promise.race([
    (async () => {
      for (const promise of probePromises) {
        const result = await promise;
        if (result) return result;
      }
      return null;
    })(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 3_000))
  ]);
}

/**
 * Normalize district name to RCCMS expected format.
 */
function normalizeDistrict(district: string): string {
  const map: Record<string, string> = {
    khordha: "Khordha", khurda: "Khordha",
    cuttack: "Cuttack",
    puri: "Puri",
    ganjam: "Ganjam",
    sambalpur: "Sambalpur",
  };
  return map[district.toLowerCase()] ?? district;
}

/**
 * Normalize tahasil name.
 */
function normalizeTahasil(tahasil: string): string {
  return tahasil
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/tahasil$/i, "")
    .trim();
}

// ── Main export ─────────────────────────────────────────────────────────────────

export interface RCCMSResult {
  source: "rccms";
  status: "success" | "partial" | "failed";
  statusReason: string;
  verification: "verified" | "manual_required";
  fetchedAt: string;
  attempts: number;
  inputsTried: Array<{ label: string; input: Record<string, unknown> }>;
  parserVersion: string;
  warnings?: Array<{ code: string; message: string }>;
  error?: string;
  data?: {
    total: number;
    cases: RCCMSCase[];
    searchMetadata: {
      district: string;
      tahasil: string;
      village: string;
      khataNo?: string;
      plotNo?: string;
      portalUrl: string;
    };
  };
}

export async function fetch(input: RCCMSInput): Promise<RCCMSResult> {
  const fetchedAt = new Date().toISOString();
  const { district, tahasil, village, khataNo, plotNo } = input;

  const inputsTried = [{
    label: "rccms_case_search",
    input: { district, tahasil, village, khataNo, plotNo },
  }];

  // ── Attempt automated probe ───────────────────────────────────────────────────
  const probe = await probePortal();

  if (!probe) {
    // Portal unreachable — fall back to manual instructions
    return {
      source: "rccms",
      status: "partial",
      statusReason: "portal_unreachable",
      verification: "manual_required",
      fetchedAt,
      attempts: SEARCH_PATHS.length,
      inputsTried,
      parserVersion: PARSER_VERSION,
      warnings: [{
        code: "PORTAL_DOWN",
        message: `RCCMS portal (${RCCMS_BASE}) is unreachable. Revenue court cases must be searched manually at the Tehsil office.`,
      }],
      data: {
        total: 0,
        cases: [],
        searchMetadata: {
          district: normalizeDistrict(district),
          tahasil,
          village,
          khataNo,
          plotNo,
          portalUrl: RCCMS_BASE,
        },
      },
    };
  }

  if (probe.status === 401 || /login|signin|authenticate/i.test(probe.html)) {
    // Login required — automated search not possible
    return {
      source: "rccms",
      status: "partial",
      statusReason: "login_required",
      verification: "manual_required",
      fetchedAt,
      attempts: 1,
      inputsTried,
      parserVersion: PARSER_VERSION,
      warnings: [{
        code: "AUTH_REQUIRED",
        message: "RCCMS portal requires login. Revenue court cases must be searched manually at the Tehsil office.",
      }],
      data: {
        total: 0,
        cases: [],
        searchMetadata: {
          district: normalizeDistrict(district),
          tahasil,
          village,
          khataNo,
          plotNo,
          portalUrl: probe.url,
        },
      },
    };
  }

  // Portal is up and potentially accessible — try to fill search form via Playwright
  // If Playwright is not available, fall back to manual instructions
  let browser: import("playwright").Browser | null = null;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({
      headless: true,
      timeout: 5_000 // Launch timeout
    });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ "User-Agent": USER_AGENT });

    await page.goto(probe.url, {
      waitUntil: "domcontentloaded",
      timeout: 3_000 // Reduce from 20s to 3s
    });
    await page.waitForTimeout(500); // Reduce from 1s to 500ms

    // Try to fill district/tahasil search fields
    const districtField = page.locator("select[name*='District'], select[id*='District'], select[id*='district']").first();
    const hasDistrict = await districtField.isVisible().catch(() => false);

    if (hasDistrict) {
      const normDistrict = normalizeDistrict(district);
      try {
        await districtField.selectOption({ label: normDistrict });
        await page.waitForTimeout(500);
      } catch { /* district selection failed */ }

      // Try to enter village or khata/plot info if fields exist
      const villageField = page.locator("input[name*='Village'], input[id*='Village'], input[name*='village']").first();
      if (await villageField.isVisible().catch(() => false)) {
        await villageField.fill(village).catch(() => {});
      }

      const plotField = page.locator("input[name*='Plot'], input[id*='Plot'], input[name*='survey']").first();
      if (await plotField.isVisible().catch(() => false)) {
        await plotField.fill(plotNo ?? khataNo ?? "").catch(() => {});
      }

      // Click search
      const searchBtn = page.locator("input[type='submit'][value*='Search'], button:has-text('Search'), input[type='submit'][value*='Search']").first();
      await searchBtn.click().catch(() => {});
      await page.waitForTimeout(1_000); // Reduce from 3s to 1s
    }

    const resultHtml = await page.content();
    const { cases, total } = parseRccmsTable(resultHtml, plotNo);

    if (total > 0) {
      await browser.close();
      return {
        source: "rccms",
        status: "success",
        statusReason: "cases_found",
        verification: "verified",
        fetchedAt,
        attempts: 1,
        inputsTried,
        parserVersion: PARSER_VERSION,
        data: {
          total,
          cases,
          searchMetadata: {
            district: normalizeDistrict(district),
            tahasil,
            village,
            khataNo,
            plotNo,
            portalUrl: probe.url,
          },
        },
      };
    }

    await browser.close();

    // Portal is up but no results found
    return {
      source: "rccms",
      status: "partial",
      statusReason: "no_cases_found",
      verification: "manual_required",
      fetchedAt,
      attempts: 1,
      inputsTried,
      parserVersion: PARSER_VERSION,
      warnings: [{
        code: "ZERO_RESULTS",
        message: "RCCMS returned no revenue court cases for the search parameters. Manual verification at the Tehsil office is still recommended for completeness.",
      }],
      data: {
        total: 0,
        cases: [],
        searchMetadata: {
          district: normalizeDistrict(district),
          tahasil,
          village,
          khataNo,
          plotNo,
          portalUrl: probe.url,
        },
      },
    };
  } catch (err) {
    await browser?.close();
    const errorMessage = err instanceof Error ? err.message : String(err);

    return {
      source: "rccms",
      status: "partial",
      statusReason: "probe_failed",
      verification: "manual_required",
      fetchedAt,
      attempts: 1,
      inputsTried,
      parserVersion: PARSER_VERSION,
      warnings: [{
        code: "FETCH_ERROR",
        message: `RCCMS automated search failed: ${errorMessage}. Revenue court cases should be verified manually at the Tehsil office.`,
      }],
      data: {
        total: 0,
        cases: [],
        searchMetadata: {
          district: normalizeDistrict(district),
          tahasil,
          village,
          khataNo,
          plotNo,
          portalUrl: RCCMS_BASE,
        },
      },
    };
  }
}

// ── Table parser ─────────────────────────────────────────────────────────────────

export function parseRccmsTable(html: string, plotNo?: string): { cases: RCCMSCase[]; total: number } {
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  const cases: RCCMSCase[] = [];
  const dataRows = rows.slice(1); // skip header

  for (const row of dataRows) {
    const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) ?? [];
    if (cells.length < 5) continue;

    const extract = (c: string) => c.replace(/<[^>]+>/g, "").trim();

    const caseNo = extract(cells[0] ?? "");
    const caseType = extract(cells[1] ?? "");
    const rawFilingDate = extract(cells[2] ?? "");
    const status = extract(cells[3] ?? "");
    const subject = extract(cells[4] ?? "");
    const petitioner = extract(cells[5] ?? "");
    const respondent = extract(cells[6] ?? "");

    // Skip empty/no-case rows
    if (!caseNo || caseNo.includes("no record") || caseNo.includes("No Cases")) continue;

    const parties: Array<{ name: string; role: "petitioner" | "respondent" }> = [];
    if (petitioner) parties.push({ name: petitioner, role: "petitioner" });
    if (respondent) parties.push({ name: respondent, role: "respondent" });

    cases.push({
      caseNo,
      caseType: caseType || "Revenue Case",
      filingDate: rawFilingDate || undefined,
      status: status || "Unknown",
      court: "RCCMS Odisha",
      subject: subject || undefined,
      ...(plotNo ? { plotNo } : {}),
      ...(parties.length > 0 ? { parties } : {}),
    });
  }

  return { cases, total: cases.length };
}

// ── Health check ────────────────────────────────────────────────────────────────

export async function healthCheck(): Promise<{ ok: boolean; message?: string }> {
  // Use Promise.race to ensure healthCheck doesn't hang the process
  return await Promise.race([
    (async () => {
      const probe = await probePortal();
      if (!probe) {
        return { ok: false, message: "RCCMS portal unreachable" };
      }
      if (probe.status === 401) {
        return { ok: false, message: "RCCMS portal requires login" };
      }
      return { ok: true, message: `RCCMS portal accessible at ${probe.url}` };
    })(),
    new Promise<{ ok: boolean; message: string }>((resolve) =>
      setTimeout(() => resolve({ ok: false, message: "RCCMS health check timeout" }), 3_000)
    )
  ]);
}
// LARR Act land acquisition risk fetcher for ClearDeed
// Sources:
// 1. eCourts party-name search filtered by "Land Acquisition Act 2013" as case act type
//    (lags behind real notifications — only surfaces after litigation is filed)
// 2. Odisha Revenue SIA notification page
//    (village-level preliminary S.11 notifications, public state government data)
// 3. RTI to District Collector as definitive fallback
//
// No GPS-to-acquisition-status automated path exists in India.
// Layered approach: court records (lagging indicator) + SIA page (village-granular) + RTI (definitive).
// Research: 2026-05-01. See PRODUCT.md Section 10 Tier A.
//
// Key reference:
// - LARR Act 2013 S.11: preliminary notification must be published in Gazette + newspapers + local notice boards
// - LACRRIS (larr.dolr.gov.in): MoRD project-centric database, no village/GPS search, no API

import { createHash } from "node:crypto";
import { SourceResultBase } from "@cleardeed/schema";

const PARSER_VERSION = "larr-risk-fetcher-v1";
const USER_AGENT = "ClearDeed/1.0 (property due-diligence; contact@cleardeed.in)";

export interface LARRInput {
  /** Seller's name for eCourts party-name search */
  sellerName: string;
  /** Village name for SIA notification cross-check */
  village: string;
  /** GPS latitude of the plot */
  lat?: number;
  /** GPS longitude of the plot */
  lon?: number;
  /** eCourts district code (default: "8" for Khurda/Odisha) */
  districtCode?: string;
  /** eCourts district name */
  districtName?: string;
}

export interface SIANotification {
  village: string;
  area: string;
  projectPurpose: string;
  notificationDate?: string;
  notificationType: string;
  sourceUrl: string;
}

export interface LARRCase {
  caseNo: string;
  caseType: string;
  court: string;
  filingDate?: string;
  status: string;
  caseAct: string;
  reliefSought?: string;
  parties: Array<{ name: string; role: "petitioner" | "respondent" | "other" }>;
}

export interface LARRRiskResult {
  source: "larr";
  status: "success" | "partial" | "failed";
  verification: "verified" | "unverified" | "manual_required" | "error";
  fetchedAt: string;
  data?: {
    cases: LARRCase[];
    siaNotifications: SIANotification[];
    riskAssessment: {
      hasActiveCases: boolean;
      hasSIANotifications: boolean;
      riskLevel: "high" | "elevated" | "low" | "unknown";
      summary: string;
    };
    sources: Array<{
      source: "ecourts" | "revenue_odisha_sia" | "lacrris" | "rti";
      status: "checked" | "not_checked" | "flagged";
      outcome: string;
    }>;
    instructions: {
      rtiToCollector: string;
      revenueOfficeVisit: string;
    };
  };
  statusReason?: string;
  attempts: Array<{
    source: string;
    action: string;
    outcome: string;
  }>;
  rawArtifactRef?: string;
  parserVersion: string;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function buildRTIQuestion(village: string, khasra?: string): string {
  return `Whether any land in village "${village}"${khasra ? `, Khata/Plot ${khasra}` : ""}, under LARR Act 2013, has been notified for acquisition under Section 11 (preliminary notification) or Section 19 (declaration) by the Land Acquisition Officer, Khordha district, Odisha?`;
}

/**
 * Generate the recommended RTI question for land acquisition status.
 * Used as a fallback in the report's "What to Ask Next" section.
 */
export function generateRTIQuestion(input: LARRInput): {
  to: string;
  subject: string;
  question: string;
  suggestedFee: string;
} {
  return {
    to: "District Collector, Khordha, Odisha",
    subject: `RTI Request: Land Acquisition Status — Village ${input.village}`,
    question: buildRTIQuestion(input.village),
    suggestedFee: "₹10 (online via rtionline.gov.in)",
  };
}

/**
 * Main fetch function. Runs eCourts LA case search + SIA page scrape.
 *
 * For the eCourts layer: searches for the seller name across all Khurda court complexes,
 * then filters results to "Land Acquisition Act 2013" case types.
 * Since eCourts party search doesn't have an act-type filter, we search by name
 * and post-filter for LA cases.
 *
 * For the SIA layer: fetches the Odisha Revenue SIA notification list and
 * cross-references village names against our dictionary.
 *
 * Both layers produce a risk assessment. RTI is surfaced as the definitive fallback
 * that the buyer should pursue independently.
 */
export async function fetch(input: LARRInput): Promise<LARRRiskResult> {
  const fetchedAt = new Date().toISOString();
  const attempts: LARRRiskResult["attempts"] = [];

  if (!input.sellerName && !input.village) {
    return {
      source: "larr",
      status: "failed",
      verification: "error",
      fetchedAt,
      statusReason: "LARR fetch requires at least one of sellerName or village.",
      attempts: [],
      parserVersion: PARSER_VERSION,
    };
  }

  const districtCode = input.districtCode ?? "8";
  const districtName = input.districtName ?? "Khurda";
  const results: LARRRiskResult["data"] = {
    cases: [],
    siaNotifications: [],
    riskAssessment: {
      hasActiveCases: false,
      hasSIANotifications: false,
      riskLevel: "unknown",
      summary: "",
    },
    sources: [
      { source: "ecourts", status: "not_checked", outcome: "" },
      { source: "revenue_odisha_sia", status: "not_checked", outcome: "" },
      { source: "lacrris", status: "not_checked", outcome: "" },
      { source: "rti", status: "not_checked", outcome: "" },
    ],
    instructions: {
      rtiToCollector: "",
      revenueOfficeVisit: "",
    },
  };

  // ── Layer 1: eCourts party-name search for Land Acquisition Act cases ─────────
  if (input.sellerName) {
    attempts.push({
      source: "ecourts",
      action: `party_name_search:${input.sellerName}`,
      outcome: "not_started",
    });

    try {
      // Import the eCourts fetcher and run party-name search
      const { ecourtsFetch } = await import("@cleardeed/fetcher-ecourts");
      const ecourtsResult = await ecourtsFetch({
        partyName: input.sellerName,
        districtName,
        districtCode,
        tryNameVariants: true,
        doubleFetch: true,
      });

      // Filter to only Land Acquisition Act cases
      const laCaseTypes = [
        "Land Acquisition Act",
        "Land Acquisition",
        "LA Act",
        "LARR Act",
        "Land Acq",
        "LA",
      ];

      const laCases = (ecourtsResult.data?.cases ?? []).filter((c: any) =>
        laCaseTypes.some((la) =>
          (c.caseType ?? "").toLowerCase().includes(la.toLowerCase()) ||
          (c.caseNo ?? "").toLowerCase().includes("la")
        )
      );

      results.cases = laCases.map((c: any) => ({
        caseNo: c.caseNo,
        caseType: c.caseType,
        court: c.court,
        filingDate: c.filingDate,
        status: c.status,
        caseAct: "Land Acquisition Act 2013",
        parties: c.parties ?? [],
      }));

      results.sources = results.sources.map((s) =>
        s.source === "ecourts"
          ? {
              ...s,
              status: "checked",
              outcome: laCases.length > 0
                ? `found_${laCases.length}_land_acquisition_cases`
                : "no_land_acquisition_cases_for_seller",
            }
          : s
      );

      results.riskAssessment.hasActiveCases = laCases.length > 0;

      attempts.push({
        source: "ecourts",
        action: `party_name_search:${input.sellerName}`,
        outcome: laCases.length > 0 ? `found_${laCases.length}_la_cases` : "no_la_cases_for_seller",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.sources = results.sources.map((s) =>
        s.source === "ecourts"
          ? { ...s, status: "flagged", outcome: `search_failed_${msg}` }
          : s
      );
      attempts.push({
        source: "ecourts",
        action: `party_name_search:${input.sellerName}`,
        outcome: `failed: ${msg}`,
      });
    }
  }

  // ── Layer 2: SIA notification scrape ───────────────────────────────────────────
  if (input.village) {
    attempts.push({
      source: "revenue_odisha_sia",
      action: `sia_scrape:${input.village}`,
      outcome: "not_started",
    });

    try {
      const siaNotifications = await scrapeOdishaSIANotifications(input.village);
      results.siaNotifications = siaNotifications;

      results.sources = results.sources.map((s) =>
        s.source === "revenue_odisha_sia"
          ? {
              ...s,
              status: "checked",
              outcome:
                siaNotifications.length > 0
                  ? `found_${siaNotifications.length}_sia_notifications`
                  : "no_sia_notifications_for_village",
            }
          : s
      );

      results.riskAssessment.hasSIANotifications = siaNotifications.length > 0;

      attempts.push({
        source: "revenue_odisha_sia",
        action: `sia_scrape:${input.village}`,
        outcome:
          siaNotifications.length > 0
            ? `found_${siaNotifications.length}_sia_notifications`
            : "no_sia_notifications_for_village",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.sources = results.sources.map((s) =>
        s.source === "revenue_odisha_sia"
          ? { ...s, status: "flagged", outcome: `scrape_failed_${msg}` }
          : s
      );
      attempts.push({
        source: "revenue_odisha_sia",
        action: `sia_scrape:${input.village}`,
        outcome: `failed: ${msg}`,
      });
    }
  }

  // ── Layer 3: RTI instructions (always surfaced as definitive fallback) ──────────
  results.sources = results.sources.map((s) =>
    s.source === "rti"
      ? {
          ...s,
          status: "checked",
          outcome: "rti_recommended_as_definitive_verification",
        }
      : s
  );

  const rtiInfo = generateRTIQuestion(input);
  results.instructions.rtiToCollector = `File RTI to District Collector, Khordha (rtionline.gov.in). Fee: ₹10. Question: "${rtiInfo.question}". Expected response: 30 days. This is the definitive verification for preliminary S.11 notifications.`;
  results.instructions.revenueOfficeVisit = `Visit the Tehsil office and the Revenue Inspector (RI) for this village. Ask specifically: (1) Has any land acquisition notification under LARR Act 2013 been issued for this village? (2) Is there a pending Social Impact Assessment (SIA)?`;

  // ── Risk assessment ──────────────────────────────────────────────────────────
  if (results.riskAssessment.hasActiveCases && results.riskAssessment.hasSIANotifications) {
    results.riskAssessment.riskLevel = "high";
    results.riskAssessment.summary =
      "Active land acquisition litigation found in eCourts AND preliminary SIA notifications found for this village. Recommend seeking legal counsel before transacting.";
  } else if (results.riskAssessment.hasActiveCases) {
    results.riskAssessment.riskLevel = "elevated";
    results.riskAssessment.summary =
      "Active land acquisition litigation found in eCourts for this seller. This is a lagging indicator — a preliminary notification may exist without litigation. Recommend RTI to District Collector for definitive status.";
  } else if (results.riskAssessment.hasSIANotifications) {
    results.riskAssessment.riskLevel = "elevated";
    results.riskAssessment.summary =
      "Preliminary SIA notifications found for this village in Odisha Revenue records. No active litigation found in eCourts for the seller — acquisition may be in early stages. RTI to District Collector is strongly recommended.";
  } else {
    results.riskAssessment.riskLevel = "unknown";
    results.riskAssessment.summary =
      "No active land acquisition litigation found in eCourts for this seller and no SIA notifications found for this village in Odisha Revenue records. However, preliminary notifications may not yet have reached eCourts or the Revenue SIA page. RTI to District Collector, Khordha is recommended for definitive confirmation.";
  }

  const hasAnyData = results.cases.length > 0 || results.siaNotifications.length > 0;
  const allChecked = results.sources.every((s) => s.status === "checked");

  return {
    source: "larr",
    status: hasAnyData ? "success" : allChecked ? "partial" : "partial",
    verification: results.riskAssessment.riskLevel === "high" || results.riskAssessment.riskLevel === "elevated"
      ? "verified"
      : "manual_required",
    fetchedAt,
    data: results,
    statusReason: results.riskAssessment.summary,
    attempts,
    rawArtifactRef: `larr-${sha256(fetchedAt)}`,
    parserVersion: PARSER_VERSION,
  };
}

// ── SIA notification scrape ────────────────────────────────────────────────────

const ODISHA_REVENUE_SIA_URL = "https://revenue.odisha.gov.in/en/Communication/sia-notification/4-1-notification";

async function scrapeOdishaSIANotifications(
  targetVillage: string
): Promise<SIANotification[]> {
  // Import Playwright lazily
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(ODISHA_REVENUE_SIA_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Wait for the notification table to load
    await page.waitForTimeout(2_000);

    // Get all text content from the page
    const pageContent = await page.content();

    // Look for table rows with village name
    const notifications: SIANotification[] = [];

    // Try to find table rows
    const rows = await page.$$("table tbody tr, table tr");

    if (rows.length === 0) {
      // Fallback: search page text for village
      const text = await page.evaluate(() => document.body?.innerText ?? "");
      const normalizedTarget = targetVillage.toLowerCase().trim();

      // Search for village mentions
      const villageMatches = text.match(
        new RegExp(`(${targetVillage}[^\\n<]{0,200})`, "gi")
      );

      if (villageMatches && villageMatches.length > 0) {
        for (const match of villageMatches) {
          notifications.push({
            village: targetVillage,
            area: extractAreaFromText(match),
            projectPurpose: extractProjectFromText(match),
            notificationType: "SIA 4(1) Notification",
            sourceUrl: ODISHA_REVENUE_SIA_URL,
          });
        }
      }
    } else {
      // Parse table rows
      for (const row of rows) {
        const cells = await row.$$("td");
        if (cells.length < 2) continue;

        const cellTexts = await Promise.all(
          cells.map((c) => c.innerText())
        );
        const joinedText = cellTexts.join(" ");

        // Check if any cell contains the target village
        if (
          joinedText.toLowerCase().includes(targetVillage.toLowerCase()) ||
          joinedText.toLowerCase().includes(normalizeVillage(targetVillage))
        ) {
          notifications.push({
            village: extractVillage(cellTexts),
            area: cellTexts[1] ?? "",
            projectPurpose: cellTexts[2] ?? cellTexts[3] ?? "",
            notificationDate: extractDate(cellTexts),
            notificationType: extractNotificationType(cellTexts),
            sourceUrl: ODISHA_REVENUE_SIA_URL,
          });
        }
      }
    }

    // Deduplicate by village + project
    const seen = new Set<string>();
    return notifications.filter((n) => {
      const key = `${n.village}|${n.projectPurpose}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } finally {
    await browser.close();
  }
}

function normalizeVillage(village: string): string {
  return village
    .toLowerCase()
    .replace(/\(ct\)/gi, "")
    .replace(/\s+/g, " ")
    .replace(/^the\s+/i, "")
    .trim();
}

function extractVillage(cells: string[]): string {
  // Try to find village name in first few cells
  for (const cell of cells.slice(0, 3)) {
    const trimmed = cell.trim();
    if (trimmed && trimmed.length > 1 && trimmed.length < 100) {
      if (!/^\d+$/.test(trimmed) && !/^\d+\/\d+$/.test(trimmed)) {
        return trimmed;
      }
    }
  }
  return cells[0] ?? "";
}

function extractAreaFromText(text: string): string {
  const areaMatch = text.match(/(\d+\.?\d*)\s*(acres?|hectares?|sq\.?\s*m|decimal)/i);
  return areaMatch ? areaMatch[0] : "";
}

function extractProjectFromText(text: string): string {
  // Extract project purpose — usually the longer text after village/area
  const parts = text.split(/\n|,/);
  const relevant = parts.filter(
    (p) =>
      p.trim().length > 10 &&
      !/^\d+$/.test(p.trim()) &&
      !/Village|Taluk|District/i.test(p.trim())
  );
  return relevant[0]?.trim() ?? "";
}

function extractDate(cells: string[]): string | undefined {
  const datePatterns = [
    /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/,
    /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/,
    /[A-Za-z]+\s+\d{1,2},?\s+\d{4}/,
  ];

  for (const cell of cells) {
    for (const pattern of datePatterns) {
      const match = cell.match(pattern);
      if (match) return match[0];
    }
  }
  return undefined;
}

function extractNotificationType(cells: string[]): string {
  const text = cells.join(" ").toLowerCase();
  if (text.includes("4(1)") || text.includes("section 4")) return "SIA 4(1) Notification";
  if (text.includes("19") || text.includes("declaration")) return "LARR S.19 Declaration";
  if (text.includes("11") || text.includes("preliminary")) return "Preliminary S.11 Notification";
  return "Land Acquisition Notification";
}

export async function healthCheck(): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(ODISHA_REVENUE_SIA_URL, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await page.waitForTimeout(1_000);
    const content = await page.evaluate(() => document.body?.innerText ?? "");
    await browser.close();

    if (content.length < 100) {
      return { ok: false, reason: "SIA page returned very little content" };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: `SIA page unreachable: ${msg}` };
  }
}
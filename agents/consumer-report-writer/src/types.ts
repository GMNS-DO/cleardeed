/**
 * A10 ConsumerReportWriter — TypeScript type helpers
 *
 * Re-exports schema types and defines cross-project mapping types
 * between orchestrator output (SourceResult[]) and A10 ConsumerReportInput.
 */

import type {
  ConsumerReportInput,
  GeoFetchResult,
  RoRDocumentV1,
  CourtCaseResult,
  RegistryLinks,
  OwnershipReasonerResult,
  LandClassificationReport,
  EncumbranceReasonerResult,
  RegulatoryFlagsReport,
  ValidationFinding,
} from "../schema";

export type {
  ConsumerReportInput,
  GeoFetchResult,
  RoRDocumentV1,
  CourtCaseResult,
  RegistryLinks,
  OwnershipReasonerResult,
  LandClassificationReport,
  EncumbranceReasonerResult,
  RegulatoryFlagsReport,
  ValidationFinding,
};

/** Land class Odia → English translation map (observed from Bhulekh RoR). */
export const LAND_CLASS_MAP: Record<string, string> = {
  // Irrigated
  "ଦାନ୍ଡା": "Irrigated (ଦଣଢ଼ା)",
  "ଦାନ୍ଡ": "Irrigated",
  "ଦାନ୍ଥା": "Irrigated (ଦଣଢ଼ା)",
  "ଦାନ୍ଥ": "Irrigated",
  "ଦାନ୍ଥେ": "Irrigated",
  // Dry / unbonded
  "ଦାର୍ଡ": "Dry land (ବାର୍ଡ)",
  "ଦାର୍ଦ": "Dry",
  // Fallow
  "ଶାରଦ": "Fallow / Shradh",
  "ଶାରଦ ଦାଡ": "Fallow double",
  "ଶାରଦ ତିନି": "Fallow triple",
  // Niga
  "ନିଗର": "Nigar / Garden land",
  // Jungle
  "ଝାଙଲ": "Jungle / Forest",
  // Dharm
  "ଧର୍ଦ": "Religious / Dharm land",
  // Misc
  "ପ଴": "Path / Road",
  "ପ୍ରଥ": "Pond / Tank",
  "ନିକେତ": "Homestead",
  "ଗଂ": "Cow-shed / Gon",
  "சோପ": "Choup / Market",
};

/** Translate an Odia land class string to English. */
export function translateLandClass(odia: string | null | undefined): string {
  if (!odia) return "Unknown";
  const trimmed = odia.trim();
  if (LAND_CLASS_MAP[trimmed]) return LAND_CLASS_MAP[trimmed];
  return odia; // return original if not found — will show in report
}

/** Odia number → Arabic digit. */
export function odiaDigitsToArabic(odia: string): string {
  return odia.replace(/[\u0B66-\u0B6F]/g, (m) =>
    String.fromCharCode(m.charCodeAt(0) - 0xB66 + 0x30)
  );
}

/** Format area with unit. */
export function formatArea(
  area: number | null | undefined,
  unit: string | null | undefined
): string {
  if (area == null) return "—";
  const u = unit ?? "acre";
  if (u === "decimil") return `${area} decimil`;
  return `${area} ${u}`;
}

// ---------------------------------------------------------------------------
// Risk Intelligence Insight Types
// ---------------------------------------------------------------------------

/** The five risk dimensions covered by the insight engine. */
export type RiskDimension =
  | "transferability" // Can this land be sold?
  | "title"           // Who owns it, is the chain clean?
  | "financial"       // Hidden costs / encumbrances?
  | "positive"        // What looks clean / reassuring?
  | "redFlag";        // Immediate verification needed

/** Severity of a risk insight. */
export type RiskSeverity = "positive" | "watchout" | "redFlag";

/**
 * A single risk intelligence insight.
 * Factual, consumer-grade, adds risk context without legal advice.
 */
export interface RiskInsight {
  dimension: RiskDimension;
  severity: RiskSeverity;
  /** Short label shown in the insight card. */
  label: string;
  /** Consumer-grade explanation — what this means for the buyer. */
  body: string;
  /** Which Bhulekh field(s) this is based on. */
  source: string;
  /**
   * How important this insight is.
   * 1–2: surface prominently (report header, top of section)
   * 3–5: standard placement within section
   * 6–10: detail / technical level
   */
  priority: number;
  /**
   * Which report panel this insight belongs to.
   * Used to group insights for rendering.
   */
  panelId: string;
  /** Specific action the buyer should take, if any. */
  actionItem?: string;
}

/**
 * Input to the risk insight engine.
 * Accepts any shape — individual fields may be null/missing.
 */
export interface RiskInsightInput {
  bhulekhUsable: boolean;
  bhulekhStatus?: string | null;
  selectedPlotNo?: unknown;
  ownerRecords?: Array<{
    odia?: string | null;
    latin?: string | null;
    guardianOdia?: string | null;
    guardianLatin?: string | null;
    casteOdia?: string | null;
    residenceOdia?: string | null;
    nameReading?: { needsManualReview?: boolean } | null;
    guardianReading?: { needsManualReview?: boolean } | null;
    ownerType?: string | null;
  }> | null;
  plotRows?: any[] | null;
  selectedPlotRow?: any | null;
  plotArea?: {
    acres?: number | null;
    sqft?: number | null;
    acreRaw?: unknown;
    decimalRaw?: unknown;
    hectareRaw?: unknown;
  } | null;
  landClass?: {
    rawKisam?: unknown;
    standardizedKisam?: unknown;
    displayKisam?: unknown;
    conversionRequired?: boolean | null;
    prohibited?: boolean | null;
    buildable?: boolean | null;
  } | null;
  dues?: {
    total?: unknown;
    khajana?: unknown;
    cess?: unknown;
    otherCess?: unknown;
    jalkar?: unknown;
  } | null;
  remarks?: {
    finalPublicationDate?: unknown;
    generatedAtRaw?: unknown;
    specialRemarks?: unknown;
  } | null;
  backPage?: {
    mutationHistory?: any[] | null;
    encumbranceEntries?: any[] | null;
    backPageRemarks?: any[] | null;
  } | null;
  /** Name match from A5 OwnershipReasoner, if available. */
  nameMatch?: {
    state?: string;
    claimedName?: string;
    officialName?: string;
    confidence?: number;
    explanation?: string;
  } | null;
  /** Court case result from eCourts, if available. */
  courtCases?: {
    total?: number;
    status?: string;
  } | null;
}

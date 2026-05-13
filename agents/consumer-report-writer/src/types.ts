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

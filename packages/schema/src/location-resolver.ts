/**
 * location-resolver.ts — Day 3 deliverable
 *
 * Resolves user input (messy tehsil/village names) to canonical Bhulekh values.
 * Algorithm (per CLEARDEED_HANDOFF_V1.1.md §4.2):
 *   Tehsil: exact-match → case-insensitive → known-alternate dictionary → fuzzy (Levenshtein ≤ 2).
 *   Village: scoped to resolved tehsil. Same cascade.
 *   If multiple villages match equally: return `ambiguous_village` with candidate list.
 *   On success: return bhulekh_value for both tehsil and village.
 *
 * This is the foundation for the dropdown-based V1.1 input flow.
 * No LLM used — deterministic string matching only.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { levenshteinDistance } from "./validation.js";

// ─── Load location graph ─────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const GRAPH_PATH = join(__dirname, "data/odisha-location-graph.json");

interface VillageEntry {
  name_en: string;
  name_or: string;
  bhulekhVillageCode: string;
  nameEnAlternates: string[];
  nameOrAlternates: string[];
}

interface RIEntry {
  name_en: string;
  villages: VillageEntry[];
}

interface TehsilEntry {
  name_en: string;
  name_or: string;
  bhulekh_value: string;
  alternateSpellings: string[];
  riCircles: RIEntry[];
}

interface LocationGraph {
  version: string;
  generatedAt: string;
  district: { name_en: string; name_or: string; bhulekh_value: string };
  tehsils: TehsilEntry[];
  _meta: {
    totalTehsils: number;
    totalVillages: number;
    digitizedVillages: number;
    notDigitizedVillages: number;
    scrapeSource: string;
  };
}

let _graph: LocationGraph | null = null;

export function getLocationGraph(): LocationGraph {
  if (!_graph) {
    _graph = JSON.parse(readFileSync(GRAPH_PATH, "utf-8")) as LocationGraph;
  }
  return _graph;
}

// ─── Normalization helpers ──────────────────────────────────────────────────────

function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[‐‑—–]/g, "-")  // normalize hyphens
    .replace(/[\s_]+/g, " ")
    .replace(/[^a-z0-9ऀ-ॿ]/g, "")  // strip punctuation, keep alphanum + Odia
    .trim();
}

function cleanForComparison(str: string): string {
  // Preserve Odia script — don't strip it. Normalize case for Latin, keep Odia chars.
  return normalize(str);
}
function cleanForOdiaMatch(str: string): string {
  // For Odia→Odia exact comparison, normalize but keep the script
  return str.toLowerCase().replace(/[\s_]+/g, " ").trim();
}
function cleanForLatinMatch(str: string): string {
  // For Latin name comparison, strip punctuation but keep letters and numbers
  return normalize(str).replace(/[^a-z0-9]/g, "");
}

// ─── Fuzzy match score (lower = better, 0 = exact) ────────────────────────────────

function fuzzyScore(input: string, candidate: string): number {
  const normInput = cleanForComparison(input);
  const normCand = cleanForComparison(candidate);
  if (normInput === normCand) return 0;
  // Levenshtein distance capped at 4 (anything higher is not a match)
  if (Math.abs(normInput.length - normCand.length) <= 4) {
    return levenshteinDistance(normInput, normCand);
  }
  // Length difference too large — check substring inclusion
  if (normCand.includes(normInput) || normInput.includes(normCand)) {
    return 0.5; // partial match
  }
  return 99; // no match
}

// ─── Tehsil resolver ────────────────────────────────────────────────────────────

// Hand-built alternate-spelling dictionary (per CLEARDEED_HANDOFF_V1.1.md Appendix A)
// Maps every plausible spelling variant → canonical tehsil name_en
const TEHSIL_ALTERNATES: Record<string, string> = {
  // Bhubaneswar
  "bhubaneswar": "Bhubaneswar",
  "bhubaneshwar": "Bhubaneswar",
  "bhubaneswer": "Bhubaneswar",
  "bhuaneswar": "Bhubaneswar",
  // Kordha
  "kordha": "Kordha",
  "khordha": "Kordha",
  "khorda": "Kordha",
  "khurdha": "Kordha",
  "khurda": "Kordha",
  "korda": "Kordha",
  "kodha": "Kordha",
  "korha": "Kordha",
  // Jatni
  "jatni": "Jatni",
  "jatani": "Jatni",
  "jathni": "Jatni",
  "jtn": "Jatni",           // common abbreviation
  // Tangi
  "tangi": "Tangi",
  "tangi": "Tangi",
  // Banapur
  "banapur": "Banapur",
  "banapur": "Banapur",
  "banpore": "Banapur",
  // Balianta
  "balianta": "Balianta",
  "balianta": "Balianta",
  // Balipatna
  "balipatna": "Balipatna",
  "balipathna": "Balipatna",
  "balipatna": "Balipatna",
  // Begunia
  "begunia": "Begunia",
  "beguniapada": "Begunia",
  "beguniapara": "Begunia",
  "beguniapda": "Begunia",
  // Bolgarh
  "bolgarh": "Bolgarh",
  "bolagarh": "Bolgarh",
  "bolgarh": "Bolgarh",
  "bolagrah": "Bolgarh",
  "bolgad": "Bolgarh",
  // Chilika
  "chilika": "Chilika",
  "balugaon": "Chilika",
  "balugon": "Chilika",
  "balugaun": "Chilika",
  "balgaon": "Chilika",
  "chilik": "Chilika",
};

export interface ResolveTehsilResult {
  success: true;
  tehsilNameEn: string;
  tehsilNameOr: string;
  bhulekh_value: string;
  matchMethod: "exact" | "case-insensitive" | "alternate" | "fuzzy";
}

export interface ResolveTehsilError {
  success: false;
  errorCode: "TEHSIL_NOT_FOUND" | "TEHSIL_AMBIGUOUS";
  errorMessage: string;
  candidates?: { tehsilNameEn: string; matchScore: number }[];
}

export type ResolveTehsilOutput = ResolveTehsilResult | ResolveTehsilError;

export function resolveTehsil(rawInput: string): ResolveTehsilOutput {
  const graph = getLocationGraph();
  const input = rawInput.trim();

  if (!input) {
    return { success: false, errorCode: "TEHSIL_NOT_FOUND", errorMessage: "Tehsil name is required" };
  }

  // Step 1: exact match on canonical name_en
  const exact = graph.tehsils.find(
    (t) => cleanForComparison(t.name_en) === cleanForComparison(input)
  );
  if (exact) {
    return { success: true, tehsilNameEn: exact.name_en, tehsilNameOr: exact.name_or, bhulekh_value: exact.bhulekh_value, matchMethod: "exact" };
  }

  // Step 2: case-insensitive match
  const ci = graph.tehsils.find(
    (t) => cleanForComparison(t.name_en) === cleanForComparison(input)
  );
  // Already checked above — check alternate spellings in canonical names
  const ciAlt = graph.tehsils.find(
    (t) => cleanForComparison(t.name_or) === cleanForComparison(input)
  );
  if (ciAlt) {
    return { success: true, tehsilNameEn: ciAlt.name_en, tehsilNameOr: ciAlt.name_or, bhulekh_value: ciAlt.bhulekh_value, matchMethod: "case-insensitive" };
  }

  // Step 3: known-alternate dictionary
  const normalized = cleanForComparison(input);
  if (TEHSIL_ALTERNATES[normalized]) {
    const mapped = TEHSIL_ALTERNATES[normalized];
    const found = graph.tehsils.find((t) => t.name_en === mapped);
    if (found) {
      return { success: true, tehsilNameEn: found.name_en, tehsilNameOr: found.name_or, bhulekh_value: found.bhulekh_value, matchMethod: "alternate" };
    }
  }

  // Step 4: fuzzy match (Levenshtein ≤ 2)
  const scored = graph.tehsils
    .map((t) => ({ tehsil: t, score: fuzzyScore(input, t.name_en) }))
    .filter(({ score }) => score <= 2)
    .sort((a, b) => a.score - b.score);

  if (scored.length === 1) {
    return {
      success: true,
      tehsilNameEn: scored[0].tehsil.name_en,
      tehsilNameOr: scored[0].tehsil.name_or,
      bhulekh_value: scored[0].tehsil.bhulekh_value,
      matchMethod: "fuzzy",
    };
  }

  if (scored.length > 1) {
    return {
      success: false,
      errorCode: "TEHSIL_AMBIGUOUS",
      errorMessage: `Multiple tehsils match '${input}'. Did you mean one of: ${scored.map((s) => s.tehsil.name_en).join(", ")}?`,
      candidates: scored.map(({ tehsil, score }) => ({ tehsilNameEn: tehsil.name_en, matchScore: score })),
    };
  }

  // Step 5: no match
  return {
    success: false,
    errorCode: "TEHSIL_NOT_FOUND",
    errorMessage: `Tehsil '${input}' not found in Khordha. Try: ${graph.tehsils.map((t) => t.name_en).join(", ")}`,
  };
}

// ─── Village resolver ────────────────────────────────────────────────────────────

export interface ResolveVillageResult {
  success: true;
  villageNameEn: string;
  villageNameOr: string;
  bhulekhVillageCode: string;
  tehsilNameEn: string;
  matchMethod: "exact" | "case-insensitive" | "alternate" | "fuzzy" | "odya_en_match";
}

export interface ResolveVillageError {
  success: false;
  errorCode: "VILLAGE_NOT_FOUND" | "VILLAGE_AMBIGUOUS" | "TEHSIL_SCOPE_REQUIRED";
  errorMessage: string;
  candidates?: { villageNameEn: string; villageNameOr: string; matchScore: number }[];
}

export type ResolveVillageOutput = ResolveVillageResult | ResolveVillageError;

export function resolveVillage(
  rawInput: string,
  tehsilNameEn: string
): ResolveVillageOutput {
  const graph = getLocationGraph();

  const tehsil = graph.tehsils.find((t) => t.name_en === tehsilNameEn);
  if (!tehsil) {
    return { success: false, errorCode: "TEHSIL_SCOPE_REQUIRED", errorMessage: `Tehsil '${tehsilNameEn}' not found` };
  }

  const input = rawInput.trim();
  if (!input) {
    return { success: false, errorCode: "VILLAGE_NOT_FOUND", errorMessage: "Village name is required" };
  }

  // Collect all villages in this tehsil
  const allVillages = tehsil.riCircles.flatMap((ri) => ri.villages);

  // Step 1: exact match on name_en (most reliable)
  const exact = allVillages.find(
    (v) => cleanForLatinMatch(v.name_en) === cleanForLatinMatch(input)
  );
  if (exact) {
    return {
      success: true,
      villageNameEn: exact.name_en,
      villageNameOr: exact.name_or,
      bhulekhVillageCode: exact.bhulekhVillageCode,
      tehsilNameEn: tehsil.name_en,
      matchMethod: "exact",
    };
  }

  // Step 2: exact match on name_or (Odia script comparison)
  const exactOr = allVillages.find(
    (v) => cleanForOdiaMatch(v.name_or) === cleanForOdiaMatch(input)
  );
  if (exactOr) {
    return {
      success: true,
      villageNameEn: exactOr.name_en,
      villageNameOr: exactOr.name_or,
      bhulekhVillageCode: exactOr.bhulekhVillageCode,
      tehsilNameEn: tehsil.name_en,
      matchMethod: "exact",
    };
  }

  // Step 3: alternate spellings (nameEnAlternates)
  const altEn = allVillages.find(
    (v) => v.nameEnAlternates.some((alt) => cleanForComparison(alt) === cleanForComparison(input))
  );
  if (altEn) {
    return {
      success: true,
      villageNameEn: altEn.name_en,
      villageNameOr: altEn.name_or,
      bhulekhVillageCode: altEn.bhulekhVillageCode,
      tehsilNameEn: tehsil.name_en,
      matchMethod: "alternate",
    };
  }

  // Step 4: fuzzy match on name_en (Levenshtein ≤ 2)
  const scored = allVillages
    .map((v) => ({ village: v, score: fuzzyScore(input, v.name_en) }))
    .filter(({ score }) => score <= 2)
    .sort((a, b) => a.score - b.score);

  if (scored.length === 1) {
    return {
      success: true,
      villageNameEn: scored[0].village.name_en,
      villageNameOr: scored[0].village.name_or,
      bhulekhVillageCode: scored[0].village.bhulekhVillageCode,
      tehsilNameEn: tehsil.name_en,
      matchMethod: "fuzzy",
    };
  }

  if (scored.length > 1) {
    return {
      success: false,
      errorCode: "VILLAGE_AMBIGUOUS",
      errorMessage: `Multiple villages in ${tehsilNameEn} match '${input}'. Please select one:`,
      candidates: scored.map(({ village, score }) => ({
        villageNameEn: village.name_en,
        villageNameOr: village.name_or,
        matchScore: score,
      })),
    };
  }

  // Step 5: no match
  return {
    success: false,
    errorCode: "VILLAGE_NOT_FOUND",
    errorMessage: `Village '${input}' not found in ${tehsilNameEn}. Try the dropdown selection.`,
  };
}

// ─── Combined resolveLocation ───────────────────────────────────────────────────

export interface ResolvedLocation {
  tehsilNameEn: string;
  tehsilNameOr: string;
  tehsilBhulekhValue: string;
  tehsilMatchMethod: ResolveTehsilResult["matchMethod"];
  villageNameEn: string;
  villageNameOr: string;
  bhulekhVillageCode: string;
  villageMatchMethod: ResolveVillageResult["matchMethod"];
}

export interface ResolutionError {
  stage: "tehsil" | "village";
  errorCode: string;
  errorMessage: string;
  candidates?: unknown[];
}

export type ResolveLocationOutput =
  | { success: true; location: ResolvedLocation }
  | { success: false; error: ResolutionError };

export function resolveLocation(
  tehsilInput: string,
  villageInput: string
): ResolveLocationOutput {
  // Resolve tehsil first
  const tehsilResult = resolveTehsil(tehsilInput);
  if (!tehsilResult.success) {
    return { success: false, error: { stage: "tehsil", errorCode: tehsilResult.errorCode, errorMessage: tehsilResult.errorMessage, candidates: (tehsilResult as ResolveTehsilError).candidates } };
  }

  // Resolve village scoped to tehsil
  const villageResult = resolveVillage(villageInput, tehsilResult.tehsilNameEn);
  if (!villageResult.success) {
    return { success: false, error: { stage: "village", errorCode: villageResult.errorCode, errorMessage: villageResult.errorMessage, candidates: (villageResult as ResolveVillageError).candidates } };
  }

  return {
    success: true,
    location: {
      tehsilNameEn: tehsilResult.tehsilNameEn,
      tehsilNameOr: tehsilResult.tehsilNameOr,
      tehsilBhulekhValue: tehsilResult.bhulekh_value,
      tehsilMatchMethod: tehsilResult.matchMethod,
      villageNameEn: villageResult.villageNameEn,
      villageNameOr: villageResult.villageNameOr,
      bhulekhVillageCode: villageResult.bhulekhVillageCode,
      villageMatchMethod: villageResult.matchMethod,
    },
  };
}

// ─── Get all tehsils (for dropdown) ─────────────────────────────────────────────

export interface TehsilOption {
  name_en: string;
  name_or: string;
  bhulekh_value: string;
  alternateSpellings: string[];
  villageCount: number;
}

export function getTehsilOptions(): TehsilOption[] {
  const graph = getLocationGraph();
  return graph.tehsils.map((t) => ({
    name_en: t.name_en,
    name_or: t.name_or,
    bhulekh_value: t.bhulekh_value,
    alternateSpellings: t.alternateSpellings,
    villageCount: t.riCircles.reduce((s, ri) => s + ri.villages.length, 0),
  }));
}

// ─── Get villages for a tehsil (for dropdown) ───────────────────────────────────

export interface VillageOption {
  name_en: string;
  name_or: string;
  bhulekhVillageCode: string;
  nameEnAlternates: string[];
}

export function getVillageOptions(tehsilNameEn: string): VillageOption[] {
  const graph = getLocationGraph();
  const tehsil = graph.tehsils.find((t) => t.name_en === tehsilNameEn);
  if (!tehsil) return [];
  return tehsil.riCircles.flatMap((ri) =>
    ri.villages.map((v) => ({
      name_en: v.name_en,
      name_or: v.name_or,
      bhulekhVillageCode: v.bhulekhVillageCode,
      nameEnAlternates: v.nameEnAlternates,
    }))
  );
}
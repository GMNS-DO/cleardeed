/**
 * identifier-picker.ts — Day 3 deliverable
 *
 * Ranks user's raw identifier input against scraped Bhulekh dropdown options.
 * Per CLEARDEED_HANDOFF_V1.1.md §4.3:
 *   normalizeIdentifier(searchMode, raw, dropdownOptions[]) → RankedOption[]
 *
 * Ranking:
 *   Rank 1: exact match (if present in dropdown)
 *   Rank 2: prefix matches (entries starting with user's input)
 *   Rank 3: fuzzy matches (Levenshtein ≤ 1 on full option string)
 *
 * Used after the location resolver confirms a village. The dropdown is
 * scraped from the Bhulekh page for the chosen search mode.
 */

import { levenshteinDistance } from "./validation.js";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SearchMode = "Plot" | "Khatiyan" | "Tenant";

export interface DropdownOption {
  /** Bhulekh internal value (used for form submission) */
  value: string;
  /** Display label from dropdown */
  label: string;
  /** Odia label if available */
  labelOr?: string;
}

export interface RankedOption {
  rank: 1 | 2 | 3 | 4;
  value: string;
  label: string;
  labelOr?: string;
  matchScore: number;
  matchType: "exact" | "prefix" | "fuzzy" | "odya_exact" | "odya_prefix";
}

export interface NormalizeIdentifierResult {
  searchMode: SearchMode;
  input: string;
  rankedOptions: RankedOption[];
  hasExact: boolean;
  hasPrefix: boolean;
}

// ─── Normalization helpers ─────────────────────────────────────────────────────

function normalizeIdentifierInput(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")  // collapse whitespace
    .toUpperCase();
}

function normalizeDropdownLabel(label: string): string {
  return label
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

// ─── Number parsing (handles Bhulekh's various formats) ────────────────────────

/**
 * Extract the numeric portion of a plot/khatiyan number.
 * Handles: 35, 35/1, 1/940/3452, 04-5, "35 ଗଡ଼ିଆ" → "35"
 */
export function extractNumeric(raw: string): string | null {
  const trimmed = raw.trim();
  // Match the leading number (possibly with leading zeros)
  const match = trimmed.match(/^(\d+)/);
  return match ? match[1] : null;
}

/**
 * Normalize a plot/khatiyan number for comparison.
 * Handles: "35", "035", "35/1", "004-5" → comparable form.
 * Leading zeros stripped; slash variants normalized.
 */
export function normalizePlotNumber(raw: string): string {
  const num = extractNumeric(raw);
  if (!num) return raw.toUpperCase();
  return num; // stripped of leading zeros
}

// ─── Rank options ───────────────────────────────────────────────────────────────

/**
 * Rank the user's raw input against the scraped dropdown options.
 * Returns options sorted by rank, then by match score within each rank.
 */
export function normalizeIdentifier(
  searchMode: SearchMode,
  raw: string,
  dropdownOptions: DropdownOption[]
): NormalizeIdentifierResult {
  if (!raw.trim() || dropdownOptions.length === 0) {
    return { searchMode, input: raw, rankedOptions: [], hasExact: false, hasPrefix: false };
  }

  const normalizedInput = normalizeIdentifierInput(raw);

  const ranked: RankedOption[] = [];
  const seenValues = new Set<string>();

  for (const opt of dropdownOptions) {
    const normLabel = normalizeDropdownLabel(opt.label);
    const normValue = opt.value.trim();
    if (!normValue || seenValues.has(normValue)) continue;
    seenValues.add(normValue);

    // Rank 1: exact match (input === full label or value)
    if (normLabel === normalizedInput || opt.value.trim() === raw.trim()) {
      ranked.push({ rank: 1, value: opt.value.trim(), label: opt.label, labelOr: opt.labelOr, matchScore: 0, matchType: "exact" });
      continue;
    }

    // Rank 1b: Odia exact match
    if (opt.labelOr && cleanForComparison(opt.labelOr) === cleanForComparison(raw)) {
      ranked.push({ rank: 1, value: opt.value.trim(), label: opt.label, labelOr: opt.labelOr, matchScore: 0, matchType: "odya_exact" });
      continue;
    }

    // Rank 2: prefix match (dropdown label starts with input)
    if (normLabel.startsWith(normalizedInput)) {
      ranked.push({ rank: 2, value: opt.value.trim(), label: opt.label, labelOr: opt.labelOr, matchScore: 0, matchType: "prefix" });
      continue;
    }

    // Rank 2b: prefix match on Odia
    if (opt.labelOr && cleanForComparison(opt.labelOr).startsWith(cleanForComparison(raw))) {
      ranked.push({ rank: 2, value: opt.value.trim(), label: opt.label, labelOr: opt.labelOr, matchScore: 0.1, matchType: "odya_prefix" });
      continue;
    }

    // Rank 3: fuzzy match (Levenshtein ≤ 1 on full normalized label)
    if (searchMode === "Tenant") {
      // For tenant names, use token-based matching (first name + surname)
      const tokens = normalizedInput.split(" ");
      const labelTokens = normLabel.split(" ");
      const allTokensMatch = tokens.every((t) =>
        labelTokens.some((lt) => levenshteinDistance(t, lt) <= 1)
      );
      if (allTokensMatch && tokens.length > 0) {
        const avgScore = tokens.reduce(
          (sum, t) => sum + Math.min(...labelTokens.map((lt) => levenshteinDistance(t, lt))),
          0
        ) / tokens.length;
        if (avgScore <= 1) {
          ranked.push({ rank: 3, value: opt.value.trim(), label: opt.label, labelOr: opt.labelOr, matchScore: avgScore, matchType: "fuzzy" });
          continue;
        }
      }
    } else {
      // For Plot/Khatiyan: compare numeric part
      const inputNum = normalizePlotNumber(raw);
      const labelNum = normalizePlotNumber(opt.label);
      if (inputNum && labelNum && inputNum === labelNum) {
        ranked.push({ rank: 3, value: opt.value.trim(), label: opt.label, labelOr: opt.labelOr, matchScore: 0, matchType: "fuzzy" });
        continue;
      }
      // Fallback: Levenshtein ≤ 1 on full label for short inputs
      if (normalizedInput.length >= 3 && levenshteinDistance(normalizedInput, normLabel) <= 1) {
        ranked.push({ rank: 3, value: opt.value.trim(), label: opt.label, labelOr: opt.labelOr, matchScore: 1, matchType: "fuzzy" });
        continue;
      }
    }
  }

  // Sort: rank 1 first, then rank 2, then rank 3. Within each rank, by matchScore ascending.
  ranked.sort((a, b) => a.rank - b.rank || a.matchScore - b.matchScore);

  // Assign rank 4 to any remaining options (for display completeness)
  const rankedValues = new Set(ranked.map((r) => r.value));
  for (const opt of dropdownOptions) {
    if (!rankedValues.has(opt.value.trim())) {
      ranked.push({ rank: 4, value: opt.value.trim(), label: opt.label, labelOr: opt.labelOr, matchScore: 99, matchType: "none" });
    }
  }

  // Return only ranks 1-3 (don't show non-matches in picker by default)
  return {
    searchMode,
    input: raw,
    rankedOptions: ranked.filter((r) => r.rank <= 3),
    hasExact: ranked.some((r) => r.rank === 1),
    hasPrefix: ranked.some((r) => r.rank === 2),
  };
}

function cleanForComparison(str: string): string {
  // For Odia text: remove diacritics, normalize whitespace
  return str.trim().replace(/\s+/g, " ").toLowerCase();
}

// ─── Format dropdown option for display ─────────────────────────────────────────

export function formatDropdownLabel(opt: DropdownOption): string {
  if (opt.labelOr && opt.labelOr !== opt.label) {
    return `${opt.label} (${opt.labelOr})`;
  }
  return opt.label;
}

// ─── Demo: create options from location graph village list ────────────────────────

import { getLocationGraph } from "./location-resolver.js";

export function villageDropdownOptions(
  tehsilNameEn: string,
  _searchMode: SearchMode
): DropdownOption[] {
  // This is a utility function for testing — in production, options come from
  // Bhulekh's live dropdown scrape. We use the graph to simulate options for tests.
  // Real usage: options are scraped from Bhulekh after village selection.
  const graph = getLocationGraph();
  const tehsil = graph.tehsils.find((t: TehsilEntry) => t.name_en === tehsilNameEn);
  if (!tehsil) return [];

  return tehsil.riCircles.flatMap((ri: RIEntry) =>
    ri.villages.map((v: VillageEntry) => ({
      value: v.bhulekhVillageCode,
      label: v.name_en,
      labelOr: v.name_or,
    }))
  );
}

// Re-export types for consumers
import type { TehsilEntry, VillageEntry, RIEntry } from "./location-resolver.js";
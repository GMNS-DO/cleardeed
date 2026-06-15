/**
 * IGR SRO (Sub-Registrar Office) Fetcher for ClearDeed
 *
 * Maps tahasil → SRO with contact details, EC portal URL, and operational metadata.
 * Used to generate precise manual EC retrieval instructions for the buyer report.
 *
 * Data source: curated JSON cache (data/sro-cache.json) sourced from
 * igrodisha.gov.in. No live portal calls — the SRO list is stable and small
 * (4 SROs in Khordha district).
 *
 * Why not live portal scraping?
 *   - The SRO list is stable (changes maybe 1-2x per year)
 *   - Manual curation is more reliable than scraping
 *   - No captcha or rate-limiting concerns
 *
 * Update schedule: manual update every 6 months or when IGR publishes a new
 * district/SRO list. No automated refresh (BACKLOG: SRO cache cron).
 */

import { loadSROCache, _resetCache } from "./cache.js";
import type { SROInfo, SROLookupResult } from "./contract.js";

const PARSER_VERSION = "igr-sro-v1.0.0";

export interface SROLookupInput {
  district?: string;
  tahasil?: string;
  sroName?: string;
}

/**
 * Resolve a tahasil name to its SRO metadata.
 *
 * Lookup logic:
 *   1. If sroName is provided, use it directly
 *   2. Else, match tahasil against all SRO tahasilPatterns in the district
 *   3. Else, return null (no default SRO — buyer must specify)
 *
 * @param input - district, tahasil, and/or sroName
 * @returns SROLookupResult with full SRO metadata or null data
 */
export function lookupSRO(input: SROLookupInput): SROLookupResult {
  const fetchedAt = new Date().toISOString();
  const district = input.district ?? "Khordha"; // Default to Khordha for launch
  const cache = loadSROCache();

  if (!cache) {
    return {
      source: "igr-sro",
      status: "error",
      statusReason: "cache_load_failed",
      fetchedAt,
      parserVersion: PARSER_VERSION,
      data: null,
      warnings: [
        {
          code: "CACHE_ERROR",
          message: "SRO cache could not be loaded. Manual instructions will use generic fallback.",
        },
      ],
    };
  }

  const districtEntry = cache.districts.find(
    (d) => d.district.toLowerCase() === district.toLowerCase()
  );

  if (!districtEntry) {
    return {
      source: "igr-sro",
      status: "not_found",
      statusReason: "district_not_in_cache",
      fetchedAt,
      parserVersion: PARSER_VERSION,
      data: null,
      warnings: [
        {
          code: "DISTRICT_NOT_FOUND",
          message: `District "${district}" is not in the SRO cache. Supported districts: ${cache.districts.map((d) => d.district).join(", ")}`,
        },
      ],
    };
  }

  let matchedSRO: SROInfo | null = null;
  let matchedPattern: string | undefined;

  // Strategy 1: explicit SRO name
  if (input.sroName) {
    matchedSRO =
      districtEntry.sros.find(
        (s) => s.sro.toLowerCase() === input.sroName!.toLowerCase()
      ) ?? null;
    if (matchedSRO) {
      matchedPattern = "explicit_sro_name";
    }
  }

  // Strategy 2: tahasil pattern matching
  if (!matchedSRO && input.tahasil) {
    const tahasilLower = input.tahasil.toLowerCase().trim();
    for (const sro of districtEntry.sros) {
      for (const pattern of sro.tahasilPatterns) {
        if (tahasilLower.includes(pattern) || pattern.includes(tahasilLower)) {
          matchedSRO = sro;
          matchedPattern = pattern;
          break;
        }
      }
      if (matchedSRO) break;
    }
  }

  if (!matchedSRO) {
    return {
      source: "igr-sro",
      status: "not_found",
      statusReason: input.tahasil
        ? "tahasil_no_sro_match"
        : "no_sro_provided",
      fetchedAt,
      parserVersion: PARSER_VERSION,
      data: null,
      warnings: [
        {
          code: "SRO_NOT_FOUND",
          message: input.tahasil
            ? `Tahsil "${input.tahasil}" did not match any SRO in ${district} district.`
            : `No tahasil or SRO name provided. Specify at least one to look up SRO details.`,
        },
      ],
    };
  }

  return {
    source: "igr-sro",
    status: "success",
    statusReason: matchedPattern === "explicit_sro_name" ? "explicit_sro_name" : `tahasil_pattern_match:${matchedPattern}`,
    fetchedAt,
    parserVersion: PARSER_VERSION,
    data: {
      district,
      sro: matchedSRO.sro,
      sroCode: matchedSRO.sroCode,
      address: matchedSRO.address,
      contactUrl: matchedSRO.contactUrl,
      ecUrl: matchedSRO.ecUrl,
      operatingHours: matchedSRO.operatingHours,
      estimatedFee: matchedSRO.estimatedFee,
      expectedTime: matchedSRO.expectedTime,
      matchedTahasilPattern: matchedPattern,
    },
    warnings: [],
  };
}

/**
 * Reset the cache (used by tests).
 */
export { _resetCache };

/**
 * Health check — returns true if the cache loads successfully.
 */
export async function healthCheck(): Promise<boolean> {
  const cache = loadSROCache();
  return cache !== null && cache.districts.length > 0;
}

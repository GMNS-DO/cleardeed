/**
 * SRO cache loader for the igr-sro fetcher.
 *
 * Loads SRO metadata from data/sro-cache.json. The cache is curated from the
 * IGR Odisha portal (igrodisha.gov.in) and the Odisha Revenue Department.
 *
 * Update schedule: manual update every 6 months or when IGR publishes a new
 * district/SRO list. No automated refresh (BACKLOG: SRO cache cron).
 */

import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SROCacheSchema, type SROCache, type SROInfo } from "./contract.js";

// Resolve the cache path relative to this file. In ESM scope, we use
// import.meta.url to derive __dirname, and fall back to the vitest-provided
// global in CommonJS test contexts.
declare const __dirname: string;
const __filename_local = typeof __dirname !== "undefined"
  ? undefined
  : fileURLToPath(import.meta.url);
const __dirname_local = typeof __dirname !== "undefined"
  ? __dirname
  : dirname(__filename_local!);

const SRO_CACHE_PATH = join(__dirname_local, "../data/sro-cache.json");

let cachedData: SROCache | null = null;

/**
 * Load the SRO cache from JSON. Returns null if the file is missing or invalid.
 */
export function loadSROCache(): SROCache | null {
  if (cachedData !== null) return cachedData;

  if (!existsSync(SRO_CACHE_PATH)) {
    console.error("[igr-sro] Cache file not found:", SRO_CACHE_PATH);
    return null;
  }

  try {
    const jsonContent = readFileSync(SRO_CACHE_PATH, "utf-8");
    const parsed = JSON.parse(jsonContent);
    const validated = SROCacheSchema.parse(parsed);
    cachedData = validated;
    return validated;
  } catch (err) {
    console.error("[igr-sro] Failed to load/validate cache:", (err as Error).message);
    return null;
  }
}

/**
 * Reset the cache (used by tests).
 */
export function _resetCache(): void {
  cachedData = null;
}

/**
 * Get the SRO info for a specific district and SRO name.
 */
export function getSRO(district: string, sroName: string): SROInfo | null {
  const cache = loadSROCache();
  if (!cache) return null;

  const districtEntry = cache.districts.find(
    (d) => d.district.toLowerCase() === district.toLowerCase()
  );
  if (!districtEntry) return null;

  return (
    districtEntry.sros.find((s) => s.sro.toLowerCase() === sroName.toLowerCase()) ?? null
  );
}

/**
 * Get all SROs for a district.
 */
export function getSROsByDistrict(district: string): SROInfo[] {
  const cache = loadSROCache();
  if (!cache) return [];

  const districtEntry = cache.districts.find(
    (d) => d.district.toLowerCase() === district.toLowerCase()
  );
  return districtEntry?.sros ?? [];
}

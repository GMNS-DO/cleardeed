/**
 * Khordha district Bhulekh village directory.
 *
 * Two-layer model:
 *
 * 1. AUTHORITATIVE (data/khordha_villages.json) — 1,669 villages captured by
 *    scripts/probe-bhulekh-villages.mjs from the live Bhulekh dropdown on
 *    2026-06-21. Each entry carries the Bhulekh numeric code, Odia script
 *    name, and (where Bhulekh carries one) an English transliteration.
 *
 *    Bhulekh's village dropdown is **predominantly Odia-script only** — 1,627
 *    of 1,669 entries have no English text on the live page. The 42 entries
 *    with English are all Bhubaneswar city-unit plots (e.g. "Bhubaneswar
 *    Sahar Unit No. Satyanagar"), not villages.
 *
 * 2. CURATED OVERLAY — 14 hand-mapped entries below preserve the buyer-facing
 *    English aliases (Mendhasala, Chandaka, Nuagaon, etc.) that the form
 *    accepts. These overlay the authoritative directory, providing English
 *    names for the villages most commonly probed. Overlay entries with a
 *    matching `bhulekhVillageCode + bhulekhTahasilCode` supersede the
 *    authoritative row; overlay-only entries (where Bhulekh's code differs
 *    from the curator's mapping) live alongside.
 *
 * IMPORTANT (DPR-LOC-002): village identity is canonical via the
 * Bhunaksha/WFS layer, not Bhulekh. Bhulekh's dropdown is the *target*
 * lookup, not the *source of truth* on identity. This file only catalogues
 * what Bhulekh exposes.
 *
 * Re-probe: `node scripts/probe-bhulekh-villages.mjs`
 *
 * Verified: Session 2026-06-21 — full 10-tahasil sweep captured 1,669 entries.
 * Per-tahasil counts:
 *   1 Banapur=276, 2 Bhubaneswar=184, 3 Kordha=141, 4 Begunia=173,
 *   5 Bolgarh=235, 6 Jatni=121, 7 Tangi=208, 8 Balianta=98,
 *   9 Balipatna=88, 10 Chilika=145. Total=1,669.
 *
 * Sangram and Naikendud are NOT digitized in Bhulekh — confirmed by probe
 * (no entry returned for those names under any tahasil). Code 83 (Haripur,
 * Bhubaneswar) IS digitized; the curator overlay below preserves it.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = join(__dirname, "..");

export interface VillageMapping {
  /** English name (form input). Empty string when Bhulekh carries no English. */
  english: string;
  /** Odia-script name (Bhulekh dropdown text). */
  odia: string;
  /** Bhulekh numeric tahasil code, "1" through "10". Empty when not digitized. */
  bhulekhTahasilCode?: string;
  /** Bhulekh numeric village code. Empty when not digitized or for overlays
   *  that describe a place Bhulekh doesn't carry. */
  bhulekhVillageCode?: string;
  /** Tahasil name as Bhulekh romanizes it (e.g. "Kordha" not "Khordha"). */
  tahasil: string;
  /** RI / revenue circle, when known from curator overlay. */
  riCircle?: string;
  /** Set true for entries confirmed missing from the Bhulekh dropdown. */
  notDigitized?: boolean;
}

interface AuthoritativeRow {
  bhulekhVillageCode: string;
  english: string;
  odia: string;
  tahasil: string | null;
  bhulekhTahasilCode: string;
}

interface AuthoritativeFile {
  probedAt: string;
  district: string;
  districtCode: string;
  tahasilCount: number;
  totalVillages: number;
  perTahasilCount: Record<string, number>;
  villages: AuthoritativeRow[];
}

// ─── Curated overlay ────────────────────────────────────────────────────────
// These 14 entries preserve the buyer-facing English aliases the form uses.
// Each overlay entry overlays any authoritative entry with the same
// (bhulekhTahasilCode, bhulekhVillageCode) pair.
const CURATED_OVERLAY: VillageMapping[] = [
  // Bhubaneswar tahasil (code 2)
  { english: "Mendhasala", odia: "ମେଣ୍ଢାଶାଳ", bhulekhTahasilCode: "2", bhulekhVillageCode: "105", tahasil: "Bhubaneswar", riCircle: "Chandaka" },
  { english: "Chandaka", odia: "ଚନ୍ଦକା", bhulekhTahasilCode: "2", bhulekhVillageCode: "76", tahasil: "Bhubaneswar", riCircle: "Chandaka" },
  { english: "Sijua", odia: "ସିଜୁଆ", bhulekhTahasilCode: "2", bhulekhVillageCode: "301", tahasil: "Bhubaneswar", riCircle: "Jatni" },
  { english: "Nuagaon", odia: "ନୁଆଗାଁ", bhulekhTahasilCode: "2", bhulekhVillageCode: "309", tahasil: "Bhubaneswar", riCircle: "Jatni" },
  { english: "Gothapada", odia: "ଗୋଠପଟଣା", bhulekhTahasilCode: "2", bhulekhVillageCode: "307", tahasil: "Bhubaneswar", riCircle: "Jatni" },
  { english: "Haripur", odia: "ହରୀପୁର", bhulekhTahasilCode: "2", bhulekhVillageCode: "83", tahasil: "Bhubaneswar", riCircle: "Chandaka" },
  // Kordha tahasil (code 3) — note Bhulekh romanizes "Kordha" with one 'h'
  { english: "Mandara", odia: "ଅଣ୍ଡା", bhulekhTahasilCode: "3", bhulekhVillageCode: "41", tahasil: "Kordha", riCircle: "Kordha" },
  { english: "Brahmanabilen", odia: "ବ୍ରାହ୍ମଣ ବେରେଣି", bhulekhTahasilCode: "3", bhulekhVillageCode: "49", tahasil: "Kordha", riCircle: "Kordha" },
  { english: "Dhaulimunda", odia: "ଧଉଳିମୁହଁ", bhulekhTahasilCode: "3", bhulekhVillageCode: "44", tahasil: "Kordha", riCircle: "Kordha" },
  // Banapur tahasil (code 1) — Banapur village lives in Banapur tahasil, not Kordha
  { english: "Banapur", odia: "ବାଣାପୁର", bhulekhTahasilCode: "1", bhulekhVillageCode: "95", tahasil: "Banapur", riCircle: "Banapur" },
  { english: "Kakatpur", odia: "ଆୟତପୁର", bhulekhTahasilCode: "1", bhulekhVillageCode: "342", tahasil: "Banapur", riCircle: "Banapur" },
  // Begunia tahasil (code 4)
  { english: "Bhagabatipur", odia: "ଭଗବତୀ ପୁର", bhulekhTahasilCode: "4", bhulekhVillageCode: "108", tahasil: "Begunia", riCircle: "Begunia" },
  // Bolgarh tahasil (code 5)
  { english: "Kudi", odia: "କୁଡ଼ୀ", bhulekhTahasilCode: "5", bhulekhVillageCode: "84", tahasil: "Bolgarh", riCircle: "Bolgarh" },
  // Balianta tahasil (code 8)
  { english: "Ranapur", odia: "ରଣପୁର", bhulekhTahasilCode: "8", bhulekhVillageCode: "41", tahasil: "Balianta", riCircle: "Balianta" },
  // Balipatna tahasil (code 9)
  { english: "Balipatna", odia: "ବିର ପାଟଣା", bhulekhTahasilCode: "9", bhulekhVillageCode: "19", tahasil: "Balipatna", riCircle: "Balipatna" },
  // Chilika tahasil (code 10) — Chilika/Balugaon naming matches
  { english: "Balugaon", odia: "ବାଲୁଗାଁ", bhulekhTahasilCode: "10", bhulekhVillageCode: "43", tahasil: "Chilika", riCircle: "Chilika" },
  // Confirmed-not-digitized (probe found no entry under any tahasil)
  { english: "Sangram", odia: "Sangram", bhulekhTahasilCode: "", bhulekhVillageCode: "", tahasil: "Jatni", notDigitized: true },
  { english: "Naikendud", odia: "Naikendud", bhulekhTahasilCode: "", bhulekhVillageCode: "", tahasil: "Balipatna", notDigitized: true },
];

// ─── Authoritative load ─────────────────────────────────────────────────────
// Loaded lazily on first access so test environments without the JSON file
// still work (fall back to overlay-only).
let _authoritativeCache: VillageMapping[] | null = null;
let _authoritativeLoadError: string | null = null;

function loadAuthoritative(): VillageMapping[] {
  if (_authoritativeCache) return _authoritativeCache;
  try {
    const jsonPath = join(PACKAGE_ROOT, "data", "khordha_villages.json");
    const raw = readFileSync(jsonPath, "utf8");
    const parsed = JSON.parse(raw) as AuthoritativeFile;
    _authoritativeCache = parsed.villages.map((row): VillageMapping => ({
      english: row.english ?? "",
      odia: row.odia ?? "",
      bhulekhTahasilCode: row.bhulekhTahasilCode,
      bhulekhVillageCode: row.bhulekhVillageCode,
      tahasil: row.tahasil ?? "",
    }));
    return _authoritativeCache;
  } catch (err) {
    _authoritativeLoadError = err instanceof Error ? err.message : String(err);
    _authoritativeCache = [];
    return _authoritativeCache;
  }
}

// ─── Merge: overlay wins on (tahasil, code) collision ───────────────────────
function buildDirectory(): VillageMapping[] {
  const authoritative = loadAuthoritative();
  const overlayKeys = new Set(
    CURATED_OVERLAY
      .filter((v) => v.bhulekhTahasilCode && v.bhulekhVillageCode)
      .map((v) => `${v.bhulekhTahasilCode}|${v.bhulekhVillageCode}`)
  );
  // Start with authoritative entries that the overlay does NOT override.
  const merged: VillageMapping[] = authoritative
    .filter((v) => !overlayKeys.has(`${v.bhulekhTahasilCode}|${v.bhulekhVillageCode}`));
  // Append all overlay entries.
  merged.push(...CURATED_OVERLAY);
  return merged;
}

let _directoryCache: VillageMapping[] | null = null;
function getDirectory(): VillageMapping[] {
  if (!_directoryCache) _directoryCache = buildDirectory();
  return _directoryCache;
}

/** Full directory: authoritative 1,669 + curated overlay. ~1,687 entries. */
export const KHRDHA_VILLAGES: readonly VillageMapping[] = getDirectory();

/** Bhulekh district code for Khordha. Stable across portal updates. */
export const DISTRICT_CODE = "20";

/** Bhulekh tahasil code for Bhubaneswar (within Khordha). */
export const BHUBANESWAR_TAHASIL_CODE = "2";

/**
 * Map of Bhulekh numeric tahasil codes → Bhulekh romanized tahasil name.
 * Order: Banapur=1, Bhubaneswar=2, Kordha=3, Begunia=4, Bolgarh=5,
 * Jatni=6, Tangi=7, Balianta=8, Balipatna=9, Chilika=10.
 */
export const KHRDHA_TAHASIL_CODES: Record<string, string> = {
  "1": "Banapur",
  "2": "Bhubaneswar",
  "3": "Kordha",
  "4": "Begunia",
  "5": "Bolgarh",
  "6": "Jatni",
  "7": "Tangi",
  "8": "Balianta",
  "9": "Balipatna",
  "10": "Chilika",
};

/** Reverse map: tahasil name → Bhulekh numeric code. */
export const KHRDHA_TAHASIL_NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(KHRDHA_TAHASIL_CODES).map(([code, name]) => [name, code])
);

// ─── Lookups ────────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Find a village by English name (case-insensitive). Matches against curated
 * English overlays first, then against any authoritative entry that carries
 * an English string.
 */
export function findVillageByEnglish(english: string): VillageMapping | undefined {
  const target = norm(english);
  if (!target) return undefined;
  const dir = getDirectory();
  // Overlay entries are guaranteed to have English — try those first.
  for (const v of CURATED_OVERLAY) {
    if (norm(v.english) === target) return v;
  }
  // Authoritative with English (Bhubaneswar city units).
  for (const v of dir) {
    if (v.english && norm(v.english) === target) return v;
  }
  return undefined;
}

/**
 * Find a village by Odia name (case-insensitive). Matches against overlay
 * Odia first, then authoritative.
 */
export function findVillageByOdia(odia: string): VillageMapping | undefined {
  const target = norm(odia);
  if (!target) return undefined;
  const dir = getDirectory();
  for (const v of CURATED_OVERLAY) {
    if (norm(v.odia) === target) return v;
  }
  for (const v of dir) {
    if (norm(v.odia) === target) return v;
  }
  return undefined;
}

/**
 * Find a village by Bhulekh (tahasil code, village code). The authoritative
 * Bhulekh-side identifier — what Bhulekh actually uses in its dropdowns.
 */
export function findVillageByCode(tahasilCode: string, villageCode: string): VillageMapping | undefined {
  const dir = getDirectory();
  // Overlay first.
  for (const v of CURATED_OVERLAY) {
    if (v.bhulekhTahasilCode === tahasilCode && v.bhulekhVillageCode === villageCode) return v;
  }
  for (const v of dir) {
    if (v.bhulekhTahasilCode === tahasilCode && v.bhulekhVillageCode === villageCode) return v;
  }
  return undefined;
}

/**
 * Find a village by English name within a specific tahasil.
 * Useful when the same English name collides across tahasils (rare but real —
 * see Ranapur code 41 which exists in both Kordha and Balianta).
 */
export function findVillageByEnglishWithTahasil(
  english: string,
  tahasil: string
): VillageMapping | undefined {
  const target = norm(english);
  const tah = norm(tahasil);
  const dir = getDirectory();
  for (const v of CURATED_OVERLAY) {
    if (norm(v.english) === target && norm(v.tahasil) === tah) return v;
  }
  for (const v of dir) {
    if (v.english && norm(v.english) === target && norm(v.tahasil) === tah) return v;
  }
  return undefined;
}

/** Filter all villages for a given tahasil (case-insensitive name match). */
export function getVillagesByTahasil(tahasil: string): VillageMapping[] {
  const tah = norm(tahasil);
  return getDirectory().filter((v) => norm(v.tahasil) === tah);
}

/** Coverage metadata for diagnostics / health checks. */
export function getDirectoryStats(): {
  total: number;
  curated: number;
  authoritative: number;
  withEnglish: number;
  odiaOnly: number;
  notDigitized: number;
  perTahasil: Record<string, number>;
  authoritativeLoadError: string | null;
  authoritativeProbedAt: string | null;
} {
  const dir = getDirectory();
  const perTahasil: Record<string, number> = {};
  let withEnglish = 0;
  for (const v of dir) {
    if (v.english) withEnglish++;
    const key = v.tahasil || "(unknown)";
    perTahasil[key] = (perTahasil[key] ?? 0) + 1;
  }
  return {
    total: dir.length,
    curated: CURATED_OVERLAY.length,
    authoritative: loadAuthoritative().length,
    withEnglish,
    odiaOnly: dir.length - withEnglish,
    notDigitized: dir.filter((v) => v.notDigitized).length,
    perTahasil,
    authoritativeLoadError: _authoritativeLoadError,
    authoritativeProbedAt: _authoritativeCache
      ? (() => {
          try {
            const raw = readFileSync(join(PACKAGE_ROOT, "data", "khordha_villages.json"), "utf8");
            return (JSON.parse(raw) as AuthoritativeFile).probedAt ?? null;
          } catch {
            return null;
          }
        })()
      : null,
  };
}
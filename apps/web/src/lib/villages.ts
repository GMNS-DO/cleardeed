/**
 * Village directory loader + search.
 *
 * Source of truth: apps/web/public/data/khordha-villages.json
 *   (copied from packages/fetchers/bhulekh/data/khordha_villages.json
 *    on 2026-06-21, with English names overlaid from the curated
 *    khordha-location.ts where Odia names matched.)
 *
 * 1,669 villages across 10 Khordha tahasils. Fetched once on mount;
 * indexed in memory by tahasil for O(N) filter per keystroke.
 *
 * Search is diacritic-insensitive substring + token-split. No fuzzy
 * library — the dataset is small enough that a 2-pass approach
 * (prefix-match first, then substring-match) gives near-instant
 * feedback without false positives.
 */

export interface Village {
  /** Bhulekh dropdown numeric code. Empty string when not digitized. */
  bhulekhVillageCode: string;
  /** Romanized name. May be empty when Bhulekh ships Odia only. */
  english: string;
  /** Odia-script name. Always present. */
  odia: string;
  /** Tahasil name as Bhulekh romanizes it (e.g. "Kordha" not "Khordha"). */
  tahasil: string;
  /** Bhulekh numeric tahasil code, "1"–"10". */
  bhulekhTahasilCode: string;
}

export interface VillagesByTahasil {
  /** key: bhulekhTahasilCode */
  [tahasilCode: string]: Village[];
}

export interface VillagesDoc {
  probedAt: string;
  district: string;
  tahasilCount: number;
  totalVillages: number;
  villages: Village[];
}

let cachedDoc: VillagesDoc | null = null;
let cachedByTahasil: VillagesByTahasil | null = null;
let inflight: Promise<VillagesDoc> | null = null;

export async function fetchVillages(): Promise<VillagesDoc> {
  if (cachedDoc) return cachedDoc;
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetch("/data/khordha-villages.json", { cache: "force-cache" });
    if (!res.ok) {
      throw new Error(`Failed to load villages (HTTP ${res.status})`);
    }
    const doc = (await res.json()) as VillagesDoc;
    cachedDoc = doc;
    cachedByTahasil = indexByTahasil(doc.villages);
    return doc;
  })();
  return inflight;
}

export function villagesByTahasil(): VillagesByTahasil {
  if (!cachedByTahasil) {
    throw new Error("villagesByTahasil() called before fetchVillages() resolved");
  }
  return cachedByTahasil;
}

function indexByTahasil(villages: Village[]): VillagesByTahasil {
  const out: VillagesByTahasil = {};
  for (const v of villages) {
    const key = v.bhulekhTahasilCode;
    if (!out[key]) out[key] = [];
    out[key].push(v);
  }
  return out;
}

/** Normalize for substring search: lowercase + strip combining diacritics. */
function fold(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Score a single village against a normalized query. 0 = no match. */
function score(v: Village, q: string): number {
  if (!q) return 1; // empty query → include with neutral score
  const en = fold(v.english);
  const or = fold(v.odia);
  // 1. Exact-prefix on english wins
  if (en && en.startsWith(q)) return 100;
  // 2. Exact-prefix on odia wins
  if (or.startsWith(q)) return 90;
  // 3. Token-substring: every token in q must appear in en or or
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 1;
  const allMatch = tokens.every((t) => en.includes(t) || or.includes(t));
  if (!allMatch) return 0;
  // Prefer matches where english starts with first token
  if (en && en.startsWith(tokens[0])) return 50;
  return 10;
}

/**
 * Search villages within a single tahasil. Empty query returns the first
 * `limit` villages (so the dropdown is useful without typing). Otherwise
 * scores by prefix > token-substring, sorts desc, and slices to `limit`.
 */
export function searchVillages(
  query: string,
  villages: Village[],
  limit = 50,
): Village[] {
  if (!villages || villages.length === 0) return [];
  const q = fold(query);
  if (!q) return villages.slice(0, limit);
  const scored: Array<{ v: Village; s: number }> = [];
  for (const v of villages) {
    const s = score(v, q);
    if (s > 0) scored.push({ v, s });
  }
  scored.sort((a, b) => {
    if (b.s !== a.s) return b.s - a.s;
    // Tie-break: prefer entries that have an English name
    const aHas = a.v.english ? 0 : 1;
    const bHas = b.v.english ? 0 : 1;
    if (aHas !== bHas) return aHas - bHas;
    return a.v.english.localeCompare(b.v.english);
  });
  return scored.slice(0, limit).map((x) => x.v);
}

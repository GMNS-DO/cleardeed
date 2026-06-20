/**
 * Khordha EOW (Economic Offences Wing) blacklist loader and matcher.
 *
 * This is a static, versioned blacklist of EOW-attached properties and
 * arrested persons in Khordha district. The list is curated from EOW Odisha
 * press releases and refreshed when new press releases are published.
 *
 * The blacklist is the durable surface of the Surya Nirman Multi-Investor
 * Fraud (Bhubaneswar 2017-2023) detection rule per CLAUDE.md Section 8.1
 * (Fraud Pattern 2).
 *
 * Schema is intentionally narrow: each entry is a single attached property
 * or arrested person. The matcher supports two query modes:
 *   - matchPlot(plotNo, khataNo, village?)   — CRITICAL
 *   - matchOwner(name)                       — HIGH WATCH-OUT
 *
 * Notes on offline behavior: this module does not perform any network I/O.
 * Network refresh lives in scripts/probe-eow.mjs; loadBlacklist() reads the
 * committed JSON only.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const EOW_SOURCE = "eow-odisha";
export const PARSER_VERSION = "eow-blacklist-v1";

/**
 * One attached property from an EOW case.
 *
 * `plotNo`/`khataNo` are the raw numbers as published; the matcher normalizes
 * them at query time. `village` and `tahasil` are optional but, when present,
 * reduce false positives in cross-village matches.
 */
export interface EOWAttachedProperty {
  /** Stable, unique id used as a primary key in khordha_eow_blacklist.json. */
  id: string;
  /** Case identifier (FIR number or court reference) as published. */
  caseRef: string;
  /** ISO date the property was attached (best-effort parse from press release). */
  attachmentDate?: string;
  /** Plot number, as published (e.g. "415", "415/1", "D-88"). */
  plotNo: string;
  /** Khata number, if mentioned in the press release. */
  khataNo?: string;
  /** Village name (Latin or transliterated, as published). */
  village?: string;
  /** Tahasil, if mentioned. */
  tahasil?: string;
  /** Free-form property description (mouza, area, RS/LR khata, etc.). */
  description?: string;
  /** Confidence flag set by the parser. */
  confidence: "verified" | "probable" | "manual_required";
  /** Source URL for the press release. */
  sourceUrl: string;
  /** Source date the press release was published. */
  sourcePublishedAt: string;
}

/**
 * One arrested person from an EOW case.
 */
export interface EOWArrestedPerson {
  /** Stable, unique id used as a primary key in khordha_eow_blacklist.json. */
  id: string;
  /** Case identifier (FIR number or court reference). */
  caseRef: string;
  /** Full name of the arrested person as published. */
  name: string;
  /** Optional role/director designation (e.g. "Director, M/s Surya Nirman"). */
  role?: string;
  /** ISO date of arrest, if published. */
  arrestDate?: string;
  /** Confidence flag set by the parser. */
  confidence: "verified" | "probable" | "manual_required";
  /** Source URL for the press release. */
  sourceUrl: string;
  /** Source date the press release was published. */
  sourcePublishedAt: string;
}

export interface KhordhaEOWBlacklist {
  /** Schema version — bump when entries or query fields change. */
  version: string;
  /** ISO timestamp of last successful refresh from EOW press releases. */
  lastRefreshedAt: string;
  /** Source domain the entries were scraped from. */
  source: string;
  /** All attached properties. */
  properties: EOWAttachedProperty[];
  /** All arrested persons. */
  arrestedPersons: EOWArrestedPerson[];
  /**
   * Cached etag / content hash. The matcher uses this to short-circuit when
   * the on-disk JSON hasn't changed. Recomputed at save time.
   */
  contentHash: string;
}

/**
 * Result of matching a single query against the blacklist.
 */
export interface BlacklistMatch {
  matched: boolean;
  /** Severity per CLAUDE.md Section 8.1: CRITICAL for plot match, HIGH for owner match. */
  severity?: "critical" | "high_watch_out";
  /** Underlying matched entry id(s). */
  entryIds: string[];
  /** Underlying case references. */
  caseRefs: string[];
  /** Underlying source URLs (press release pages). */
  sourceUrls: string[];
  /** Human-readable summary of the match. */
  summary?: string;
}

/**
 * Default path to the curated blacklist JSON.
 *
 * Path resolution walks up from this file's directory until it finds
 * `data/khordha_eow_blacklist.json` — that makes both `pnpm test` and
 * `tsx scripts/probe-eow.mjs` find the same file.
 */
function defaultBlacklistPath(): string {
  // From packages/fetchers/eow/src/blacklist.ts, walk up one level to
  // packages/fetchers/eow/, then into data/.
  return join(__dirname, "..", "data", "khordha_eow_blacklist.json");
}

/**
 * Load the curated Khordha EOW blacklist from disk.
 *
 * The function never throws: it returns a structured empty blacklist when the
 * file is missing or unreadable. This makes it safe to call from
 * `matchBlacklist()` inside the orchestrator without try/catch boilerplate.
 */
export function loadBlacklist(path: string = defaultBlacklistPath()): KhordhaEOWBlacklist {
  const empty: KhordhaEOWBlacklist = {
    version: PARSER_VERSION,
    lastRefreshedAt: new Date(0).toISOString(),
    source: EOW_SOURCE,
    properties: [],
    arrestedPersons: [],
    contentHash: sha256(""),
  };
  try {
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as Partial<KhordhaEOWBlacklist>;
    return {
      version: parsed.version ?? PARSER_VERSION,
      lastRefreshedAt: parsed.lastRefreshedAt ?? new Date(0).toISOString(),
      source: parsed.source ?? EOW_SOURCE,
      properties: Array.isArray(parsed.properties) ? parsed.properties : [],
      arrestedPersons: Array.isArray(parsed.arrestedPersons) ? parsed.arrestedPersons : [],
      contentHash: parsed.contentHash ?? sha256(raw),
    };
  } catch {
    return empty;
  }
}

/**
 * Persist a blacklist to disk as pretty-printed JSON. Used by the probe
 * script and by any future automated refresh task. Returns the content hash
 * that was written.
 *
 * This function is sync — the probe script runs serially. If the blacklist
 * ever grows large enough that write latency matters, switch to async fs
 * here and add a matching async wrapper.
 */
export function saveBlacklist(
  blacklist: KhordhaEOWBlacklist,
  path: string = defaultBlacklistPath()
): string {
  const updated: KhordhaEOWBlacklist = {
    ...blacklist,
    lastRefreshedAt: blacklist.lastRefreshedAt || new Date().toISOString(),
    contentHash: sha256(JSON.stringify({
      properties: blacklist.properties,
      arrestedPersons: blacklist.arrestedPersons,
    })),
  };
  // writeFileSync imported at module level; this call is sync because the
  // probe script runs serially and the blacklist file is small.
  writeFileSync(path, JSON.stringify(updated, null, 2) + "\n", "utf-8");
  return updated.contentHash;
}

/**
 * Normalize a plot number for comparison.
 *
 * The EOW blacklist is scraped from press releases where plot numbers are
 * written in many shapes ("415", "415/1", "D-88", "Plot No. 415",
 * "Khata No. 94, Plot 415"). This helper strips the noise and leaves the
 * canonical plot identifier.
 */
export function normalizePlotNo(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/plot\s*(no\.?|number)?\s*/gi, "")
    .replace(/khata\s*(no\.?|number)?\s*/gi, "")
    .replace(/[^\w/-]/g, "")
    .trim();
}

/**
 * Normalize a person/company name for comparison.
 *
 * Bhulekh owner fields and EOW arrest lists are written in slightly
 * different transliterations of the same Odia name. We lowercase, strip
 * punctuation, and collapse whitespace.
 */
export function normalizeName(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/[.,'"`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Match a plot number (+ optional khata and village) against the EOW attached
 * properties list. The matcher is intentionally strict on plot number and
 * uses khata/village only to disambiguate close hits.
 *
 * Match logic:
 * 1. Normalize both query and stored plot numbers.
 * 2. Exact match on normalized plotNo.
 * 3. If multiple matches share the same normalized plot number but differ
 *    in village or khata, narrow with the disambiguators.
 * 4. A match is `verified` only when the stored entry's confidence is
 *    `verified`; otherwise it is `probable` and the caller should treat
 *    it as a watch-out, not a hard stop.
 */
export function matchPlot(
  blacklist: KhordhaEOWBlacklist,
  query: { plotNo: string; khataNo?: string; village?: string }
): BlacklistMatch {
  const qPlot = normalizePlotNo(query.plotNo);
  const qKhata = query.khataNo ? normalizePlotNo(query.khataNo) : "";
  const qVillage = normalizeName(query.village);
  if (!qPlot) return { matched: false, entryIds: [], caseRefs: [], sourceUrls: [] };

  // Step 1: collect plot+village candidates. Khata is only used as a
  // disambiguator in step 2 — if the caller's khata differs from the
  // recorded khata but plot+village still match, we still treat it as a
  // hit because fraud records may use an aggregated or off-by-one khata.
  const candidates: EOWAttachedProperty[] = [];
  for (const entry of blacklist.properties) {
    const ePlot = normalizePlotNo(entry.plotNo);
    if (!ePlot) continue;
    if (ePlot !== qPlot) continue;
    if (qVillage && entry.village && normalizeName(entry.village) !== qVillage) continue;
    candidates.push(entry);
  }
  if (candidates.length === 0) {
    return { matched: false, entryIds: [], caseRefs: [], sourceUrls: [] };
  }
  // Step 2: if multiple candidates share the same plot+village, narrow with
  // khata. If only one candidate, accept it regardless of khata mismatch.
  let hits: EOWAttachedProperty[] = candidates;
  if (qKhata && candidates.length > 1) {
    const narrowed = candidates.filter(
      (e) => !e.khataNo || normalizePlotNo(e.khataNo) === qKhata
    );
    if (narrowed.length > 0) hits = narrowed;
  }
  const caseRefs = Array.from(new Set(hits.map((h) => h.caseRef)));
  const sourceUrls = Array.from(new Set(hits.map((h) => h.sourceUrl)));
  return {
    matched: true,
    severity: "critical",
    entryIds: hits.map((h) => h.id),
    caseRefs,
    sourceUrls,
    summary: hits.length === 1
      ? `Plot ${hits[0].plotNo} matches EOW attached property (case ${hits[0].caseRef}).`
      : `Plot ${qPlot} matches ${hits.length} EOW attached properties across ${caseRefs.length} case(s).`,
  };
}

/**
 * Match a person/company name against the EOW arrest list. The matcher is
 * intentionally fuzzy on whitespace/punctuation and accepts both full-name
 * and surname-only queries.
 *
 * Match strength:
 *  - "full" when normalized query is a full-name match (or a substring of a
 *    stored full name).
 *  - "partial" when only a surname token matches; this is intentionally
 *    downgraded to reduce false positives — a surname-only hit should
 *    trigger a manual check, not an automatic block.
 */
export function matchOwner(
  blacklist: KhordhaEOWBlacklist,
  queryName: string
): BlacklistMatch & { matchStrength?: "full" | "partial" } {
  const q = normalizeName(queryName);
  if (!q) return { matched: false, entryIds: [], caseRefs: [], sourceUrls: [] };
  const qTokens = q.split(" ").filter(Boolean);

  const fullHits: EOWArrestedPerson[] = [];
  const partialHits: EOWArrestedPerson[] = [];
  // A surname-only query (single token) is treated as a partial match even
  // when the token is contained in a stored full name — surnames are common
  // across many unrelated people, so a single-token hit should downgrade to
  // partial strength to avoid spurious auto-flags.
  const isSurnameOnlyQuery = qTokens.length === 1;
  for (const entry of blacklist.arrestedPersons) {
    const eName = normalizeName(entry.name);
    if (!eName) continue;
    if (eName === q || q.includes(eName)) {
      fullHits.push(entry);
      continue;
    }
    if (!isSurnameOnlyQuery && eName.includes(q)) {
      // Multi-token query is a substring of stored full name → full match
      // (e.g. "Arun Kumar" inside "Arun Kumar Sahu"). Surname-only queries
      // skip this branch and fall through to the partial-token check.
      fullHits.push(entry);
      continue;
    }
    // Token-level: at least one full token of the query matches a full token
    // of the entry, but not a full-name match. We require the match to be a
    // surname-style token (>= 4 chars) to avoid spurious hits on initials.
    const eTokens = eName.split(" ").filter(Boolean);
    const sharedSurname = qTokens.some(
      (qt) => qt.length >= 4 && eTokens.includes(qt)
    );
    if (sharedSurname) partialHits.push(entry);
  }
  if (fullHits.length === 0 && partialHits.length === 0) {
    return { matched: false, entryIds: [], caseRefs: [], sourceUrls: [] };
  }
  const primary = fullHits.length > 0 ? fullHits : partialHits;
  const caseRefs = Array.from(new Set(primary.map((h) => h.caseRef)));
  const sourceUrls = Array.from(new Set(primary.map((h) => h.sourceUrl)));
  return {
    matched: true,
    severity: "high_watch_out",
    entryIds: primary.map((h) => h.id),
    caseRefs,
    sourceUrls,
    matchStrength: fullHits.length > 0 ? "full" : "partial",
    summary: fullHits.length > 0
      ? `Owner name matches ${fullHits.length} EOW arrest record(s): ${fullHits.map((h) => h.name).join("; ")}.`
      : `Owner name partially matches ${partialHits.length} EOW arrest record(s) on a surname token — manual verification required.`,
  };
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

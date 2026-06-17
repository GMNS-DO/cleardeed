/**
 * Odia name dictionary loader.
 *
 * Single source of truth for Odia → English name tokens used by
 * A10 ConsumerReportWriter and A5 OwnershipReasoner.
 *
 * The dictionary lives in `odia-names.json` so that:
 *   1. Tokens are version-controlled separately from TS code
 *   2. P1 P4 (feedback loop) can mutate the JSON without touching lib.ts
 *   3. Held-out fixtures and incremental additions don't grow the TS bundle
 *
 * The loader is a synchronous read at module init. The JSON is small
 * (~109 tokens at P0, ~500 at P1, <2KB at P4 even with feedback merges).
 * If the file size ever exceeds 16KB, switch to an async load.
 *
 * Locked contract: the exported shape is stable across P1 P0 → P1 P4.
 * Do not add fields to the token map. The `_meta` block is informational only.
 */

import odiaNamesJson from "./odia-names.json";

export type OdiaNameDict = Readonly<Record<string, string>>;

export type OdiaNameDictMeta = {
  readonly version: number;
  readonly created: string;
  readonly source: string;
  readonly count: number;
  readonly notes: string;
};

const ROOT = odiaNamesJson as unknown as {
  _meta: OdiaNameDictMeta;
  tokens: Record<string, string>;
};

// Freeze the map. Mutations should go through a new dict version, not in-place edits.
const DICT: OdiaNameDict = Object.freeze({ ...ROOT.tokens });

/**
 * Returns the full Odia → English name dictionary.
 * Frozen — do not mutate. Use loadOdiaNameDict() once at module init
 * and pass the result around, or call this function directly (cheap).
 */
export function loadOdiaNameDict(): OdiaNameDict {
  return DICT;
}

/**
 * Returns metadata about the loaded dictionary. Used for
 *   - logging on pipeline startup
 *   - the held-out fixture test to assert that the test set is disjoint
 *   - future admin UI showing "current dict version"
 */
export function getOdiaNamesMeta(): OdiaNameDictMeta {
  return ROOT._meta;
}

/**
 * Look up a single key. Convenience wrapper for call sites that
 * want a typed null on miss without checking the truthy key.
 */
export function lookupOdiaName(key: string): string | null {
  return DICT[key] ?? null;
}

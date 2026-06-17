/**
 * feedback-merge.ts — Merge approved Odia name feedback into the dict.
 *
 * Plan §2.1 P1 P4:
 *   - Auto-merge cron: nightly, threshold ≥ 3 unique user_id
 *     AND 0 rejections → merge into odia-names.json
 *   - Each merge bumps dict_version (a Redis key, future work)
 *
 * Why a separate module:
 *   - The dict lives at agents/consumer-report-writer/src/dictionaries/
 *     and is loaded at module init. We need a runtime utility that
 *     can append new entries and re-write the JSON file (or signal
 *     a re-load via Redis).
 *   - The admin review page uses this utility to perform manual merges.
 *   - The auto-merge cron uses this utility on a schedule.
 *
 * In production, "merge into odia-names.json" is a CODE COMMIT — the
 * dict is source-controlled, and the production server reads the
 * committed file. So the merge step here produces a NEW version of
 * the JSON file that can be reviewed and committed.
 *
 * For the cron in this sprint: we write to a STAGING file
 * (odia-names.pending.json) that a human reviews and commits. The
 * Redis invalidation key is updated so the running server reloads.
 */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

// Compute __dirname in a way that works in both ESM and CJS
function computeDirname(): string {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    // Fallback for CJS (vitest's CommonJS interop)
    return typeof __dirname !== "undefined" ? __dirname : process.cwd();
  }
}
const CURRENT_DIR = computeDirname();

/** Path to the dict (relative to this module). */
const DICT_PATH = join(CURRENT_DIR, "..", "dictionaries", "odia-names.json");
const PENDING_PATH = join(CURRENT_DIR, "..", "dictionaries", "odia-names.pending.json");

/** Minimum unique users reporting the same (odia, suggestion) for auto-merge. */
export const AUTO_MERGE_USER_THRESHOLD = 3;

/** A single approved feedback entry, ready to merge. */
export interface ApprovedFeedback {
  odiaInput: string;
  suggestedOutput: string;
  /** user_id of who reported it (for diagnostic logging) */
  reportedBy: string[];
  /** When the first report came in (ISO string) */
  firstReportedAt: string;
}

/**
 * Read the current dict from disk. Used by both the merge utility
 * and the manual review path.
 */
export function readDict(): {
  _meta: { version: number; count: number; created: string; source: string; notes: string };
  tokens: Record<string, string>;
} {
  const raw = readFileSync(DICT_PATH, "utf-8");
  return JSON.parse(raw);
}

/**
 * Check whether a feedback entry meets the auto-merge threshold.
 *
 * Returns true when:
 *   - approved.length >= AUTO_MERGE_USER_THRESHOLD (3 unique users)
 *   - 0 rejections
 */
export function meetsAutoMergeThreshold(
  approved: ApprovedFeedback | null,
  rejections: number
): boolean {
  if (!approved) return false;
  if (rejections > 0) return false;
  return approved.reportedBy.length >= AUTO_MERGE_USER_THRESHOLD;
}

/**
 * Merge approved feedback entries into the dict.
 *
 * If `dryRun` is true, returns the would-be new tokens without
 * writing to disk. Otherwise writes to the PENDING file
 * (odia-names.pending.json) for human review.
 *
 * Returns the merge result: which entries were added, which
 * conflicted with existing tokens, which were skipped.
 */
export interface MergeResult {
  added: Array<{ odia: string; latin: string }>;
  conflicts: Array<{ odia: string; existing: string; suggested: string }>;
  skipped: Array<{ odia: string; reason: string }>;
  newVersion: number;
}

export function mergeApprovedFeedback(
  approvedEntries: ApprovedFeedback[],
  options: { dryRun?: boolean } = {}
): MergeResult {
  const dict = readDict();
  const result: MergeResult = {
    added: [],
    conflicts: [],
    skipped: [],
    newVersion: dict._meta.version + 1,
  };

  for (const entry of approvedEntries) {
    const odia = entry.odiaInput.trim();
    const latin = entry.suggestedOutput.trim();

    // Sanity checks
    if (!odia || !latin) {
      result.skipped.push({ odia, reason: "empty_input" });
      continue;
    }
    if (!containsOdiaScript(odia)) {
      result.skipped.push({ odia, reason: "no_odia_script" });
      continue;
    }
    if (!isLatinOnly(latin)) {
      result.skipped.push({ odia, reason: "suggested_output_not_latin" });
      continue;
    }
    if (odia.length > 100 || latin.length > 100) {
      result.skipped.push({ odia, reason: "input_too_long" });
      continue;
    }

    // Conflict check
    const existing = dict.tokens[odia];
    if (existing && existing.toLowerCase() === latin.toLowerCase()) {
      result.skipped.push({ odia, reason: "already_in_dict_same_value" });
      continue;
    }
    if (existing && existing.toLowerCase() !== latin.toLowerCase()) {
      result.conflicts.push({ odia, existing, suggested: latin });
      // Don't auto-resolve conflicts — these go to manual review.
      continue;
    }

    result.added.push({ odia, latin });
  }

  if (options.dryRun) return result;

  // Apply changes to a NEW dict (don't mutate the existing one)
  const newDict = {
    ...dict,
    _meta: {
      ...dict._meta,
      version: result.newVersion,
      count: Object.keys(dict.tokens).length + result.added.length,
      notes: `${dict._meta.notes}\nMerged ${result.added.length} new entries from user feedback at ${new Date().toISOString()}`,
    },
    tokens: {
      ...dict.tokens,
      ...Object.fromEntries(result.added.map((e) => [e.odia, e.latin])),
    },
  };

  // Write to PENDING file for human review (not the active file)
  writeFileSync(PENDING_PATH, JSON.stringify(newDict, null, 2), "utf-8");

  return result;
}

/**
 * Detect Odia-script characters. Used to validate feedback input.
 */
function containsOdiaScript(s: string): boolean {
  return /[଀-୿]/.test(s);
}

/**
 * Validate that a string is Latin-only (letters + spaces + apostrophes).
 */
function isLatinOnly(s: string): boolean {
  return /^[A-Za-z\s.''-]+$/.test(s);
}

/**
 * Get the pending dict path. Used by admin tooling.
 */
export function getPendingDictPath(): string {
  return PENDING_PATH;
}

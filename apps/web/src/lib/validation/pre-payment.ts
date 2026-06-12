/**
 * Pre-payment input validation — Sprint V4
 *
 * Pure input validation, no live portal calls. Runs before the ₹ paywall
 * to surface actionable errors to the buyer at the cheapest possible moment.
 *
 * V1 input shape (per apps/web/src/app/api/report/pregenerate/route.ts):
 *   { tehsil, tehsilValue, village, villageCode, searchMode, identifier, claimedOwnerName?, email? }
 *
 * Error contract: every rejection carries an actionable message a buyer can act on
 * (e.g. "Village 'Kopili' is not in Khordha district. Pick from the dropdown.").
 *
 * Per CLAUDE.md §3: no new abstractions, no generalized "smart" validators. This is
 * a hardcoded heuristic against the current V1 form contract. If the form grows,
 * extend this file — do not generalize it.
 */

// Importing the villages array directly. The fetcher-bhulekh barrel does not
// re-export it, so a relative import is the path of least friction (per CLAUDE.md
// §3: no new abstractions).
import { KHRDHA_VILLAGES } from "../../../../../packages/fetchers/bhulekh/src/villages";

/** The 10 Khordha tahasils. Order matches the Bhulekh dropdown. */
export const KHRDHA_TAHASILS: readonly string[] = [
  "Bhubaneswar",
  "Kordha",
  "Jatni",
  "Tangi",
  "Banapur",
  "Balianta",
  "Balipatna",
  "Begunia",
  "Bolgarh",
  "Chilika",
] as const;

export type ValidationOk = { ok: true };
export type ValidationErr = { ok: false; error: string };
export type ValidationResult = ValidationOk | ValidationErr;

/**
 * Bhulekh plot numbers are one of:
 *   - numeric:        "415", "1024"
 *   - D/prefix:       "D/589", "D-589"
 *   - fraction:       "415/2", "589/1A"
 *   - alphanumeric:   "415A", "1024B"
 *
 * We intentionally allow a wide shape here — the actual lookup may be more
 * restrictive, but the form should not reject on mere shape. Length capped at
 * 16 chars to keep abusive inputs out of downstream Bhulekh calls.
 */
const PLOT_NUMBER_RE = /^[A-Za-z0-9][A-Za-z0-9\/\-]{0,15}$/;

/** RFC-5322 is overkill here — a pragmatic email check is enough. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Build a quick lowercase set of valid village names for O(1) lookup. */
function buildVillageIndex(): Set<string> {
  const set = new Set<string>();
  for (const v of KHRDHA_VILLAGES) {
    set.add(v.english.toLowerCase());
    set.add(v.odia.toLowerCase());
  }
  return set;
}

const VILLAGE_INDEX = buildVillageIndex();

/**
 * Map of valid Bhulekh numeric tahasil codes → English name. Sourced from
 * packages/fetchers/bhulekh/src/villages.ts (see the header comment there).
 */
const KHRDHA_TAHASIL_CODES: Record<string, string> = {
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

/**
 * Normalize a tahasil label as submitted by the buyer. The V1 form sends the
 * Bhulekh-English name in `tehsil` and the Bhulekh numeric code in `tehsilValue`.
 * We accept either the English name or a valid Bhulekh numeric code.
 */
function normalizeTahasil(tehsil: string | undefined): string | null {
  if (!tehsil) return null;
  const trimmed = tehsil.trim();
  if (!trimmed) return null;

  // Direct English-name match (case-insensitive)
  const lower = trimmed.toLowerCase();
  for (const t of KHRDHA_TAHASILS) {
    if (t.toLowerCase() === lower) return t;
  }
  // Numeric Bhulekh code — must be 1..10
  if (/^\d+$/.test(trimmed)) {
    return KHRDHA_TAHASIL_CODES[trimmed] ?? null;
  }
  return null;
}

export interface PrePaymentInput {
  tehsil?: string;
  tehsilValue?: string;
  village?: string;
  villageCode?: string;
  searchMode?: string;
  identifier?: string;
  email?: string;
}

/**
 * Validate the V1 pre-payment form input. Cheap, synchronous, no I/O.
 *
 * Returns `{ok: false, error: <actionable message>}` on the first failure
 * found (deterministic order: tehsil → village → plot → email → searchMode).
 */
export function validateInputPrePayment(
  input: PrePaymentInput
): ValidationResult {
  // 1. Tehsil — must be one of the 10 Khordha tahasils.
  const tehsilOk = normalizeTahasil(input.tehsil) ?? normalizeTahasil(input.tehsilValue);
  if (!tehsilOk) {
    return {
      ok: false,
      error: `Tehsil "${input.tehsil ?? ""}" is not a recognized Khordha tahasil. Pick from: ${KHRDHA_TAHASILS.join(", ")}.`,
    };
  }

  // 2. Village — must be a known Khordha village (English or Odia spelling).
  const village = (input.village ?? "").trim();
  if (!village) {
    return { ok: false, error: "Village is required. Pick a village from the dropdown." };
  }
  if (!VILLAGE_INDEX.has(village.toLowerCase())) {
    return {
      ok: false,
      error: `Village "${village}" is not in Khordha district. Pick a village from the dropdown.`,
    };
  }

  // 3. Search mode — Plot / Khatiyan / Tenant.
  const searchMode = input.searchMode ?? "";
  if (searchMode !== "Plot" && searchMode !== "Khatiyan" && searchMode !== "Tenant") {
    return {
      ok: false,
      error: `Search mode "${searchMode}" is not valid. Choose Plot, Khatiyan, or Tenant.`,
    };
  }

  // 4. Plot/identifier number — non-empty + shape.
  const identifier = (input.identifier ?? "").trim();
  if (!identifier) {
    return { ok: false, error: "Plot number is required." };
  }
  if (!PLOT_NUMBER_RE.test(identifier)) {
    return {
      ok: false,
      error: `Plot number "${identifier}" looks invalid. Use digits, letters, D/ prefix, or fractions like 415/2.`,
    };
  }

  // 5. Email — optional in V1, but if present must be well-formed.
  const email = (input.email ?? "").trim();
  if (email && !EMAIL_RE.test(email)) {
    return {
      ok: false,
      error: `Email "${email}" is not well-formed. Use name@example.com format, or leave it blank.`,
    };
  }

  return { ok: true };
}

/**
 * Odia normalisation — pre-transliteration string cleanup.
 *
 * Goal: make equivalent Odia texts hash to the same key, so dictionary
 * lookups succeed even when the source uses different Unicode representations
 * of the same visual character.
 *
 * Transformations applied, in order:
 *   1. Unicode NFC normalisation
 *   2. ZWNJ (‌) and ZWJ (‍) removal
 *   3. Anusvara + Candra Bindu fold → "n" semantics (handled at the
 *      character-class level in lib.ts, not in this normaliser — we
 *      leave them intact here)
 *   4. Vowel-sign fold: collapse visual variants of the same modifier
 *      (e.g. different "i" kar forms) into the canonical sign
 *   5. Whitespace collapse
 *
 * No semantics for chandrabindu (ଁ) and anusvara (ଂ) here —
 * those are handled by the charByChar transliterator. The normaliser
 * only does string-shape work, not phonetic work.
 *
 * This module is new in P1 P0. It is NOT yet wired into transliterateOdia.
 * Wiring happens in P1 P1 after the held-out gate passes.
 */

// Zero-width joiners we strip.
const ZWNJ = "‌";
const ZWJ = "‍";

// Odia-specific whitespace we collapse to a single ASCII space.
const ODIA_WHITESPACE = /[  -   　]/g;

// Visual variant map for vowel-signs (matras).
// Only includes variants that are visually distinct Unicode codepoints
// but transliterate identically in the standard scheme.
const VOWEL_SIGN_FOLDS: Record<string, string> = {
  // i-kar variants
  "ି": "ି",
  // ii-kar variants
  "ୀ": "ୀ",
  // u-kar variants
  "ୁ": "ୁ",
  // uu-kar variants
  "ୂ": "ୂ",
  // vocalic r
  "ୃ": "ୃ",
  // vocalic rr
  "ୄ": "ୄ",
  // e-kar
  "େ": "େ",
  // ai-kar
  "ୈ": "ୈ",
  // o-kar
  "ୋ": "ୋ",
  // au-kar
  "ୌ": "ୌ",
  // long au-kar alternative
  "ୖ": "ୌ",
};

/**
 * Normalise an Odia string for downstream transliteration.
 *
 * Idempotent: normaliseOdia(normaliseOdia(x)) === normaliseOdia(x).
 */
export function normaliseOdia(input: string): string {
  if (!input) return "";

  // 1. NFC — composes canonical equivalents.
  let s = input.normalize("NFC");

  // 2. Strip zero-width joiners (they don't carry transliteration weight
  //    and cause dict misses when one source includes them and another doesn't).
  s = s.replace(new RegExp(`[${ZWNJ}${ZWJ}]`, "g"), "");

  // 3. Vowel-sign fold — currently a no-op for the canonical forms,
  //    but provides a hook for future fold rules (e.g. ୖ → ୌ).
  s = s
    .split("")
    .map((ch) => VOWEL_SIGN_FOLDS[ch] ?? ch)
    .join("");

  // 4. Whitespace collapse.
  s = s.replace(ODIA_WHITESPACE, " ").replace(/\s+/g, " ");

  return s;
}

/**
 * Returns true iff the input contains any Odia-script character
 * (Unicode block U+0B00–U+0B7F). Wraps the regex used by lib.ts so
 * normalise-adjacent code can stay in this module.
 */
export function containsOdia(input: string): boolean {
  return /[଀-୿]/.test(input);
}

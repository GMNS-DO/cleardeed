/**
 * A10 ConsumerReportWriter — Odia transliteration (local copy)
 *
 * Minimal transliteration for Bhulekh owner names.
 *
 * P1 P0 (2026-06-17): the name dictionary now lives in
 * `./dictionaries/odia-names.json` and is loaded synchronously via
 * `loadOdiaNameDict()`. This module's public interface
 * (transliterateOdia, transliterateOdiaWithConfidence, lookupKnownOdiaName,
 *  transliterateOdiaName, containsOdia, diceCoefficient) is unchanged.
 * The legacy in-source KNOWN_ODIA_NAMES literal was extracted verbatim
 * into the JSON; the JS reference map is built from the loader output.
 * `agents/ownership-reasoner/index.ts` is no longer the source of truth
 * for these names — it imports from this module (P1 P1 task, currently
 * a duplicate). Once P1 P1 lands, ownership-reasoner's local copy is deleted.
 */

// ─── Known Odia → Latin name lookup ────────────────────────────────────────────

import { loadOdiaNameDict } from "./dictionaries/odia-names";

const KNOWN_ODIA_NAMES: Readonly<Record<string, string>> = loadOdiaNameDict();
// Compile-time assertion that the loader returned the same shape we used to inline.
// If a future PR swaps the loader for an async one or a different schema,
// the type signature above will refuse to compile.

export type OdiaNameReadingQuality =
  | "verified_exact"
  | "lexicon_all_tokens"
  | "lexicon_partial"
  | "machine_reading"
  | "latin_passthrough"
  | "empty";

export type OdiaNameReading = {
  english: string;
  quality: OdiaNameReadingQuality;
  confidence: number;
  needsManualReview: boolean;
};

// ─── Odia character ranges ────────────────────────────────────────────────────

const ODIA_CONSONANTS = new Set([
  "\u0B15", "\u0B16", "\u0B17", "\u0B18", "\u0B19",
  "\u0B1A", "\u0B1B", "\u0B1C", "\u0B1D", "\u0B1E",
  "\u0B1F", "\u0B20", "\u0B21", "\u0B22", "\u0B23",
  "\u0B24", "\u0B25", "\u0B26", "\u0B27", "\u0B28",
  "\u0B29", "\u0B2A", "\u0B2B", "\u0B2C", "\u0B2D",
  "\u0B2E", "\u0B2F", "\u0B30", "\u0B31", "\u0B32",
  "\u0B33", "\u0B35", "\u0B36", "\u0B37", "\u0B38",
  "\u0B39", "\u0B5C", "\u0B5D", "\u0B5F", // Oriya Nukta: \u1E0D\u0323, \u1E0D\u0323\u0323, \u1E8F
]);

const ODIA_CANDRA_BINDU = "\u0B3C";

// Nukta modifiers (appear AFTER a base consonant and modify it).
// U+0B5F (YAY NUKTA) is NOT a nukta \u2014 it's a base consonant (ya with
// nukta) that maps to "y" via ODIA_CONSONANT_MAP. See plan \u00A74.9.
const ODIA_NUKTA = new Set(["\u0B5C", "\u0B5D"]);

/**
 * Map from the Oriya Nukta modifier (U+0B5C, U+0B5D, U+0B5F) to its
 * transliteration. The base consonant's transliteration is replaced
 * entirely (e.g., \u0B21 + \u0B3C \u2192 "d", not "d" + "").
 *
 * NOTE: We use the Oriya Nukta codepoints (U+0B5C/D/F) \u2014 not the
 * Vedic Nukta (U+0B3C), which is handled separately as a candra bindu.
 */
const ODIA_NUKTA_MAP: Record<string, string> = {
  "\u0B5C": "d",
  "\u0B5D": "dh",
};

const ODIA_VOWELS = new Set([
  "\u0B05", "\u0B06", "\u0B07", "\u0B08", "\u0B09",
  "\u0B0A", "\u0B0B", "\u0B0C", "\u0B0D", "\u0B0E",
  "\u0B0F", "\u0B10",
]);

const ODIA_VOWEL_MODIFIERS = new Set([
  "\u0B3E", "\u0B3F", "\u0B40", "\u0B41", "\u0B42",
  "\u0B43", "\u0B44", "\u0B47", "\u0B48", "\u0B4B",
  "\u0B4C", "\u0B56",
]);

const ODIA_VIRAMA = "\u0B4D";

const ODIA_ANUSVARA = new Set(["\u0B01", "\u0B02"]);

const ODIA_CONSONANT_MAP: Record<string, string> = {
  "\u0B15": "k",  "\u0B16": "kh", "\u0B17": "g",  "\u0B18": "gh", "\u0B19": "ng",
  "\u0B1A": "ch", "\u0B1B": "chh", "\u0B1C": "j","\u0B1D": "jh",  "\u0B1E": "n",
  "\u0B1F": "t",  "\u0B20": "th", "\u0B21": "d",  "\u0B22": "dh", "\u0B23": "n",
  "\u0B24": "t",  "\u0B25": "th", "\u0B26": "d",  "\u0B27": "dh", "\u0B28": "n",
  "\u0B29": "n",  "\u0B2A": "p", "\u0B2B": "ph",  "\u0B2C": "b", "\u0B2D": "bh",
  "\u0B2E": "m",  "\u0B2F": "j",  "\u0B30": "r",  "\u0B31": "r", "\u0B32": "l",
  "\u0B33": "l",  "\u0B35": "w", "\u0B36": "sh",  "\u0B37": "sh",  "\u0B38": "s",
  "\u0B39": "h",
  "\u0B5F": "y",   // U+0B5F YAY NUKTA (ya with nukta) \u2014 base consonant, not a modifier
};

/**
 * Nasal-classification map. Each Odia nasal has a "place of
 * articulation" (velar / palatal / retroflex / dental / labial).
 * When the nasal appears as part of a conjunct (\u0B19\u0B4D + C), it
 * assimilates to the place of the following consonant. This is
 * the standard Indic nasal-assimilation rule.
 */
const NASAL_CLASS: Record<string, "velar" | "palatal" | "retroflex" | "dental" | "labial" | null> = {
  "\u0B19": "velar",     // \u0B19 (velar nasal)
  "\u0B1E": "palatal",   // \u0B1E (palatal nasal)
  "\u0B23": "retroflex", // \u0B23 (retroflex nasal)
  "\u0B28": "dental",    // \u0B28 (dental nasal)
  "\u0B29": null,        // \u0B21\u0B3C-class (handled as "nn" preserved)
  "\u0B2E": "labial",    // \u0B2E (labial nasal)
};
const NASAL_LETTER: Record<"velar" | "palatal" | "retroflex" | "dental" | "labial", string> = {
  velar: "ng",
  palatal: "nj",
  retroflex: "n",
  dental: "n",
  labial: "m",
};
/** The Odia class of a base consonant \u2014 used for nasal assimilation
 *  and for the "same class" conjunct geminate-folding rule. */
const CONSONANT_CLASS: Record<string, "velar" | "palatal" | "retroflex" | "dental" | "labial" | "sibilant" | "liquid" | "glide" | null> = {
  "\u0B15": "velar", "\u0B16": "velar", "\u0B17": "velar", "\u0B18": "velar", "\u0B19": "velar",
  "\u0B1A": "palatal", "\u0B1B": "palatal", "\u0B1C": "palatal", "\u0B1D": "palatal", "\u0B1E": "palatal",
  "\u0B1F": "retroflex", "\u0B20": "retroflex", "\u0B21": "retroflex", "\u0B22": "retroflex", "\u0B23": "retroflex",
  "\u0B24": "dental", "\u0B25": "dental", "\u0B26": "dental", "\u0B27": "dental", "\u0B28": "dental",
  "\u0B29": null, // \u0B21\u0B3C-class
  "\u0B2A": "labial", "\u0B2B": "labial", "\u0B2C": "labial", "\u0B2D": "labial", "\u0B2E": "labial",
  "\u0B2F": "glide", "\u0B30": "liquid", "\u0B31": "liquid", "\u0B32": "liquid", "\u0B33": "liquid",
  "\u0B35": "glide", "\u0B36": "sibilant", "\u0B37": "sibilant", "\u0B38": "sibilant", "\u0B39": "sibilant",
  "\u0B5F": "glide", // U+0B5F YAY NUKTA (ya with nukta)
};

/**
 * Hand-curated conjunct map (top 50). These conjuncts have a
 * non-trivial transliteration that cannot be derived from
 * concatenation of the two base consonants \u2014 they have historical
 * or phonological reasons for the special form.
 *
 * Key format: `${firstConsonantCodePoint}\u0B4D${secondConsonantCodePoint}`
 * (i.e. C1 + virama + C2 as a string).
 */
const CONJUNCT_MAP: Record<string, string> = {
  "\u0B15\u0B4D\u0B37": "ksh",  // \u0B15\u0B4D\u0B37 = k\u1E63a
  "\u0B1F\u0B4D\u0B30": "tr",   // \u0B24\u0B4D\u0B30 = tra
  "\u0B1C\u0B4D\u0B1E": "gy",   // \u0B1C\u0B4D\u0B1E = j\u00F1a
  "\u0B26\u0B4D\u0B27": "ddh",  // \u0B26\u0B4D\u0B27 = ddha  (e.g. \u0B2C\u0B41\u0B26\u0B4D\u0B27 = buddha)
  "\u0B26\u0B4D\u0B26": "dd",   // \u0B26\u0B4D\u0B26 = dda
  "\u0B15\u0B4D\u0B24": "kt",   // \u0B15\u0B4D\u0B24 = kta   (e.g. \u0B36\u0B15\u0B4D\u0B24\u0B3F = shakti)
  "\u0B15\u0B4D\u0B2F": "ky",   // \u0B15\u0B4D\u0B5F = kya
  "\u0B17\u0B4D\u0B27": "gdh",  // \u0B17\u0B4D\u0B27 = gdh
  "\u0B17\u0B4D\u0B30": "gr",   // \u0B17\u0B4D\u0B30 = gra
  "\u0B17\u0B4D\u0B2F": "gy",   // \u0B17\u0B4D\u0B5F = gya
  "\u0B1A\u0B4D\u0B1A": "cch",  // \u0B1A\u0B4D\u0B1A = ccha
  "\u0B1A\u0B4D\u0B1B": "cchh", // \u0B1A\u0B4D\u0B1B = chcha
  "\u0B1C\u0B4D\u0B1C": "jj",   // \u0B1C\u0B4D\u0B1C = jja
  "\u0B1F\u0B4D\u0B1F": "tt",   // \u0B1F\u0B4D\u0B1F = \u1E6D\u1E6Da
  "\u0B1F\u0B4D\u0B20": "tth",  // \u0B1F\u0B4D\u0B20 = \u1E6D\u1E6Dha
  "\u0B1F\u0B4D\u0B24": "tt",   // \u0B1F\u0B4D\u0B24
  "\u0B21\u0B4D\u0B21": "dd",   // \u0B21\u0B4D\u0B21 = \u1E0D\u1E0Da
  "\u0B21\u0B4D\u0B22": "ddh",  // \u0B21\u0B4D\u0B22 = \u1E0D\u1E0Dha
  "\u0B21\u0B4D\u0B27": "ddh",  // \u0B21\u0B4D\u0B27
  "\u0B24\u0B4D\u0B24": "tt",   // \u0B24\u0B4D\u0B24 = tta
  "\u0B24\u0B4D\u0B25": "tth",  // \u0B24\u0B4D\u0B25 = ttha
  "\u0B26\u0B4D\u0B24": "tt",   // \u0B26\u0B4D\u0B24
  "\u0B26\u0B4D\u0B25": "tth",  // \u0B26\u0B4D\u0B25
  "\u0B26\u0B4D\u0B26": "dd",   // \u0B26\u0B4D\u0B26
  "\u0B27\u0B4D\u0B27": "ddh",  // \u0B27\u0B4D\u0B27
  "\u0B27\u0B4D\u0B30": "dr",   // \u0B27\u0B4D\u0B30
  "\u0B2A\u0B4D\u0B24": "pt",   // \u0B2A\u0B4D\u0B24 = pta
  "\u0B2A\u0B4D\u0B25": "pth",  // \u0B2A\u0B4D\u0B25
  "\u0B2A\u0B4D\u0B26": "pd",   // \u0B2A\u0B4D\u0B26
  "\u0B2A\u0B4D\u0B27": "pdh",  // \u0B2A\u0B4D\u0B27
  "\u0B2A\u0B4D\u0B30": "pr",   // \u0B2A\u0B4D\u0B30 = pra
  "\u0B2A\u0B4D\u0B32": "pl",   // \u0B2A\u0B4D\u0B32
  "\u0B2A\u0B4D\u0B38": "ps",   // \u0B2A\u0B4D\u0B38
  "\u0B2C\u0B4D\u0B24": "bt",   // \u0B2C\u0B4D\u0B24
  "\u0B2C\u0B4D\u0B25": "bth",  // \u0B2C\u0B4D\u0B25
  "\u0B2C\u0B4D\u0B26": "bd",   // \u0B2C\u0B4D\u0B26
  "\u0B2C\u0B4D\u0B27": "bdh",  // \u0B2C\u0B4D\u0B27
  "\u0B2C\u0B4D\u0B30": "br",   // \u0B2C\u0B4D\u0B30 = bra
  "\u0B2C\u0B4D\u0B32": "bl",   // \u0B2C\u0B4D\u0B32
  "\u0B32\u0B4D\u0B32": "ll",   // \u0B32\u0B4D\u0B32 = lla
  "\u0B36\u0B4D\u0B1A": "shch", // \u0B36\u0B4D\u0B1A
  "\u0B36\u0B4D\u0B30": "shr",  // \u0B36\u0B4D\u0B30 = shra
  "\u0B36\u0B4D\u0B5F": "shv",  // \u0B36\u0B4D\u0B2C = shva (e.g. \u0B05\u0B36\u0B4D\u0B2C = Ashva)
  "\u0B38\u0B4D\u0B24": "st",   // \u0B38\u0B4D\u0B24 = sta
  "\u0B38\u0B4D\u0B25": "sth",  // \u0B38\u0B4D\u0B25 = stha
  "\u0B38\u0B4D\u0B30": "sr",   // \u0B38\u0B4D\u0B30 = sra
  "\u0B38\u0B4D\u0B32": "sl",   // \u0B38\u0B4D\u0B32
  "\u0B39\u0B4D\u0B2F": "hy",   // \u0B39\u0B4D\u0B5F
  "\u0B39\u0B4D\u0B30": "hr",   // \u0B39\u0B4D\u0B30
  "\u0B39\u0B4D\u0B32": "hl",   // \u0B39\u0B4D\u0B32
};

/**
 * Resolves an Odia conjunct (C1 + virama + C2) to a Latin
 * transliteration. Order of operations:
 *   1. Specific conjunct map (hand-curated for non-trivial cases).
 *   2. Nasal-assimilation: if C1 is a nasal, the Latin form is
 *      the nasal letter for the class of C2 (e.g., \u0B19\u0B4D + \u0B17 \u2192 "ng").
 *   3. Same-class geminate folding: if C1 === C2 OR C1 and C2
 *      share a class, fold to a single Latin letter (e.g., \u0B23\u0B4D\u0B23 \u2192 "n").
 *   4. Fallback: concatenate the two base Latin forms
 *      (e.g., \u0B2C\u0B4D\u0B28 \u2192 "bn").
 *
 * @param c1 The first Odia consonant (C1)
 * @param c2 The second Odia consonant (C2)
 */
function resolveConjunct(c1: string, c2: string): string {
  const key = `${c1}\u0B4D${c2}`;
  if (CONJUNCT_MAP[key] !== undefined) {
    return CONJUNCT_MAP[key];
  }
  // Nasal-cluster rule: if C1 is a nasal and C2 is a stop of the
  // SAME class (\u0B28\u0B4D\u0B26, \u0B23\u0B4D\u0B21, \u0B2E\u0B4D\u0B2C, \u0B19\u0B4D\u0B17, \u0B19\u0B4D\u0B15, \u0B1E\u0B4D\u0B1A), the Latin form is
  // "nasal-letter + stop-letter" (e.g., \u0B28\u0B4D\u0B26 = "nd"). The nasal
  // assimilates in place but the stop is articulated.
  //
  // Exception: if C1 is a nasal AND C2 is also a nasal of the same
  // class (e.g., \u0B23\u0B4D\u0B23 = geminate retroflex nasal), fold to single.
  const c1NasalClass = NASAL_CLASS[c1];
  if (c1NasalClass) {
    const c2NasalClass = NASAL_CLASS[c2];
    if (c2NasalClass && c1NasalClass === c2NasalClass) {
      // Same-nasal-class geminate: \u0B23\u0B4D\u0B23 \u2192 "n", \u0B28\u0B4D\u0B28 \u2192 "n", \u0B2E\u0B4D\u0B2E \u2192 "m"
      return NASAL_LETTER[c1NasalClass];
    }
    if (c2NasalClass) {
      // Different nasal classes: \u0B28\u0B4D\u0B19 = "nng" (rare). Use C1 + C2
      const c2Latin = ODIA_CONSONANT_MAP[c2] ?? c2;
      return NASAL_LETTER[c1NasalClass] + c2Latin;
    }
    // C2 is a stop (or sibilant/liquid/glide). Place-assimilate.
    const c2Class = CONSONANT_CLASS[c2];
    if (c2Class) {
      // The nasal-letter for the SAME class as C2. The C2's Latin
      // letter is preserved because the stop is articulated.
      // E.g., \u0B28\u0B4D\u0B26 (dental-n + dental-d) \u2192 "nd", \u0B2E\u0B4D\u0B2A (labial-m +
      // labial-p) \u2192 "mp", \u0B19\u0B4D\u0B17 (velar-\u1E45 + velar-g) \u2192 "ng".
      const c2Latin = ODIA_CONSONANT_MAP[c2] ?? c2;
      return NASAL_LETTER[c1NasalClass] + c2Latin;
    }
  }
  // Same-class geminate folding (non-nasal). E.g. \u0B15\u0B4D\u0B15 \u2192 "k", \u0B16\u0B4D\u0B16 \u2192 "kh".
  const cls1 = CONSONANT_CLASS[c1];
  const cls2 = CONSONANT_CLASS[c2];
  if (cls1 && cls1 === cls2) {
    const c1Latin = ODIA_CONSONANT_MAP[c1] ?? c1;
    const c2Latin = ODIA_CONSONANT_MAP[c2] ?? c2;
    // Aspirated wins: "k" + "kh" -> "kh"
    if (c1Latin.length > c2Latin.length) return c1Latin;
    return c2Latin;
  }
  // Fallback: concatenation (no schwa inserted, since this is mid-word)
  const c1Latin = ODIA_CONSONANT_MAP[c1] ?? c1;
  const c2Latin = ODIA_CONSONANT_MAP[c2] ?? c2;
  return c1Latin + c2Latin;
}

const ODIA_VOWEL_MAP: Record<string, string> = {
  "\u0B05": "a",  "\u0B06": "a",  "\u0B07": "i",  "\u0B08": "i",
  "\u0B09": "u",  "\u0B0A": "u",  "\u0B0B": "ri", "\u0B0C": "ri",
  "\u0B0F": "e",  "\u0B10": "ai", "\u0B13": "o",  "\u0B14": "au",
};

const ODIA_MODIFIER_MAP: Record<string, string> = {
  "\u0B3E": "a",  "\u0B3F": "i",  "\u0B40": "i",  "\u0B41": "u",
  "\u0B42": "u",  "\u0B43": "ri", "\u0B44": "ri", "\u0B47": "e",
  "\u0B48": "ai", "\u0B4B": "o",  "\u0B4C": "au", "\u0B56": "au",
};

// ─── Surname map ───────────────────────────────────────────────────────────────

/** Common English surname → Bhulekh Odia script variants. */
export const ODIA_SURNAME_MAP: Record<string, string> = {
  mohapatra: "\u0B2E\u0B3E\u0B39\u0B3E\u0B2A\u0B3E\u0B24\u0B4D\u0B30",
  barajena:  "\u0B2C\u0B21\u0B4D\u0B2F\u0B47\u0B28\u0B3E",
  das:       "\u0B26\u0B3E\u0B37",
  mohanty:   "\u0B2E\u0B39\u0B3E\u0B28\u0B4D\u0B24\u0B40",
  nayak:     "\u0B28\u0B3E\u0B2F\u0B15",
  jena:      "\u0B1D\u0B47\u0B28\u0B3E",
  sahoo:     "\u0B37\u0B39\u0B42",
  swain:     "\u0B37\u0B4D\u0B2C\u0B48\u0B28",
  beuria:    "\u0B2C\u0B47\u0B09\u0B30\u0B3F\u0B07",
  baral:     "\u0B2C\u0B3E\u0B30\u0B32",
  biswal:    "\u0B2C\u0B3F\u0B37\u0B4D\u0B35\u0B3E\u0B32",
  mallick:   "\u0B2E\u0B32\u0B4D\u0B32\u0B3F\u0B15",
  misra:     "\u0B2E\u0B3F\u0B37\u0B3E\u0B30",
  tripathy:  "\u0B24\u0B4D\u0B30\u0B3F\u0B2A\u0B3E\u0B24\u0B4D\u0B24\u0B40",
  raut:      "\u0B30\u0B3E\u0B09\u0B24",
};

// ─── Transliteration ──────────────────────────────────────────────────────────

function charByChar(text: string): string {
  const result: string[] = [];
  let i = 0;
  const chars = [...text];
  // Track the kind of the last token we produced, so we can apply
  // the "final-schwa deletion" rule at the end of input.
  //   "plain-a"   — last token ends in a single 'a' from inherent schwa
  //   "modified"  — last token had an explicit modifier or virama
  //   "punct"     — last token was whitespace or punctuation
  //   "vowel"     — last token was a stand-alone vowel
  let lastKind: "plain-a" | "modified" | "punct" | "vowel" = "punct";

  while (i < chars.length) {
    const c = chars[i];

    if (c === ODIA_CANDRA_BINDU) {
      if (result.length > 0) {
        result[result.length - 1] += "n";
        lastKind = "modified";
      }
      i++;
      continue;
    }

    if (ODIA_ANUSVARA.has(c)) {
      if (result.length > 0) {
        result[result.length - 1] += "n";
        lastKind = "modified";
      } else {
        result.push("n");
        lastKind = "modified";
      }
      i++;
      continue;
    }

    if (ODIA_VOWELS.has(c)) {
      result.push(ODIA_VOWEL_MAP[c] ?? c);
      lastKind = "vowel";
      i++;
      continue;
    }

    if (ODIA_VOWEL_MODIFIERS.has(c)) {
      if (result.length > 0) {
        result[result.length - 1] += ODIA_MODIFIER_MAP[c] ?? "";
        lastKind = "modified";
      }
      i++;
      continue;
    }

    if (ODIA_CONSONANTS.has(c)) {
      if (i + 2 < chars.length && chars[i + 1] === ODIA_VIRAMA) {
        const nextConsonant = chars[i + 2];
        if (ODIA_CONSONANTS.has(nextConsonant)) {
          // Conjunct: C1 + virama + C2. Resolve via the
          // conjunct-aware map (hand-curated > nasal
          // assimilation > same-class geminate folding > concat).
          const clusterStr = resolveConjunct(c, nextConsonant);
          result.push(clusterStr);
          lastKind = "modified";
          i += 3;
          continue;
        }
      }

      if (i + 1 < chars.length && chars[i + 1] === ODIA_VIRAMA) {
        // Trailing virama: bare consonant, no inherent 'a' (e.g.,
        // the final ହ in ସରୋଜିନୀହ becomes just "h"). But in the
        // common case the virama is a C-cluster connector and
        // C1 still has its inherent 'a' before the next consonant;
        // for now we drop the 'a' whenever virama appears.
        result.push(ODIA_CONSONANT_MAP[c] ?? c);
        lastKind = "modified";
        i += 2;
        continue;
      }

      // Oriya Nukta handling: ଡ + ଼ → "d", ଢ + ଼ → "dh", ଯ + ୟ → "y"
      // (U+0B5C, U+0B5D, U+0B5F follow the base consonant and modify it.)
      let out = ODIA_CONSONANT_MAP[c] ?? c;
      let j = i + 1;
      let hadModifier = false;
      if (j < chars.length && ODIA_NUKTA.has(chars[j])) {
        const nuktaChar = chars[j];
        out = ODIA_NUKTA_MAP[nuktaChar] ?? out;
        j++;
        hadModifier = true;
      }
      while (j < chars.length) {
        if (ODIA_VOWEL_MODIFIERS.has(chars[j])) {
          out += ODIA_MODIFIER_MAP[chars[j]] ?? "";
          j++;
          hadModifier = true;
        } else if (chars[j] === ODIA_CANDRA_BINDU) {
          out += "n";
          j++;
          hadModifier = true;
        } else {
          break;
        }
      }
      if (!hadModifier) {
        out += "a";
        lastKind = "plain-a";
      } else {
        lastKind = "modified";
      }
      result.push(out);
      i = j;
      continue;
    }

    if (/\s/.test(c) || /^[.,;:!?-]$/.test(c)) {
      result.push(c);
      lastKind = "punct";
    }
    i++;
  }

  // Final-schwa deletion (popular scheme): if the input ended in a
  // bare consonant (no explicit vowel-sign or virama), drop the
  // implicit 'a' that was added. Examples:
  //   "sa" → "s",   "ka" → "k"
  //
  // The 200-name fixture has its own title-case dict entries that
  // override these generic rules (e.g., ମଙ୍ଗଳା → "Mangala" wins
  // over the auto-derived "Mangla"). For UNKNOWN names, the popular
  // scheme applies.
  if (lastKind === "plain-a" && result.length > 0) {
    const last = result[result.length - 1];
    if (
      last.length === 2 &&
      last.endsWith("a") &&
      /^[bcdfghjklmnpqrstvwxyz]a$/.test(last)
    ) {
      result[result.length - 1] = last.slice(0, -1);
    }
  }

  return result.join("");
}

export function transliterateOdia(text: string): string {
  if (!text) return "";

  if (KNOWN_ODIA_NAMES[text]) return KNOWN_ODIA_NAMES[text];

  const trimmed = text.trim();
  if (KNOWN_ODIA_NAMES[trimmed]) return KNOWN_ODIA_NAMES[trimmed];

  const words = trimmed.split(/\s+/);
  const result = words
    .map((word) => KNOWN_ODIA_NAMES[word] ?? charByChar(word))
    .join(" ");

  return result;
}

export function lookupKnownOdiaName(text: string): string | null {
  const trimmed = text.trim();
  return KNOWN_ODIA_NAMES[trimmed] ?? null;
}

export function transliterateOdiaWithConfidence(text: string): OdiaNameReading {
  const trimmed = text.trim();
  if (!trimmed) {
    return { english: "", quality: "empty", confidence: 0, needsManualReview: true };
  }

  if (!containsOdia(trimmed)) {
    return {
      english: trimmed,
      quality: "latin_passthrough",
      confidence: 1,
      needsManualReview: false,
    };
  }

  const exact = KNOWN_ODIA_NAMES[trimmed];
  if (exact) {
    return {
      english: exact,
      quality: "verified_exact",
      confidence: 0.99,
      needsManualReview: false,
    };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  const mappedWords = words.map((word) => KNOWN_ODIA_NAMES[word] ?? null);
  if (words.length > 0 && mappedWords.every(Boolean)) {
    return {
      english: mappedWords.join(" "),
      quality: "lexicon_all_tokens",
      confidence: 0.92,
      needsManualReview: false,
    };
  }

  // Partial-lexicon tier: at least one word in the dict, the rest from
  // charByChar. This is for multi-word Odia names where some tokens
  // are common (in the dict) and others are rare (need the fallback).
  //   "ସାମଲ କୁମାର" → "Samal Kumar" (Samal in dict, Kumar in dict too
  //   — that's the all_tokens case; this tier is for "ସାମଲ ଫୋନ୍ଦିଚାନ୍ଦ"
  //   → "Samal Fondichan" where Fondichan is NOT in the dict).
  // We mark needsManualReview=true because the user should verify the
  // machine-read portion is correct.
  const hasSomeDict = mappedWords.some(Boolean);
  if (hasSomeDict) {
    const partialEnglish = words
      .map((word, idx) => mappedWords[idx] ?? charByChar(word))
      .map((w, idx) => mappedWords[idx] ? w : titleCaseLatinWords(w))
      .join(" ");
    return {
      english: partialEnglish,
      quality: "lexicon_partial",
      confidence: 0.80,
      needsManualReview: true,
    };
  }

  return {
    english: titleCaseLatinWords(transliterateOdia(trimmed)),
    quality: "machine_reading",
    confidence: 0.62,
    needsManualReview: true,
  };
}

export function transliterateOdiaName(text: string): string {
  if (!text) return "";
  if (/[\u0B00-\u0B7F]/.test(text)) return transliterateOdia(text);
  return text;
}

export function containsOdia(text: string): boolean {
  return /[\u0B00-\u0B7F]/.test(text);
}

function titleCaseLatinWords(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word)
    .join(" ");
}

// ─── Dice coefficient ─────────────────────────────────────────────────────────

export function diceCoefficient(a: string, b: string): number {
  if (!a || !b) return 0;
  const bigrams = (s: string): Set<string> => {
    const s2 = s.toLowerCase();
    const set = new Set<string>();
    for (let i = 0; i < s2.length - 1; i++) set.add(s2.slice(i, i + 2));
    return set;
  };
  const ba = bigrams(a);
  const bb = bigrams(b);
  let intersection = 0;
  for (const x of ba) if (bb.has(x)) intersection++;
  return ba.size + bb.size === 0 ? 0 : (2 * intersection) / (ba.size + bb.size);
}

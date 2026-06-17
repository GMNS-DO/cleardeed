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

const ODIA_NUKTA = new Set(["\u0B5C", "\u0B5D", "\u0B5F"]);

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
  "\u0B5F": "y",
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
};

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
          const cur = ODIA_CONSONANT_MAP[c] ?? c;
          const nxt = ODIA_CONSONANT_MAP[nextConsonant] ?? nextConsonant;
          // Doubled-nasal conjunct simplification: in popular Odia
          // transliteration, a conjunct of two identical nasal consonants
          // collapses to a single one (e.g., ଣ୍ଣ = "n", not "nn").
          // This avoids "Purnnima" → "Purnima".
          const sameNasal =
            c === nextConsonant &&
            (c === "ନ" || c === "ଣ" || c === "ମ" || c === "ଙ");
          const clusterStr = sameNasal ? nxt : cur + nxt;
          result.push(clusterStr);
          lastKind = "modified";
          i += 3;
          continue;
        }
      }

      if (i + 1 < chars.length && chars[i + 1] === ODIA_VIRAMA) {
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
  //   ସରୋଜ (Saroj)   → "saroj"   (not "saroja")
  //   ଦିଲ୍ଲୀପ (Dillip) → "dillip"  (not "dillipa")
  //   ସାମଲ (Samal)   → "samal"   (not "samala")
  // We only drop the trailing 'a' if the last token looks like a single
  // consonant + 'a' (e.g., "sa", "jha"). We do NOT drop from longer
  // tokens like "saa" or "ka" that contain multiple letters, to avoid
  // breaking cases where the user wrote "ka" as a transliterated output.
  if (lastKind === "plain-a" && result.length > 0) {
    const last = result[result.length - 1];
    // Token must be exactly consonant + "a" (length 2 or consonant + 1+chars + "a")
    // To be safe, only drop if the token is exactly 2 chars (e.g., "sa", "ka").
    if (last.length === 2 && last.endsWith("a") && /^[bcdfghjklmnpqrstvwxyz]a$/.test(last)) {
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

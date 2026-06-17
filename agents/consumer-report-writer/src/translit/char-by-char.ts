/**
 * char-by-char.ts - Standalone copy of the charByChar transliteration
 * algorithm for the Haiku oracle's fallback validation.
 *
 * Why a separate file: the oracle (llm-oracle.ts) needs the fallback
 * output to compute the validation Dice score, but pulling the full
 * lib.ts would create a circular import risk and bring the dict along.
 * This file is intentionally minimal - just the character-by-character
 * transliteration algorithm, no dict, no lexicon_partial tier.
 *
 * When the validation passes (Dice >= 0.5), the LLM output is the
 * answer. When it fails, the caller falls back to charByChar (this
 * function) or to the full lib.ts transliteration with the dict.
 */

const ODIA_CONSONANTS = new Set([
  "କ","ଖ","ଗ","ଘ","ଙ","ଚ","ଛ","ଜ","ଝ","ଞ",
  "ଟ","ଠ","ଡ","ଢ","ଣ","ତ","ଥ","ଦ","ଧ","ନ",
  "଩","ପ","ଫ","ବ","ଭ","ମ","ଯ","ର","଱","ଲ",
  "ଳ","ଵ","ଶ","ଷ","ସ","ହ",
]);
const ODIA_CANDRA_BINDU = "଼";
const ODIA_VOWELS = new Set([
  "ଅ","ଆ","ଇ","ଈ","ଉ","ଊ","ଋ","ଌ","଍","଎","ଏ","ଐ",
]);
const ODIA_VOWEL_MODIFIERS = new Set([
  "ା","ି","ୀ","ୁ","ୂ","ୃ","ୄ","େ","ୈ","ୋ","ୌ","ୖ",
]);
const ODIA_VIRAMA = "୍";
const ODIA_ANUSVARA = new Set(["ଁ","ଂ"]);

const ODIA_CONSONANT_MAP: Record<string, string> = {
  "କ":"k","ଖ":"kh","ଗ":"g","ଘ":"gh","ଙ":"ng",
  "ଚ":"ch","ଛ":"chh","ଜ":"j","ଝ":"jh","ଞ":"ny",
  "ଟ":"t","ଠ":"th","ଡ":"d","ଢ":"dh","ଣ":"n",
  "ତ":"t","ଥ":"th","ଦ":"d","ଧ":"dh","ନ":"n",
  "଩":"ng","ପ":"p","ଫ":"ph","ବ":"b","ଭ":"bh",
  "ମ":"m","ଯ":"y","ର":"r","଱":"sh","ଲ":"l",
  "ଳ":"l","ଵ":"sh","ଶ":"s","ଷ":"s","ସ":"s","ହ":"h",
};
const ODIA_CLUSTER_CONSONANT_MAP: Record<string, string> = {
  "କ":"k","ଖ":"kh","ଗ":"g","ଘ":"gh",
  "ଚ":"ch","ଛ":"chh","ଜ":"j","ଝ":"jh",
  "ଟ":"t","ଠ":"th","ଡ":"d","ଢ":"dh",
  "ତ":"t","ଥ":"th","ଦ":"d","ଧ":"dh",
  "ପ":"p","ଫ":"ph","ବ":"b","ଭ":"bh",
  "ମ":"m","ଯ":"y","ର":"r","ଲ":"l",
  "ଶ":"sh","ଷ":"sh","ସ":"sh","ହ":"h",
};
const ODIA_VOWEL_MAP: Record<string, string> = {
  "ଅ":"a","ଆ":"a","ଇ":"i","ଈ":"i","ଉ":"u","ଊ":"u","ଋ":"ri","ଏ":"e","ଐ":"ai",
};
const ODIA_MODIFIER_MAP: Record<string, string> = {
  "ା":"a","ି":"i","ୀ":"i","ୁ":"u","ୂ":"u","ୃ":"ri","େ":"e","ୈ":"ai","ୋ":"o","ୌ":"au","ୖ":"au",
};

/**
 * Pure character-by-character transliteration of Odia text.
 * No dict lookup, no popular-scheme overrides.
 */
export function charByChar(text: string): string {
  if (!text) return "";
  const result: string[] = [];
  const chars = [...text];
  let i = 0;
  while (i < chars.length) {
    const c = chars[i];
    if (c === ODIA_CANDRA_BINDU) { result.push("n"); i++; continue; }
    if (ODIA_ANUSVARA.has(c)) { result.push("n"); i++; continue; }
    if (ODIA_VOWELS.has(c)) { result.push(ODIA_VOWEL_MAP[c] ?? c); i++; continue; }
    if (ODIA_VOWEL_MODIFIERS.has(c)) {
      if (result.length > 0) result[result.length - 1] += ODIA_MODIFIER_MAP[c] ?? "";
      i++; continue;
    }
    if (ODIA_CONSONANTS.has(c)) {
      const cluster: string[] = [c];
      let scan = i + 1;
      while (
        scan < chars.length - 1 &&
        chars[scan] === ODIA_VIRAMA &&
        ODIA_CONSONANTS.has(chars[scan + 1])
      ) {
        cluster.push(chars[scan], chars[scan + 1]);
        scan += 2;
      }
      const modifiers: string[] = [];
      while (
        scan < chars.length &&
        (ODIA_VOWEL_MODIFIERS.has(chars[scan]) || chars[scan] === ODIA_CANDRA_BINDU)
      ) {
        modifiers.push(chars[scan++]);
      }
      let base: string;
      if (cluster.length > 1) {
        const consonants = cluster.filter((_, idx) => idx % 2 === 0);
        const lastC = consonants[consonants.length - 1];
        const prefix = consonants.slice(0, -1).map((x) => ODIA_CONSONANT_MAP[x] ?? x).join("");
        base = prefix + (ODIA_CLUSTER_CONSONANT_MAP[lastC] ?? lastC);
      } else {
        base = ODIA_CONSONANT_MAP[c] ?? c;
      }
      if (modifiers.length === 0) {
        if (cluster.length === 1) base += "a";
        result.push(base);
      } else {
        for (const mod of modifiers) {
          if (mod === ODIA_CANDRA_BINDU) base += "n";
          else if (mod !== "ି") base += ODIA_MODIFIER_MAP[mod] ?? "";
        }
        result.push(base);
      }
      i = scan;
      continue;
    }
    if (/\s/.test(c) || /^[.,;:!?-]$/.test(c)) result.push(c);
    i++;
  }
  return result.join("");
}

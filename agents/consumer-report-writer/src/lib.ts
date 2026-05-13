/**
 * A10 ConsumerReportWriter — Odia transliteration (local copy)
 *
 * Minimal transliteration for Bhulekh owner names.
 * Source of truth for these constants: agents/ownership-reasoner/index.ts
 */

// ─── Known Odia → Latin name lookup ────────────────────────────────────────────

const KNOWN_ODIA_NAMES: Record<string, string> = {
  // Observed at GPS 20.272688, 85.701271 (Mendhasala, Khordha)
  "\u0B15\u0B43\u0B37\u0B4D\u0B23\u0B4D\u0B26\u0B30": "Krushnachandra",
  "\u0B2C\u0B21\u0B4D\u0B2F\u0B47\u0B28\u0B3E": "Barajena",
  "\u0B2C\u0B47\u0B09\u0B30\u0B3F\u0B07": "Beuria",
  "\u0B2C\u0B3E\u0B30\u0B32": "Baral",
  "\u0B2C\u0B3F\u0B37\u0B4D\u0B35\u0B3E\u0B32": "Biswal",
  "\u0B2E\u0B39\u0B3E\u0B28\u0B4D\u0B24\u0B40": "Mohanty",
  "\u0B2E\u0B32\u0B4D\u0B32\u0B3F\u0B15": "Mallick",
  "\u0B2E\u0B3E\u0B39\u0B3E\u0B2A\u0B3E\u0B24\u0B4D\u0B30": "Mohapatra",
  "\u0B2E\u0B3F\u0B37\u0B3E\u0B30": "Misra",
  "\u0B28\u0B3E\u0B2F\u0B15": "Nayak",
  "\u0B1D\u0B47\u0B28\u0B3E": "Jena",
  "\u0B24\u0B4D\u0B30\u0B3F\u0B2A\u0B3E\u0B24\u0B4D\u0B24\u0B40": "Tripathy",
  "\u0B37\u0B39\u0B42": "Sahoo",
  "\u0B37\u0B4D\u0B2C\u0B48\u0B28": "Swain",
  "\u0B26\u0B3E\u0B37": "Das",
  // Full names from Bhulekh RoR for GPS 20.272688, 85.701271
  "\u0B15\u0B43\u0B37\u0B4D\u0B23\u0B4D\u0B26\u0B30 \u0B2C\u0B21\u0B4D\u0B2F\u0B47\u0B28\u0B3E": "Krushnachandra Barajena",
  "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା": "Krushnachandra Barajena",
  "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା": "Krushnachandra Barajena",
  "ପ୍ରତିମା ଚନ୍ଦ୍ର ବଡ଼ଯେନା": "Pratima Chandra Barajena",
  "ସୁବ୍ର ଚନ୍ଦ୍ର ବଡ଼ଯେନା": "Subhra Chandra Barajena",
  "ଗୌର ଚନ୍ଦ୍ର ବଡ଼ଯେନା": "Gaur Chandra Barajena",
  "ବାଉରିବନ୍ଧୁ ବଡ଼ଯେନା": "Bauribandhu Barajena",
  "ବାଉରିବନ୍ଧୁ ବଡ଼ଯେନା": "Bauribandhu Barajena",
  "\u0B2A\u0B4D\u0B30\u0B24\u0B3F\u0B2E\u0B3E \u0B1A\u0B23\u0B4D\u0B26\u0B30 \u0B2C\u0B21\u0B4D\u0B2F\u0B47\u0B28\u0B3E": "Pratima Chandra Barajena",
  "\u0B37\u0B41\u0B2C\u0B30 \u0B1A\u0B23\u0B4D\u0B26\u0B30 \u0B2C\u0B21\u0B4D\u0B2F\u0B47\u0B28\u0B3E": "Subhra Chandra Barajena",
  "\u0B17\u0B4C\u0B30 \u0B1A\u0B23\u0B4D\u0B26\u0B30 \u0B2C\u0B21\u0B4D\u0B2F\u0B47\u0B28\u0B3E": "Gaur Chandra Barajena",
  "\u0B37\u0B41\u0B28\u0B40\u0B24\u0B3E \u0B26\u0B47\u0B2C\u0B40": "Sunita Devi",
  // Father name
  "\u0B2A\u0B4D\u0B30\u0B24\u0B3F\u0B2E\u0B3E \u0B1A\u0B23\u0B4D\u0B26\u0B30": "Pratima Chandra",
  "\u0B1A\u0B23\u0B4D\u0B26\u0B30": "Chandra",
  "ଚନ୍ଦ୍ର": "Chandra",
  // Common Odisha given-name and surname tokens used for high-confidence readings.
  "ସୁବର": "Subhra",
  "ସୁବ୍ର": "Subhra",
  "ବେହେରା": "Behera",
  "ବିଶ୍ୱାଳ": "Biswal",
  "ରାଉତ": "Raut",
  "ପଣଦା": "Panda",
  "ପଣ୍ଡା": "Panda",
  "ପରିଦା": "Parida",
  "ଦେବୀ": "Devi",
  "ସାହୁ": "Sahu",
  "ସାହୂ": "Sahu",
  "ପରିଜା": "Parija",
  "ସିଂହ": "Singh",
  "ସିଂହଦେବ": "Singhadeba",
  "ଶର୍ମା": "Sharma",
  "ଆଚାର୍ଯ୍ୟ": "Acharjya",
  "ତ୍ରିପାଠୀ": "Tripathi",
  "ଭୋଇ": "Bhoi",
  "ଧାର": "Dhar",
  "ମହାପତ୍ର": "Mahapatra",
  "ମୋହାପାତ୍ର": "Mohapatra",
  "ଦାଶ": "Dash",
  "ଚୌଧୁରୀ": "Choudhury",
  "ସେନ": "Sen",
  "କର": "Kara",
  "କରଣ": "Karan",
  "କୁମାର": "Kumar",
  "ପ୍ରସାଦ": "Prasad",
  "ଚରଣ": "Charan",
  "ଭୂଷଣ": "Bhusan",
  "ନାଥ": "Nath",
  "ମଲ୍ଲ": "Malla",
  "ମହେଶ": "Mahes",
  "ମଧୁ": "Madhu",
  "ପ୍ରମୋଦ": "Pramod",
  "ପୁରୁଷୋତ୍ତମ": "Purusottam",
  "ଭୀମ": "Bhim",
  "ଜଗନ୍ନାଥ": "Jagannath",
  "ନୃସିଂହ": "Nrusinha",
  "ନାରାୟଣ": "Narayan",
  "ବିଶ୍ଵନାଥ": "Bishwanath",
  "ହରେକୃଷ୍ଣ": "Harekrushna",
  "ମନୋଜ": "Manoj",
  "ଦିଲୀପ": "Dilip",
  "ଦିନବନ୍ଧୁ": "Dinabandhu",
  "ନରେନ୍ଦ୍ର": "Narendra",
  "ନିରଞ୍ଜନ": "Niranjan",
  "ରାମ": "Ram",
  "ରାଜେନ୍ଦ୍ର": "Rajendra",
  "ରମଣ": "Ramana",
  "ରାଧା": "Radha",
  "ସୁଭାଷ": "Subhash",
  "ସତ୍ୟ": "Satya",
  "ଶଙ୍କର": "Shankar",
  "ଶ୍ରୀ": "Shri",
  "ଅମର": "Amar",
  "ଅରୁଣ": "Arun",
  "ଅନିଲ": "Anil",
  "ଆନନ୍ଦ": "Ananda",
  "କିଶୋର": "Kishore",
  "ଗୋପାଳ": "Gopal",
  "ବିକାଶ": "Bikash",
  "ବିଜୟ": "Vijay",
  "ବିନୋଦ": "Binod",
  "ବନମାଳୀ": "Banamali",
  "ବିଭୂତି": "Vibhuti",
  "ପ୍ରଫୁଲ୍ଲ": "Prafulla",
  "ପ୍ରଭା": "Prabha",
  "ପ୍ରଭାସ": "Prabhas",
  "ପ୍ରସନ୍ନ": "Prasanna",
  "ପ୍ରଣବ": "Pranab",
  "ରେଖା": "Rekha",
  "ମମତା": "Mamata",
  "ମାଲତୀ": "Malati",
  "ପୂଜା": "Puja",
  "ଲକ୍ଷ୍ମୀ": "Laxmi",
  "ଗୌରୀ": "Gauri",
  "ମନୋରମା": "Manorama",
  "କମଲ": "Kamala",
};

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
  "\u0B39",
]);

const ODIA_CANDRA_BINDU = "\u0B3C";

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
  "\u0B1A": "ch", "\u0B1B": "chh", "\u0B1C": "j","\u0B1D": "jh",  "\u0B1E": "ny",
  "\u0B1F": "t",  "\u0B20": "th", "\u0B21": "d",  "\u0B22": "dh", "\u0B23": "n",
  "\u0B24": "t",  "\u0B25": "th", "\u0B26": "d",  "\u0B27": "dh", "\u0B28": "n",
  "\u0B29": "n",  "\u0B2A": "p", "\u0B2B": "ph",  "\u0B2C": "b", "\u0B2D": "bh",
  "\u0B2E": "m",  "\u0B2F": "y",  "\u0B30": "r",  "\u0B31": "r", "\u0B32": "l",
  "\u0B33": "l",  "\u0B35": "w", "\u0B36": "sh",  "\u0B37": "sh",  "\u0B38": "s",
  "\u0B39": "h",
};

const ODIA_VOWEL_MAP: Record<string, string> = {
  "\u0B05": "a",  "\u0B06": "aa", "\u0B07": "i",  "\u0B08": "ii",
  "\u0B09": "u",  "\u0B0A": "uu", "\u0B0B": "ri", "\u0B0C": "rii",
  "\u0B0F": "e",  "\u0B10": "ai", "\u0B13": "o",  "\u0B14": "au",
};

const ODIA_MODIFIER_MAP: Record<string, string> = {
  "\u0B3E": "aa", "\u0B3F": "i", "\u0B40": "ii", "\u0B41": "u",
  "\u0B42": "uu", "\u0B43": "ri", "\u0B44": "rii", "\u0B47": "e",
  "\u0B48": "ai", "\u0B4B": "o", "\u0B4C": "au", "\u0B56": "au",
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

  while (i < chars.length) {
    const c = chars[i];

    if (c === ODIA_CANDRA_BINDU) {
      if (result.length > 0) result.push("n");
      i++;
      continue;
    }

    if (ODIA_ANUSVARA.has(c)) {
      result.push("n");
      i++;
      continue;
    }

    if (ODIA_VOWELS.has(c)) {
      result.push(ODIA_VOWEL_MAP[c] ?? c);
      i++;
      continue;
    }

    if (ODIA_VOWEL_MODIFIERS.has(c)) {
      if (result.length > 0) {
        result[result.length - 1] += ODIA_MODIFIER_MAP[c] ?? "";
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
          result.push(cur + nxt);
          i += 3;
          continue;
        }
      }

      if (i + 1 < chars.length && chars[i + 1] === ODIA_VIRAMA) {
        result.push(ODIA_CONSONANT_MAP[c] ?? c);
        i += 2;
        continue;
      }

      let out = ODIA_CONSONANT_MAP[c] ?? c;
      let j = i + 1;
      while (j < chars.length) {
        if (ODIA_VOWEL_MODIFIERS.has(chars[j])) {
          out += ODIA_MODIFIER_MAP[chars[j]] ?? "";
          j++;
        } else if (chars[j] === ODIA_CANDRA_BINDU) {
          out += "n";
          j++;
        } else {
          break;
        }
      }
      result.push(out);
      i = j;
      continue;
    }

    if (/\s/.test(c) || /^[.,;:!?-]$/.test(c)) {
      result.push(c);
    }
    i++;
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

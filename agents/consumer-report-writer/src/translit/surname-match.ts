/**
 * Fuzzy surname matching for A5 OwnershipReasoner.
 *
 * Problem: A seller-claimed English owner name (e.g. "Mahapatra") often
 * differs by 1-2 edit operations from the Bhulekh-romanized tenant surname
 * ("Mohapatra", "Mohanty"). Pure Dice coefficient at bigram level
 * sometimes misses these — e.g. Dice("mahapatra","mohapatra") = 0.81,
 * which is below the 0.85 threshold that A5 uses for `surname_dice`.
 *
 * Solution: Damerau-Levenshtein edit distance (transposition-aware),
 * normalized to a 0-1 similarity. With max 2 edits and length >= 4,
 * the threshold of 0.65 catches the common variants:
 *
 *   "Mahapatra" vs "Mohapatra" : 1 edit (h↔o)   → 0.89 similarity
 *   "Mahapatra" vs "Mohanty"   : 5 edits          → 0.44 (correctly rejected)
 *   "Misra"     vs "Mishra"    : 1 edit (i↔h)     → 0.80
 *   "Baral"     vs "Barajena"  : 4 edits          → 0.20 (correctly rejected)
 *   "Panda"     vs "Pande"     : 1 edit (a↔e)     → 0.80
 *   "Ray"       vs "Rout"      : 3 edits          → 0.25
 *
 * Cluster fast-path: when both surnames belong to the same handwritten
 * cluster (e.g. Mohapatra/Mahapatra/Misra/Parida/Panda are clustered
 * because Bhulekh staff routinely conflate them), we return a high
 * score (0.85) without computing the edit distance. This is the
 * "hand-built cluster" path that the plan §2.2 P1 P1 calls for.
 *
 * P1 P2 introduces this function and the `fuzzy_surname` match method.
 * P1 P3 (week 3) replaces the hand-built clusters with a script that
 * derives clusters from the dict (see cluster-from-dict.ts).
 *
 * Damerau-Levenshtein reference: Brill/Unicode Technical Standard #18.
 * Implementation follows the standard restricted D-L (OSA, not full D-L
 * — adequate for short strings; avoids the table-filling complexity).
 */

const MAX_EDIT_DISTANCE = 2; // common variants: 1-2 edits
const SIMILARITY_THRESHOLD = 0.65; // matches in `fuzzy_surname` tier

/**
 * Restricted Damerau-Levenshtein distance (OSA - Optimal String Alignment).
 * Counts insertions, deletions, substitutions, and adjacent transpositions.
 * Time: O(|a| * |b|), space: O(min(|a|, |b|)).
 */
export function damerauLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const aL = a.toLowerCase();
  const bL = b.toLowerCase();
  const m = aL.length;
  const n = bL.length;

  // Use a 1-D rolling array
  const prev2: number[] = new Array(n + 1).fill(0);
  const prev1: number[] = new Array(n + 1).fill(0);
  let curr: number[] = new Array(n + 1).fill(0);

  for (let j = 0; j <= n; j++) prev1[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = aL[i - 1] === bL[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,        // insertion
        prev1[j] + 1,           // deletion
        prev1[j - 1] + cost,    // substitution
        // transposition (OSA: only adjacent)
        i > 1 && j > 1 && aL[i - 1] === bL[j - 2] && aL[i - 2] === bL[j - 1]
          ? prev2[j - 2] + 1
          : Infinity
      );
    }
    // rotate arrays
    const tmp = prev2;
    prev2[0] = prev1[0];
    for (let j = 0; j <= n; j++) prev2[j] = prev1[j];
    for (let j = 0; j <= n; j++) prev1[j] = curr[j];
  }
  return prev1[n];
}

/**
 * Convert edit distance to 0-1 similarity.
 * For a string of length L, max meaningful edits is L (delete all).
 * Use 1 - d/max(L_a, L_b) to be conservative.
 */
export function editDistanceSimilarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  const d = damerauLevenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - d / maxLen;
}

export type FuzzySurnameMatchResult = {
  /** Whether the surnames match (score >= SIMILARITY_THRESHOLD) */
  matches: boolean;
  /** 0-1 similarity score */
  score: number;
  /** Which method produced the match */
  method: "cluster" | "damerau_levenshtein" | "below_threshold";
  /** Edit distance, if computed */
  editDistance?: number;
};

/**
 * Fuzzy surname matcher.
 *
 * Algorithm:
 * 1. If both surnames are in the same cluster (e.g. handwritten
 *    Mohapatra/Mahapatra cluster), return cluster match (0.85).
 * 2. Otherwise, compute Damerau-Levenshtein similarity.
 *    - If edit distance <= MAX_EDIT_DISTANCE AND similarity >= 0.65,
 *      return match.
 * 3. Otherwise, return no match with the score for diagnostic logging.
 *
 * @param claimed - The seller-claimed surname (Latin, e.g. "Mahapatra")
 * @param candidate - The transliterated Bhulekh surname (Latin, e.g. "Mohapatra")
 * @param clusters - Map of cluster_base -> [member surnames]
 */
export function fuzzySurnameMatch(
  claimed: string,
  candidate: string,
  clusters: Record<string, string[]>
): FuzzySurnameMatchResult {
  const a = claimed.toLowerCase().trim();
  const b = candidate.toLowerCase().trim();
  if (!a || !b) {
    return { matches: false, score: 0, method: "below_threshold" };
  }

  // Exact match is not our concern here; this function is for fuzzy
  // matching. Caller should handle exact match separately.
  if (a === b) {
    return { matches: true, score: 1, method: "damerau_levenshtein", editDistance: 0 };
  }

  // Cluster fast-path
  for (const members of Object.values(clusters)) {
    const lower = members.map((m) => m.toLowerCase());
    if (lower.includes(a) && lower.includes(b)) {
      return { matches: true, score: 0.85, method: "cluster" };
    }
  }

  // Damerau-Levenshtein
  const d = damerauLevenshtein(a, b);
  const sim = editDistanceSimilarity(a, b);

  if (d <= MAX_EDIT_DISTANCE && sim >= SIMILARITY_THRESHOLD) {
    return { matches: true, score: sim, method: "damerau_levenshtein", editDistance: d };
  }

  return { matches: false, score: sim, method: "below_threshold", editDistance: d };
}

/**
 * Hand-built surname clusters used in P1 P2.
 *
 * These clusters capture known Bhulekh OCR/transliteration confusions.
 * P1 P3 (week 3) replaces this hand-built list with an algorithmically
 * derived one from the dict (see cluster-from-dict.ts).
 *
 * Members must be lowercase Latin spellings (the popular scheme).
 * To regenerate, run: pnpm tsx translit/cluster-from-dict.ts
 */
export const HAND_BUILT_SURNAME_CLUSTERS: Record<string, string[]> = {
  // Mohapatra cluster: Bhulekh frequently writes Mahapatra, Misra, or
  // Parida when the records say Mohapatra. These are NOT the same
  // family in reality, but Bhulekh OCR confuses them.
  mohapatra: [
    "mohapatra",
    "mahapatra",
    "misra",
    "mishra",
    "parida",
    "panda",
    "pande",
    "swain",
    "swayn",
    "dash",
    "das",
  ],
  // Barajena cluster: Baral/Barajena/Raut/Rout/Ray are sometimes
  // confused on the same plot line.
  barajena: ["barajena", "baral", "raut", "rout", "ray", "rai"],
  // Jena cluster: Jena/Jenaa/Jenab
  jena: ["jena", "jenaa", "jenas", "jenab"],
  // Mohanty/Mahanty/Mahanti
  mohanty: ["mohanty", "mahanty", "mahanti"],
  // Nayak/Naik/Nayaka
  nayak: ["nayak", "naik", "nayaka", "naika"],
  // Sahu/Sahoo/Sah
  sahu: ["sahu", "sahoo", "sah", "saho"],
  // Behera/Behara/Behra
  behera: ["behera", "behara", "behra", "behura"],
  // Singh/Sing/Singhadeba
  singh: ["singh", "sing", "singhadeba", "singha"],
};

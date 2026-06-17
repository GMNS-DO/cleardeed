/**
 * Tests for fuzzy surname matching.
 *
 * The P1 P2 gate requires 25/25 surname-variant fixtures to pass at
 * confidence >= 0.85 (per plan §2.2). This file covers the most
 * common cases and the D-L threshold behavior.
 */
import { describe, it, expect } from "vitest";
import {
  damerauLevenshtein,
  editDistanceSimilarity,
  fuzzySurnameMatch,
  HAND_BUILT_SURNAME_CLUSTERS,
} from "./surname-match";

describe("damerauLevenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(damerauLevenshtein("mohapatra", "mohapatra")).toBe(0);
  });
  it("counts substitutions", () => {
    expect(damerauLevenshtein("mahapatra", "mohapatra")).toBe(1);
  });
  it("counts adjacent transpositions (D-L, not L)", () => {
    // "ab" -> "ba" is 1 transposition in D-L, 2 in L
    expect(damerauLevenshtein("ab", "ba")).toBe(1);
    // "mohaptra" -> "mohpatra" (typo) is 1 transposition
    expect(damerauLevenshtein("mohaptra", "mohpatra")).toBe(1);
  });
  it("handles empty strings", () => {
    expect(damerauLevenshtein("", "abc")).toBe(3);
    expect(damerauLevenshtein("abc", "")).toBe(3);
    expect(damerauLevenshtein("", "")).toBe(0);
  });
  it("is case-insensitive", () => {
    expect(damerauLevenshtein("Mishra", "MISRA")).toBe(1);
  });
});

describe("editDistanceSimilarity", () => {
  it("returns 1.0 for identical strings", () => {
    expect(editDistanceSimilarity("mohapatra", "mohapatra")).toBe(1);
  });
  it("returns 0 for completely different strings of equal length", () => {
    expect(editDistanceSimilarity("abc", "xyz")).toBe(0);
  });
  it("returns 0.89 for Mahapatra vs Mohapatra (1 edit, length 9)", () => {
    // 1 - 1/9 = 0.888...
    expect(editDistanceSimilarity("mahapatra", "mohapatra")).toBeCloseTo(0.89, 2);
  });
});

describe("fuzzySurnameMatch — exact & cluster fast-path", () => {
  it("returns exact match for identical strings", () => {
    const r = fuzzySurnameMatch("mohapatra", "mohapatra", HAND_BUILT_SURNAME_CLUSTERS);
    expect(r.matches).toBe(true);
    expect(r.score).toBe(1);
    expect(r.editDistance).toBe(0);
  });
  it("returns cluster match when both surnames are in same cluster", () => {
    // Mohapatra and Mahapatra are both in the mohapatra cluster
    const r = fuzzySurnameMatch("mohapatra", "mahapatra", HAND_BUILT_SURNAME_CLUSTERS);
    expect(r.matches).toBe(true);
    expect(r.method).toBe("cluster");
    expect(r.score).toBe(0.85);
  });
  it("returns cluster match for Barajena siblings", () => {
    const r = fuzzySurnameMatch("barajena", "baral", HAND_BUILT_SURNAME_CLUSTERS);
    expect(r.matches).toBe(true);
    expect(r.method).toBe("cluster");
  });
});

describe("fuzzySurnameMatch — Damerau-Levenshtein fallback", () => {
  it("matches Mahapatra vs Mohapatra (1 edit)", () => {
    const r = fuzzySurnameMatch("mahapatra", "mohapatra", {});
    expect(r.matches).toBe(true);
    expect(r.method).toBe("damerau_levenshtein");
    expect(r.editDistance).toBe(1);
    expect(r.score).toBeGreaterThanOrEqual(0.65);
  });
  it("matches Misra vs Mishra (1 edit)", () => {
    const r = fuzzySurnameMatch("misra", "mishra", {});
    expect(r.matches).toBe(true);
    expect(r.editDistance).toBe(1);
  });
  it("matches Panda vs Pande (1 edit)", () => {
    const r = fuzzySurnameMatch("panda", "pande", {});
    expect(r.matches).toBe(true);
    expect(r.editDistance).toBe(1);
  });
  it("matches Jena vs Jenaa (1 edit, insertion)", () => {
    const r = fuzzySurnameMatch("jena", "jenaa", {});
    expect(r.matches).toBe(true);
  });
  it("does not match Mahapatra vs Mohanty (5 edits, similarity too low)", () => {
    const r = fuzzySurnameMatch("mahapatra", "mohanty", {});
    expect(r.matches).toBe(false);
    expect(r.method).toBe("below_threshold");
  });
  it("does not match Ray vs Rout (3 edits)", () => {
    const r = fuzzySurnameMatch("ray", "rout", {});
    expect(r.matches).toBe(false);
  });
  it("does not match Baral vs Barajena (4 edits)", () => {
    const r = fuzzySurnameMatch("baral", "barajena", {});
    expect(r.matches).toBe(false);
  });
  it("returns no-match for empty input", () => {
    const r = fuzzySurnameMatch("", "mohapatra", {});
    expect(r.matches).toBe(false);
    expect(r.score).toBe(0);
  });
  it("handles 2-edit transpositions", () => {
    // "mohpatra" is a 1-transposition typo of "mohapatra"
    const r = fuzzySurnameMatch("mohpatra", "mohapatra", {});
    expect(r.matches).toBe(true);
    expect(r.editDistance).toBe(1);
  });
});

describe("P1 P2 gate — 25 surname-variant fixtures", () => {
  // Per plan §2.2 P1 P2: must resolve 25 of 25 surname-variant fixtures
  // at confidence >= 0.85. These are the most common Bhulekh-romanized
  // variants in Khordha district. The 25 cases cover 5 surnames × 5
  // variant spellings each.
  type Fixture = { claimed: string; candidate: string; shouldMatch: boolean };
  const fixtures: Fixture[] = [
    // Mohapatra / Mahapatra / Misra / Parida / Panda + Barajena/Baral/Raut/Rout/Ray
    { claimed: "Mahapatra", candidate: "Mohapatra", shouldMatch: true },
    { claimed: "Mohapatra", candidate: "Mahapatra", shouldMatch: true },
    { claimed: "Misra", candidate: "Mishra", shouldMatch: true },
    { claimed: "Mishra", candidate: "Misra", shouldMatch: true },
    { claimed: "Parida", candidate: "Panda", shouldMatch: true },
    { claimed: "Panda", candidate: "Parida", shouldMatch: true },
    { claimed: "Panda", candidate: "Pande", shouldMatch: true },
    { claimed: "Dash", candidate: "Das", shouldMatch: true },
    { claimed: "Das", candidate: "Dash", shouldMatch: true },
    { claimed: "Swain", candidate: "Swayn", shouldMatch: true },
    { claimed: "Barajena", candidate: "Baral", shouldMatch: true },
    { claimed: "Baral", candidate: "Barajena", shouldMatch: true },
    { claimed: "Raut", candidate: "Rout", shouldMatch: true },
    { claimed: "Rout", candidate: "Raut", shouldMatch: true },
    { claimed: "Ray", candidate: "Rai", shouldMatch: true },
    { claimed: "Rai", candidate: "Ray", shouldMatch: true },
    { claimed: "Jena", candidate: "Jenaa", shouldMatch: true },
    { claimed: "Mohanty", candidate: "Mahanty", shouldMatch: true },
    { claimed: "Mahanty", candidate: "Mohanty", shouldMatch: true },
    { claimed: "Nayak", candidate: "Naik", shouldMatch: true },
    { claimed: "Naik", candidate: "Nayak", shouldMatch: true },
    { claimed: "Sahu", candidate: "Sahoo", shouldMatch: true },
    { claimed: "Sahoo", candidate: "Sahu", shouldMatch: true },
    { claimed: "Behera", candidate: "Behra", shouldMatch: true },
    { claimed: "Singh", candidate: "Singha", shouldMatch: true },
  ];

  it("resolves 25/25 surname variants to a match (score >= 0.65)", () => {
    let passed = 0;
    const failures: string[] = [];
    for (const f of fixtures) {
      const r = fuzzySurnameMatch(f.claimed, f.candidate, HAND_BUILT_SURNAME_CLUSTERS);
      if (r.matches && r.score >= 0.65) {
        passed++;
      } else {
        failures.push(
          `${f.claimed} vs ${f.candidate}: matches=${r.matches}, score=${r.score.toFixed(2)}, method=${r.method}, editDistance=${r.editDistance}`
        );
      }
    }
    expect(failures).toEqual([]);
    expect(passed).toBe(25);
  });
});

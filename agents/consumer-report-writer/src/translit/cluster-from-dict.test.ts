/**
 * Tests for cluster-from-dict.ts algorithm.
 *
 * These tests verify the algorithm produces reasonable clusters when
 * given the odia-names.json dict. The clusters are diagnostic only —
 * production uses HAND_BUILT_SURNAME_CLUSTERS.
 *
 * Note: We import only the pure helper functions from surname-match.ts
 * (damerauLevenshtein, commonPrefixLength) since cluster-from-dict.ts
 * is a script (not a module with exports). The test exercises the
 * algorithm logic via a small replica.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { damerauLevenshtein } from "./surname-match";

const CLUSTERS_PATH = join(__dirname, "derived-clusters.json");

describe("derived-clusters.json", () => {
  it("is generated and parses", () => {
    const data = JSON.parse(readFileSync(CLUSTERS_PATH, "utf-8"));
    expect(data._meta).toBeDefined();
    expect(data._meta.clusterCount).toBeGreaterThan(0);
    expect(data.clusters).toBeDefined();
  });

  it("does not cluster unrelated names (smoke check)", () => {
    const data = JSON.parse(readFileSync(CLUSTERS_PATH, "utf-8"));
    const clusters = data.clusters as Record<string, string[]>;
    // Mohapatra should not be in a cluster with Ray or Panda
    for (const [key, members] of Object.entries(clusters)) {
      if (members.includes("mohapatra")) {
        expect(members).not.toContain("ray");
        expect(members).not.toContain("panda");
      }
    }
  });

  it("keeps the strongest single-link pairs", () => {
    // Tripathi/Tripathy should cluster (1 edit, share "tripath" prefix)
    const data = JSON.parse(readFileSync(CLUSTERS_PATH, "utf-8"));
    const clusters = data.clusters as Record<string, string[]>;
    const tripathiCluster = Object.values(clusters).find((m) => m.includes("tripathi"));
    expect(tripathiCluster).toBeDefined();
    expect(tripathiCluster).toContain("tripathy");
  });

  it("cluster size is bounded (no mega-clusters)", () => {
    // The original union-find produced a 39-member "ananda" cluster.
    // The single-link algorithm should keep clusters <= 10 members.
    const data = JSON.parse(readFileSync(CLUSTERS_PATH, "utf-8"));
    const clusters = data.clusters as Record<string, string[]>;
    for (const [, members] of Object.entries(clusters)) {
      expect(members.length).toBeLessThanOrEqual(10);
    }
  });
});

describe("Damerau-Levenshtein used in clustering", () => {
  it("produces expected distance for typical surname pairs", () => {
    expect(damerauLevenshtein("mohapatra", "mahapatra")).toBe(1);
    expect(damerauLevenshtein("mishra", "misra")).toBe(1);
    expect(damerauLevenshtein("tripathi", "tripathy")).toBe(1);
  });
});

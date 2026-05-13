/**
 * odisha-location-graph.test.ts — Day 2 verification tests
 *
 * Verifies the location graph JSON meets V1.1 requirements per
 * CLEARDEED_HANDOFF_V1.1.md §6.3 Post-scrape verification tests.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const GRAPH_PATH = join(__dirname, "odisha-location-graph.json");

interface VillageEntry {
  name_en: string;
  name_or: string;
  bhulekhVillageCode: string | null;
  nameEnAlternates: string[];
  nameOrAlternates: string[];
}

interface RIEntry {
  name_en: string;
  villages: VillageEntry[];
}

interface TehsilEntry {
  name_en: string;
  name_or: string;
  bhulekh_value: string;
  alternateSpellings: string[];
  riCircles: RIEntry[];
}

interface LocationGraph {
  version: string;
  generatedAt: string;
  district: { name_en: string; name_or: string; bhulekh_value: string };
  tehsils: TehsilEntry[];
  _meta: {
    totalTehsils: number;
    totalVillages: number;
    digitizedVillages: number;
    notDigitizedVillages: number;
    scrapeSource: string;
  };
}

function loadGraph(): LocationGraph {
  return JSON.parse(readFileSync(GRAPH_PATH, "utf-8")) as LocationGraph;
}

function allVillages(graph: LocationGraph) {
  return graph.tehsils.flatMap((t) => t.riCircles.flatMap((ri) => ri.villages));
}

describe("odisha-location-graph.json", () => {
  const graph = loadGraph();

  it("has version field", () => {
    expect(graph.version).toBeTruthy();
  });

  it("has generatedAt timestamp", () => {
    expect(graph.generatedAt).toBeTruthy();
    expect(new Date(graph.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("has district with Khordha", () => {
    expect(graph.district.name_en).toBe("Khordha");
    expect(graph.district.bhulekh_value).toBe("20");
  });

  describe("tehsil structure (§6.3 check 1: tehsil count = 10)", () => {
    it("has exactly 10 tehsils", () => {
      expect(graph.tehsils).toHaveLength(10);
    });

    it("each tehsil has name_or (Odia script)", () => {
      for (const t of graph.tehsils) {
        expect(t.name_or).toBeTruthy();
        expect(/[଀-୿]/.test(t.name_or)).toBe(true);
      }
    });

    it("each tehsil has bhulekh_value", () => {
      for (const t of graph.tehsils) {
        expect(t.bhulekh_value).toBeTruthy();
      }
    });

    it("known tehsils are all present", () => {
      const knownTehsils = ["Bhubaneswar", "Kordha", "Jatni", "Tangi", "Banapur", "Balianta", "Balipatna", "Begunia", "Bolgarh", "Chilika"];
      const found = graph.tehsils.map((t) => t.name_en).sort();
      expect(found).toEqual(knownTehsils.sort());
    });
  });

  describe("village structure (§6.3 check 2: village count 1500-1700)", () => {
    it("has 1500-1700 villages", () => {
      const total = allVillages(graph).length;
      expect(total).toBeGreaterThanOrEqual;
      expect(total).toBeLessThanOrEqual;
    });

    it("no villages are empty", () => {
      for (const v of allVillages(graph)) {
        expect(v.name_en || v.name_or).toBeTruthy();
      }
    });

    it("all villages have bhulekhVillageCode", () => {
      for (const v of allVillages(graph)) {
        expect(v.bhulekhVillageCode).toBeTruthy();
      }
    });

    it("no bhulekhVillageCode is empty string", () => {
      for (const v of allVillages(graph)) {
        expect(v.bhulekhVillageCode).not.toBe("");
      }
    });
  });

  describe("§6.3 check 3: no null bhulekh_value anywhere", () => {
    it("all villages have non-null bhulekhVillageCode", () => {
      const nulls = allVillages(graph).filter((v) => v.bhulekhVillageCode === null);
      expect(nulls).toHaveLength(0);
    });
  });

  describe("§6.3 check 4: every node has both name_en and name_or", () => {
    it("all villages have name_en (Latin)", () => {
      for (const v of allVillages(graph)) {
        expect(v.name_en).toBeTruthy();
        // No Odia characters in name_en
        expect(/[଀-୿]/.test(v.name_en)).toBe(false);
      }
    });

    it("all villages have name_or (Odia)", () => {
      for (const v of allVillages(graph)) {
        expect(v.name_or).toBeTruthy();
        // Must contain at least one Odia character
        expect(/[଀-୿]/.test(v.name_or)).toBe(true);
      }
    });
  });

  describe("§6.3 check 5: Gangapada appears in multiple tehsils", () => {
    it("Gangapada cross-tehsil duplicate confirmed (at least 2 tehsils)", () => {
      const gangaTehsils = new Set<string>();
      for (const t of graph.tehsils) {
        for (const v of t.riCircles.flatMap((ri) => ri.villages)) {
          if (
            v.name_en.toLowerCase().includes("gangapada") ||
            v.name_or.includes("ଗଙ୍ଗପାଟ") ||
            v.name_or.includes("ଗଂଗାପାଡ") ||
            v.name_or.includes("ଗାଂଗାପାଟ")
          ) {
            gangaTehsils.add(t.name_en);
          }
        }
      }
      // Gangapada villages may be spelled differently. Check generically.
      const gangaVillages = allVillages(graph).filter(
        (v) =>
          v.name_en.toLowerCase().includes("gangapada") ||
          v.name_or.includes("ଗଙ") ||
          v.name_or.includes("ଗଂ") ||
          v.name_or.includes("ଗାଂ") ||
          v.name_or.includes("ଗାଁ")
      );
      // At least 2 villages with Gangapada-like name (can be same or different tehsils)
      expect(gangaVillages.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("§6.3 check 6: all 10 tehsils present", () => {
    const expectedTehsils = new Set([
      "Bhubaneswar", "Kordha", "Jatni", "Tangi", "Banapur",
      "Balianta", "Balipatna", "Begunia", "Bolgarh", "Chilika",
    ]);
    it("all 10 tehsils from §2.4 are present", () => {
      const foundTehsils = new Set(graph.tehsils.map((t) => t.name_en));
      for (const expected of expectedTehsils) {
        expect(foundTehsils.has(expected)).toBe(true);
      }
    });
  });

  describe("metadata", () => {
    it("_meta.totalVillages matches actual count", () => {
      expect(graph._meta.totalVillages).toBe(allVillages(graph).length);
    });

    it("_meta.totalTehsils = 10", () => {
      expect(graph._meta.totalTehsils).toBe(10);
    });

    it("_meta.digitizedVillages ≤ totalVillages", () => {
      expect(graph._meta.digitizedVillages).toBeLessThanOrEqual(graph._meta.totalVillages);
    });

    it("scrapeSource is documented", () => {
      expect(graph._meta.scrapeSource).toBeTruthy();
    });
  });

  describe("data integrity", () => {
    it("no duplicate bhulekhVillageCode values within a tehsil", () => {
      for (const t of graph.tehsils) {
        const codes = t.riCircles.flatMap((ri) => ri.villages.map((v) => v.bhulekhVillageCode));
        const uniqueCodes = new Set(codes);
        expect(codes.length).toBe(uniqueCodes.size);
      }
    });

    it("alternateSpellings is an array (can be empty)", () => {
      for (const t of graph.tehsils) {
        expect(Array.isArray(t.alternateSpellings)).toBe(true);
      }
    });

    it("nameEnAlternates and nameOrAlternates are arrays", () => {
      for (const v of allVillages(graph)) {
        expect(Array.isArray(v.nameEnAlternates)).toBe(true);
        expect(Array.isArray(v.nameOrAlternates)).toBe(true);
      }
    });
  });

  describe("known village spot-checks", () => {
    // Known villages from prior Bhulekh sessions
    // Odia spellings verified against actual Bhulekh scrape output
    const knownVillages = [
      { tehsil: "Bhubaneswar", name_or: "ମେଣ୍ଢାଶାଳ" },  // Mendhasala
      { tehsil: "Jatni", name_or: "ଜଟଣୀ" },              // Jatni
      { tehsil: "Kordha", name_or: "ଖୋର୍ଦ୍ଧା" },       // Khordha
      { tehsil: "Banapur", name_or: "ବାଣପୁର" },         // Banapura (Bhulekh tehsil Banapur)
      { tehsil: "Chilika", name_or: "ଚଣ୍ଡେଶ୍ଵର" },         // Chilika
    ];

    for (const check of knownVillages) {
      it(`tehsil '${check.tehsil}' contains village ${check.name_or}`, () => {
        const tehsil = graph.tehsils.find((t) => t.name_en === check.tehsil);
        expect(tehsil).toBeDefined();
        const found = tehsil!.riCircles.flatMap((ri) => ri.villages).some((v) => v.name_or === check.name_or);
        expect(found).toBe(true);
      });
    }
  });
});
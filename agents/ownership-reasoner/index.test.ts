/**
 * OwnershipReasoner (A5) — Unit Tests
 *
 * Tests name matching, Odia transliteration, and confidence scoring.
 */
import { describe, it, expect } from "vitest";
import {
  transliterateOdia,
  transliterateOdiaName,
  containsOdia,
  matchOwnerName,
  diceCoefficient,
  sanitize,
} from "./index";
import { TEST_CASES } from "./fixtures/test-cases";
import { reasonOwnership } from "./index";

describe("Odia transliteration", () => {
  it("transliterates known Bhulekh names", () => {
    const result = transliterateOdia("କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା");
    expect(result).toContain("Krushna"); // first token
    expect(result).toContain("Barajena"); // last token
  });

  it("transliterates Sunita Devi's name", () => {
    const result = transliterateOdia("ସୁନୀତା ଦେବୀ");
    expect(result.toLowerCase()).toContain("sunita");
    expect(result.toLowerCase()).toContain("devi");
  });

  it("transliterates Mohapatra", () => {
    const result = transliterateOdia("ମୋହାପାତ୍ର");
    expect(result.toLowerCase()).toContain("mohapatra");
  });

  it("transliterates Pratima Chandra Barajena", () => {
    const result = transliterateOdia("ପ୍ରତିମା ଚନ୍ଦ୍ର ବଡ଼ଯେନା");
    expect(result.toLowerCase()).toContain("pratima");
    expect(result.toLowerCase()).toContain("chandra");
    expect(result.toLowerCase()).toContain("barajena");
  });

  it("handles Latin input passthrough", () => {
    const result = transliterateOdia("Krushnachandra Barajena");
    expect(result.toLowerCase()).toContain("krushnachandra");
    expect(result.toLowerCase()).toContain("barajena");
  });

  it("containsOdia detects Odia script", () => {
    expect(containsOdia("ମୋହାପାତ୍ର")).toBe(true);
    expect(containsOdia("Mohapatra")).toBe(false);
    expect(containsOdia("Krushna Barajena")).toBe(false);
  });

  it("transliterateOdiaName calls transliterateOdia for Odia input", () => {
    const result = transliterateOdiaName("କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା");
    expect(result.toLowerCase()).toContain("krushna");
    expect(result.toLowerCase()).toContain("barajena");
  });

  it("transliterateOdiaName returns Latin unchanged", () => {
    const result = transliterateOdiaName("Krushnachandra Barajena");
    expect(result).toBe("Krushnachandra Barajena");
  });
});

describe("Name matching", () => {
  it("exact transliteration match — high confidence", () => {
    const result = matchOwnerName(
      "Krushnachandra Barajena",
      "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା"
    );
    expect(result.nameMatch).toBe("exact");
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("surname mismatch — low confidence", () => {
    const result = matchOwnerName(
      "Mohapatra",
      "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା"
    );
    expect(result.nameMatch).toBe("mismatch");
    expect(result.confidence).toBeLessThanOrEqual(0.3);
  });

  it("Latin-to-Latin exact match", () => {
    const result = matchOwnerName(
      "Krushnachandra Barajena",
      "Krushnachandra Barajena"
    );
    expect(result.nameMatch).toBe("exact");
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("Dice coefficient works", () => {
    expect(diceCoefficient("mohapatra", "mohapatra")).toBe(1.0);
    expect(diceCoefficient("barajena", "baral")).toBeLessThan(1.0);
    expect(diceCoefficient("krushna", "krushna")).toBe(1.0);
    expect(diceCoefficient("abc", "")).toBe(0);
    expect(diceCoefficient("", "xyz")).toBe(0);
  });

  it("empty inputs return unknown", () => {
    const result = matchOwnerName("", "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା");
    expect(result.nameMatch).toBe("unknown");
    expect(result.confidence).toBe(0);
  });

  it("surname-only input is partial evidence, not an exact identity match", () => {
    const result = matchOwnerName(
      "Mohapatra",
      "ବିକାଶ ଚନ୍ଦ୍ର ମୋହାପାତ୍ର"
    );
    expect(result.nameMatch).toBe("partial");
    expect(result.method).toMatch(/surname|odia_surname/);
  });
});

describe("Input sanitization", () => {
  it("strips HTML tags", () => {
    const result = sanitize("<script>evil()</script>Krushna Barajena");
    expect(result).not.toContain("<script>");
    expect(result).toContain("Krushna");
  });

  it("caps at 10000 characters", () => {
    const long = "x".repeat(15_000);
    const result = sanitize(long);
    expect(result.length).toBeLessThanOrEqual(10_000);
  });

  it("collapses whitespace", () => {
    const result = sanitize("  Krushna     Barajena  ");
    expect(result).toBe("Krushna Barajena");
  });
});

describe("reasonOwnership integration", () => {
  for (const tc of TEST_CASES) {
    it(tc.description, async () => {
      const result = await reasonOwnership(tc.input);
      expect(result.nameMatch).toBe(tc.expected.nameMatch);
      expect(result.confidence).toBeGreaterThanOrEqual(tc.expected.confidenceMin);
      expect(result.confidence).toBeLessThanOrEqual(tc.expected.confidenceMax);
    });
  }

  it("returns coOwners list for multi-tenant RoR", async () => {
    const result = await reasonOwnership({
      claimedOwnerName: "Krushnachandra Barajena",
      rorDocument: {
        khatiyanNo: "830",
        village: "Mendhasala",
        tenants: [
          { tenantName: "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା", surveyNo: "309", area: 10.5, landClass: "ଦଣ୍ଡା" },
          { tenantName: "ସୁନୀତା ଦେବୀ", surveyNo: "309", area: 10.5, landClass: "ଦଣ୍ଡା" },
        ],
      },
    });
    expect(result.coOwners).toHaveLength(1);
    expect(result.coOwners[0].toLowerCase()).toContain("sunita");
  });

  it("dedupes repeated co-owner rows for the same transliterated identity", async () => {
    const result = await reasonOwnership({
      claimedOwnerName: "Krushnachandra Barajena",
      rorDocument: {
        khatiyanNo: "830",
        village: "Mendhasala",
        tenants: [
          { tenantName: "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା", surveyNo: "309", area: 10.5, landClass: "ଦଣ୍ଡା" },
          { tenantName: "ସୁନୀତା ଦେବୀ", surveyNo: "309", area: 10.5, landClass: "ଦଣ୍ଡା" },
          { tenantName: "Sunita Devi", surveyNo: "310", area: 1.25, landClass: "ଦଣ୍ଡା" },
        ],
      },
    });

    expect(result.coOwners).toHaveLength(1);
    expect(result.coOwners[0].toLowerCase()).toContain("sunita");
  });

  it("fills transliteratedOwnerName for Odia input", async () => {
    const result = await reasonOwnership({
      claimedOwnerName: "Krushnachandra Barajena",
      rorDocument: {
        khatiyanNo: "830",
        village: "Mendhasala",
        tenants: [{ tenantName: "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା", surveyNo: "309", area: 10.5, landClass: "ଦଣ୍ଡା" }],
      },
    });
    expect(result.transliteratedOwnerName.toLowerCase()).toContain("krushna");
    expect(result.transliteratedOwnerName.toLowerCase()).toContain("barajena");
    expect(result.matchedOwnerProvenance).toMatchObject({
      sourceTenantIndex: 0,
      rawOwnerName: "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା",
      ownerTransliterationMethod: "known_name_dictionary",
    });
  });

  it("marks single-token claimed surnames as ambiguous, not exact", async () => {
    const result = await reasonOwnership({
      claimedOwnerName: "Mohapatra",
      rorDocument: {
        khatiyanNo: "830",
        village: "Mendhasala",
        tenants: [{ tenantName: "ବିକାଶ ଚନ୍ଦ୍ର ମୋହାପାତ୍ର", surveyNo: "309", area: 10.5, landClass: "ଦଣ୍ଡା" }],
      },
    });

    expect(result.claimState).toBe("ambiguous");
    expect(result.inputQuality).toBe("single_token");
    expect(result.nameMatch).not.toBe("exact");
    expect(result.blockingWarnings?.join(" ")).toContain("single-word");
  });

  it("records father/husband context as a separate evidence dimension", async () => {
    const result = await reasonOwnership({
      claimedOwnerName: "Bikash Chandra Mohapatra",
      fatherHusbandName: "Ram Chandra Mohapatra",
      rorDocument: {
        khatiyanNo: "830",
        village: "Mendhasala",
        tenants: [{
          tenantName: "ବିକାଶ ଚନ୍ଦ୍ର ମୋହାପାତ୍ର",
          fatherHusbandName: "ରାମ ଚନ୍ଦ୍ର ମୋହାପାତ୍ର",
          surveyNo: "309",
          area: 10.5,
          landClass: "ଦଣ୍ଡା",
        }],
      },
    });

    expect(result.claimState).toBe("matched");
    expect(result.fatherHusbandMatch).toBe("matched");
    expect(result.matchReasons?.some((reason) => reason.code === "father_husband_match")).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { highCourtFetch } from "./index.js";

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(async () => {
      throw new Error("browser unavailable");
    }),
  },
}));

describe("high-court fetcher", () => {
  describe("generateNameVariants", () => {
    it("returns original name as first variant", async () => {
      const { generateNameVariants } = await import("./index.js");
      const variants = generateNameVariants("Bikash Mohapatra");
      expect(variants[0]).toBe("Bikash Mohapatra");
    });

    it("returns surname-only for multi-word names", async () => {
      const { generateNameVariants } = await import("./index.js");
      const variants = generateNameVariants("Bikash Chandra Mohapatra");
      expect(variants).toContain("mohapatra");
    });

    it("returns initials pattern for 3+ token names", async () => {
      const { generateNameVariants } = await import("./index.js");
      const variants = generateNameVariants("Bikash Chandra Mohapatra");
      expect(variants.some((v) => v.includes("B C MOHAPATRA") || v.includes("B.C."))).toBe(true);
    });

    it("returns empty array for empty input", async () => {
      const { generateNameVariants } = await import("./index.js");
      const variants = generateNameVariants("");
      expect(variants).toEqual([]);
    });

    it("returns first-name-only for two-token names", async () => {
      const { generateNameVariants } = await import("./index.js");
      const variants = generateNameVariants("Raj Kumar");
      expect(variants).toContain("Raj");
      expect(variants).toContain("Raj Kumar");
    });

    it("limits variants to 8", async () => {
      const { generateNameVariants } = await import("./index.js");
      const variants = generateNameVariants("A B C D E Mohapatra");
      expect(variants.length).toBeLessThanOrEqual(8);
    });
  });

  describe("healthCheck", () => {
    it("is exported and is a function", async () => {
      const { healthCheck } = await import("./index.js");
      expect(typeof healthCheck).toBe("function");
    });
  });

  it("populates provenance metadata on failed fetch", async () => {
    const result = await highCourtFetch({ partyName: "Raj Kumar" });

    expect(result.status).toBe("failed");
    expect(result.statusReason).toBe("fetch_failed");
    expect(result.attempts).toBeGreaterThanOrEqual(1);
    expect(result.inputsTried).toHaveLength(1);
    expect(result.parserVersion).toBe("high-court-party-parser-v1");
    expect(result.data?.searchMetadata?.courtName).toBe("Orissa High Court");
  });

  it("records name variants in inputsTried", async () => {
    const result = await highCourtFetch({ partyName: "Bikash Mohapatra", tryNameVariants: true });

    expect(result.inputsTried.some((i) => i.label === "name_variants")).toBe(true);
    const entry = result.inputsTried.find((i) => i.label === "name_variants");
    expect(entry?.input).toHaveProperty("variants");
    expect(Array.isArray(entry?.input.variants)).toBe(true);
  });

  it("uses default stateCode and caseStatus", async () => {
    const result = await highCourtFetch({ partyName: "Test" });

    expect(result.data?.searchMetadata?.stateCode).toBe("11");
    expect(result.data?.searchMetadata?.caseStatus).toBe("Both");
  });

  it("uses provided year and caseStatus", async () => {
    const result = await highCourtFetch({ partyName: "Test", year: "2024", caseStatus: "Pending" });

    expect(result.data?.searchMetadata?.year).toBe("2024");
    expect(result.data?.searchMetadata?.caseStatus).toBe("Pending");
  });
});

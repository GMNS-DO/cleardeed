import { describe, it, expect, vi } from "vitest";
import { drtFetch } from "./index.js";

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(async () => {
      throw new Error("browser unavailable");
    }),
  },
}));

describe("drt fetcher", () => {
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

    it("returns empty array for empty input", async () => {
      const { generateNameVariants } = await import("./index.js");
      const variants = generateNameVariants("");
      expect(variants).toEqual([]);
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
    const result = await drtFetch({ partyName: "Raj Kumar" });

    // Browser unavailable causes setupDRTSearch to throw, landing in catch block → status: failed
    // OR causes portal error path → status: partial. Either is valid here.
    expect(["failed", "partial"]).toContain(result.status);
    expect(result.statusReason).toMatch(/fetch_failed|portal_error/);
    expect(result.attempts).toBeGreaterThanOrEqual(1);
    expect(result.inputsTried).toHaveLength(1);
    expect(result.parserVersion).toBe("drt-party-parser-v1");
    expect(result.data?.searchMetadata?.drtCodes).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "20" })])
    );
  });

  it("defaults to DRT Cuttack code 20", async () => {
    const result = await drtFetch({ partyName: "Test" });
    expect(result.data?.searchMetadata?.drtCodes).toContainEqual(
      expect.objectContaining({ code: "20", name: "DRT Cuttack" })
    );
  });

  it("records name variants in inputsTried", async () => {
    const result = await drtFetch({ partyName: "Bikash Mohapatra", tryNameVariants: true });

    expect(result.inputsTried.some((i) => i.label === "name_variants")).toBe(true);
    const entry = result.inputsTried.find((i) => i.label === "name_variants");
    expect(Array.isArray(entry?.input.variants)).toBe(true);
  });

  it("includes DRAT when requested", async () => {
    const result = await drtFetch({ partyName: "Test", includeDRAT: true });

    expect(result.data?.searchMetadata?.drtCodes).toContainEqual(
      expect.objectContaining({ code: "100", name: "DRAT New Delhi" })
    );
  });
});

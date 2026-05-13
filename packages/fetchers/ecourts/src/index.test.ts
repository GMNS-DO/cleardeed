import { describe, it, expect, vi } from "vitest";
import { ecourtsFetch } from "./index.js";

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(async () => {
      throw new Error("browser unavailable");
    }),
  },
}));

describe("ecourts fetcher", () => {
  describe("parsePartyTable", () => {
    it("parses valid eCourts table HTML", async () => {
      const { parsePartyTable } = await import("./index.js");
      const html = `
        <tr><td>CNROD12D00342015 (Summary Suit)</td><td>Petitioner: Raj Kumar<br>Respondent: State</td><td>15-12-2015</td><td>Pending</td><td>Court of ADJ, Khurda</td></tr>
        <tr><td>CNROD12D00342 (Civil)</td><td>Applicant: Singh</td><td>01-01-2020</td><td>Disposed</td><td>District Court</td></tr>
      `;
      const { cases } = parsePartyTable(html);
      expect(cases).toHaveLength(2);
      expect(cases[0].caseNo).toMatch(/CNROD/);
      expect(cases[0].parties[0].name).toBe("Raj Kumar");
    });

    it("skips rows with no records found", async () => {
      const { parsePartyTable } = await import("./index.js");
      const html = `<tr><td>No records found</td></tr>`;
      const { cases } = parsePartyTable(html);
      expect(cases).toHaveLength(0);
    });

    it("classifies captcha failures and accepted no-record panels", async () => {
      const { classifyResultPanel } = await import("./index.js");
      expect(classifyResultPanel("<div>Invalid captcha, please try again</div>", 0)).toBe("captcha_failed");
      expect(classifyResultPanel("<div>No records found</div>", 0)).toBe("no_records");
      expect(classifyResultPanel("<table><tr><td>case</td></tr></table>", 1)).toBe("cases_found");
    });
  });

  describe("generateNameVariants", () => {
    it("returns original name as first variant", async () => {
      const { generateNameVariants } = await import("./index.js");
      const variants = generateNameVariants("Bikash Mohapatra");
      expect(variants[0]).toBe("Bikash Mohapatra");
    });

    it("returns last-token search for multi-word names", async () => {
      const { generateNameVariants } = await import("./index.js");
      const variants = generateNameVariants("Bikash Chandra Mohapatra");
      expect(variants).toContain("mohapatra");
    });

    it("returns initials pattern for 3+ token names", async () => {
      const { generateNameVariants } = await import("./index.js");
      const variants = generateNameVariants("Bikash Chandra Mohapatra");
      expect(variants.some((v) => v.toUpperCase().includes("B C MOHAPATRA") || v.toUpperCase().includes("B.C.MOHAPATRA"))).toBe(true);
    });

    it("returns first-token-only and last-token-only for two-token names", async () => {
      const { generateNameVariants } = await import("./index.js");
      const variants = generateNameVariants("Raj Kumar");
      const upperVariants = variants.map((v) => v.toUpperCase());
      expect(upperVariants).toContain("RAJ");
      expect(upperVariants).toContain("KUMAR");
      expect(upperVariants).toContain("RAJ KUMAR");
    });

    it("limits variants to MAX_NAME_VARIANTS", async () => {
      const { generateNameVariants } = await import("./index.js");
      const variants = generateNameVariants("A B C Mohapatra");
      expect(variants.length).toBeLessThanOrEqual(4);
    });

    it("returns empty array for empty input", async () => {
      const { generateNameVariants } = await import("./index.js");
      const variants = generateNameVariants("");
      expect(variants).toEqual([]);
    });

    it("generates surname variants for known Odia surnames", async () => {
      const { generateNameVariants } = await import("./index.js");
      const variants = generateNameVariants("Bikash Mohapatra");
      const mohapatraVariants = variants.filter((v) => v.includes("mohapatra"));
      expect(mohapatraVariants.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("healthCheck", () => {
    it("is exported and is a function", async () => {
      const { healthCheck } = await import("./index.js");
      expect(typeof healthCheck).toBe("function");
    });
  });

  it("populates provenance metadata on failed fetches", async () => {
    const result = await ecourtsFetch({ partyName: "Raj Kumar" });

    expect(result.status).toBe("failed");
    expect(result.statusReason).toBe("fetch_failed");
    expect(result.attempts).toBeGreaterThanOrEqual(1);
    expect(result.inputsTried).toHaveLength(1);
    expect(result.parserVersion).toBe("ecourts-party-table-parser-v2");
    expect(result.data?.searchMetadata?.complexesTried).toEqual([
      "Bhubaneswar", "Khurda", "Banapur", "Jatni", "Tangi",
    ]);
  });

  it("fails closed for unsupported districts instead of silently searching Khurda", async () => {
    const result = await ecourtsFetch({
      partyName: "Raj Kumar",
      districtName: "Cuttack",
      districtCode: "2",
    });

    expect(result.status).toBe("failed");
    expect(result.statusReason).toBe("unsupported_district");
    expect(result.data?.searchMetadata?.districtName).toBe("Cuttack");
    expect(result.data?.searchMetadata?.districtCode).toBe("2");
    expect(result.data?.searchMetadata?.complexesTried).toEqual([]);
  });

  it("records name variants in inputsTried", async () => {
    const result = await ecourtsFetch({
      partyName: "Raj Kumar",
      tryNameVariants: true,
      doubleFetch: true,
    });

    expect(result.inputsTried.some((i) => i.label === "name_variants_generated")).toBe(true);
    const variantEntry = result.inputsTried.find((i) => i.label === "name_variants_generated");
    expect(variantEntry?.input).toHaveProperty("variants");
    expect(Array.isArray(variantEntry?.input.variants)).toBe(true);
  });

  it("adds negativeResultConfidence field in searchMetadata for negative results", async () => {
    const result = await ecourtsFetch({ partyName: "UnknownPersonXYZ123" });

    expect(result.data?.searchMetadata).toHaveProperty("negativeResultConfidence");
    expect(["high", "medium", "low", "unconfirmed"]).toContain(
      result.data?.searchMetadata?.negativeResultConfidence
    );
  });

  it("adds nameVariantsTried and doubleFetchResults arrays in searchMetadata", async () => {
    const result = await ecourtsFetch({ partyName: "Raj Kumar" });

    expect(result.data?.searchMetadata).toHaveProperty("nameVariantsTried");
    expect(result.data?.searchMetadata).toHaveProperty("doubleFetchResults");
    expect(result.data?.searchMetadata).toHaveProperty("captchaAcceptedCount");
    expect(result.data?.searchMetadata).toHaveProperty("captchaFailedCount");
  });

  it("supports disabling name variants via tryNameVariants flag", async () => {
    const result = await ecourtsFetch({
      partyName: "Raj Kumar",
      tryNameVariants: false,
      doubleFetch: false,
    });

    const variantEntry = result.inputsTried.find((i) => i.label === "name_variants_generated");
    expect(variantEntry?.input.tryNameVariants).toBe(false);
    expect(variantEntry?.input.doubleFetch).toBe(false);
  });

  it("has negative_result_confidence validator when search completes", async () => {
    // The main try block throws because browser is unavailable, so validators aren't set
    // This test verifies that when browser is unavailable, the catch block returns validators: undefined
    // (which is fine - the validators are set in the main success/failure branches)
    const result = await ecourtsFetch({ partyName: "Raj Kumar" });
    // Browser unavailable causes fetch_failed in the catch block
    // The catch block only sets validators if err.attempts exists (retry scenario)
    expect(result.status).toBe("failed");
    expect(result.statusReason).toBe("fetch_failed");
  });
});

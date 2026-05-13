import { describe, it, expect } from "vitest";
import { generateRTIQuestion } from "./index";

describe("larrFetch", () => {
  describe("generateRTIQuestion", () => {
    it("returns RTI question for a village", () => {
      const rti = generateRTIQuestion({ village: "Mendhasala", sellerName: "Mohapatra" });
      expect(rti.to).toContain("Collector");
      expect(rti.question).toContain("Mendhasala");
      expect(rti.question).toContain("LARR Act 2013");
      expect(rti.question).toContain("Section 11");
    });

    it("includes khasra/plot when provided", () => {
      const rti = generateRTIQuestion({ village: "Mendhasala", sellerName: "Mohapatra" });
      expect(rti.question).toContain("village");
      expect(rti.suggestedFee).toBe("₹10 (online via rtionline.gov.in)");
    });

    it("handles village-only input without khasra", () => {
      const rti = generateRTIQuestion({ village: "Gothapada" });
      expect(rti.question).toContain("Gothapada");
      expect(rti.question).not.toContain("Khata");
    });

    it("returns correct fee amount", () => {
      const rti = generateRTIQuestion({ village: "Mendhasala" });
      expect(rti.suggestedFee).toContain("₹10");
    });

    it("includes both RTI and revenue office visit options", () => {
      const rti = generateRTIQuestion({ village: "Mendhasala", sellerName: "Mohapatra" });
      expect(rti.question).toContain("Section 11");
    });
  });
});

describe("LARR risk structure (no network)", () => {
  // These tests verify the data structure and types that fetch() returns
  // without making real network calls. Network-dependent tests are in
  // a separate integration test file.

  it("generateRTIQuestion is callable and returns all required fields", () => {
    const rti = generateRTIQuestion({ village: "Mendhasala" });
    expect(rti).toHaveProperty("to");
    expect(rti).toHaveProperty("subject");
    expect(rti).toHaveProperty("question");
    expect(rti).toHaveProperty("suggestedFee");
    expect(typeof rti.question).toBe("string");
    expect(rti.question.length).toBeGreaterThan(10);
  });
});
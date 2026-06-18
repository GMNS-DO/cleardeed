// agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/dues.test.ts
import { describe, it, expect } from "vitest";
import { bhulekhDuesRules } from "../../../registry/bhulekh/dues";
import { runInsights } from "../../../engine";

const baseRor = { status: "verified" as const };

describe("bhulekh dues rules", () => {
  it("exports 3 rules", () => {
    expect(bhulekhDuesRules.length).toBe(3);
  });

  it("fires redFlag when revenue dues > 0 and older than 1 year", () => {
    const out = runInsights(bhulekhDuesRules, {
      ror: {
        ...baseRor,
        page1: { revenueDues: { amount: 1250, year: 2022, currentYear: 2026 } },
      },
    });
    expect(out.find((i) => i.severity === "redFlag")).toBeDefined();
  });

  it("fires watchout when revenue dues are present but year is unverified", () => {
    const out = runInsights(bhulekhDuesRules, {
      ror: {
        ...baseRor,
        page1: { revenueDues: { amount: 500, year: null } },
      },
    });
    expect(out.find((i) => i.severity === "watchout")).toBeDefined();
  });

  it("fires watchout when no dues field is readable", () => {
    const out = runInsights(bhulekhDuesRules, {
      ror: { ...baseRor, page1: {} },
    });
    expect(out.find((i) => i.severity === "watchout")).toBeDefined();
  });
});
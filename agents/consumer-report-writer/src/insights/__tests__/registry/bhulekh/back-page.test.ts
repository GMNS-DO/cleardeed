// agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/back-page.test.ts
import { describe, it, expect } from "vitest";
import { bhulekhBackPageRules } from "../../../registry/bhulekh/back-page";
import { runInsights } from "../../../engine";

const baseRor = { status: "verified" as const };

describe("bhulekh back-page rules", () => {
  it("exports 6 rules", () => {
    expect(bhulekhBackPageRules.length).toBe(6);
  });

  it("fires positive when mutation case references are found in RoR", () => {
    const out = runInsights(bhulekhBackPageRules, {
      ror: {
        ...baseRor,
        page2: { mutationReferences: ["M-2024-1234", "M-2023-0998"] },
      },
    });
    expect(out.find((i) => i.severity === "positive")).toBeDefined();
  });

  it("fires watchout when mutation count > 0 in last 12 months", () => {
    const out = runInsights(bhulekhBackPageRules, {
      ror: {
        ...baseRor,
        section6: { mutationCount: 3, months: 8 },
      },
    });
    expect(out.find((i) => i.severity === "watchout")).toBeDefined();
  });

  it("fires redFlag when mutation references contain Dakhal Kharaj", () => {
    const out = runInsights(bhulekhBackPageRules, {
      ror: {
        ...baseRor,
        page2: { mutationReferences: ["M-2024-0001 Dakhal Kharaj", "M-2023-0011"] },
      },
    });
    expect(out.find((i) => i.severity === "redFlag")).toBeDefined();
  });

  it("fires watchout when mutation references have no linked khatiyan", () => {
    const out = runInsights(bhulekhBackPageRules, {
      ror: {
        ...baseRor,
        page2: { mutationReferences: ["M-2024-0001"] },
      },
    });
    expect(out.find((i) => i.severity === "watchout" && i.body.includes("khatiyan"))).toBeDefined();
  });

  it("fires redFlag when encumbrance-style entries (Bond / Sairat) are found", () => {
    const out = runInsights(bhulekhBackPageRules, {
      ror: {
        ...baseRor,
        page2: { encumbrances: [{ type: "Bond", docNo: "B-2024-77" }] },
      },
    });
    expect(out.find((i) => i.severity === "redFlag")).toBeDefined();
  });

  it("fires watchout when RoR status is parser_uncertain (page 2 not readable)", () => {
    const out = runInsights(bhulekhBackPageRules, {
      ror: { status: "parser_uncertain", page2: { unreadable: true } },
    });
    expect(out.find((i) => i.severity === "watchout")).toBeDefined();
  });
});
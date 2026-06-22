// agents/consumer-report-writer/src/insights/__tests__/registry/recursive/area-cross.test.ts
import { describe, it, expect } from "vitest";
import { areaCrossRules } from "../../../registry/recursive/area-cross";
import { runInsights } from "../../../engine";

const baseRor = {
  status: "verified" as const,
  page1: { owner: "Rama" },
};

describe("recursive area-cross rules (V1.5)", () => {
  it("exports 2 rules", () => {
    expect(areaCrossRules.length).toBe(2);
  });

  // ROR-INS-078
  it("ROR-INS-078 — fires watchout when acres vs hectares disagree > 5%", () => {
    const out = runInsights(areaCrossRules, {
      ror: {
        ...baseRor,
        page2: {
          plots: [
            { plotNo: "415", areaAcres: 0.10, areaHectares: 0.10 /* expect ~0.0405 ha */ },
          ],
        },
      },
    });
    const r = out.find((i) => i.ruleId === "ROR-INS-078");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("watchout");
  });

  it("ROR-INS-078 — does NOT fire when acres and hectares are internally consistent", () => {
    const out = runInsights(areaCrossRules, {
      ror: {
        ...baseRor,
        page2: {
          plots: [
            { plotNo: "415", areaAcres: 0.10, areaHectares: 0.10 / 2.4710538147 },
          ],
        },
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-078")).toBeUndefined();
  });

  it("ROR-INS-078 — does NOT fire when only one of the two fields is present", () => {
    const out = runInsights(areaCrossRules, {
      ror: {
        ...baseRor,
        page2: { plots: [{ plotNo: "415", areaAcres: 0.10 }] },
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-078")).toBeUndefined();
  });

  // ROR-INS-079
  it("ROR-INS-079 — fires watchout when Bhunaksha polygon area vs Bhulekh area differ > 15%", () => {
    const out = runInsights(areaCrossRules, {
      ror: {
        ...baseRor,
        plotTable: {
          targetRow: { area: 0.10 },
          rows: [{ area: 0.10 }],
          totals: null,
        },
      },
      bhunaksha: { status: "verified", area: 0.001 /* ~0.247 ac vs 0.10 ac → 147% drift */ },
    });
    const r = out.find((i) => i.ruleId === "ROR-INS-079");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("redFlag"); // drift > 30% → redFlag
  });

  it("ROR-INS-079 — fires watchout (not redFlag) at 16–30% drift", () => {
    const out = runInsights(areaCrossRules, {
      ror: {
        ...baseRor,
        plotTable: { targetRow: { area: 1.0 }, rows: [{ area: 1.0 }], totals: null },
      },
      // 1.0 ac → 0.00405 km²; target ~20% larger polygon
      bhunaksha: { status: "verified", area: 0.00486 },
    });
    const r = out.find((i) => i.ruleId === "ROR-INS-079");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("watchout");
  });

  it("ROR-INS-079 — does NOT fire when Bhunaksha is missing", () => {
    const out = runInsights(areaCrossRules, {
      ror: {
        ...baseRor,
        plotTable: { targetRow: { area: 0.10 }, rows: [{ area: 0.10 }], totals: null },
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-079")).toBeUndefined();
  });

  it("ROR-INS-079 — does NOT fire on small (<15%) drift", () => {
    const out = runInsights(areaCrossRules, {
      ror: {
        ...baseRor,
        plotTable: { targetRow: { area: 1.0 }, rows: [{ area: 1.0 }], totals: null },
      },
      bhunaksha: { status: "verified", area: 0.00405 * 1.10 /* +10% drift */ },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-079")).toBeUndefined();
  });

  it("emits nothing when ror is missing", () => {
    expect(runInsights(areaCrossRules, {}).length).toBe(0);
  });
});
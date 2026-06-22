// agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/land-misc.test.ts
import { describe, it, expect } from "vitest";
import { bhulekhLandMiscRules } from "../../../registry/bhulekh/land-misc";
import { runInsights } from "../../../engine";

const baseRor = { status: "verified" as const, page1: { owner: "Rama" } };

describe("bhulekh land-misc rules (V1.5)", () => {
  it("exports 9 rules", () => {
    expect(bhulekhLandMiscRules.length).toBe(9);
  });

  // ROR-INS-077
  it("ROR-INS-077 — fires redFlag when ଧାରା 6 is in plot remarks", () => {
    const out = runInsights(bhulekhLandMiscRules, {
      ror: {
        ...baseRor,
        page2: {
          plots: [
            { plotNo: "415", remarksOdia: "ଧାରା 6 ସରକାରୀ ଜମି" },
          ],
        },
      },
    });
    const r = out.find((i) => i.ruleId === "ROR-INS-077");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("redFlag");
  });

  it("ROR-INS-077 — fires on English Section 6 marker", () => {
    const out = runInsights(bhulekhLandMiscRules, {
      ror: {
        ...baseRor,
        page2: { plots: [{ plotNo: "415", remarksOdia: "Section 6 Govt. Land encroachment" }] },
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-077")).toBeDefined();
  });

  it("ROR-INS-077 — does NOT fire when remarks are clean", () => {
    const out = runInsights(bhulekhLandMiscRules, {
      ror: {
        ...baseRor,
        page2: { plots: [{ plotNo: "415", remarksOdia: "ସୀମାନ୍ତ ରାସ୍ତା" }] },
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-077")).toBeUndefined();
  });

  // ROR-INS-081
  it("ROR-INS-081 — fires watchout when chauhaddi identical on all 4 sides", () => {
    const out = runInsights(bhulekhLandMiscRules, {
      ror: {
        ...baseRor,
        chauhaddiByPlot: {
          "415": { north: "Road", south: "Road", east: "Road", west: "Road" },
        },
      },
    });
    const r = out.find((i) => i.ruleId === "ROR-INS-081");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("watchout");
  });

  it("ROR-INS-081 — does NOT fire when chauhaddi is realistic", () => {
    const out = runInsights(bhulekhLandMiscRules, {
      ror: {
        ...baseRor,
        chauhaddiByPlot: {
          "415": { north: "Road", south: "Plot 416", east: "Plot 297", west: "Plot 414" },
        },
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-081")).toBeUndefined();
  });

  // ROR-INS-082
  it("ROR-INS-082 — fires watchout when all plot rows have area = 0 or null", () => {
    const out = runInsights(bhulekhLandMiscRules, {
      ror: {
        ...baseRor,
        page2: { plots: [{ plotNo: "415", area: 0 }, { plotNo: "416", area: null }] },
      },
    });
    const r = out.find((i) => i.ruleId === "ROR-INS-082");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("watchout");
  });

  it("ROR-INS-082 — does NOT fire when at least one plot row has area", () => {
    const out = runInsights(bhulekhLandMiscRules, {
      ror: {
        ...baseRor,
        page2: { plots: [{ plotNo: "415", area: 0 }, { plotNo: "416", area: 0.05 }] },
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-082")).toBeUndefined();
  });

  it("emits nothing when ror is missing", () => {
    expect(runInsights(bhulekhLandMiscRules, {}).length).toBe(0);
  });

  // ROR-INS-045 — Area unit cross-check.
  it("ROR-INS-045 — fires watchout when hectares disagree with acres by >5%", () => {
    const out = runInsights(bhulekhLandMiscRules, {
      ror: {
        ...baseRor,
        plotTable: {
          ...baseRor.plotTable,
          rows: [
            { plotNo: "309", areaAcres: 0.5, areaHectares: 0.05 }, // 0.5 ac = 0.202 ha, but row says 0.05
          ],
        },
      },
    });
    const r = out.find((i) => i.ruleId === "ROR-INS-045");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("watchout");
  });

  it("ROR-INS-045 — fires watchout when acres+decimals disagree with hectares by >5%", () => {
    // acres=0 + decimals=1050 = 0.1050 acre; correct hectares = 0.1050/2.47105 ≈ 0.0425
    // If the row says 0.5 ha, that's a 1100%+ mismatch.
    const out = runInsights(bhulekhLandMiscRules, {
      ror: {
        ...baseRor,
        plotTable: {
          ...baseRor.plotTable,
          rows: [
            { plotNo: "309", areaAcres: 0, areaDecimals: 1050, areaHectares: 0.5 },
          ],
        },
      },
    });
    const r = out.find((i) => i.ruleId === "ROR-INS-045");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("watchout");
  });

  it("ROR-INS-045 — does NOT fire when units reconcile within tolerance", () => {
    // 0.1050 acre (acres=0 + decimals=1050) = 0.1050/2.47105 ≈ 0.04249 ha
    const out = runInsights(bhulekhLandMiscRules, {
      ror: {
        ...baseRor,
        plotTable: {
          ...baseRor.plotTable,
          rows: [
            { plotNo: "309", areaAcres: 0, areaDecimals: 1050, areaHectares: 0.04249 },
          ],
        },
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-045")).toBeUndefined();
  });

  it("ROR-INS-045 — does NOT fire when only one unit is present (cannot cross-check)", () => {
    const out = runInsights(bhulekhLandMiscRules, {
      ror: {
        ...baseRor,
        plotTable: {
          ...baseRor.plotTable,
          rows: [{ plotNo: "309", areaAcres: 0.5 }],
        },
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-045")).toBeUndefined();
  });

  // V1.2 — Section-6 rules (ROR-INS-051..055)
  it("ROR-INS-051 — fires redFlag when ror.section6.present is true", () => {
    const out = runInsights(bhulekhLandMiscRules, {
      ror: { ...baseRor, section6: { present: true, referenceCount: 1 } },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-051")).toBeDefined();
  });

  it("ROR-INS-052 — fires when Section-6 area > 2 acres", () => {
    const out = runInsights(bhulekhLandMiscRules, {
      ror: { ...baseRor, section6: { present: true, areaAcres: 5, referenceCount: 1 } },
    });
    const r = out.find((i) => i.ruleId === "ROR-INS-052");
    expect(r).toBeDefined();
    expect(r?.headline).toContain("5");
  });

  it("ROR-INS-052 — does NOT fire when Section-6 area <= 2 acres", () => {
    const out = runInsights(bhulekhLandMiscRules, {
      ror: { ...baseRor, section6: { present: true, areaAcres: 1.5, referenceCount: 1 } },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-052")).toBeUndefined();
  });

  it("ROR-INS-053 — fires when owner name contains government wording", () => {
    const out = runInsights(bhulekhLandMiscRules, {
      ror: {
        ...baseRor,
        page1: { owner: "Govt of Odisha" },
        section6: { present: true, referenceCount: 1 },
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-053")).toBeDefined();
  });

  it("ROR-INS-054 — fires when Section-6 referenceCount > 1", () => {
    const out = runInsights(bhulekhLandMiscRules, {
      ror: { ...baseRor, section6: { present: true, referenceCount: 3 } },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-054")).toBeDefined();
  });

  it("ROR-INS-055 — fires when Section-6 raw text names Govt of Odisha", () => {
    const out = runInsights(bhulekhLandMiscRules, {
      ror: {
        ...baseRor,
        section6: {
          present: true,
          referenceCount: 1,
          rawTextOdia: "ଧାରା 6 ଓଡିଶା ସରକାର ଜମି",
        },
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-055")).toBeDefined();
  });
});
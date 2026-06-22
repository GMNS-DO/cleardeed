// agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/bda-layout.test.ts
//
// T-052 — BDA layout approval sub-plot detector (Pattern 5 cover).
//
// ROR-INS-152 fires a redFlag when the RoR plot number carries a
// sub-plot indicator: slash-suffix (415/1), alpha-prefix (D/88),
// alphanumeric-suffix (88A), or hyphen-suffix (415-A).

import { describe, it, expect } from "vitest";
import { bhulekhBdaLayoutRules } from "../../../registry/bhulekh/bda-layout";
import { runInsights } from "../../../engine";

const baseRor = {
  status: "verified" as const,
  plotTable: {
    targetPlotNo: "415",
    targetRow: { plotNo: "415" },
    rows: [{ plotNo: "415" }],
  },
};

describe("bhulekh bda-layout rules (ROR-INS-152 sub-plot indicator)", () => {
  it("exports exactly 1 rule", () => {
    expect(bhulekhBdaLayoutRules.length).toBe(1);
    expect(bhulekhBdaLayoutRules[0].id).toBe("ROR-INS-152");
  });

  it("fires redFlag for slash-suffix sub-plot (415/1)", () => {
    const out = runInsights(bhulekhBdaLayoutRules, {
      ror: {
        ...baseRor,
        plotTable: {
          ...baseRor.plotTable,
          targetPlotNo: "415/1",
          targetRow: { plotNo: "415/1" },
        },
      },
    });
    const r152 = out.find((i) => i.ruleId === "ROR-INS-152");
    expect(r152).toBeDefined();
    expect(r152?.severity).toBe("redFlag");
  });

  it("fires redFlag for alpha-prefix sub-plot (D/88)", () => {
    const out = runInsights(bhulekhBdaLayoutRules, {
      ror: {
        ...baseRor,
        plotTable: {
          ...baseRor.plotTable,
          targetPlotNo: "D/88",
          targetRow: { plotNo: "D/88" },
        },
      },
    });
    const r152 = out.find((i) => i.ruleId === "ROR-INS-152");
    expect(r152).toBeDefined();
    expect(r152?.severity).toBe("redFlag");
  });

  it("fires redFlag for alphanumeric-suffix (88A)", () => {
    const out = runInsights(bhulekhBdaLayoutRules, {
      ror: {
        ...baseRor,
        plotTable: {
          ...baseRor.plotTable,
          targetPlotNo: "88A",
          targetRow: { plotNo: "88A" },
        },
      },
    });
    const r152 = out.find((i) => i.ruleId === "ROR-INS-152");
    expect(r152).toBeDefined();
  });

  it("fires redFlag for hyphen-suffix (415-A)", () => {
    const out = runInsights(bhulekhBdaLayoutRules, {
      ror: {
        ...baseRor,
        plotTable: {
          ...baseRor.plotTable,
          targetPlotNo: "415-A",
          targetRow: { plotNo: "415-A" },
        },
      },
    });
    const r152 = out.find((i) => i.ruleId === "ROR-INS-152");
    expect(r152).toBeDefined();
  });

  it("does NOT fire for pure-number plot (415)", () => {
    const out = runInsights(bhulekhBdaLayoutRules, { ror: baseRor });
    expect(out.find((i) => i.ruleId === "ROR-INS-152")).toBeUndefined();
  });

  it("does NOT fire for plot 128 (Bhunaksha plot, no suffix)", () => {
    const out = runInsights(bhulekhBdaLayoutRules, {
      ror: {
        ...baseRor,
        plotTable: {
          ...baseRor.plotTable,
          targetPlotNo: "128",
          targetRow: { plotNo: "128" },
        },
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-152")).toBeUndefined();
  });

  it("does NOT fire when RoR is not verified", () => {
    const out = runInsights(bhulekhBdaLayoutRules, {
      ror: { ...baseRor, status: "partial", plotTable: { targetPlotNo: "415/1" } },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-152")).toBeUndefined();
  });

  it("falls back to geoFetch.plotNo when target row is absent", () => {
    const out = runInsights(bhulekhBdaLayoutRules, {
      ror: { status: "verified", plotTable: { targetPlotNo: "309/4-A" } },
      geoFetch: { plotNo: "309/4-A" } as any,
    });
    const r152 = out.find((i) => i.ruleId === "ROR-INS-152");
    expect(r152).toBeDefined();
  });

  it("includes BDA manual-verification pointer in disclosure", () => {
    const out = runInsights(bhulekhBdaLayoutRules, {
      ror: {
        ...baseRor,
        plotTable: {
          ...baseRor.plotTable,
          targetPlotNo: "415/1",
          targetRow: { plotNo: "415/1" },
        },
      },
    });
    const r152 = out.find((i) => i.ruleId === "ROR-INS-152");
    expect(r152?.disclosure?.howToVerify.toLowerCase()).toContain("bda");
  });
});

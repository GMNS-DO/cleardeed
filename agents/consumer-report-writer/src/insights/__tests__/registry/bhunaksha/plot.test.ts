// agents/consumer-report-writer/src/insights/__tests__/registry/bhunaksha/plot.test.ts
import { describe, it, expect } from "vitest";
import { bhunakshaPlotRules } from "../../../registry/bhunaksha/plot";
import { runInsights } from "../../../engine";

// Verified Bhunaksha input: 1.0 sq_km, plot 415, village Mendhasala
const verifiedBhunaksha = {
  status: "success",
  data: {
    plotNo: "415",
    village: "Mendhasala",
    tahasil: "Bhubaneswar",
    area: 1.0,
    areaUnit: "sq_km",
  },
};

describe("bhunaksha plot rules", () => {
  it("exports 5 rules", () => {
    expect(bhunakshaPlotRules.length).toBe(5);
  });

  it("fires redFlag when Bhunaksha area differs from RoR area by > 5%", () => {
    // Bhunaksha area is 1.0 sq_km; RoR area is 0.5 acres (~0.002 sq_km).
    // That's a massive drift > 5% — ROR-INS-070 should fire.
    const out = runInsights(bhunakshaPlotRules, {
      bhunaksha: verifiedBhunaksha,
      ror: { status: "verified", page2: { area: 0.5 } },
    });
    const redFlag = out.find(
      (i) => i.severity === "redFlag" && i.ruleId === "ROR-INS-070"
    );
    expect(redFlag).toBeDefined();
    expect(redFlag!.panel).toBe("plot");
  });

  it("fires watchout when Bhunaksha page returns ---NO DATA---", () => {
    const out = runInsights(bhunakshaPlotRules, {
      bhunaksha: { ...verifiedBhunaksha, pageText: "---NO DATA---" },
    });
    const w = out.find(
      (i) => i.severity === "watchout" && i.ruleId === "ROR-INS-071"
    );
    expect(w).toBeDefined();
    expect(w!.issueLens).toBe("parser_source_quality");
  });

  it("fires watchout when Bhunaksha plot number differs from RoR plot number", () => {
    const out = runInsights(bhunakshaPlotRules, {
      bhunaksha: verifiedBhunaksha, // plot 415
      ror: { status: "verified", page2: { plotNumber: "309" } },
    });
    const w = out.find(
      (i) => i.severity === "watchout" && i.ruleId === "ROR-INS-072"
    );
    expect(w).toBeDefined();
    expect(w!.issueLens).toBe("title_chain");
  });

  it("fires watchout when Bhunaksha data is missing entirely", () => {
    // No bhunaksha at all in input → ROR-INS-073 missing_source watchout.
    const out = runInsights(bhunakshaPlotRules, {
      ror: { status: "verified", page1: { khatiyanNumber: "830" } },
    });
    const w = out.find(
      (i) => i.severity === "watchout" && i.ruleId === "ROR-INS-073"
    );
    expect(w).toBeDefined();
    expect(w!.issueLens).toBe("parser_source_quality");
  });

  it("emits nothing for matching-area, matching-plot, data-present happy path", () => {
    // 0.00405 sq_km ≈ 1 acre. RoR area 1.0 acres. Difference is within 5%.
    const out = runInsights(bhunakshaPlotRules, {
      bhunaksha: { ...verifiedBhunaksha, data: { ...verifiedBhunaksha.data, area: 0.00405 } },
      ror: { status: "verified", page2: { area: 1.0, plotNumber: "415" } },
    });
    // ROR-INS-070 (area mismatch) and ROR-INS-072 (plot mismatch) should not fire.
    expect(out.find((i) => i.ruleId === "ROR-INS-070")).toBeUndefined();
    expect(out.find((i) => i.ruleId === "ROR-INS-072")).toBeUndefined();
    expect(out.find((i) => i.ruleId === "ROR-INS-071")).toBeUndefined();
    expect(out.find((i) => i.ruleId === "ROR-INS-073")).toBeUndefined();
    expect(out.find((i) => i.ruleId === "ROR-INS-094")).toBeUndefined();
  });

  // Phase 8 / Task 36 — ROR-INS-094 positive signal
  it("fires positive signal (ROR-INS-094) when plotDiagram.status === 'success' with a url", () => {
    const out = runInsights(bhunakshaPlotRules, {
      bhunaksha: verifiedBhunaksha,
      plotDiagram: {
        status: "success",
        url: "https://example.supabase.co/storage/v1/object/sign/plot-diagrams/abc123.svg",
        cacheHit: false,
      },
    });
    const pos = out.find((i) => i.severity === "positive" && i.ruleId === "ROR-INS-094");
    expect(pos).toBeDefined();
    expect(pos!.panel).toBe("plot");
    expect(pos!.issueLens).toBe("revenue_record");
    expect(pos!.evidenceStrength).toBe("selected_plot_anchor");
    expect(pos!.headline.toLowerCase()).toContain("plot diagram");
  });

  it("fires ROR-INS-094 also when plotDiagram.status === 'partial' (still has a url)", () => {
    const out = runInsights(bhunakshaPlotRules, {
      bhunaksha: verifiedBhunaksha,
      plotDiagram: {
        status: "partial",
        url: "https://example.supabase.co/storage/v1/object/sign/plot-diagrams/abc123.svg",
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-094")).toBeDefined();
  });

  it("does NOT fire ROR-INS-094 when plotDiagram.status === 'failed'", () => {
    const out = runInsights(bhunakshaPlotRules, {
      bhunaksha: verifiedBhunaksha,
      plotDiagram: { status: "failed", url: null, reason: "WFS compose returned empty polygon set" },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-094")).toBeUndefined();
  });

  it("does NOT fire ROR-INS-094 when plotDiagram is null or absent", () => {
    const out = runInsights(bhunakshaPlotRules, {
      bhunaksha: verifiedBhunaksha,
      plotDiagram: undefined,
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-094")).toBeUndefined();
  });

  it("does NOT fire ROR-INS-094 when plotDiagram.url is empty string", () => {
    const out = runInsights(bhunakshaPlotRules, {
      bhunaksha: verifiedBhunaksha,
      plotDiagram: { status: "success", url: "" },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-094")).toBeUndefined();
  });
});

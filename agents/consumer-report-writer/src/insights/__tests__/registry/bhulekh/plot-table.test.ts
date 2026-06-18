// agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/plot-table.test.ts
import { describe, it, expect } from "vitest";
import { bhulekhPlotTableRules } from "../../../registry/bhulekh/plot-table";
import { runInsights } from "../../../engine";

const baseRor = { status: "verified" as const };

describe("bhulekh plot-table rules", () => {
  it("exports 5 rules", () => {
    expect(bhulekhPlotTableRules.length).toBe(5);
  });

  it("fires watchout when plot number has a sub-plot indicator (e.g. '415/1')", () => {
    const out = runInsights(bhulekhPlotTableRules, {
      ror: { ...baseRor, page2: { selectedPlotNumber: "415/1" } },
    });
    expect(out.find((i) => i.severity === "watchout")).toBeDefined();
  });

  it("fires watchout when a plot row has no kisam recorded", () => {
    const out = runInsights(bhulekhPlotTableRules, {
      ror: {
        ...baseRor,
        page2: { plots: [{ plotNumber: "415", area: "0.75 ac" }] },
      },
    });
    expect(out.find((i) => i.severity === "watchout")).toBeDefined();
  });

  it("fires watchout when a plot row has no area", () => {
    const out = runInsights(bhulekhPlotTableRules, {
      ror: {
        ...baseRor,
        page2: { plots: [{ plotNumber: "415", kisam: "gharabari" }] },
      },
    });
    expect(out.find((i) => i.severity === "watchout")).toBeDefined();
  });

  it("fires watchout when all plots in khatiyan are government kisam", () => {
    const out = runInsights(bhulekhPlotTableRules, {
      ror: {
        ...baseRor,
        page2: {
          plots: [
            { plotNumber: "415", kisam: "forest", area: "0.5 ac" },
            { plotNumber: "416", kisam: "jungle", area: "0.5 ac" },
          ],
        },
      },
    });
    expect(out.find((i) => i.body.toLowerCase().includes("government"))).toBeDefined();
  });

  it("fires watchout when the plot table is empty", () => {
    const out = runInsights(bhulekhPlotTableRules, {
      ror: { ...baseRor, page2: { plots: [] } },
    });
    expect(out.find((i) => i.severity === "watchout")).toBeDefined();
  });
});
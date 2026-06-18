// agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/plot.test.ts
import { describe, it, expect } from "vitest";
import { bhulekhPlotRules } from "../../../registry/bhulekh/plot";
import { runInsights } from "../../../engine";

const verifiedRor = {
  status: "verified",
  page1: {
    khatiyanNumber: "830",
    owner: "Rama Mohanty",
    landTypeOdia: "ଦଣ୍ଡା",
  },
  page2: {
    selectedPlotFound: true,
    plots: [{ plotNumber: "415", area: "0.75 ac" }],
  },
  section6: { mutationCount: 2 },
};

const input = { ror: verifiedRor };

describe("bhulekh plot rules", () => {
  it("exports 7 rules", () => {
    expect(bhulekhPlotRules.length).toBe(7);
  });

  it("fires positive signal when selected plot found", () => {
    const out = runInsights(bhulekhPlotRules, input);
    const positive = out.find((i) => i.severity === "positive");
    expect(positive).toBeDefined();
    expect(positive!.panel).toBe("plot");
  });

  it("fires watchout when selected plot not in page2", () => {
    const out = runInsights(bhulekhPlotRules, {
      ror: { ...verifiedRor, page2: { selectedPlotFound: false, plots: [] } },
    });
    expect(out.find((i) => i.body.includes("not present in the RoR plot list"))).toBeDefined();
  });

  it("fires watchout when mutation count > 5 in 24 months", () => {
    const out = runInsights(bhulekhPlotRules, {
      ror: { ...verifiedRor, section6: { mutationCount: 7, months: 18 } },
    });
    expect(out.find((i) => i.body.includes("7 mutations in 18 months"))).toBeDefined();
  });

  it("emits nothing when ror is missing", () => {
    expect(runInsights(bhulekhPlotRules, {}).length).toBe(0);
  });
});

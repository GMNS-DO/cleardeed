// agents/consumer-report-writer/src/insights/__tests__/registry/bhuvan-flood/flood.test.ts
import { describe, it, expect } from "vitest";
import { bhuvanFloodRules } from "../../../registry/bhuvan-flood/flood";
import { runInsights } from "../../../engine";

const layersProbed = ["flood", "or_cyclone", "inundation"];

describe("bhuvan-flood rules", () => {
  it("exports 2 rules", () => {
    expect(bhuvanFloodRules.length).toBe(2);
  });

  it("fires watchout for medium-frequency zones", () => {
    const out = runInsights(bhuvanFloodRules, {
      bhuvanFloodData: {
        floodFrequency: "medium",
        layersProbed,
        getFeatureInfoBlocked: false,
        tileBytes: 12345,
        dataSource: "bhuvan-ras2.nrsc.gov.in",
      },
    });
    const insight = out.find((i) => i.ruleId === "ROR-INS-200");
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe("watchout");
    expect(insight!.panel).toBe("land");
    expect(insight!.headline).toMatch(/medium-frequency/);
    // layer note must be appended
    expect(insight!.body).toContain("flood");
  });

  it("fires watchout for high-frequency zones", () => {
    const out = runInsights(bhuvanFloodRules, {
      bhuvanFloodData: {
        floodFrequency: "high",
        layersProbed,
        getFeatureInfoBlocked: false,
        tileBytes: 12345,
        dataSource: "bhuvan-ras2.nrsc.gov.in",
      },
    });
    const insight = out.find((i) => i.ruleId === "ROR-INS-200");
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe("watchout");
    expect(insight!.headline).toMatch(/high-frequency/);
  });

  it("fires redFlag for very-high-frequency zones", () => {
    const out = runInsights(bhuvanFloodRules, {
      bhuvanFloodData: {
        floodFrequency: "very_high",
        layersProbed,
        getFeatureInfoBlocked: false,
        tileBytes: 12345,
        dataSource: "bhuvan-ras2.nrsc.gov.in",
      },
    });
    const insight = out.find((i) => i.ruleId === "ROR-INS-200");
    expect(insight).toBeDefined();
    expect(insight!.severity).toBe("redFlag");
  });

  it("does NOT fire ROR-INS-200 for none or low frequency", () => {
    for (const freq of ["none", "low"]) {
      const out = runInsights(bhuvanFloodRules, {
        bhuvanFloodData: {
          floodFrequency: freq,
          layersProbed,
          getFeatureInfoBlocked: false,
          tileBytes: 12345,
          dataSource: "bhuvan-ras2.nrsc.gov.in",
        },
      });
      expect(out.find((i) => i.ruleId === "ROR-INS-200")).toBeUndefined();
    }
  });

  it("fires manual card when bhuvanFloodData is absent", () => {
    const out = runInsights(bhuvanFloodRules, {});
    const card = out.find((i) => i.ruleId === "ROR-INS-201");
    expect(card).toBeDefined();
    expect(card!.panel).toBe("land");
    expect(card!.severity).toBe("watchout");
    expect(card!.body).toContain("Bhuvan");
  });

  it("fires manual card when GetFeatureInfo is blocked", () => {
    const out = runInsights(bhuvanFloodRules, {
      bhuvanFloodData: {
        floodFrequency: "unknown",
        layersProbed,
        getFeatureInfoBlocked: true,
        tileBytes: 12345,
        dataSource: "bhuvan-ras2.nrsc.gov.in",
      },
    });
    const card = out.find((i) => i.ruleId === "ROR-INS-201");
    expect(card).toBeDefined();
    expect(card!.body).toMatch(/GetFeatureInfo|flood raster/);
  });

  it("does NOT fire manual card when frequency is concrete and not blocked", () => {
    const out = runInsights(bhuvanFloodRules, {
      bhuvanFloodData: {
        floodFrequency: "low",
        layersProbed,
        getFeatureInfoBlocked: false,
        tileBytes: 12345,
        dataSource: "bhuvan-ras2.nrsc.gov.in",
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-201")).toBeUndefined();
  });

  it("manual card copy must mention NRSC licensing posture", () => {
    const out = runInsights(bhuvanFloodRules, {});
    const card = out.find((i) => i.ruleId === "ROR-INS-201");
    expect(card!.actionItem).toContain("NRSC");
  });
});
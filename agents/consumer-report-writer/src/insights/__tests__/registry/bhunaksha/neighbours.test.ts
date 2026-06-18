// agents/consumer-report-writer/src/insights/__tests__/registry/bhunaksha/neighbours.test.ts
import { describe, it, expect } from "vitest";
import { bhunakshaNeighboursRules } from "../../../registry/bhunaksha/neighbours";
import { runInsights } from "../../../engine";

// UP-006 chain-walk output stub: when neighbours is implemented, the engine
// should populate `chainWalkCompleted: true` on the bhunaksha block.
const baseBhunaksha = {
  status: "success",
  data: {
    plotNo: "415",
    village: "Mendhasala",
    tahasil: "Bhubaneswar",
    area: 0.00405,
    areaUnit: "sq_km",
  },
};

describe("bhunaksha neighbours rules", () => {
  it("exports 4 rules", () => {
    expect(bhunakshaNeighboursRules.length).toBe(4);
  });

  it("fires positive for chain-walk completion (stub-friendly)", () => {
    // Once UP-006 lands, the engine will set chainWalkCompleted. Until then the
    // rule is a stub — but it must still emit a positive insight when the
    // chainWalkCompleted flag is set on the bhunaksha block.
    const out = runInsights(bhunakshaNeighboursRules, {
      bhunaksha: { ...baseBhunaksha, chainWalkCompleted: true },
    });
    const positive = out.find(
      (i) => i.severity === "positive" && i.ruleId === "ROR-INS-090"
    );
    expect(positive).toBeDefined();
    expect(positive!.panel).toBe("neighbours");
  });

  it("fires watchout for adjacent-plot mismatch (stub-friendly)", () => {
    // Until UP-006 lands, surface as parser_uncertain stub.
    const out = runInsights(bhunakshaNeighboursRules, {
      bhunaksha: { ...baseBhunaksha, adjacentPlotMismatch: true },
    });
    const w = out.find(
      (i) => i.severity === "watchout" && i.ruleId === "ROR-INS-091"
    );
    expect(w).toBeDefined();
    expect(w!.panel).toBe("neighbours");
  });

  it("fires positive when surrounded by consistent private records", () => {
    const out = runInsights(bhunakshaNeighboursRules, {
      bhunaksha: {
        ...baseBhunaksha,
        neighbours: [
          { plotNumber: "412", type: "private", landClass: "agricultural" },
          { plotNumber: "416", type: "private", landClass: "agricultural" },
          { plotNumber: "418", type: "private", landClass: "agricultural" },
          { plotNumber: "414", type: "private", landClass: "agricultural" },
        ],
      },
    });
    const positive = out.find(
      (i) => i.severity === "positive" && i.ruleId === "ROR-INS-092"
    );
    expect(positive).toBeDefined();
    expect(positive!.panel).toBe("neighbours");
  });

  it("fires watchout when no adjacent plots are identifiable", () => {
    const out = runInsights(bhunakshaNeighboursRules, {
      bhunaksha: {
        ...baseBhunaksha,
        neighbours: [],
      },
    });
    const w = out.find(
      (i) => i.severity === "watchout" && i.ruleId === "ROR-INS-093"
    );
    expect(w).toBeDefined();
    expect(w!.panel).toBe("neighbours");
  });
});

// agents/consumer-report-writer/src/insights/__tests__/registry/bhunaksha/road-access.test.ts
import { describe, it, expect } from "vitest";
import { bhunakshaRoadAccessRules } from "../../../registry/bhunaksha/road-access";
import { runInsights } from "../../../engine";

const baseBhunaksha = {
  status: "success",
  data: {
    plotNo: "415",
    village: "Mendhasala",
    tahasil: "Bhubaneswar",
    area: 0.00405,
    areaUnit: "sq_km",
    chauhaddi: {
      north: { type: "road", label: "20-ft Danga" },
      south: { type: "private", plotNumber: "412" },
      east: { type: "private", plotNumber: "416" },
      west: { type: "private", plotNumber: "414" },
    },
  },
};

describe("bhunaksha road-access rules", () => {
  it("exports 4 rules", () => {
    expect(bhunakshaRoadAccessRules.length).toBe(4);
  });

  it("fires redFlag when no adjacent road is identified", () => {
    // No road/rasta/danga on any side.
    const out = runInsights(bhunakshaRoadAccessRules, {
      bhunaksha: {
        ...baseBhunaksha,
        data: {
          ...baseBhunaksha.data,
          chauhaddi: {
            north: { type: "private", plotNumber: "412" },
            south: { type: "private", plotNumber: "418" },
            east: { type: "private", plotNumber: "416" },
            west: { type: "private", plotNumber: "414" },
          },
        },
      },
    });
    const redFlag = out.find(
      (i) => i.severity === "redFlag" && i.ruleId === "ROR-INS-080"
    );
    expect(redFlag).toBeDefined();
    expect(redFlag!.panel).toBe("roadAccess");
  });

  it("fires watchout when plot is bounded entirely by KHA / government land", () => {
    const out = runInsights(bhunakshaRoadAccessRules, {
      bhunaksha: {
        ...baseBhunaksha,
        data: {
          ...baseBhunaksha.data,
          chauhaddi: {
            north: { type: "kha", label: "KHA Plot 1" },
            south: { type: "kha", label: "KHA Plot 2" },
            east: { type: "kha", label: "KHA Plot 3" },
            west: { type: "kha", label: "KHA Plot 4" },
          },
        },
      },
    });
    const w = out.find(
      (i) => i.severity === "watchout" && i.ruleId === "ROR-INS-081"
    );
    expect(w).toBeDefined();
    expect(w!.panel).toBe("roadAccess");
  });

  it("fires positive when Chauhaddi mentions a road on at least one side", () => {
    const out = runInsights(bhunakshaRoadAccessRules, {
      bhunaksha: baseBhunaksha,
    });
    const positive = out.find(
      (i) => i.severity === "positive" && i.ruleId === "ROR-INS-082"
    );
    expect(positive).toBeDefined();
    expect(positive!.panel).toBe("roadAccess");
  });

  // HIGH #5 regression: split ROR-INS-080 (real redFlag) from ROR-INS-083
  // (parser_uncertain stub when chauhaddi is missing).
  it("fires ROR-INS-083 watchout when chauhaddi data is missing entirely", () => {
    const out = runInsights(bhunakshaRoadAccessRules, {
      bhunaksha: {
        ...baseBhunaksha,
        data: { ...baseBhunaksha.data, chauhaddi: undefined },
      },
    });
    const stub = out.find(
      (i) => i.severity === "watchout" && i.ruleId === "ROR-INS-083"
    );
    expect(stub).toBeDefined();
    expect(stub!.panel).toBe("roadAccess");
    // Sanity check on the body — distinct from the redFlag body.
    expect(stub!.body).toMatch(/not yet wired|chauhaddi data was not available/);
  });

  it("preserves ROR-INS-080 redFlag when chauhaddi is present and has no road", () => {
    // No road/rasta/danga on any side.
    const out = runInsights(bhunakshaRoadAccessRules, {
      bhunaksha: {
        ...baseBhunaksha,
        data: {
          ...baseBhunaksha.data,
          chauhaddi: {
            north: { type: "private", plotNumber: "412" },
            south: { type: "private", plotNumber: "418" },
            east: { type: "private", plotNumber: "416" },
            west: { type: "private", plotNumber: "414" },
          },
        },
      },
    });
    expect(
      out.find((i) => i.ruleId === "ROR-INS-080" && i.severity === "redFlag")
    ).toBeDefined();
    // And the new stub does NOT fire when chauhaddi is present.
    expect(out.find((i) => i.ruleId === "ROR-INS-083")).toBeUndefined();
  });

  it("emits no roadAccess insight when chauhaddi is present and a road exists", () => {
    const out = runInsights(bhunakshaRoadAccessRules, {
      bhunaksha: baseBhunaksha,
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-080")).toBeUndefined();
    expect(out.find((i) => i.ruleId === "ROR-INS-083")).toBeUndefined();
  });
});

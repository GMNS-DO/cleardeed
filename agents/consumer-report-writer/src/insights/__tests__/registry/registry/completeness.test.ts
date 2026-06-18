import { describe, it, expect } from "vitest";
import { completenessRules } from "../../../registry/registry/completeness";
import { runInsights } from "../../../engine";

describe("completeness rules", () => {
  it("exports 4 rules", () => {
    expect(completenessRules.length).toBe(4);
  });

  it("emits nothing when sourceStatuses is missing", () => {
    // When the orchestrator hasn't told us any source statuses, stay quiet.
    // (We don't want to gate every report on a completeness panel that wasn't populated.)
    const out = runInsights(completenessRules, {});
    expect(out.length).toBe(0);
  });

  it("ROR-INS-140 fires redFlag when any source is not_implemented", () => {
    const out = runInsights(completenessRules, {
      sourceStatuses: [
        { source: "bhulekh", status: "verified" },
        { source: "ecourts", status: "not_implemented" },
      ],
    });
    const r140 = out.find((i) => i.ruleId === "ROR-INS-140");
    expect(r140).toBeDefined();
    expect(r140!.severity).toBe("redFlag");
    expect(r140!.body).toContain("ecourts");
  });

  it("ROR-INS-141 fires watchout when any source is parser_uncertain", () => {
    const out = runInsights(completenessRules, {
      sourceStatuses: [
        { source: "bhulekh", status: "parser_uncertain" },
      ],
    });
    const r141 = out.find((i) => i.ruleId === "ROR-INS-141");
    expect(r141).toBeDefined();
    expect(r141!.severity).toBe("watchout");
    expect(r141!.body).toContain("bhulekh");
  });

  it("ROR-INS-142 fires redFlag when all sources returned but key fields missing", () => {
    const out = runInsights(completenessRules, {
      sourceStatuses: [
        { source: "bhulekh", status: "verified" },
        { source: "ecourts", status: "verified" },
      ],
      ror: {
        status: "verified",
        page1: { khatiyanNumber: "" }, // missing
        // owner missing too
      },
    });
    const r142 = out.find((i) => i.ruleId === "ROR-INS-142");
    expect(r142).toBeDefined();
    expect(r142!.severity).toBe("redFlag");
  });

  it("ROR-INS-143 fires watchout when EOW blacklist check is unavailable", () => {
    const out = runInsights(completenessRules, {
      sourceStatuses: [
        { source: "bhulekh", status: "verified" },
      ],
      eowBlacklistAvailable: false,
    });
    const r143 = out.find((i) => i.ruleId === "ROR-INS-143");
    expect(r143).toBeDefined();
    expect(r143!.severity).toBe("watchout");
  });

  it("ROR-INS-143 stays quiet when EOW blacklist is available", () => {
    const out = runInsights(completenessRules, {
      sourceStatuses: [{ source: "bhulekh", status: "verified" }],
      eowBlacklistAvailable: true,
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-143")).toBeUndefined();
  });
});

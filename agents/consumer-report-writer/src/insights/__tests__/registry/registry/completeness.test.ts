import { describe, it, expect } from "vitest";
import { completenessRules, plotDiagramRule } from "../../../registry/registry/completeness";
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

  // ROR-INS-170 (Phase 8 / Task 36) — plot diagram missing watchout.
  // Lives in its own exported `plotDiagramRule` so `completenessRules` stays at 4.
  describe("ROR-INS-170 plot diagram missing", () => {
    it("exports the rule with id ROR-INS-170", () => {
      expect(plotDiagramRule.id).toBe("ROR-INS-170");
    });

    it("fires watchout (never redFlag) when bhunaksha is verified but plotDiagram is absent", () => {
      const out = runInsights([plotDiagramRule], {
        sourceStatuses: [{ source: "bhunaksha", status: "verified" }],
        // plotDiagram absent entirely (legacy report)
      });
      expect(out.length).toBe(1);
      expect(out[0].ruleId).toBe("ROR-INS-170");
      expect(out[0].severity).toBe("watchout");
      expect(out[0].issueLens).toBe("parser_source_quality");
    });

    it("stays quiet when plotDiagram is present and successful", () => {
      const out = runInsights([plotDiagramRule], {
        sourceStatuses: [{ source: "bhunaksha", status: "verified" }],
        plotDiagram: { status: "success", url: "https://example.supabase.co/diagram.svg" },
      });
      expect(out.length).toBe(0);
    });

    it("stays quiet when plotDiagram is present but failed (section handles copy)", () => {
      const out = runInsights([plotDiagramRule], {
        sourceStatuses: [{ source: "bhunaksha", status: "verified" }],
        plotDiagram: { status: "failed", url: null, reason: "WFS compose failed" },
      });
      expect(out.length).toBe(0);
    });

    it("stays quiet when bhunaksha is not verified (no plot context to render)", () => {
      const out = runInsights([plotDiagramRule], {
        sourceStatuses: [{ source: "bhunaksha", status: "partial" }],
      });
      expect(out.length).toBe(0);
    });
  });
});

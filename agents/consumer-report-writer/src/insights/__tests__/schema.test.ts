// agents/consumer-report-writer/src/insights/__tests__/schema.test.ts
import { describe, it, expect } from "vitest";
import {
  ISSUE_LENS,
  EVIDENCE_STRENGTH,
  INSIGHT_PANEL,
  SEVERITY,
  InsightSchema,
  RuleSchema,
} from "../schema";

describe("insights schema", () => {
  it("exposes the 5 issue lenses", () => {
    expect([...ISSUE_LENS].sort()).toEqual(
      ["land_use_permission", "parser_source_quality", "registry_ec", "revenue_record", "title_chain"].sort()
    );
  });

  it("exposes the 7 evidence strengths", () => {
    expect([...EVIDENCE_STRENGTH].sort()).toEqual(
      [
        "case_or_order_anchor",
        "document_anchor",
        "missing_source",
        "parser_uncertain",
        "row_count_signal",
        "selected_plot_anchor",
        "source_observation",
      ].sort()
    );
  });

  it("exposes the 16 insight panels", () => {
    expect(INSIGHT_PANEL.length).toBe(16);
  });

  it("InsightSchema rejects missing required fields", () => {
    const bad = {
      panel: "plot",
      // missing issueLens, evidenceStrength, source, actionItem, body, severity
    };
    expect(() => InsightSchema.parse(bad)).toThrow();
  });

  it("InsightSchema accepts a minimal valid insight", () => {
    const ok = {
      panel: "plot",
      issueLens: "title_chain",
      evidenceStrength: "document_anchor",
      source: "bhulekh:ror:page-1",
      severity: "watchout",
      headline: "Owner not in RoR",
      body: "The RoR lists no personal name for this khatiyan.",
      actionItem: "Ask seller for the mutation chain from the last personal owner.",
      ruleId: "ROR-INS-001",
    };
    expect(() => InsightSchema.parse(ok)).not.toThrow();
  });

  it("RuleSchema requires id, panel, fn, and version", () => {
    const bad = { id: "x", panel: "plot" };
    expect(() => RuleSchema.parse(bad)).toThrow();
  });
});

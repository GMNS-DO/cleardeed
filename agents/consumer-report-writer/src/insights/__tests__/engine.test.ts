// agents/consumer-report-writer/src/insights/__tests__/engine.test.ts
import { describe, it, expect } from "vitest";
import { runRule, stubFor, liveDataPresent } from "../registry/_shared";
import { runInsights, groupByPanel } from "../engine";
import type { Rule } from "../schema";

const baseRule: Rule = {
  id: "ROR-INS-TEST",
  panel: "plot",
  fn: (input: any) =>
    input?.ror?.status === "verified"
      ? [
          {
            panel: "plot",
            issueLens: "title_chain",
            evidenceStrength: "document_anchor",
            source: "bhulekh:ror:page-1",
            severity: "watchout",
            headline: "Mismatch",
            body: "Owner does not match RoR.",
            actionItem: "Ask seller.",
            ruleId: "ROR-INS-TEST",
          },
        ]
      : null,
  version: "1.0.0",
};

describe("registry _shared", () => {
  it("runRule returns insight when fn produces one", () => {
    const out = runRule(baseRule, { ror: { status: "verified" } });
    expect(out[0]?.ruleId).toBe("ROR-INS-TEST");
  });

  it("runRule returns [] when fn returns null", () => {
    expect(runRule(baseRule, { ror: { status: "missing" } })).toEqual([]);
  });

  it("runRule catches throws and returns [] (never blows up the engine)", () => {
    const bad: Rule = {
      ...baseRule,
      fn: () => {
        throw new Error("boom");
      },
    };
    expect(runRule(bad, {})).toEqual([]);
  });

  it("liveDataPresent returns true when a path resolves to a non-empty value", () => {
    expect(liveDataPresent({ a: { b: 1 } }, "a.b")).toBe(true);
    expect(liveDataPresent({ a: { b: 0 } }, "a.b")).toBe(true);
    expect(liveDataPresent({ a: { b: "" } }, "a.b")).toBe(false);
    expect(liveDataPresent({}, "a.b")).toBe(false);
  });

  it("stubFor produces a parser_uncertain insight with stable shape", () => {
    const s = stubFor(
      "ROR-INS-X",
      "court",
      "title_chain",
      "case_or_order_anchor",
      "Body text",
      "Action text"
    );
    expect(s.evidenceStrength).toBe("parser_uncertain");
    expect(s.severity).toBe("watchout");
    expect(s.panel).toBe("court");
    expect(s.issueLens).toBe("title_chain");
    expect(s.body).toBe("Body text");
  });
});

describe("engine", () => {
  it("runInsights runs every rule and drops nulls", () => {
    const rules: Rule[] = [
      { ...baseRule, id: "ROR-INS-A", fn: () => null },
      { ...baseRule, id: "ROR-INS-B" }, // emits when input.ror.status==='verified'
      { ...baseRule, id: "ROR-INS-C" },
    ];
    const out = runInsights(rules, { ror: { status: "verified" } });
    expect(out.length).toBe(2);
  });

  it("groupByPanel buckets by panel id", () => {
    const rules: Rule[] = [
      { ...baseRule, id: "ROR-INS-A" },
    ];
    const out = runInsights(rules, { ror: { status: "verified" } });
    const map = groupByPanel(out);
    expect(map.get("plot")?.length).toBe(1);
    expect(map.get("owner")).toBeUndefined();
  });
});

describe("runInsights accepts N insights per rule", () => {
  it("flattens a rule that emits an array of 2 insights", () => {
    const rule: Rule = {
      id: "ROR-INS-901",
      panel: "owner",
      version: "1.0.0",
      fn: () => [
        {
          panel: "owner",
          issueLens: "title_chain",
          evidenceStrength: "document_anchor",
          source: "bhulekh.ror",
          severity: "watchout",
          headline: "Co-owner 1",
          body: "First co-owner identified.",
          actionItem: "Verify identity.",
          ruleId: "ROR-INS-901",
        },
        {
          panel: "owner",
          issueLens: "title_chain",
          evidenceStrength: "document_anchor",
          source: "bhulekh.ror",
          severity: "watchout",
          headline: "Co-owner 2",
          body: "Second co-owner identified.",
          actionItem: "Verify identity.",
          ruleId: "ROR-INS-902",
        },
      ],
    };
    const out = runInsights([rule], {} as any);
    expect(out).toHaveLength(2);
    expect(out[0].ruleId).toBe("ROR-INS-901");
    expect(out[1].ruleId).toBe("ROR-INS-902");
  });

  it("treats an empty array the same as null (no fire)", () => {
    const rule: Rule = {
      id: "ROR-INS-903",
      panel: "owner",
      version: "1.0.0",
      fn: () => [],
    };
    const out = runInsights([rule], {} as any);
    expect(out).toHaveLength(0);
  });
});

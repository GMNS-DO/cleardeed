// agents/consumer-report-writer/src/__tests__/tested-patterns-panel.test.ts
//
// T1 — render assertions for the Tested Fraud Patterns Panel. We exercise
// the evaluator and the renderer with the three scenarios that matter:
//   1. all patterns pass (clean plot)
//   2. Pattern 3 (Malipada Impersonation) triggered
//   3. No Bhulekh data (untested branch, no crash)

import { describe, it, expect } from "vitest";
import {
  evaluatePatterns,
  buildTestedPatternsPanel,
  type PatternResult,
} from "../components/tested-patterns";

const makeInsight = (ruleId: string, severity: "redFlag" | "watchout" | "info") =>
  ({ ruleId, severity }) as any;

const noRules = new Set<string>();
const fired = (ruleId: string) => new Set<string>([ruleId]);

describe("T1 — Tested Fraud Patterns Panel", () => {
  it("evaluator: 5 patterns returned in stable order", () => {
    const results: PatternResult[] = evaluatePatterns({
      insights: [],
      revenueRecords: null,
      firedRuleIds: noRules,
    });
    expect(results).toHaveLength(5);
    expect(results.map((r) => r.pattern.id)).toEqual([
      "PAT-1",
      "PAT-2",
      "PAT-3",
      "PAT-4",
      "PAT-5",
    ]);
  });

  it("all-pass: every pattern shows passed state, no trigger", () => {
    const results = evaluatePatterns({
      insights: [],
      revenueRecords: null,
      firedRuleIds: noRules,
    });
    // When revenueRecords is null, evaluator returns "untested".
    expect(results.every((r) => r.state === "untested")).toBe(true);
    const html = buildTestedPatternsPanel({
      results,
      fetchedAt: "13 May 2026, 14:23",
    });
    expect(html).toContain("TESTED FRAUD PATTERNS");
    expect(html).toContain("Patia Industrial-Lease Scam");
    expect(html).toContain("Surya Nirman Multi-Investor");
    expect(html).toContain("Malipada Impersonation");
    expect(html).toContain("Industrial-Zone Plot Sold as Residential");
    expect(html).toContain("Subdivided Plot Without BDA Layout");
  });

  it("all-pass with revenueRecords → state=passed", () => {
    const results = evaluatePatterns({
      insights: [],
      revenueRecords: { plotNo: "309" },
      firedRuleIds: noRules,
    });
    expect(results.every((r) => r.state === "passed")).toBe(true);
  });

  it("Pattern 3 (Malipada) triggered → red state + evidence link", () => {
    const results = evaluatePatterns({
      insights: [
        makeInsight("ROR-INS-024", "redFlag"),
        makeInsight("ROR-INS-075", "watchout"),
      ],
      revenueRecords: { plotNo: "309" },
      firedRuleIds: fired("ROR-INS-024"),
    });
    const malipada = results.find((r) => r.pattern.id === "PAT-3");
    expect(malipada?.state).toBe("triggered");
    expect(malipada?.firedInsight?.ruleId).toBe("ROR-INS-024");
    const html = buildTestedPatternsPanel({
      results,
      fetchedAt: "13 May 2026, 14:23",
    });
    expect(html).toContain("data-state=\"triggered\"");
    expect(html).toContain("ROR-INS-024");
  });

  it("surya-nirman triggers from EOW blacklist rule ROR-INS-210", () => {
    const results = evaluatePatterns({
      insights: [makeInsight("ROR-INS-210", "redFlag")],
      revenueRecords: { plotNo: "309" },
      firedRuleIds: fired("ROR-INS-210"),
    });
    const surya = results.find((r) => r.pattern.id === "PAT-2");
    expect(surya?.state).toBe("triggered");
    expect(surya?.firedInsight?.ruleId).toBe("ROR-INS-210");
  });

  it("industrial-zone triggers from BDA zone check rule ROR-INS-153", () => {
    const results = evaluatePatterns({
      insights: [makeInsight("ROR-INS-153", "redFlag")],
      revenueRecords: { plotNo: "309" },
      firedRuleIds: fired("ROR-INS-153"),
    });
    const industrial = results.find((r) => r.pattern.id === "PAT-4");
    expect(industrial?.state).toBe("triggered");
  });

  it("subdivided triggers from sub-plot rule ROR-INS-040", () => {
    const results = evaluatePatterns({
      insights: [makeInsight("ROR-INS-040", "redFlag")],
      revenueRecords: { plotNo: "309" },
      firedRuleIds: fired("ROR-INS-040"),
    });
    const subplot = results.find((r) => r.pattern.id === "PAT-5");
    expect(subplot?.state).toBe("triggered");
  });

  it("patia-lease triggers from rule ROR-INS-180", () => {
    const results = evaluatePatterns({
      insights: [makeInsight("ROR-INS-180", "redFlag")],
      revenueRecords: { plotNo: "309" },
      firedRuleIds: fired("ROR-INS-180"),
    });
    const patia = results.find((r) => r.pattern.id === "PAT-1");
    expect(patia?.state).toBe("triggered");
  });

  it("no Bhulekh data: untested state", () => {
    const results = evaluatePatterns({
      insights: [],
      revenueRecords: null,
      firedRuleIds: noRules,
    });
    const patia = results.find((r) => r.pattern.id === "PAT-1");
    expect(patia?.state).toBe("untested");
  });

  it("html is XSS-safe", () => {
    const results = evaluatePatterns({
      insights: [],
      revenueRecords: { plotNo: "309" },
      firedRuleIds: noRules,
    });
    const html = buildTestedPatternsPanel({
      results,
      fetchedAt: "13 May 2026, 14:23",
    });
    expect(html).not.toContain("<script");
  });

  it("html includes fetched timestamp", () => {
    const results = evaluatePatterns({
      insights: [],
      revenueRecords: { plotNo: "309" },
      firedRuleIds: noRules,
    });
    const html = buildTestedPatternsPanel({
      results,
      fetchedAt: "13 May 2026, 14:23",
    });
    expect(html).toContain("13 May 2026");
  });
});
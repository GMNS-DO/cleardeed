// agents/consumer-report-writer/src/insights/__tests__/engine.test.ts
import { describe, it, expect } from "vitest";
import { runRule, stubFor, liveDataPresent } from "../registry/_shared";
import type { Rule } from "../schema";

const baseRule: Rule = {
  id: "ROR-INS-TEST",
  panel: "plot",
  fn: (input: any) =>
    input?.ror?.status === "verified"
      ? {
          panel: "plot",
          issueLens: "title_chain",
          evidenceStrength: "document_anchor",
          source: "bhulekh:ror:page-1",
          severity: "watchout",
          headline: "Mismatch",
          body: "Owner does not match RoR.",
          actionItem: "Ask seller.",
          ruleId: "ROR-INS-TEST",
        }
      : null,
  version: "1.0.0",
};

describe("registry _shared", () => {
  it("runRule returns insight when fn produces one", () => {
    const out = runRule(baseRule, { ror: { status: "verified" } });
    expect(out?.ruleId).toBe("ROR-INS-TEST");
  });

  it("runRule returns null when fn returns null", () => {
    expect(runRule(baseRule, { ror: { status: "missing" } })).toBeNull();
  });

  it("runRule catches throws and returns null (never blows up the engine)", () => {
    const bad: Rule = {
      ...baseRule,
      fn: () => {
        throw new Error("boom");
      },
    };
    expect(runRule(bad, {})).toBeNull();
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

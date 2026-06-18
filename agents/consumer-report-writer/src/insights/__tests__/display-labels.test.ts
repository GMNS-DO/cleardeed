// agents/consumer-report-writer/src/insights/__tests__/display-labels.test.ts
import { describe, it, expect } from "vitest";
import { noProhibitedPhrases, PROHIBITED_PHRASES } from "../display-labels";
import type { Insight } from "../schema";

const base: Insight = {
  panel: "plot",
  issueLens: "title_chain",
  evidenceStrength: "document_anchor",
  source: "bhulekh:ror:page-1",
  severity: "watchout",
  headline: "Owner mismatch",
  body: "The RoR lists a different person.",
  actionItem: "Ask the seller to explain.",
  ruleId: "ROR-INS-001",
};

describe("display-labels", () => {
  it("lists 8 prohibited phrases", () => {
    expect(PROHIBITED_PHRASES.length).toBe(8);
  });

  it("returns empty array for clean text", () => {
    expect(noProhibitedPhrases(base)).toEqual([]);
  });

  it("catches 'verified clear' case-insensitively", () => {
    const i = { ...base, body: "This plot is VERIFIED CLEAR." };
    expect(noProhibitedPhrases(i)).toContain("verified clear");
  });

  it("catches 'ownership verified'", () => {
    const i = { ...base, body: "Ownership Verified by RoR." };
    expect(noProhibitedPhrases(i)).toContain("ownership verified");
  });

  it("catches 'safe to buy'", () => {
    expect(noProhibitedPhrases({ ...base, body: "Safe to buy." })).toContain(
      "safe to buy"
    );
  });

  it("catches 'no encumbrance'", () => {
    expect(
      noProhibitedPhrases({ ...base, body: "There is no encumbrance." })
    ).toContain("no encumbrance");
  });

  it("catches 'no litigation'", () => {
    expect(
      noProhibitedPhrases({ ...base, body: "No litigation found." })
    ).toContain("no litigation");
  });

  it("catches 'clear title'", () => {
    expect(
      noProhibitedPhrases({ ...base, body: "You have a clear title." })
    ).toContain("clear title");
  });

  it("catches 'buildable' as an absolute claim", () => {
    expect(
      noProhibitedPhrases({ ...base, body: "This plot is buildable." })
    ).toContain("buildable");
  });

  it("catches 'no restriction' as an absolute claim", () => {
    expect(
      noProhibitedPhrases({ ...base, body: "There is no restriction." })
    ).toContain("no restriction");
  });

  it("checks headline, body, and actionItem", () => {
    const i = { ...base, actionItem: "Mark this as verified clear." };
    expect(noProhibitedPhrases(i)).toContain("verified clear");
  });
});

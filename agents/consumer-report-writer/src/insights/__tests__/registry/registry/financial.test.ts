import { describe, it, expect } from "vitest";
import { financialRules } from "../../../registry/registry/financial";
import { runInsights } from "../../../engine";

const rorPresent = { ror: { status: "verified", page1: { owner: "Rama" } } };

describe("financial rules", () => {
  it("exports 3 rules", () => {
    expect(financialRules.length).toBe(3);
  });

  // HIGH #4 regression: stubs gate on RoR data presence.
  it("stubs do NOT fire when input has no RoR (HIGH #4 gate)", () => {
    const out = runInsights(financialRules, {});
    expect(out.length).toBe(0);
  });

  it("stubs fire with parser_uncertain when RoR is present", () => {
    const out = runInsights(financialRules, rorPresent);
    expect(out.length).toBe(3);
    expect(out.every((i) => i.evidenceStrength === "parser_uncertain")).toBe(true);
    expect(out.every((i) => i.panel === "financial")).toBe(true);
  });

  it("each stub body mentions benchmark / cost-of-risk", () => {
    const out = runInsights(financialRules, rorPresent);
    for (const i of out) {
      const body = i.body.toLowerCase();
      expect(body).toMatch(/benchmark|cost-of-risk/);
    }
  });

  it("all rule IDs match ROR-INS-13x", () => {
    for (const r of financialRules) {
      expect(r.id).toMatch(/^ROR-INS-13\d$/);
    }
  });
});

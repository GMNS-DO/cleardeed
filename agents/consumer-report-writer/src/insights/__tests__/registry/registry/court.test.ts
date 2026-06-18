import { describe, it, expect } from "vitest";
import { courtRules } from "../../../registry/registry/court";
import { runInsights } from "../../../engine";

const rorPresent = { ror: { status: "verified", page1: { owner: "Rama" } } };

describe("court rules", () => {
  it("exports 3 rules", () => {
    expect(courtRules.length).toBe(3);
  });

  // HIGH #4 regression: stubs gate on RoR data presence.
  it("stubs do NOT fire when input has no RoR (HIGH #4 gate)", () => {
    const out = runInsights(courtRules, {});
    expect(out.length).toBe(0);
  });

  it("stubs fire with parser_uncertain when RoR is present", () => {
    const out = runInsights(courtRules, rorPresent);
    expect(out.length).toBe(3);
    expect(out.every((i) => i.evidenceStrength === "parser_uncertain")).toBe(true);
    expect(out.every((i) => i.panel === "court")).toBe(true);
  });

  it("each stub body mentions eCourts + High Court + DRT", () => {
    const out = runInsights(courtRules, rorPresent);
    for (const i of out) {
      const body = i.body.toLowerCase();
      expect(body).toContain("ecourts");
      expect(body).toContain("high court");
      expect(body).toContain("drt");
    }
  });

  it("all rule IDs match ROR-INS-12x", () => {
    for (const r of courtRules) {
      expect(r.id).toMatch(/^ROR-INS-12\d$/);
    }
  });
});

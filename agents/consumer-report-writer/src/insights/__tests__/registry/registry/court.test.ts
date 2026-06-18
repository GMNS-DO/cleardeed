import { describe, it, expect } from "vitest";
import { courtRules } from "../../../registry/registry/court";
import { runInsights } from "../../../engine";

describe("court rules", () => {
  it("exports 3 rules", () => {
    expect(courtRules.length).toBe(3);
  });

  it("stubs fire with parser_uncertain when input is empty", () => {
    const out = runInsights(courtRules, {});
    expect(out.length).toBe(3);
    expect(out.every((i) => i.evidenceStrength === "parser_uncertain")).toBe(true);
    expect(out.every((i) => i.panel === "court")).toBe(true);
  });

  it("each stub body mentions eCourts + High Court + DRT", () => {
    const out = runInsights(courtRules, {});
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

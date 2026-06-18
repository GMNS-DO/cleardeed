import { describe, it, expect } from "vitest";
import { deedsRules } from "../../../registry/registry/deeds";
import { runInsights } from "../../../engine";

describe("deeds rules", () => {
  it("exports 5 rules", () => {
    expect(deedsRules.length).toBe(5);
  });

  it("stubs fire with parser_uncertain when input is empty", () => {
    const out = runInsights(deedsRules, {});
    expect(out.length).toBe(5);
    expect(out.every((i) => i.evidenceStrength === "parser_uncertain")).toBe(true);
    expect(out.every((i) => i.panel === "deeds")).toBe(true);
  });

  it("each stub body mentions IGR sale-deed bridge", () => {
    const out = runInsights(deedsRules, {});
    for (const i of out) {
      expect(i.body.toLowerCase()).toContain("igr sale-deed");
    }
  });

  it("all rule IDs match ROR-INS-11x", () => {
    for (const r of deedsRules) {
      expect(r.id).toMatch(/^ROR-INS-11\d$/);
    }
  });
});

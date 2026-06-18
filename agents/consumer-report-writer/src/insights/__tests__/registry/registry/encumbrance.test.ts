import { describe, it, expect } from "vitest";
import { encumbranceRules } from "../../../registry/registry/encumbrance";
import { runInsights } from "../../../engine";

describe("encumbrance rules", () => {
  it("exports 5 rules", () => {
    expect(encumbranceRules.length).toBe(5);
  });

  it("stubs fire with parser_uncertain when input is empty", () => {
    const out = runInsights(encumbranceRules, {});
    // All 5 stubs are always-on (no live data check) and emit parser_uncertain.
    expect(out.length).toBe(5);
    expect(out.every((i) => i.evidenceStrength === "parser_uncertain")).toBe(true);
    expect(out.every((i) => i.panel === "encumbrance")).toBe(true);
  });

  it("each stub body mentions IGR EC", () => {
    const out = runInsights(encumbranceRules, {});
    for (const i of out) {
      expect(i.body.toLowerCase()).toContain("igr ec");
    }
  });

  it("all rule IDs match ROR-INS-1xx", () => {
    for (const r of encumbranceRules) {
      expect(r.id).toMatch(/^ROR-INS-1\d{2}$/);
    }
  });
});

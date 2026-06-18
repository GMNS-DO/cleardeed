import { describe, it, expect } from "vitest";
import { encumbranceRules } from "../../../registry/registry/encumbrance";
import { runInsights } from "../../../engine";

const rorPresent = { ror: { status: "verified", page1: { owner: "Rama" } } };

describe("encumbrance rules", () => {
  it("exports 5 rules", () => {
    expect(encumbranceRules.length).toBe(5);
  });

  // HIGH #4 regression: stubs gate on RoR data presence. Empty input
  // must NOT fire any of the 16 unconditional IGR/EC stubs.
  it("stubs do NOT fire when input has no RoR (HIGH #4 gate)", () => {
    const out = runInsights(encumbranceRules, {});
    expect(out.length).toBe(0);
  });

  it("stubs do NOT fire when ror is undefined but other fields are present", () => {
    const out = runInsights(encumbranceRules, { sellerName: "Rama" });
    expect(out.length).toBe(0);
  });

  it("stubs fire with parser_uncertain when RoR is present", () => {
    const out = runInsights(encumbranceRules, rorPresent);
    expect(out.length).toBe(5);
    expect(out.every((i) => i.evidenceStrength === "parser_uncertain")).toBe(true);
    expect(out.every((i) => i.panel === "encumbrance")).toBe(true);
  });

  it("each stub body mentions IGR EC", () => {
    const out = runInsights(encumbranceRules, rorPresent);
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

import { describe, it, expect } from "vitest";
import { chainRecursiveRules } from "../../../registry/recursive/chain-recursive";
import { neighboursRecursiveRules } from "../../../registry/recursive/neighbours-recursive";
import { zoningRules } from "../../../registry/recursive/zoning";
import { runInsights } from "../../../engine";

describe("recursive stubs", () => {
  it("chain exports 1 rule", () => {
    expect(chainRecursiveRules.length).toBe(1);
  });

  it("neighbours exports 1 rule", () => {
    expect(neighboursRecursiveRules.length).toBe(1);
  });

  it("zoning exports 2 rules", () => {
    expect(zoningRules.length).toBe(2);
  });

  it("chain fires parser_uncertain stub", () => {
    const out = runInsights(chainRecursiveRules, {});
    expect(out.length).toBe(1);
    expect(out[0].evidenceStrength).toBe("parser_uncertain");
    expect(out[0].ruleId).toBe("ROR-INS-150");
    expect(out[0].panel).toBe("chain");
  });

  it("neighbours fires parser_uncertain stub", () => {
    const out = runInsights(neighboursRecursiveRules, {});
    expect(out.length).toBe(1);
    expect(out[0].evidenceStrength).toBe("parser_uncertain");
    expect(out[0].ruleId).toBe("ROR-INS-151");
    expect(out[0].panel).toBe("neighbours");
  });

  it("zoning fires two parser_uncertain stubs", () => {
    const out = runInsights(zoningRules, {});
    expect(out.length).toBe(2);
    expect(out.every((i) => i.evidenceStrength === "parser_uncertain")).toBe(true);
    const ids = out.map((i) => i.ruleId).sort();
    expect(ids).toEqual(["ROR-INS-152", "ROR-INS-153"]);
  });

  it("all recursive stubs together fire 4 insights", () => {
    const all = [...chainRecursiveRules, ...neighboursRecursiveRules, ...zoningRules];
    const out = runInsights(all, {});
    expect(out.length).toBe(4);
    expect(out.every((i) => i.evidenceStrength === "parser_uncertain")).toBe(true);
  });

  it("recursive stubs mention the upstream that ships them", () => {
    const all = [...chainRecursiveRules, ...neighboursRecursiveRules, ...zoningRules];
    const out = runInsights(all, {});
    for (const i of out) {
      // The body of each stub describes the upstream source that will activate it.
      expect(i.body.length).toBeGreaterThan(20);
      // All bodies here should explicitly note "not yet" wiring.
      expect(i.body.toLowerCase()).toContain("not yet");
    }
  });
});

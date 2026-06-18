// agents/consumer-report-writer/src/insights/__tests__/auto-activation.test.ts
import { describe, it, expect } from "vitest";
import { encumbranceRules } from "../registry/registry/encumbrance";
import { runInsights } from "../engine";

describe("auto-activation", () => {
  it("CERSAI rule emits live insight when cersai.activeCharge is true", () => {
    const [rule] = encumbranceRules.filter((r) => r.id === "ROR-INS-103");
    expect(rule).toBeDefined();
    const out = runInsights([rule!], { cersai: { activeCharge: true } });
    expect(out[0]?.body).not.toContain("not yet wired");
    expect(out[0]?.severity).toBe("redFlag");
  });

  it("CERSAI rule emits stub insight when cersai is missing (with RoR present)", () => {
    const [rule] = encumbranceRules.filter((r) => r.id === "ROR-INS-103");
    expect(rule).toBeDefined();
    const out = runInsights([rule!], { ror: { present: true } });
    expect(out[0]?.body).toContain("not yet wired");
  });
});
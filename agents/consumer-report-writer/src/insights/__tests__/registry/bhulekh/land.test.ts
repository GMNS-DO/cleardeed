// agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/land.test.ts
import { describe, it, expect } from "vitest";
import { bhulekhLandRules } from "../../../registry/bhulekh/land";
import { runInsights } from "../../../engine";

const baseRor = { status: "verified" as const, page1: { owner: "Rama Mohanty" } };

describe("bhulekh land rules", () => {
  it("exports 6 rules", () => {
    expect(bhulekhLandRules.length).toBe(6);
  });

  it("fires redFlag when kisam is forest / jungle", () => {
    const out = runInsights(bhulekhLandRules, {
      ror: { ...baseRor, page1: { ...baseRor.page1, kisam: "forest" } },
    });
    expect(out.find((i) => i.severity === "redFlag")).toBeDefined();
  });

  it("fires watchout when kisam is bagayat (irrigated agricultural)", () => {
    const out = runInsights(bhulekhLandRules, {
      ror: { ...baseRor, page1: { ...baseRor.page1, kisam: "bagayat" } },
    });
    expect(out.find((i) => i.severity === "watchout")).toBeDefined();
  });

  it("fires positive when kisam is gharabari (homestead)", () => {
    const out = runInsights(bhulekhLandRules, {
      ror: { ...baseRor, page1: { ...baseRor.page1, kisam: "gharabari" } },
    });
    expect(out.find((i) => i.severity === "positive")).toBeDefined();
  });

  it("fires stub when ror is unverified / missing", () => {
    const out = runInsights(bhulekhLandRules, { ror: { status: "partial" } });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].evidenceStrength).toBe("parser_uncertain");
  });

  it("emits nothing when ror is empty", () => {
    expect(runInsights(bhulekhLandRules, {}).length).toBe(0);
  });

  // ROR-INS-035 (BLOCKER 3 regression): neya_niyogita is government-notified
  // land (Neyanjori / Gair Khalsa), NOT bagayat. It must fire ROR-INS-035,
  // not ROR-INS-031.
  it("does NOT fire ROR-INS-031 (bagayat watchout) for neya_niyogita", () => {
    const out = runInsights(bhulekhLandRules, {
      ror: { ...baseRor, page1: { ...baseRor.page1, kisam: "neya_niyogita" } },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-031")).toBeUndefined();
  });

  it("fires ROR-INS-035 (redFlag) for neya_niyogita", () => {
    const out = runInsights(bhulekhLandRules, {
      ror: { ...baseRor, page1: { ...baseRor.page1, kisam: "neya_niyogita" } },
    });
    const red = out.find(
      (i) => i.severity === "redFlag" && i.ruleId === "ROR-INS-035"
    );
    expect(red).toBeDefined();
    expect(red!.body).toMatch(/Government notified land|Neyanjori/);
  });

  it("fires ROR-INS-035 (redFlag) for the neyanjori spelling variant", () => {
    const out = runInsights(bhulekhLandRules, {
      ror: { ...baseRor, page1: { ...baseRor.page1, kisam: "neyanjori" } },
    });
    const red = out.find(
      (i) => i.severity === "redFlag" && i.ruleId === "ROR-INS-035"
    );
    expect(red).toBeDefined();
    expect(red!.body).toMatch(/Government notified land|Neyanjori/);
  });
});
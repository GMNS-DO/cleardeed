// agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/back-page-recency.test.ts
import { describe, it, expect } from "vitest";
import { bhulekhBackPageRecencyRules } from "../../../registry/bhulekh/back-page-recency";
import { runInsights } from "../../../engine";

const baseRor = { status: "verified" as const, page1: { owner: "Rama" } };
const currentYear = new Date().getFullYear();

describe("bhulekh back-page-recency rules (V1.5)", () => {
  it("exports 3 rules", () => {
    expect(bhulekhBackPageRecencyRules.length).toBe(3);
  });

  // ROR-INS-072
  it("ROR-INS-072 — fires redFlag on RCCMS / Board of Revenue / Tahasildar mutation", () => {
    const out = runInsights(bhulekhBackPageRecencyRules, {
      ror: {
        ...baseRor,
        mutationReferences: [
          { caseType: "RCCMS Mutation", caseNo: "12/2020", orderDate: "12.06.2020", orderYear: 2020 },
        ],
      },
    });
    const r = out.find((i) => i.ruleId === "ROR-INS-072");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("redFlag");
  });

  it("ROR-INS-072 — does NOT fire on plain Sale references", () => {
    const out = runInsights(bhulekhBackPageRecencyRules, {
      ror: {
        ...baseRor,
        mutationReferences: [
          { caseType: "Sale Deed", caseNo: "12/2020", orderDate: "12.06.2020", orderYear: 2020 },
        ],
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-072")).toBeUndefined();
  });

  // ROR-INS-073
  it("ROR-INS-073 — fires watchout on recent mutation with no sale-deed anchor", () => {
    const out = runInsights(bhulekhBackPageRecencyRules, {
      ror: {
        ...baseRor,
        mutationReferences: [
          {
            caseType: "Partition",
            caseNo: "5/" + currentYear,
            orderDate: "12.06." + currentYear,
            orderYear: currentYear,
          },
        ],
      },
    });
    const r = out.find((i) => i.ruleId === "ROR-INS-073");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("watchout");
  });

  it("ROR-INS-073 — does NOT fire when mutation type is Sale (anchored)", () => {
    const out = runInsights(bhulekhBackPageRecencyRules, {
      ror: {
        ...baseRor,
        mutationReferences: [
          {
            caseType: "Sale",
            caseNo: "5/" + currentYear,
            orderDate: "12.06." + currentYear,
            orderYear: currentYear,
          },
        ],
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-073")).toBeUndefined();
  });

  it("ROR-INS-073 — does NOT fire on old (>2y) mutation", () => {
    const oldYear = currentYear - 5;
    const out = runInsights(bhulekhBackPageRecencyRules, {
      ror: {
        ...baseRor,
        mutationReferences: [
          { caseType: "Partition", caseNo: "5/" + oldYear, orderDate: "12.06." + oldYear, orderYear: oldYear },
        ],
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-073")).toBeUndefined();
  });

  // ROR-INS-074
  it("ROR-INS-074 — fires watchout on 3+ mutations in last 5 years", () => {
    const out = runInsights(bhulekhBackPageRecencyRules, {
      ror: {
        ...baseRor,
        mutationReferences: [
          { caseType: "Sale", caseNo: "1", orderYear: currentYear - 1 },
          { caseType: "Sale", caseNo: "2", orderYear: currentYear - 2 },
          { caseType: "Sale", caseNo: "3", orderYear: currentYear - 3 },
        ],
      },
    });
    const r = out.find((i) => i.ruleId === "ROR-INS-074");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("watchout");
  });

  it("ROR-INS-074 — does NOT fire on 2 mutations in 5 years", () => {
    const out = runInsights(bhulekhBackPageRecencyRules, {
      ror: {
        ...baseRor,
        mutationReferences: [
          { caseType: "Sale", caseNo: "1", orderYear: currentYear - 1 },
          { caseType: "Sale", caseNo: "2", orderYear: currentYear - 4 },
        ],
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-074")).toBeUndefined();
  });

  it("emits nothing when ror is missing", () => {
    expect(runInsights(bhulekhBackPageRecencyRules, {}).length).toBe(0);
  });
});
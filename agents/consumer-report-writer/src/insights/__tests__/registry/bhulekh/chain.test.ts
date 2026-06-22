// agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/chain.test.ts
import { describe, it, expect } from "vitest";
import { bhulekhChainRules } from "../../../registry/bhulekh/chain";
import { runInsights } from "../../../engine";

const baseRor = { status: "verified" as const, page1: { owner: "Rama Mohanty" } };

describe("bhulekh chain rules (V1.5)", () => {
  it("exports 5 rules", () => {
    expect(bhulekhChainRules.length).toBe(6);
  });

  // ROR-INS-070
  it("ROR-INS-070 — fires redFlag when plot number has 2+ slashes", () => {
    const out = runInsights(bhulekhChainRules, {
      ror: {
        ...baseRor,
        page2: { selectedPlotNumber: "415/1/2", plots: [], totals: null },
      },
    });
    const r = out.find((i) => i.ruleId === "ROR-INS-070");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("redFlag");
    expect(r?.panel).toBe("chain");
  });

  it("ROR-INS-070 — does NOT fire on single sub-plot (ROR-INS-040 territory)", () => {
    const out = runInsights(bhulekhChainRules, {
      ror: {
        ...baseRor,
        page2: { selectedPlotNumber: "415/1", plots: [], totals: null },
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-070")).toBeUndefined();
  });

  // ROR-INS-071
  it("ROR-INS-071 — fires watchout when owner address is in different mouza + no PoA", () => {
    const out = runInsights(bhulekhChainRules, {
      ror: {
        ...baseRor,
        page1: {
          owner: "Dharitri Mohanty",
          ownerAddress: "Bhubaneswar, Patia",
          hasPoA: false,
          plotVillage: "Mendhasala",
        },
      },
    });
    const r = out.find((i) => i.ruleId === "ROR-INS-071");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("watchout");
  });

  it("ROR-INS-071 — does NOT fire when owner address shares a token with plot village", () => {
    const out = runInsights(bhulekhChainRules, {
      ror: {
        ...baseRor,
        page1: {
          owner: "Rama",
          ownerAddress: "Patia, Mendhasala",
          hasPoA: false,
          plotVillage: "Mendhasala",
        },
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-071")).toBeUndefined();
  });

  it("ROR-INS-071 — does NOT fire when PoA is on record (mitigated)", () => {
    const out = runInsights(bhulekhChainRules, {
      ror: {
        ...baseRor,
        page1: {
          owner: "Rama",
          ownerAddress: "Cuttack, Jobra",
          hasPoA: true,
          plotVillage: "Mendhasala",
        },
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-071")).toBeUndefined();
  });

  // ROR-INS-075
  it("ROR-INS-075 — fires redFlag when PoA on record + seller name ≠ owner name", () => {
    const out = runInsights(bhulekhChainRules, {
      ror: {
        ...baseRor,
        page1: { owner: "Rama Mohanty", hasPoA: true },
      },
      claimedOwnerName: "Shyam Mohanty",
    });
    const r = out.find((i) => i.ruleId === "ROR-INS-075");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("redFlag");
    expect(r?.body).toMatch(/Suraj Lamp/i);
  });

  it("ROR-INS-075 — does NOT fire when no claimedOwnerName is supplied", () => {
    const out = runInsights(bhulekhChainRules, {
      ror: {
        ...baseRor,
        page1: { owner: "Rama", hasPoA: true },
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-075")).toBeUndefined();
  });

  it("ROR-INS-075 — does NOT fire when hasPoA is false / null", () => {
    const out = runInsights(bhulekhChainRules, {
      ror: {
        ...baseRor,
        page1: { owner: "Rama", hasPoA: false },
      },
      claimedOwnerName: "Shyam",
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-075")).toBeUndefined();
  });

  // ROR-INS-076
  it("ROR-INS-076 — fires watchout when zamindari khewat present but no mutation chain", () => {
    const out = runInsights(bhulekhChainRules, {
      ror: {
        ...baseRor,
        page1: {
          owner: "Rama",
          zamindarKhewatOdia: "ଓଡିଶା ସରକାର ଖେୱାଟ ନମ୍ବର 1",
          khewatNo: "12",
        },
        mutationReferences: [],
      },
    });
    const r = out.find((i) => i.ruleId === "ROR-INS-076");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("watchout");
  });

  it("ROR-INS-076 — does NOT fire when mutation chain is present", () => {
    const out = runInsights(bhulekhChainRules, {
      ror: {
        ...baseRor,
        page1: {
          owner: "Rama",
          zamindarKhewatOdia: "Zamindari",
          khewatNo: "12",
        },
        mutationReferences: [{ caseType: "Sale", caseNo: "1/2020", orderDate: "12.06.2020", orderYear: 2020 }],
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-076")).toBeUndefined();
  });

  // ROR-INS-080
  it("ROR-INS-080 — fires redFlag when sum of tenant areas > plot area", () => {
    const out = runInsights(bhulekhChainRules, {
      ror: {
        ...baseRor,
        page1: {
          owner: "Rama",
          tenants: [{ area: 0.10 }, { area: 0.05 }],
        },
        plotTable: { targetRow: { area: 0.10 }, rows: [{ area: 0.10 }], totals: null },
      },
    });
    const r = out.find((i) => i.ruleId === "ROR-INS-080");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("redFlag");
  });

  it("ROR-INS-080 — does NOT fire when tenancy fits within plot area", () => {
    const out = runInsights(bhulekhChainRules, {
      ror: {
        ...baseRor,
        page1: {
          owner: "Rama",
          tenants: [{ area: 0.05 }],
        },
        plotTable: { targetRow: { area: 0.10 }, rows: [{ area: 0.10 }], totals: null },
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-080")).toBeUndefined();
  });

  it("emits nothing when ror is missing", () => {
    expect(runInsights(bhulekhChainRules, {}).length).toBe(0);
  });

  // ROR-INS-046 — Khewat ≠ 1 → multiple co-tenants on this tenancy.
  it("ROR-INS-046 — fires watchout when khewatNo > 1", () => {
    const out = runInsights(bhulekhChainRules, {
      ror: {
        ...baseRor,
        page1: { owner: "Rama", khewatNo: "3" },
      },
    });
    const r = out.find((i) => i.ruleId === "ROR-INS-046");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("watchout");
    expect(r?.headline).toContain("3");
  });

  it("ROR-INS-046 — does NOT fire when khewatNo is 1 or missing", () => {
    const one = runInsights(bhulekhChainRules, {
      ror: { ...baseRor, page1: { owner: "Rama", khewatNo: "1" } },
    });
    expect(one.find((i) => i.ruleId === "ROR-INS-046")).toBeUndefined();
    const missing = runInsights(bhulekhChainRules, {
      ror: { ...baseRor, page1: { owner: "Rama" } },
    });
    expect(missing.find((i) => i.ruleId === "ROR-INS-046")).toBeUndefined();
  });
});
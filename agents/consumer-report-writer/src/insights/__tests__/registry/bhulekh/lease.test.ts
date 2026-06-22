// agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/lease.test.ts
//
// T-050 — IGR lease-deed detection (Patia Industrial-Lease pre-flag).
//
// ROR-INS-180 fires a redFlag when the RoR's rights text contains a
// lease-tenure keyword AND the raw kisam is Sthitiban / Raiyati.

import { describe, it, expect } from "vitest";
import { bhulekhLeaseRules } from "../../../registry/bhulekh/lease";
import { runInsights } from "../../../engine";

const baseRor = {
  status: "verified" as const,
  page1: {
    owner: "Rama Mohanty",
    kisam: "sthitiban",
    rawKisamOdia: "ସ୍ଥିତିବାନ",
    rightsOdia: "ପଟ୍ଟା ରୁକା",
    rightsText: "Patta Ruka",
  },
};

describe("bhulekh lease rules (ROR-INS-180 Patia Industrial-Lease pre-flag)", () => {
  it("exports exactly 1 rule", () => {
    expect(bhulekhLeaseRules.length).toBe(1);
    expect(bhulekhLeaseRules[0].id).toBe("ROR-INS-180");
  });

  it("fires redFlag when rights text has lease keyword + Sthitiban kisam (Odia)", () => {
    const out = runInsights(bhulekhLeaseRules, { ror: baseRor });
    const r180 = out.find((i) => i.ruleId === "ROR-INS-180");
    expect(r180).toBeDefined();
    expect(r180?.severity).toBe("redFlag");
    expect(r180?.headline).toContain("lease");
  });

  it("fires redFlag when rights text has English 'lease' + Raiyati kisam", () => {
    const out = runInsights(bhulekhLeaseRules, {
      ror: {
        ...baseRor,
        page1: {
          ...baseRor.page1,
          kisam: "raiyati",
          rawKisamOdia: "ରାୟତି",
          rightsOdia: "Lease hold — Bandobast pending",
          rightsText: "Lease hold — Bandobast pending",
        },
      },
    });
    const r180 = out.find((i) => i.ruleId === "ROR-INS-180");
    expect(r180).toBeDefined();
    expect(r180?.severity).toBe("redFlag");
  });

  it("does NOT fire when rights text has lease keyword but kisam is Gharabari (homestead)", () => {
    const out = runInsights(bhulekhLeaseRules, {
      ror: {
        ...baseRor,
        page1: {
          ...baseRor.page1,
          kisam: "gharabari",
          rawKisamOdia: "ଘରବାଡ଼ି",
        },
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-180")).toBeUndefined();
  });

  it("does NOT fire when kisam is Sthitiban but rights text is clean freehold", () => {
    const out = runInsights(bhulekhLeaseRules, {
      ror: {
        ...baseRor,
        page1: {
          ...baseRor.page1,
          rightsOdia: "ସାଧାରଣ ବାହାକୀ",
          rightsText: "Sadharana Bahaki",
        },
      },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-180")).toBeUndefined();
  });

  it("does NOT fire when RoR is not verified", () => {
    const out = runInsights(bhulekhLeaseRules, {
      ror: { ...baseRor, status: "partial" },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-180")).toBeUndefined();
  });

  it("includes disclosure block with IGR manual-verification pointer", () => {
    const out = runInsights(bhulekhLeaseRules, { ror: baseRor });
    const r180 = out.find((i) => i.ruleId === "ROR-INS-180");
    expect(r180?.disclosure).toBeDefined();
    expect(r180?.disclosure?.howToVerify.toLowerCase()).toContain("igr");
  });
});

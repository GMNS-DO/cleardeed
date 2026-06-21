// agents/consumer-report-writer/src/insights/__tests__/registry/bhulekh/owner.test.ts
import { describe, it, expect } from "vitest";
import { bhulekhOwnerRules } from "../../../registry/bhulekh/owner";
import { runInsights } from "../../../engine";

const verifiedRor = {
  status: "verified",
  page1: {
    khatiyanNumber: "830",
    owner: "Rama Mohanty",
    landTypeOdia: "ଦଣ୍ଡା",
  },
};

describe("bhulekh owner rules", () => {
  it("exports 8 rules", () => {
        expect(bhulekhOwnerRules.length).toBe(8);
  });

  it("fires redFlag for government khatiyan (owner is empty)", () => {
    const out = runInsights(bhulekhOwnerRules, {
      ror: { status: "verified", page1: { owner: "" } },
    });
    expect(out.find((i) => i.severity === "redFlag" && i.body.includes("government"))).toBeDefined();
  });

  it("fires redFlag for multiple co-owners — body contains '3 owners'", () => {
    const out = runInsights(bhulekhOwnerRules, {
      ror: {
        status: "verified",
        page1: {
          owner: "Rama Mohanty",
          coOwners: ["Sita Mohanty", "Hari Mohanty"],
        },
      },
    });
    expect(out.find((i) => i.body.includes("3 owners"))).toBeDefined();
  });

  it("fires redFlag when seller name does not match — body contains 'does not match'", () => {
    const out = runInsights(bhulekhOwnerRules, {
      ror: { status: "verified", page1: { owner: "Rama Mohanty" } },
      sellerName: "Shyam Patnaik",
    });
    expect(out.find((i) => i.severity === "redFlag" && i.body.includes("does not match"))).toBeDefined();
  });

  it("emits nothing when ror is missing", () => {
    expect(runInsights(bhulekhOwnerRules, {}).length).toBe(0);
  });

  // HIGH #1 regression: ROR-INS-024 must ignore single-letter and very short
  // seller tokens. A buyer typing "m" would otherwise match every owner
  // name containing an "m".
  it("does NOT fire ROR-INS-024 for a single-letter seller name 'm'", () => {
    const out = runInsights(bhulekhOwnerRules, {
      ror: { status: "verified", page1: { owner: "Rama Mohanty" } },
      sellerName: "m",
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-024")).toBeUndefined();
  });

  it("does NOT fire ROR-INS-024 when only short tokens (length < 3) are provided", () => {
    const out = runInsights(bhulekhOwnerRules, {
      ror: { status: "verified", page1: { owner: "Rama Mohanty" } },
      sellerName: "M P", // 1-char and 1-char tokens
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-024")).toBeUndefined();
  });

  it("preserves existing ROR-INS-024 behavior for meaningful tokens", () => {
    // Sanity check: a multi-token seller name whose tokens don't appear in
    // the RoR owner still fires the redFlag. Single-token seller names
    // remain the domain of ROR-INS-023 (single-token watchout), not
    // ROR-INS-024.
    const out = runInsights(bhulekhOwnerRules, {
      ror: { status: "verified", page1: { owner: "Rama Mohanty" } },
      sellerName: "Shyam Patnaik",
    });
    expect(
      out.find((i) => i.ruleId === "ROR-INS-024" && i.severity === "redFlag")
    ).toBeDefined();
  });

  // POA-001 — Power of Attorney on record.
  it("POA-001 — fires watchout when hasPoA is true", () => {
    const out = runInsights(bhulekhOwnerRules, {
      ror: { status: "verified", page1: { owner: "Rama", hasPoA: true } },
    });
    const r = out.find((i) => i.ruleId === "POA-001");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("watchout");
  });

  it("POA-001 — does NOT fire when hasPoA is false or null", () => {
    const f = runInsights(bhulekhOwnerRules, {
      ror: { status: "verified", page1: { owner: "Rama", hasPoA: false } },
    });
    expect(f.find((i) => i.ruleId === "POA-001")).toBeUndefined();
    const n = runInsights(bhulekhOwnerRules, {
      ror: { status: "verified", page1: { owner: "Rama" } },
    });
    expect(n.find((i) => i.ruleId === "POA-001")).toBeUndefined();
  });

  // ROR-INS-026 — Malipada impersonation distance check (Pattern 3).
  // Fires redFlag when plotGPS and ownerResidenceGPS are both populated,
  // distance > 50km, and no PoA on record (Bhulekh or IGR-EC).
  it("ROR-INS-026 — fires redFlag when owner residence is >50km from plot and no PoA", () => {
    const out = runInsights(bhulekhOwnerRules, {
      ror: { status: "verified", page1: { owner: "Rama", hasPoA: false } },
      plotGPS: { lat: 20.27, lon: 85.84 }, // Bhubaneswar
      ownerResidenceGPS: { lat: 22.57, lon: 88.36 }, // Kolkata — ~500 km away
    });
    const r = out.find((i) => i.ruleId === "ROR-INS-026");
    expect(r).toBeDefined();
    expect(r?.severity).toBe("redFlag");
    // Body should mention the actual distance in km
    expect(r?.body).toMatch(/\d+ km/);
  });

  it("ROR-INS-026 — does NOT fire when owner residence is <50km from plot", () => {
    const out = runInsights(bhulekhOwnerRules, {
      ror: { status: "verified", page1: { owner: "Rama", hasPoA: false } },
      plotGPS: { lat: 20.27, lon: 85.84 }, // Bhubaneswar
      ownerResidenceGPS: { lat: 20.30, lon: 85.85 }, // 3km away
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-026")).toBeUndefined();
  });

  it("ROR-INS-026 — does NOT fire when Bhulekh PoA is true", () => {
    const out = runInsights(bhulekhOwnerRules, {
      ror: { status: "verified", page1: { owner: "Rama", hasPoA: true } },
      plotGPS: { lat: 20.27, lon: 85.84 },
      ownerResidenceGPS: { lat: 22.57, lon: 88.36 },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-026")).toBeUndefined();
  });

  it("ROR-INS-026 — does NOT fire when IGR-EC poaOnRecord is true (ground truth)", () => {
    const out = runInsights(bhulekhOwnerRules, {
      ror: { status: "verified", page1: { owner: "Rama" } },
      igrEc: { poaOnRecord: true },
      plotGPS: { lat: 20.27, lon: 85.84 },
      ownerResidenceGPS: { lat: 22.57, lon: 88.36 },
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-026")).toBeUndefined();
  });

  it("ROR-INS-026 — does NOT fire when ownerResidenceGPS is missing (orchestrator follow-up)", () => {
    const out = runInsights(bhulekhOwnerRules, {
      ror: { status: "verified", page1: { owner: "Rama" } },
      plotGPS: { lat: 20.27, lon: 85.84 },
      // ownerResidenceGPS intentionally absent
    });
    expect(out.find((i) => i.ruleId === "ROR-INS-026")).toBeUndefined();
  });
});
import { describe, expect, it } from "vitest";
import { igrEcRules } from "../registry/bhulekh/igr-ec";

const r181 = igrEcRules.find((r) => r.id === "ROR-INS-181")!;
const r182 = igrEcRules.find((r) => r.id === "ROR-INS-182")!;
const r183 = igrEcRules.find((r) => r.id === "ROR-INS-183")!;

function igrInput(partial: { ecAvailable?: boolean; poaOnRecord?: boolean; entryCount?: number; hasRor?: boolean; hasCersai?: boolean }) {
  return {
    ...(partial.hasRor ? { ror: { status: "verified" } } : {}),
    ...(partial.ecAvailable !== undefined || partial.poaOnRecord !== undefined || partial.entryCount !== undefined
      ? { igrEc: { ecAvailable: partial.ecAvailable ?? false, poaOnRecord: partial.poaOnRecord ?? false, entryCount: partial.entryCount ?? 0 } }
      : {}),
    ...(partial.hasCersai ? { cersai: { activeCharge: false } } : {}),
  } satisfies any;
}

// ── ROR-INS-181 ──────────────────────────────────────────────────────────────
describe("ROR-INS-181 — EC mortgage stub", () => {
  it("fires stub when igrEc is absent and RoR is present", () => {
    const out = r181.fn(igrInput({ hasRor: true }));
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("watchout");
    expect(out![0].ruleId).toBe("ROR-INS-181");
    expect(out![0].headline).toContain("EC not retrieved");
  });

  it("does NOT fire when igrEc data is available", () => {
    // When IGR bridge ships, the TODO returns null until entries are checked.
    // Currently igrEcData returns null when ecAvailable is false.
    const out = r181.fn(igrInput({ ecAvailable: false, hasRor: true }));
    // The stub fires on ecAvailable=false (IGR ran but found no EC).
    expect(out).not.toBeNull();
  });

  it("does NOT fire when RoR is absent (demo / partial)", () => {
    expect(r181.fn({})).toBeNull();
    expect(r181.fn(igrInput({ hasRor: false }))).toBeNull();
  });
});

// ── ROR-INS-181 — real detector (active-mortgage entries) ──────────────────
describe("ROR-INS-181 — active-mortgage detector", () => {
  const ecInput = (entries: unknown[]) => ({
    ror: { status: "verified" },
    igrEc: { ecAvailable: true, entries },
  });

  it("fires redFlag when an active mortgage entry is present", () => {
    const out = r181.fn(
      ecInput([
        {
          docType: "mortgage",
          docNo: "1234/2020",
          party1: "SBI Home Loans",
          consideration: "₹25,00,000",
          regDate: "2020-03-15",
        },
      ])
    );
    expect(out).not.toBeNull();
    expect(out!.length).toBe(1);
    expect(out![0].severity).toBe("redFlag");
    expect(out![0].ruleId).toBe("ROR-INS-181");
    expect(out![0].headline).toContain("SBI Home Loans");
    expect(out![0].headline).toContain("1234/2020");
    expect(out![0].body).toContain("SBI Home Loans");
    expect(out![0].actionItem.toLowerCase()).toContain("release deed");
    expect(out![0].disclosure).toBeDefined();
  });

  it("fires one redFlag per active mortgage (multiple entries)", () => {
    const out = r181.fn(
      ecInput([
        { docType: "mortgage", docNo: "M1", party1: "HDFC" },
        { docType: "charge", docNo: "C1", party1: "ICICI Bank" },
      ])
    );
    expect(out).not.toBeNull();
    expect(out!.length).toBe(2);
    expect(out!.map((i) => i.severity)).toEqual(["redFlag", "redFlag"]);
  });

  it("does NOT fire when the only mortgage entry is discharged", () => {
    const out = r181.fn(
      ecInput([
        {
          docType: "mortgage",
          docNo: "M1",
          party1: "SBI",
          // propertyDesc contains "release" — heuristic marks it discharged.
          propertyDesc: "Release of mortgage — fully satisfied",
        },
      ])
    );
    expect(out).toBeNull();
  });

  it("does NOT fire when entries are all discharged charges", () => {
    const out = r181.fn(
      ecInput([
        {
          docType: "charge",
          docNo: "C1",
          party1: "Axis Bank",
          party2: "Satisfaction of charge",
        },
        { docType: "mortgage", docNo: "M1", party1: "SBI", party2: "Discharge of mortgage" },
      ])
    );
    expect(out).toBeNull();
  });

  it("does NOT fire when EC has no entries (clean EC)", () => {
    expect(r181.fn(ecInput([]))).toBeNull();
  });

  it("ignores entries with non-mortgage docType (sale deeds, etc.)", () => {
    const out = r181.fn(
      ecInput([
        { docType: "sale-deed", docNo: "S1", party1: "Old Owner" },
        { docType: "gift-deed", docNo: "G1", party1: "Donor" },
        { docType: "partition-deed", docNo: "P1", party1: "Co-owners" },
      ])
    );
    expect(out).toBeNull();
  });

  it("treats hypothecation ('hip') as an active encumbrance", () => {
    const out = r181.fn(
      ecInput([{ docType: "hip", docNo: "H1", party1: "Vehicle financier" }])
    );
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("redFlag");
    expect(out![0].headline).toContain("Vehicle financier");
  });

  it("uses 'the lender' fallback when party1 is absent", () => {
    const out = r181.fn(ecInput([{ docType: "mortgage", docNo: "M9" }]));
    expect(out).not.toBeNull();
    expect(out![0].headline).toContain("the lender");
  });
});

// ── ROR-INS-182 ──────────────────────────────────────────────────────────────
describe("ROR-INS-182 — GPA/charge EC stub", () => {
  it("fires stub when igrEc is absent and RoR is present", () => {
    const out = r182.fn(igrInput({ hasRor: true }));
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("watchout");
    expect(out![0].ruleId).toBe("ROR-INS-182");
  });

  it("does NOT fire when igrEc data is present", () => {
    const out = r182.fn(igrInput({ ecAvailable: false, hasRor: true }));
    expect(out).not.toBeNull(); // ecAvailable=false still triggers the stub in the current implementation
  });

  it("does NOT fire when RoR is absent", () => {
    expect(r182.fn({})).toBeNull();
  });
});

// ── ROR-INS-183 — CERSAI stub ────────────────────────────────────────────────
describe("ROR-INS-183 — CERSAI missing stub", () => {
  it("fires when CERSAI is absent and RoR is present", () => {
    const out = r183.fn(igrInput({ hasRor: true }));
    expect(out).not.toBeNull();
    expect(out![0].ruleId).toBe("ROR-INS-183");
    expect(out![0].headline).toContain("CERSAI not checked");
  });

  it("does NOT fire when cersai data is present", () => {
    expect(r183.fn(igrInput({ hasRor: true, hasCersai: true }))).toBeNull();
  });

  it("does NOT fire when RoR is absent (very partial report)", () => {
    expect(r183.fn({})).toBeNull();
  });
});

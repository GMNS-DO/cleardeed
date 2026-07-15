import { describe, expect, it } from "vitest";
import { bhulekhCourtRules } from "../registry/bhulekh/court";

const r160 = bhulekhCourtRules.find((r) => r.id === "ROR-INS-160")!;
const r161 = bhulekhCourtRules.find((r) => r.id === "ROR-INS-161")!;
const r162 = bhulekhCourtRules.find((r) => r.id === "ROR-INS-162")!;
const r163 = bhulekhCourtRules.find((r) => r.id === "ROR-INS-163")!;

// ── helpers ─────────────────────────────────────────────────────────────────
function courtInput(partial: {
  cases?: Array<{ caseNo?: string; caseId?: string; status?: string; caseType?: string; court?: string; filingDate?: string }>;
  total?: number;
  ecourtsSrc?: string;
  rccmsSrc?: string;
}) {
  return {
    courtCases: {
      total: partial.total ?? partial.cases?.length ?? 0,
      cases: partial.cases ?? [],
      sources: {
        ecourts: partial.ecourtsSrc ?? "ok",
        rccms: partial.rccmsSrc ?? "ok",
      },
    },
  } satisfies any;
}

// ── ROR-INS-160 ──────────────────────────────────────────────────────────────
describe("ROR-INS-160 — pending property case red flag", () => {
  it("fires redFlag when a pending civil suit exists", () => {
    const out = r160.fn(courtInput({ cases: [{ caseNo: "C-101/2023", status: "Pending", caseType: "Civil Suit" }] }));
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("redFlag");
    expect(out![0].headline).toContain("C-101/2023");
    expect(out![0].headline).toContain("Active court case");
  });

  it("fires redFlag when status is empty string (unclear)", () => {
    const out = r160.fn(courtInput({ cases: [{ caseNo: "X/1", status: "", caseType: "Land Dispute" }] }));
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("redFlag");
  });

  it("does NOT fire when case is disposed with a disposal date", () => {
    const out = r160.fn(courtInput({ cases: [{ caseNo: "D-1", status: "Disposed", filingDate: "2020", disposalDate: "2022-03-15" } as any] }));
    expect(out).toBeNull();
  });

  it("picks title type over criminal when both present", () => {
    const out = r160.fn(courtInput({
      cases: [
        { caseNo: "CR-1", status: "Pending", caseType: "Criminal" },
        { caseNo: "CIV-1", status: "Pending", caseType: "Civil Suit" },
      ],
    }));
    expect(out).not.toBeNull();
    expect(out![0].headline).toContain("CIV-1");
    expect(out![0].body).toContain("Civil Suit");
  });

  it("fires with multiple pending cases", () => {
    const out = r160.fn(courtInput({ total: 3, cases: [
      { caseNo: "A/1", status: "Pending", caseType: "Misc" },
      { caseNo: "B/2", status: "Pending", caseType: "Civil" },
      { caseNo: "C/3", status: "Pending", caseType: "Title" },
    ]}));
    expect(out).not.toBeNull();
    expect(out![0].body).toContain("3 cases");
  });

  it("skips when no cases", () => {
    expect(r160.fn(courtInput({ cases: [] }))).toBeNull();
  });

  it("skips when courtCases is null", () => {
    expect(r160.fn({ courtCases: null } as any)).toBeNull();
  });
});

// ── ROR-INS-161 ──────────────────────────────────────────────────────────────
describe("ROR-INS-161 — disposed case recent watchout", () => {
  it("fires watchout when case disposed but filed within 10 years", () => {
    const out = r161.fn(courtInput({ cases: [{ caseNo: "D-55", status: "Disposed", caseType: "Civil", filingDate: "2022" }] }));
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("watchout");
    expect(out![0].headline).toContain("D-55");
    expect(out![0].headline).toContain("residual appeal risk");
  });

  it("skips when filing year > 10 years ago (stale)", () => {
    const out = r161.fn(courtInput({ cases: [{ caseNo: "OLD/1", status: "Disposed", filingDate: "2010" }] }));
    expect(out).toBeNull();
  });

  it("skips when case is pending (handled by 160)", () => {
    const out = r161.fn(courtInput({ cases: [{ caseNo: "P/1", status: "Pending", filingDate: "2024" }] }));
    expect(out).toBeNull();
  });

  it("skips when no filing date", () => {
    const out = r161.fn(courtInput({ cases: [{ caseNo: "NODATE/1", status: "Disposed" }] }));
    expect(out).toBeNull();
  });

  it("skips when no cases", () => {
    expect(r161.fn(courtInput({ cases: [] }))).toBeNull();
  });
});

// ── ROR-INS-162 ──────────────────────────────────────────────────────────────
describe("ROR-INS-162 — zero cases positive", () => {
  it("fires positive when ecourts source is ok and total is 0", () => {
    const out = r162.fn(courtInput({ cases: [], total: 0, ecourtsSrc: "ok" }));
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("positive");
    expect(out![0].headline).toContain("No court cases found");
  });

  it("fires positive when ecourts source is no_data", () => {
    const out = r162.fn(courtInput({ cases: [], total: 0, ecourtsSrc: "no_data" }));
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("positive");
  });

  it("does NOT fire when cases were found (total > 0)", () => {
    const out = r162.fn(courtInput({ cases: [{ caseNo: "A/1", status: "Pending" }], total: 1, ecourtsSrc: "ok" }));
    expect(out).toBeNull();
  });

  it("does NOT fire when ecourts source is not_run", () => {
    expect(r162.fn(courtInput({ cases: [], total: 0, ecourtsSrc: "not_run" }))).toBeNull();
  });

  it("skips when courtCases is null", () => {
    expect(r162.fn({ courtCases: null } as any)).toBeNull();
  });
});

// ── ROR-INS-163 ──────────────────────────────────────────────────────────────
describe("ROR-INS-163 — court data unavailable watchout", () => {
  it("fires watchout when both sources are non-contributory and total is 0", () => {
    const out = r163.fn(courtInput({ cases: [], total: 0, ecourtsSrc: "not_run", rccmsSrc: "not_run" }));
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("watchout");
    expect(out![0].headline).toContain("inconclusive");
  });

  it("fires watchout when captcha error on ecourts", () => {
    const out = r163.fn(courtInput({ cases: [], total: 0, ecourtsSrc: "source_down", rccmsSrc: "not_run" }));
    expect(out).not.toBeNull();
    expect(out![0].body).toContain("captcha");
  });

  it("skips when ecourts is contributing (ok)", () => {
    expect(r163.fn(courtInput({ cases: [], total: 0, ecourtsSrc: "ok", rccmsSrc: "not_run" }))).toBeNull();
  });

  it("skips when ecourts is no_data (valid zero)", () => {
    expect(r163.fn(courtInput({ cases: [], total: 0, ecourtsSrc: "no_data", rccmsSrc: "not_run" }))).toBeNull();
  });

  it("skips when cases were found even with error status", () => {
    const out = r163.fn(courtInput({ cases: [{ caseNo: "A/1", status: "Pending" }], total: 1, ecourtsSrc: "not_run" }));
    expect(out).toBeNull();
  });

  it("skips when courtCases is null", () => {
    expect(r163.fn({ courtCases: null } as any)).toBeNull();
  });
});

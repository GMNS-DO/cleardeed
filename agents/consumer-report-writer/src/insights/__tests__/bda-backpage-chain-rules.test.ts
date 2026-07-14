import { describe, expect, it } from "vitest";

// ── ROR-INS-153 ──────────────────────────────────────────────────────────────
import { zoningRules } from "../registry/recursive/zoning";

const r153 = zoningRules.find((r) => r.id === "ROR-INS-153")!;

function inputFor153(partial: {
  rorStatus?: string;
  bdaStatus?: string;
  zoneRows?: Array<{ zone?: { id?: string } }>;
} = {}) {
  return {
    ror: { status: partial.rorStatus ?? "verified" },
    bdaZoneData: partial.bdaStatus !== undefined
      ? {
          source: "bda-zoning",
          status: partial.bdaStatus,
          data: partial.zoneRows,
        }
      : null,
  } satisfies any;
}

describe("ROR-INS-153 — BDA industrial zone check", () => {
  it("fires redFlag when zone id is industrial", () => {
    const out = r153.fn(inputFor153({ bdaStatus: "ok", zoneRows: [{ zone: { id: "industrial", name: "Industrial" } }] }));
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("redFlag");
    expect(out![0].headline).toContain("Industrial");
    expect(out![0].ruleId).toBe("ROR-INS-153");
  });

  it("fires redFlag when zone id is industrial_2 (safety net)", () => {
    const out = r153.fn(inputFor153({ bdaStatus: "ok", zoneRows: [{ zone: { id: "industrial_2", name: "Industrial-2" } }] }));
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("redFlag");
  });

  it("does not fire when zone is residential", () => {
    const out = r153.fn(inputFor153({ bdaStatus: "ok", zoneRows: [{ zone: { id: "residential" } }] }));
    expect(out).toBeNull();
  });

  it("returns watchout when bdaZoneData is null", () => {
    const out = r153.fn({ ror: { status: "verified" }, bdaZoneData: null } as any);
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("watchout");
    expect(out![0].headline).toContain("outside BDA Master Plan");
  });

  it("returns watchout when BDA returns empty rows", () => {
    const out = r153.fn(inputFor153({ bdaStatus: "ok", zoneRows: [] }));
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("watchout");
    expect(out![0].headline).toContain("not classified");
  });

  it("returns watchout when BDA returns no_data status", () => {
    const out = r153.fn(inputFor153({ bdaStatus: "no_data" }));
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("watchout");
    expect(out![0].headline).toContain("not classified");
  });

  it("skips when RoR is unverified", () => {
    const out = r153.fn(inputFor153({ rorStatus: "error" }));
    expect(out).toBeNull();
  });

  it("skips when RoR is partial", () => {
    const out = r153.fn(inputFor153({ rorStatus: "partial" }));
    expect(out).toBeNull();
  });
});

// ─── Sprint 4: end-to-end BDA polygon → ROR-INS-153 redFlag firing ───────────
//
// These tests construct bdaZoneData in the shape the BDA zoning fetcher
// returns after a real point-in-polygon hit and confirm ROR-INS-153 fires
// redFlag. The BDA fetcher itself (packages/fetchers/bda-zoning) has its
// own unit tests for polygon containment. Here we verify the downstream
// insight engine consumes the shape correctly.

const CHANDAKA_POLYGON_HIT = {
  source: "bda-zoning",
  status: "success",
  statusReason: "polygon_overlay_match",
  data: [
    {
      tehsil: "Bhubaneswar",
      village: "Chandaka",
      locality: "Chandaka Industrial Estate",
      zone: { id: "industrial", name: "Industrial", description: "Areas designated for industrial activities", zoneCode: "I" },
    },
  ],
  warnings: [{ code: "polygon_overlay_limitation", message: "..." }],
};

const MANCHESWAR_POLYGON_HIT = {
  source: "bda-zoning",
  status: "success",
  statusReason: "polygon_overlay_match",
  data: [
    {
      tehsil: "Bhubaneswar",
      village: "Mancheswar",
      locality: "Mancheswar Industrial Estate",
      zone: { id: "industrial", name: "Industrial", description: "Areas designated for industrial activities", zoneCode: "I" },
    },
  ],
  warnings: [{ code: "polygon_overlay_limitation", message: "..." }],
};

describe("ROR-INS-153 — end-to-end polygon hit (Sprint 4)", () => {
  it("fires redFlag on a real Chandaka Industrial Estate GPS", () => {
    const out = r153.fn({
      ror: { status: "verified" },
      bdaZoneData: CHANDAKA_POLYGON_HIT,
    } as any);
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("redFlag");
    expect(out![0].ruleId).toBe("ROR-INS-153");
    expect(out![0].headline).toMatch(/bda industrial|chandaka/i);
  });

  it("fires redFlag on a real Mancheswar Industrial Estate GPS", () => {
    const out = r153.fn({
      ror: { status: "verified" },
      bdaZoneData: MANCHESWAR_POLYGON_HIT,
    } as any);
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("redFlag");
    expect(out![0].ruleId).toBe("ROR-INS-153");
    expect(out![0].headline).toMatch(/bda industrial|mancheswar/i);
  });

  it("does NOT fire industrial redFlag on a V1.1 demo Mendhasala GPS (out_of_scope)", () => {
    const out = r153.fn({
      ror: { status: "verified" },
      bdaZoneData: null,
    } as any);
    // Null bdaZoneData produces a watchout (outside BDA jurisdiction),
    // NOT a redFlag. This is the V1.1 demo-correct behavior.
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("watchout");
    expect(out![0].ruleId).toBe("ROR-INS-153");
    expect(out![0].headline.toLowerCase()).toContain("outside bda master plan");
  });
});

// ── ROR-INS-155 ──────────────────────────────────────────────────────────────
import { bhulekhChainGapRules } from "../registry/bhulekh/chain-gaps";

const r155 = bhulekhChainGapRules.find((r) => r.id === "ROR-INS-155")!;

function inputFor155(partial: {
  rorStatus?: string;
  mutationRefs?: Array<{ orderDate?: string }>;
  acquisitionYear?: string | null;
} = {}) {
  return {
    ror: {
      status: partial.rorStatus ?? "verified",
      mutationReferences: partial.mutationRefs,
      page1: { acquisitionYear: partial.acquisitionYear ?? null },
    },
  } satisfies any;
}

describe("ROR-INS-155 — title chain gaps", () => {
  it("skips when no mutation refs", () => {
    expect(r155.fn(inputFor155({ mutationRefs: [] }))).toBeNull();
  });

  it("skips when fewer than 2 parseable order dates", () => {
    const out = r155.fn(inputFor155({ mutationRefs: [{ orderDate: "2024" }] }));
    expect(out).toBeNull();
  });

  it("skips when span is < 15 years with few mutations", () => {
    const out = r155.fn(
      inputFor155({ mutationRefs: [{ orderDate: "2021" }, { orderDate: "2023" }] })
    );
    expect(out).toBeNull();
  });

  it("skips when span is < 8 years between consecutive entries", () => {
    const out = r155.fn(
      inputFor155({ mutationRefs: [{ orderDate: "2000" }, { orderDate: "2005" }, { orderDate: "2008" }] })
    );
    expect(out).toBeNull();
  });

  it("fires watchout when only 2 mutations over 15+ years", () => {
    const out = r155.fn(
      inputFor155({ mutationRefs: [{ orderDate: "2000-01" }, { orderDate: "2018" }] })
    );
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("watchout");
    expect(out![0].headline).toContain("Mutation chain gap");
  });

  it("fires watchout when a consecutive gap >= 8 years", () => {
    const out = r155.fn(
      inputFor155({
        mutationRefs: [{ orderDate: "1995" }, { orderDate: "2008" }, { orderDate: "2018" }],
      })
    );
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("watchout");
    expect(out![0].headline).toContain("Mutation chain gap");
  });

  it("mentions acquisition year when older than oldest mutation", () => {
    const out = r155.fn(
      inputFor155({
        mutationRefs: [{ orderDate: "2015" }],
        acquisitionYear: "1995",
      })
    );
    expect(out).toBeNull(); // only 1 parseable date → no gap signal
  });

  it("skips when RoR status is unverified", () => {
    const out = r155.fn(inputFor155({ rorStatus: "error", mutationRefs: [{ orderDate: "2000" }, { orderDate: "2020" }] }));
    expect(out).toBeNull();
  });

  it("skips when RoR status is partial", () => {
    const out = r155.fn(inputFor155({ rorStatus: "partial", mutationRefs: [{ orderDate: "2000" }, { orderDate: "2020" }] }));
    expect(out).toBeNull();
  });
});

// ── ROR-INS-156 ──────────────────────────────────────────────────────────────
import { bhulekhBackPageRemarksRules } from "../registry/bhulekh/back-page-remarks";

const r156 = bhulekhBackPageRemarksRules.find((r) => r.id === "ROR-INS-156")!;

function inputFor156(partial: {
  rorStatus?: string;
  backPage?: {
    status?: string;
    backPageRemarks?: Array<{
      category: "court_case" | "bank_charge" | "govt_restriction" | "other" | "unknown";
      rawText: string;
      extractedCaseNo?: string | null;
      extractedBankName?: string | null;
    }>;
  } | null;
} = {}) {
  return {
    ror: {
      status: partial.rorStatus ?? "verified",
      backPage: partial.backPage ?? { status: "success", backPageRemarks: [] },
    },
  } satisfies any;
}

describe("ROR-INS-156 — back-page remarks red flags", () => {
  it("skips when back page has no remarks", () => {
    expect(r156.fn(inputFor156({ backPage: { status: "success", backPageRemarks: [] } }))).toBeNull();
  });

  it("fires watchout for court_case", () => {
    const out = r156.fn(
      inputFor156({
        backPage: {
          status: "success",
          backPageRemarks: [{ category: "court_case", rawText: "Case pending", extractedCaseNo: "RFE/123/2024" }],
        },
      })
    );
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("watchout");
    expect(out![0].issueLens).toBe("title_chain");
    expect(out![0].headline).toContain("Case No. RFE/123/2024");
    expect(out![0].source).toBe("bhulekh:ror:page-2:remark:court_case");
  });

  it("fires watchout for bank_charge", () => {
    const out = r156.fn(
      inputFor156({
        backPage: {
          status: "success",
          backPageRemarks: [{ category: "bank_charge", rawText: "Bank charge", extractedBankName: "SBI" }],
        },
      })
    );
    expect(out).not.toBeNull();
    expect(out![0].severity).toBe("watchout");
    expect(out![0].issueLens).toBe("encumbrance_charge");
    expect(out![0].headline).toContain("SBI");
  });

  it("fires watchout for govt_restriction", () => {
    const out = r156.fn(
      inputFor156({
        backPage: {
          status: "success",
          backPageRemarks: [{ category: "govt_restriction", rawText: "Restriction under X Act" }],
        },
      })
    );
    expect(out).not.toBeNull();
    expect(out![0].issueLens).toBe("title_chain");
    expect(out![0].severity).toBe("watchout");
  });

  it("skips when back page parsing failed", () => {
    expect(r156.fn(inputFor156({ backPage: { status: "failed", backPageRemarks: [] } }))).toBeNull();
  });

  it("skips when back page has parse_error", () => {
    expect(r156.fn(inputFor156({ backPage: { status: "parse_error", backPageRemarks: [] } }))).toBeNull();
  });

  it("skips when RoR is unverified", () => {
    expect(
      r156.fn(
        inputFor156({
          rorStatus: "error",
          backPage: { status: "success", backPageRemarks: [{ category: "court_case", rawText: "x" }] },
        })
      )
    ).toBeNull();
  });

  it("skips unknown category", () => {
    const out = r156.fn(
      inputFor156({
        backPage: {
          status: "success",
          backPageRemarks: [{ category: "unknown", rawText: "Some random text" }],
        },
      })
    );
    expect(out).toBeNull();
  });

  it("skips remark with empty rawText", () => {
    const out = r156.fn(
      inputFor156({
        backPage: {
          status: "success",
          backPageRemarks: [{ category: "court_case", rawText: "" }],
        },
      })
    );
    expect(out).toBeNull();
  });

  it("handles missing backPage field", () => {
    expect(r156.fn(inputFor156({ backPage: null }))).toBeNull();
  });
});

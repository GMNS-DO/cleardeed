// agents/consumer-report-writer/src/__tests__/v12-fields-panel.test.ts
//
// T10 — render assertions for the V1.2 ground-truth field panel. Each
// V1.2 field (chauhaddiByPlot, section6, khewat, hasPoA, ownerFieldMissing,
// mutationReferences) is tested with present + absent branches.

import { describe, it, expect } from "vitest";
import { buildV12FieldPanel } from "../components/v12-fields";

describe("T10 — V1.2 ground-truth field panel", () => {
  it("returns empty when revenueRecords is null", () => {
    expect(buildV12FieldPanel({ revenueRecords: null, plotNo: "309" })).toBe("");
  });

  it("renders chauhaddi card when per-plot boundary bearings exist", () => {
    const rr = {
      chauhaddiByPlot: {
        "309": { north: "ରାସ୍ତା", south: "ନାଳ", east: "ପଡ଼ିଆ", west: "ଘର" },
      },
    };
    const html = buildV12FieldPanel({ revenueRecords: rr, plotNo: "309" });
    expect(html).toContain("GROUND TRUTH");
    expect(html).toContain("Chauhaddi");
    expect(html).toContain("North");
    expect(html).toContain("South");
    expect(html).toContain("East");
    expect(html).toContain("West");
    expect(html).toContain("bhulekh.ori.nic.in");
  });

  it("renders khewat + PoA + owner-field flags", () => {
    const rr = {
      raw: {
        khewatNo: "830",
        hasPoA: true,
        ownerFieldMissing: true,
      },
      record: { tenantBlockRawOdia: "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା" },
      parserVersion: "3.2",
    };
    const html = buildV12FieldPanel({ revenueRecords: rr, plotNo: "309" });
    expect(html).toContain("Khewat Number");
    expect(html).toContain("830");
    expect(html).toContain("Power of Attorney");
    expect(html).toContain("PoA inferred");
    expect(html).toContain("Owner field not readable");
    expect(html).toContain("କୃଷ୍ଣଚନ୍ଦ୍ର");
  });

  it("renders Section 6 reference when present", () => {
    const rr = {
      section6: { present: true, referenceCount: 1 },
    };
    const html = buildV12FieldPanel({ revenueRecords: rr, plotNo: "309" });
    expect(html).toContain("Section 6");
    expect(html).toContain("⚠ Section 6 reference found");
  });

  it("renders mutation references when list non-empty", () => {
    const rr = {
      mutationReferences: [
        {
          caseType: "MUT",
          caseNo: "M-1234/2022",
          orderDate: "2022-08-15",
          plotNo: "309",
        },
      ],
    };
    const html = buildV12FieldPanel({ revenueRecords: rr, plotNo: "309" });
    expect(html).toContain("Mutation references");
    expect(html).toContain("M-1234/2022");
    expect(html).toContain("2022-08-15");
    expect(html).toContain("anchor-only");
  });

  it("empty revenueRecords (no V1.2 fields) → empty html", () => {
    const html = buildV12FieldPanel({ revenueRecords: {}, plotNo: "309" });
    expect(html).toBe("");
  });

  it("escapes HTML in field values", () => {
    const rr = {
      chauhaddiByPlot: {
        "309": { north: "<script>alert(1)</script>" },
      },
    };
    const html = buildV12FieldPanel({ revenueRecords: rr, plotNo: "309" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

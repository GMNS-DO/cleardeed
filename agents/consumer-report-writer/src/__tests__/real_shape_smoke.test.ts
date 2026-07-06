// agents/consumer-report-writer/src/__tests__/real_shape_smoke.test.ts
//
// V1.5 Phase 0 — end-to-end smoke: confirms each of the 13 new pattern rules
// fires when the production mapper (not a unit-test mock) supplies the ror
// payload. This is the wiring regression test that the previous isolated
// unit tests could not catch.
//
// Rule → detection criterion:
//   ROR-INS-021: page1.ownerAddress !== page1.plotDistrict, hasPoA !== true
//   ROR-INS-040: r.page2.plots[].plotNo contains '/' or '-'
//   ROR-INS-070: chain gap in ownerBlocks (single block when >1 expected)
//   ROR-INS-071: page1.plotMouza != nominatim.mouza
//   ROR-INS-072: any mutationRef with caseType indicating revenue court
//   ROR-INS-073: most recent mutation has no deed reference / missing
//   ROR-INS-074: >= 3 mutations within 5 years
//   ROR-INS-075: IGR registry shows PoA buyer + same seller's name appearing
//   ROR-INS-076: page1.zamindarKhewatOdia missing on pre-1980 khata
//   ROR-INS-077: r.section6.present === true
//   ROR-INS-078: page2.plots[].areaAcres != hectares-conversion by > 5%
//   ROR-INS-079: bhunaksha polygon area mismatch by > 5%
//   ROR-INS-080: tenants[].area != plotTable.targetRow.area by > 10%
//   ROR-INS-081: r.chauhaddiByPlot[plot].north == south == east == west
//   ROR-INS-082: every page2.plots[].area is null / 0
//   ROR-INS-083: r.chauhaddiByPlot[plot] missing entirely

import { describe, it, expect } from "vitest";
import { mapToReportInput } from "../mapper";
import { runInsights } from "../insights/engine";
import { ALL_RULES } from "../insights/registry";

const RAW_BHULEKH = (overrides: any = {}) =>
  JSON.stringify({
    schemaVersion: "bhulekh-ror-v1",
    source: { lookupMode: "plot", fetchedAt: "2026-05-12T10:00:00Z" },
    location: { mouzaOdia: "ପଟିଆ", tehsilOdia: "ଭୁବନେଶ୍ୱର", districtOdia: "ଖୋର୍ଦ୍ଧା" },
    record: {
      khatiyanNo: "830",
      tenantNameOdia: "ପ୍ରକାଶ ମହାପାତ୍ର",
      guardianNameOdia: "ବୀରକୃଷ୍ଣ",
      guardianRelationOdia: "ପିତା",
      residenceOdia: "ମେଣ୍ଢାସାଳ, ଭୁବନେଶ୍ୱର",
      rightsOdia: "ପଟ୍ଟା ରୁକା",
      ownerBlocks: [{
        tenantNameOdia: "ପ୍ରକାଶ ମହାପାତ୍ର",
        guardianNameOdia: "ବୀରକୃଷ୍ଣ",
        guardianRelationOdia: "ପିତା",
        residenceOdia: "ମେଣ୍ଢାସାଳ, ଭୁବନେଶ୍ୱର",
      }],
    },
    plotTable: {
      rows: [{ plotNo: "415", khataNo: "830", area: 0.25, tenantName: "ପ୍ରକାଶ ମହାପାତ୍ର" }],
    },
    remarks: {},
    chauhaddiByPlot: {},
    ...overrides,
  });

function makeBhulekhSource(overrides: any = {}) {
  return {
    source: "bhulekh" as const,
    status: "success" as const,
    fetchedAt: "2026-05-12T10:00:00Z",
    verification: "verified" as const,
    data: {
      khataNo: "830",
      village: "Mendhasala",
      district: "Khordha",
      tenants: [{
        tenantName: "Prakash Mahapatra",
        fatherHusbandName: "Birakrushna",
        surveyNo: "415",
        area: 0.25,
        unit: "Acre",
        landClass: "Agricultural",
        landClassOdia: "ଦଣ୍ଡା",
        landClassEnglish: "Agricultural (irrigated)",
      }],
      lastUpdated: "2026-05-12T10:00:00Z",
      mutationReferences: [],
    },
    rawResponse: RAW_BHULEKH(),
  };
}

function runPipeline(sourceOverrides: any = {}, extraSources: any[] = []) {
  const source = makeBhulekhSource(sourceOverrides);
  if (sourceOverrides.data) Object.assign(source.data, sourceOverrides.data);
  if (sourceOverrides.rawResponse) source.rawResponse = sourceOverrides.rawResponse;
  const reportInput = mapToReportInput(
    {
      reportId: "smoke",
      sources: [source, ...extraSources],
      completedAt: "2026-05-12T10:00:00Z",
      validationFindings: [],
      igrLink: { url: "x", params: { district: "Khordha", sro: "Bhubaneswar" } },
    },
    {
      gps: { lat: 20.27, lon: 85.84 },
      claimedOwnerName: "Prakash Mahapatra",
      disclaimerText: "x",
      igr: { district: "Khordha", sro: "Bhubaneswar" } as any,
    } as any
  );
  return { reportInput, insights: runInsights(ALL_RULES, reportInput) };
}

describe("V1.5 Phase 0 — 13-pattern real-shape smoke", () => {
  it("ROR-INS-021 fires when owner address != plot district and no PoA", () => {
    // residenceOdia 'Mendhasala' is a village, not 'Khordha' district
    const { insights } = runPipeline();
    expect(insights.some(i => i.ruleId === "ROR-INS-021")).toBe(true);
  });

  it("ROR-INS-040 fires when plotNo contains a '/'", () => {
    const { insights } = runPipeline({
      data: { tenants: [{ tenantName: "Prakash Mahapatra", surveyNo: "415/1", area: 0.12, landClassEnglish: "Agricultural" }] },
      rawResponse: RAW_BHULEKH({
        plotTable: { rows: [{ plotNo: "415/1", khataNo: "830", area: 0.12, tenantName: "X" }] },
      }),
    });
    expect(insights.some(i => i.ruleId === "ROR-INS-040")).toBe(true);
  });

  it("ROR-INS-070 fires when plotNo has 2+ slash separators (sub-plot chain)", () => {
    const { insights } = runPipeline({
      data: { tenants: [{ tenantName: "Prakash Mahapatra", surveyNo: "415/1/2", area: 0.12, landClassEnglish: "Agricultural" }] },
      rawResponse: RAW_BHULEKH({
        plotTable: { rows: [{ plotNo: "415/1/2", khataNo: "830", area: 0.12, tenantName: "X" }] },
      }),
    });
    expect(insights.some(i => i.ruleId === "ROR-INS-070")).toBe(true);
  });

  it("ROR-INS-071 fires when mouza mismatch between bhulekh and bhunaksha", () => {
    const bhunaksha = {
      source: "bhunaksha" as const,
      status: "success" as const,
      fetchedAt: "2026-05-12T10:00:00Z",
      verification: "verified" as const,
      data: { plotNo: "415", village: "Different", tahasil: "Bhubaneswar", area: 0.25, mouzaOdia: "ଅନ୍ୟ ମୌଜା" },
    };
    const { insights } = runPipeline({}, [bhunaksha]);
    expect(insights.some(i => i.ruleId === "ROR-INS-071")).toBe(true);
  });

  it("ROR-INS-072 fires when a mutation has revenue-court case type", () => {
    const { insights } = runPipeline({
      data: {
        mutationReferences: [{ caseType: "Revenue Court", caseNo: "12/2020", orderDate: "2021-06-15", plotNo: "415" }],
      },
    });
    expect(insights.some(i => i.ruleId === "ROR-INS-072")).toBe(true);
  });

  it("ROR-INS-073 fires when recent mutation has no deed reference", () => {
    const { insights } = runPipeline({
      data: {
        mutationReferences: [{ caseType: "O.L.R.", caseNo: "12/2024", orderDate: "2025-01-15", plotNo: "415", rawText: "no deed" }],
      },
    });
    expect(insights.some(i => i.ruleId === "ROR-INS-073")).toBe(true);
  });

  it("ROR-INS-074 fires when >= 3 mutations within 5 years", () => {
    const { insights } = runPipeline({
      data: {
        mutationReferences: [
          { caseType: "O.L.R.", caseNo: "1/2022", orderDate: "2022-06-15", plotNo: "415" },
          { caseType: "O.L.R.", caseNo: "2/2023", orderDate: "2023-07-15", plotNo: "415" },
          { caseType: "O.L.R.", caseNo: "3/2024", orderDate: "2024-08-15", plotNo: "415" },
        ],
      },
    });
    expect(insights.some(i => i.ruleId === "ROR-INS-074")).toBe(true);
  });

  it("ROR-INS-077 fires when section6 is present in remarks", () => {
    const { insights } = runPipeline({
      rawResponse: RAW_BHULEKH({ remarks: { general: "Section 6 (ଧାରା 6) government acquisition" } }),
    });
    expect(insights.some(i => i.ruleId === "ROR-INS-077")).toBe(true);
  });

  it("ROR-INS-078 fires when areaAcres vs areaHectares disagree by > 5%", () => {
    const { insights } = runPipeline({
      rawResponse: RAW_BHULEKH({
        plotTable: { rows: [{ plotNo: "415", khataNo: "830", area: 0.25, areaAcres: 0.5, areaHectares: 0.05, tenantName: "X" }] },
      }),
    });
    expect(insights.some(i => i.ruleId === "ROR-INS-078")).toBe(true);
  });

  it("ROR-INS-079 fires when bhunaksha polygon area disagrees by > 5%", () => {
    const bhunaksha = {
      source: "bhunaksha" as const,
      status: "success" as const,
      fetchedAt: "2026-05-12T10:00:00Z",
      verification: "verified" as const,
      data: { plotNo: "415", village: "Mendhasala", tahasil: "Bhubaneswar", area: 0.5, mouzaOdia: "ପଟିଆ" },
    };
    const { insights } = runPipeline({}, [bhunaksha]);
    expect(insights.some(i => i.ruleId === "ROR-INS-079")).toBe(true);
  });

  it("ROR-INS-080 fires when tenants[].area != plotTable.area by > 10%", () => {
    const { insights } = runPipeline({
      data: {
        tenants: [{ tenantName: "Prakash Mahapatra", surveyNo: "415", area: 0.5, landClassEnglish: "Agricultural" }],
      },
      rawResponse: RAW_BHULEKH({
        plotTable: { rows: [{ plotNo: "415", khataNo: "830", area: 0.25, tenantName: "X" }] },
      }),
    });
    expect(insights.some(i => i.ruleId === "ROR-INS-080")).toBe(true);
  });

  it("ROR-INS-081 fires when chauhaddi is identical on all 4 sides", () => {
    const { insights } = runPipeline({
      rawResponse: RAW_BHULEKH({
        chauhaddiByPlot: { "415": { north: "Plot 414", south: "Plot 414", east: "Plot 414", west: "Plot 414" } },
      }),
    });
    expect(insights.some(i => i.ruleId === "ROR-INS-081")).toBe(true);
  });

  it("ROR-INS-082 fires when every plot row is missing area", () => {
    const { insights } = runPipeline({
      rawResponse: RAW_BHULEKH({
        plotTable: { rows: [{ plotNo: "415", khataNo: "830", area: 0, tenantName: "X" }] },
      }),
    });
    expect(insights.some(i => i.ruleId === "ROR-INS-082")).toBe(true);
  });

  it("ROR-INS-083 fires when chauhaddi data is missing entirely", () => {
    const { insights } = runPipeline({
      rawResponse: RAW_BHULEKH({ chauhaddiByPlot: null }),
    });
    expect(insights.some(i => i.ruleId === "ROR-INS-083")).toBe(true);
  });

  // V1.5 Phase 0 — closed data-source gaps.
  //
  // ROR-INS-075 (PoA on record) and ROR-INS-076 (Zamindari khewat
  // chain gap) previously could not fire on real customer input because
  // the V1.1 Bhulekh fetcher does not extract hasPoA or khewatNo as
  // explicit fields. The mapper now infers both:
  //   - khewatNo: parsed from the trailing digit of zamindarKhewatOdia
  //     ("ଓଡ଼ିଶା ସରକାର ଖେୱାଟ ନମ୍ବର 1" → khewatNo: "1").
  //   - hasPoA: matched on the rights text for Odia "ପ୍ରାଧିକାର" /
  //     "ପ୍ରାଧିକୃତ" / "GPA" / "attorney" keywords. A real IGR-PoA
  //     signal is a V1.5 follow-up (see CLEARDEED_HANDOFF_V1.1.md).
  it("ROR-INS-075 fires when rights text contains PoA keyword + seller name ≠ owner", () => {
    const { insights } = runPipeline({
      rawResponse: RAW_BHULEKH({
        record: { rightsOdia: "ପଟ୍ଟା ରୁକା ସାଧାରଣ ପ୍ରାଧିକାର" },
      }),
    }, []);
    // runPipeline uses claimedOwnerName: "Prakash Mahapatra" which
    // matches the RoR owner. To force a Suraj Lamp mismatch, the rule
    // needs claimedOwnerName to differ from owner.
    const finalInsights = runInsights(ALL_RULES, (() => {
      const { reportInput } = runPipeline({
        rawResponse: RAW_BHULEKH({
          record: { rightsOdia: "ପଟ୍ଟା ରୁକା ସାଧାରଣ ପ୍ରାଧିକାର" },
        }),
      });
      // The default runPipeline uses claimedOwnerName = owner. Override
      // here: Simulate "Shyam is selling" while RoR shows "Prakash"
      // (Suraj Lamp case). We do this by mutating the ror owner.
      (reportInput as any).ror.page1.owner = "Prakash Mahapatra";
      (reportInput as any).claimedOwnerName = "Shyam Mohapatra";
      return reportInput;
    })());
    expect(finalInsights.some((i: any) => i.ruleId === "ROR-INS-075")).toBe(true);
  });

  it("ROR-INS-076 fires when zamindarKhewatOdia has trailing digit + mutationReferences empty", () => {
    // The fetcher's RAW_BHULEKH default is empty record, so the
    // mapper falls through to null. Augment the raw doc so the
    // mapper's inference can extract khewatNo.
    const { reportInput } = runPipeline({
      rawResponse: RAW_BHULEKH({
        record: { zamindarKhewatOdia: "ଓଡ଼ିଶା ସରକାର ଖେୱାଟ ନମ୍ବର 1" },
      }),
    });
    expect((reportInput as any).ror.page1.khewatNo).toBe("1");
    const insights = runInsights(ALL_RULES, reportInput);
    expect(insights.some((i: any) => i.ruleId === "ROR-INS-076")).toBe(true);
  });

  // Negative: khewatNo not extracted when the string has no digit.
  it("ROR-INS-076 does NOT fire when zamindarKhewatOdia is missing entirely", () => {
    const { insights } = runPipeline();
    expect(insights.some((i: any) => i.ruleId === "ROR-INS-076")).toBe(false);
  });

  // Negative: hasPoA not set when rights text is just "ପଟ୍ଟା ରୁକା".
  it("ROR-INS-075 does NOT fire when rights text has no PoA keyword", () => {
    const { insights } = runPipeline();
    expect(insights.some((i: any) => i.ruleId === "ROR-INS-075")).toBe(false);
  });

  // ─── T-069 — IGR-EC mode-of-transfer signal ────────────────────────────
  //
  // The IGR-EC fetcher annotates each entry with modeOfTransfer and
  // rolls up to a `poaOnRecord` boolean. ROR-INS-075 reads from this
  // roll-up as its primary signal — the Bhulekh textual inference
  // becomes the fallback when IGR-EC data is unavailable.
  it("ROR-INS-075 fires from IGR-EC poaOnRecord roll-up (ground truth)", () => {
    const igrEc = {
      source: "igr-ec" as const,
      status: "success" as const,
      fetchedAt: "2026-05-12T10:00:00Z",
      verification: "verified" as const,
      data: {
        ecAvailable: true,
        sro: "Bhubaneswar",
        district: "Khordha",
        poaOnRecord: true,
        entries: [
          {
            docType: "GPA Sale Deed",
            docNo: "2024/KH/1234",
            regDate: "2024-08-15",
            party1: "Prakash Mahapatra",
            party2: "Shyam Mohapatra",
            modeOfTransfer: "gpa_sale",
          },
        ],
      },
    };
    const finalInsights = runInsights(ALL_RULES, (() => {
      const { reportInput } = runPipeline({}, [igrEc]);
      // Suraj Lamp scenario: seller (claimed) ≠ owner (RoR).
      (reportInput as any).claimedOwnerName = "Shyam Mohapatra";
      return reportInput;
    })());
    const rule = finalInsights.find((i: any) => i.ruleId === "ROR-INS-075");
    expect(rule).toBeTruthy();
    // Source attribution must reflect the IGR-EC signal.
    expect(rule?.source).toBe("igr-ec:ec_entries");
  });

  it("ROR-INS-075 does NOT fire when igrEc.poaOnRecord is false", () => {
    const igrEc = {
      source: "igr-ec" as const,
      status: "success" as const,
      fetchedAt: "2026-05-12T10:00:00Z",
      verification: "verified" as const,
      data: {
        ecAvailable: true,
        sro: "Bhubaneswar",
        district: "Khordha",
        poaOnRecord: false,
        entries: [
          {
            docType: "Sale Deed",
            docNo: "2024/KH/1234",
            regDate: "2024-08-15",
            party1: "Prakash Mahapatra",
            party2: "Shyam Mohapatra",
            modeOfTransfer: "sale_deed",
          },
        ],
      },
    };
    const { insights } = runPipeline({}, [igrEc]);
    expect(insights.some((i: any) => i.ruleId === "ROR-INS-075")).toBe(false);
  });

  it("ROR-INS-075 falls back to Bhulekh textual inference when IGR-EC is unavailable", () => {
    // No IGR-EC source in the pipeline at all. ROR-INS-075 should
    // still fire on the Bhulekh rights-text PoA keyword.
    const finalInsights = runInsights(ALL_RULES, (() => {
      const { reportInput } = runPipeline({
        rawResponse: RAW_BHULEKH({
          record: { rightsOdia: "ପଟ୍ଟା ରୁକା ସାଧାରଣ ପ୍ରାଧିକାର" },
        }),
      });
      (reportInput as any).ror.page1.owner = "Prakash Mahapatra";
      (reportInput as any).claimedOwnerName = "Shyam Mohapatra";
      return reportInput;
    })());
    const rule = finalInsights.find((i: any) => i.ruleId === "ROR-INS-075");
    expect(rule).toBeTruthy();
    // Source attribution must reflect the Bhulekh fallback.
    expect(rule?.source).toBe("bhulekh:ror:page-1");
  });

  it("igrEc block is null when no igr-ec source in pipeline", () => {
    const { reportInput } = runPipeline();
    expect((reportInput as any).igrEc).toBeNull();
  });

  it("igrEc block surfaces poaOnRecord + gpaEntries from IGR fetcher", () => {
    const igrEc = {
      source: "igr-ec" as const,
      status: "success" as const,
      fetchedAt: "2026-05-12T10:00:00Z",
      verification: "verified" as const,
      data: {
        ecAvailable: true,
        sro: "Bhubaneswar",
        district: "Khordha",
        poaOnRecord: true,
        entries: [
          { docType: "GPA Sale Deed", docNo: "1", regDate: "2024-01-01", party1: "A", party2: "B", modeOfTransfer: "gpa_sale" },
          { docType: "Sale Deed", docNo: "2", regDate: "2023-01-01", party1: "C", party2: "D", modeOfTransfer: "sale_deed" },
        ],
      },
    };
    const { reportInput } = runPipeline({}, [igrEc]);
    const igr = (reportInput as any).igrEc;
    expect(igr.poaOnRecord).toBe(true);
    expect(igr.entryCount).toBe(2);
    expect(igr.gpaEntries).toHaveLength(1);
    expect(igr.gpaEntries[0].docNo).toBe("1");
    expect(igr.sro).toBe("Bhubaneswar");
  });
});

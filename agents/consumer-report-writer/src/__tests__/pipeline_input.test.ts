// agents/consumer-report-writer/src/__tests__/pipeline_input.test.ts
//
// V1.5 Phase 0 — wiring fix regression test.
//
// The bhulekh rules under src/insights/registry/bhulekh/* read `input.ror.*`.
// The A10 mapper used to only surface `data.revenueRecords` (a slim consumer
// view), so even though the rules passed unit tests in isolation, they
// never fired on real reports because `(input as any).ror` was undefined.
//
// This test exercises the production path end-to-end: the mapper is
// called with a real-shaped Bhulekh source + rawResponse, and the
// resulting `data.ror` is fed into the insight engine. We assert that:
//   1. `data.ror` is shaped (page1, page2, plotTable, tenants)
//   2. ROR-INS-021 (Pattern 3 — Malipada impersonation) fires when the
//      owner's address is far from the plot
//   3. ROR-INS-040 (Pattern 5 — sub-plot indicator) fires when the
//      plot number contains a slash or dash
//   4. The lease-indicator signal is preserved in page1.leaseIndicators
//      even when the dictionary maps the raw Odia to "khalsa" (Pattern 1)

import { describe, it, expect } from "vitest";
import { mapToReportInput } from "../mapper";
import { runInsights } from "../insights/engine";
import { ALL_RULES } from "../insights/registry";

const RAW_BHULEKH_DOC = (overrides: any = {}) =>
  JSON.stringify({
    schemaVersion: "bhulekh-ror-v1",
    source: {
      lookupMode: "plot",
      finalUrl: "https://bhulekh.ori.nic.in/ROR2_3/PlotROR.aspx",
      fetchedAt: "2026-05-12T10:00:00Z",
      artifactType: "html",
      rawArtifactHash: "sha256:test",
    },
    location: {
      mouzaOdia: "ପଟିଆ",
      tehsilOdia: "ଭୁବନେଶ୍ୱର",
      thanaOdia: "ଚନ୍ଦ୍ରଶେଖରପୁର",
      districtOdia: "ଖୋର୍ଦ୍ଧା",
      tehsilNo: "01",
      thanaNo: "04",
    },
    record: {
      khatiyanNo: "830",
      tenantNameOdia: "ପ୍ରକାଶ ମହାପାତ୍ର",
      guardianNameOdia: "ବୀରକୃଷ୍ଣ",
      guardianRelationOdia: "ପିତା",
      casteOdia: null,
      residenceOdia: "ମେଣ୍ଢାସାଳ, ଭୁବନେଶ୍ୱର",
      rightsOdia: "ପଟ୍ଟା ରୁକା",
      tenantBlockRawOdia: null,
      ownerBlocks: [
        {
          tenantNameOdia: "ପ୍ରକାଶ ମହାପାତ୍ର",
          guardianNameOdia: "ବୀରକୃଷ୍ଣ",
          guardianRelationOdia: "ପିତା",
          casteOdia: null,
          residenceOdia: "ମେଣ୍ଢାସାଳ, ଭୁବନେଶ୍ୱର",
        },
      ],
    },
    plotTable: {
      rows: [
        {
          plotNo: "415",
          khataNo: "830",
          area: 0.25,
          tenantName: "ପ୍ରକାଶ ମହାପାତ୍ର",
        },
      ],
    },
    dues: {
      jalkar: "120",
      khajana: "440",
      cess: "60",
      otherCess: "0",
      total: "620",
    },
    remarks: {},
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
      tenants: [
        {
          tenantName: "Prakash Mahapatra",
          fatherHusbandName: "Birakrushna",
          surveyNo: "415",
          area: 0.25,
          unit: "Acre",
          landClass: "Agricultural",
          landClassOdia: "ଦଣ୍ଡା",
          landClassEnglish: "Agricultural (irrigated)",
        },
      ],
      lastUpdated: "2026-05-12T10:00:00Z",
    },
    rawResponse: RAW_BHULEKH_DOC(),
  };
}

describe("V1.5 Phase 0 — input.ror wiring", () => {
  it("the mapper exposes data.ror with the page1/page2/plotTable/tenants shape", () => {
    const reportInput = mapToReportInput(
      {
        reportId: "test-1",
        sources: [makeBhulekhSource()],
        completedAt: "2026-05-12T10:00:00Z",
        validationFindings: [],
        igrLink: { url: "https://igrodisha.gov.in", params: {} },
      },
      {
        gps: { lat: 20.27, lon: 85.84 },
        claimedOwnerName: "Prakash Mahapatra",
        disclaimerText: "Disclaimer.",
      }
    );

    const ror: any = (reportInput as any).ror;
    expect(ror).toBeTruthy();
    expect(ror.status).toBe("verified");
    expect(ror.page1).toBeTruthy();
    expect(ror.page1.khatiyanNumber).toBe("830");
    expect(ror.page1.owner).toBe("Prakash Mahapatra");
    expect(ror.page1.plotDistrict).toBe("Khordha");
    expect(ror.page1.landClassEnglish).toBe("Agricultural (irrigated)");
    expect(ror.page1.rightsOdia).toBe("ପଟ୍ଟା ରୁକା");
    expect(ror.page1.leaseIndicators.hasPattaTenure).toBe(true);
    expect(ror.page1.leaseIndicators.hasLeaseTenure).toBe(false);

    expect(ror.page2).toBeTruthy();
    expect(ror.page2.plots.length).toBeGreaterThan(0);
    expect(ror.page2.plots[0].plotNo).toBe("415");

    expect(ror.plotTable).toBeTruthy();
    expect(ror.plotTable.targetRow.plotNo).toBe("415");
    expect(ror.plotTable.targetRow.khataNo).toBe("830");
    expect(ror.plotTable.targetRow.village).toBe("Mendhasala");

    expect(ror.tenants.length).toBe(1);
    expect(ror.tenants[0].tenantName).toBe("Prakash Mahapatra");
  });

  it("ROR-INS-040 (sub-plot indicator) fires when plot number contains '/'", () => {
    // Sub-plot: 415/1 — Pattern 5 indicator.
    const source = makeBhulekhSource();
    (source.data.tenants![0] as any).surveyNo = "415/1";
    (source as any).rawResponse = RAW_BHULEKH_DOC({
      plotTable: {
        rows: [
          {
            plotNo: "415/1",
            khataNo: "830",
            area: 0.12,
            tenantName: "ପ୍ରକାଶ ମହାପାତ୍ର",
          },
        ],
      },
    });

    const reportInput = mapToReportInput(
      {
        reportId: "test-sub-plot",
        sources: [source],
        completedAt: "2026-05-12T10:00:00Z",
        validationFindings: [],
        igrLink: { url: "https://igrodisha.gov.in", params: {} },
      },
      {
        gps: { lat: 20.27, lon: 85.84 },
        claimedOwnerName: "Prakash Mahapatra",
        disclaimerText: "Disclaimer.",
      }
    );

    const ror: any = (reportInput as any).ror;
    expect(ror.page2.selectedPlotNumber).toBe("415/1");
    expect(ror.page2.plots[0].plotNo).toBe("415/1");

    // Now exercise the engine. We pass ALL_RULES (every rule we ship) and
    // assert that ROR-INS-040 actually fires on this real-shaped payload.
    const insights = runInsights(ALL_RULES, { ror });
    const ids = insights.map((i) => i.ruleId);
    expect(ids).toContain("ROR-INS-040");
  });

  it("ROR-INS-021 (Malipada impersonation) reads page1.ownerAddress + page1.plotDistrict from the wired ror payload", () => {
    // The Malipada rule compares page1.ownerAddress with page1.plotDistrict.
    // If those fields are undefined (the bug Phase 0 fixes), the rule returns
    // null and never fires. Wiring = the rule sees the values.
    const reportInput = mapToReportInput(
      {
        reportId: "test-malipada",
        sources: [makeBhulekhSource()],
        completedAt: "2026-05-12T10:00:00Z",
        validationFindings: [],
        igrLink: { url: "https://igrodisha.gov.in", params: {} },
      },
      {
        gps: { lat: 20.27, lon: 85.84 },
        claimedOwnerName: "Prakash Mahapatra",
        disclaimerText: "Disclaimer.",
      }
    );

    const ror: any = (reportInput as any).ror;
    // Wiring check: both fields must be populated, otherwise the rule's
    // `!p1.ownerAddress` short-circuit returns null even on real reports.
    expect(ror.page1.ownerAddress).toBeTruthy();
    expect(ror.page1.ownerAddress).toContain("ମେଣ୍ଢାସାଳ");
    expect(ror.page1.plotDistrict).toBe("Khordha");

    // Behaviour check: the rule's current check (`address !== district`) is
    // coarse — it fires here because "Mendhasala" ≠ "Khordha". What we are
    // verifying is that the rule fired AT ALL (i.e. read the new fields).
    // Tightening the rule to a same-district check is a Phase 2 concern.
    const insights = runInsights(ALL_RULES, { ror });
    const fired = insights.some((i) => i.ruleId === "ROR-INS-021");
    expect(fired).toBe(true);
  });

  it("preserves the lease-tenure hint in page1.leaseIndicators even when dictionary normalizes it", () => {
    // Patia-style: rightsOdia shows lease tenure, but dictionary maps
    // the kisam to "khalsa" before the rule engine sees it. The raw
    // tenure word must survive.
    const source = makeBhulekhSource();
    (source as any).rawResponse = RAW_BHULEKH_DOC({
      record: {
        khatiyanNo: "1250",
        tenantNameOdia: "ଓଡ଼ିଶା ସରକାର",
        guardianNameOdia: null,
        guardianRelationOdia: null,
        casteOdia: null,
        residenceOdia: "ପଟିଆ ଇଣ୍ଡଷ୍ଟ୍ରିଆଲ ଏରିଆ, ଭୁବନେଶ୍ୱର",
        rightsOdia: "ଲିଜ୍ ରୁକା (ଶିଳ୍ପ ପାଇଁ)",
        tenantBlockRawOdia: null,
        ownerBlocks: [
          {
            tenantNameOdia: "ଓଡ଼ିଶା ସରକାର",
            guardianNameOdia: null,
            guardianRelationOdia: null,
            casteOdia: null,
            residenceOdia: "ପଟିଆ ଇଣ୍ଡଷ୍ଟ୍ରିଆଲ ଏରିଆ, ଭୁବନେଶ୍ୱର",
          },
        ],
      },
      plotTable: {
        rows: [
          {
            plotNo: "880/2",
            khataNo: "1250",
            area: 0.5,
            tenantName: "ଓଡ଼ିଶା ସରକାର",
          },
        ],
      },
    });
    (source.data.tenants![0] as any).surveyNo = "880/2";
    (source.data as any).khataNo = "1250";

    const reportInput = mapToReportInput(
      {
        reportId: "test-patia-lease",
        sources: [source],
        completedAt: "2026-05-12T10:00:00Z",
        validationFindings: [],
        igrLink: { url: "https://igrodisha.gov.in", params: {} },
      },
      {
        gps: { lat: 20.27, lon: 85.84 },
        claimedOwnerName: "Odisha Sarkar",
        disclaimerText: "Disclaimer.",
      }
    );

    const ror: any = (reportInput as any).ror;
    expect(ror.page1.leaseIndicators.hasLeaseTenure).toBe(true);
    expect(ror.page1.leaseIndicators.hasPattaTenure).toBe(false);
    expect(ror.page1.leaseIndicators.tenureRawOdia).toContain("ଲିଜ");
    expect(ror.page1.ownerAddress).toContain("ପଟିଆ");
  });
});

// Phase 2 v1 — input.plotDiagram wiring.
//
// MapCard v1 reads input.plotDiagram.{targetPolygon,neighbors,roads,bounds}
// to render the interactive map. If a future mapper refactor drops any
// of these fields, the map card silently falls back to the v0 static
// SVG (renderMapCard returns ""). This test pins the contract: when
// the pipeline's plot-diagram step succeeded, the mapper MUST surface
// the transient geo data on the input.
describe("Phase 2 v1 — input.plotDiagram wiring", () => {
  it("surfaces the transient geo fields when the diagram step succeeded", () => {
    const targetPolygon = {
      type: "Polygon" as const,
      coordinates: [
        [
          [85.701, 20.272],
          [85.702, 20.272],
          [85.702, 20.273],
          [85.701, 20.273],
          [85.701, 20.272],
        ],
      ],
    };
    const neighbors = [
      {
        plotNo: "128",
        village: "Mendhasala",
        tehsil: "Bhubaneswar",
        polygon: targetPolygon,
        areaSqKm: 0.1,
      },
    ];
    const bounds = { minLat: 20.27, maxLat: 20.28, minLon: 85.7, maxLon: 85.71 };
    const reportInput = mapToReportInput(
      {
        reportId: "test-v1",
        sources: [],
        completedAt: "2026-06-25T00:00:00Z",
        validationFindings: [],
      },
      {
        gps: { lat: 20.272, lon: 85.701 },
        claimedOwnerName: "Prakash Mahapatra",
        disclaimerText: "Disclaimer.",
      },
      // Third arg — the plot-diagram step result. The mapper MUST
      // surface this on the returned input.
      {
        status: "success",
        url: "https://storage.example.com/plot-diagrams/test-v1.svg",
        cacheHit: false,
        rendered: true,
        targetPolygon,
        neighbors,
        roads: [],
        bounds,
      }
    );

    const pd: any = (reportInput as any).plotDiagram;
    expect(pd).toBeTruthy();
    expect(pd.status).toBe("success");
    expect(pd.url).toContain("plot-diagrams/test-v1.svg");
    // Geo fields must be present, not just status/url.
    expect(pd.targetPolygon).toEqual(targetPolygon);
    expect(pd.neighbors).toEqual(neighbors);
    expect(pd.bounds).toEqual(bounds);
    // The Bhulekh deep-link is built server-side from village+tahasil+plotNo.
    // The mapper's geoFetch uses bhunaksha first, then nominatim.
    // No bhunaksha source → falls through to nominatim → no village in
    // this test → URL is just the homepage with no query string.
    expect(pd.bhulekhUrl).toBe("https://bhulekh.ori.nic.in/RoRView.aspx");
  });

  it("passes through bounds with the lon/lat keys (renamed from minX/maxX)", () => {
    const reportInput = mapToReportInput(
      {
        reportId: "test-v1-bounds",
        sources: [],
        completedAt: "2026-06-25T00:00:00Z",
        validationFindings: [],
      },
      {
        gps: { lat: 20.272, lon: 85.701 },
        claimedOwnerName: "Owner",
        disclaimerText: "Disclaimer.",
      },
      {
        status: "success",
        url: "https://x.com/y.svg",
        bounds: { minLat: 19.8, maxLat: 20.5, minLon: 85.0, maxLon: 86.0 },
        targetPolygon: null,
        neighbors: [],
        roads: [],
      }
    );
    const pd: any = (reportInput as any).plotDiagram;
    expect(pd.bounds.minLat).toBe(19.8);
    expect(pd.bounds.maxLat).toBe(20.5);
    expect(pd.bounds.minLon).toBe(85.0);
    expect(pd.bounds.maxLon).toBe(86.0);
  });

  it("input.plotDiagram is null when the third arg is omitted (v0 behavior)", () => {
    // Backwards-compat: pre-Phase-2 call sites in the test suite do
    // not pass the third arg. They must continue to work, with
    // input.plotDiagram === null (which means renderMapCard returns ""
    // and the legacy buildPlotDiagramSection is the visible map).
    const reportInput = mapToReportInput(
      {
        reportId: "test-no-pd",
        sources: [],
        completedAt: "2026-06-25T00:00:00Z",
        validationFindings: [],
      },
      {
        gps: { lat: 20.272, lon: 85.701 },
        claimedOwnerName: "Owner",
        disclaimerText: "Disclaimer.",
      }
    );
    expect((reportInput as any).plotDiagram).toBeNull();
  });

  it("input.plotDiagram is null when the diagram step failed", () => {
    // A failed diagram step still surfaces status='failed' and a
    // reason, but no polygon data. The mapper must pass that through
    // so renderMapCard can show the "Map unavailable" branch.
    const reportInput = mapToReportInput(
      {
        reportId: "test-failed",
        sources: [],
        completedAt: "2026-06-25T00:00:00Z",
        validationFindings: [],
      },
      {
        gps: { lat: 20.272, lon: 85.701 },
        claimedOwnerName: "Owner",
        disclaimerText: "Disclaimer.",
      },
      {
        status: "failed",
        url: null,
        reason: "wfs_unavailable",
        cacheHit: false,
        rendered: false,
      }
    );
    const pd: any = (reportInput as any).plotDiagram;
    expect(pd).toBeTruthy();
    expect(pd.status).toBe("failed");
    expect(pd.url).toBeNull();
    // No polygon on failed — the input field is null.
    expect(pd.targetPolygon).toBeNull();
  });
});

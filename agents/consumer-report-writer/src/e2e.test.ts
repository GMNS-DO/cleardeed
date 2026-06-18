/**
 * E2E regression test for Sprint 5 exit criterion #6.
 *
 * The full report must produce all 6 buyer-facing sections without
 * crashing, and each section must contain at least the minimum
 * expected content. Two cases:
 *
 *   1. "renders all 6 sections for a complete Khordha input"
 *      — every optional fetcher returns success, so each section
 *        has substantive content.
 *   2. "renders gracefully when optional fetchers fail"
 *      — every optional fetcher returns failure, so each section
 *        renders an "unavailable" caveat but the report still
 *        composes.
 *
 * The 6 sections asserted (per PRODUCT_SPEC §3, as wired up in
 * agents/consumer-report-writer/src/index.ts):
 *
 *   1. The Plot                → id="section-plot"
 *   2. The Owner               → id="section-owner"
 *   3. What you can build       → id="section-land" (BDA + kisam)
 *   4. What you might lose     → id="section-encumbrance" (eCourts + EC + RCCMS + CERSAI)
 *   5. Adjacent plots           → id="section-adjacent-plots"
 *   6. What it's worth          → id="section-benchmark" (circle rate)
 */
import { describe, it, expect } from "vitest";
import { generateConsumerReport } from "./index";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const KHA_AK = "CLD-E2E-COMPLETE-001";
const KHA_BK = "CLD-E2E-DEGRADED-001";

/**
 * A complete Khordha input. Every optional fetcher has returned a
 * realistic, well-formed payload, so each of the 6 sections should
 * render substantive content.
 */
const COMPLETE_INPUT = {
  reportId: KHA_AK,
  generatedAt: "2026-06-12T10:30:00.000Z",
  gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
  claimedOwnerName: "Sita Patnaik",
  plotDescription: "Plot 415, Mendhasala, Bhubaneswar",

  // Plot identity from Bhunaksha
  geoFetch: {
    village: "Mendhasala",
    tahasil: "Bhubaneswar",
    district: "Khordha",
    state: "Odisha",
    postcode: "752054",
    displayName: "Mendhasala, Bhubaneswar, Khordha, Odisha, 752054, India",
    plotNo: "415",
    area: 0.024,
    gpsSource: "gps_device",
  },

  // Bhulekh RoR (Odia owners — one transliterated name is the asserted string)
  revenueRecords: {
    khataNo: "415",
    village: "Mendhasala",
    district: "Khordha",
    riCircle: "11",
    lastUpdated: "2026-01-01",
    tenants: [
      {
        tenantName: "Sita Patnaik",
        surveyNo: "415",
        area: 0.1,
        unit: "acre",
        landClass: "ଘରବାରି",
        landClassOdia: "ଘରବାରି",
        landClassEnglish: "Homestead",
        fatherName: "Ram Patnaik",
        conversionRequired: false,
        prohibited: false,
        buildable: true,
      },
    ],
    mutationReferences: [],
  },

  // Court cases
  courtCases: {
    total: 0,
    cases: [],
    sources: { ecourts: "success", rccms: "success" },
    searchMetadata: {
      ecourts: {
        captchaAcceptedCount: 1,
        captchaFailedCount: 0,
        attempts: [{ complexName: "Bhubaneswar", outcome: "no_records" }],
      },
    },
  },

  // IGR registry link
  registryLinks: {
    url: "https://igrodisha.gov.in/ecsearch",
    params: {
      district: "Khordha",
      sro: "Bhubaneswar",
      plotNo: "415",
      ownerName: "Sita Patnaik",
    },
    instructions:
      "Visit igrodisha.gov.in, select Khordha / Bhubaneswar SRO, search by plot 415, and obtain the EC.",
  },

  // Tier 2 outputs
  ownershipReasoner: {
    officialOwnerName: "Sita Patnaik",
    transliteratedOwnerName: "Sita Patnaik",
    nameMatch: "exact",
    discrepancyExplanation: "Full-name match.",
    coOwners: [],
    confidence: 0.95,
    confidenceBasis: "Exact Bhulekh RoR full name match.",
  },
  landClassifier: {
    currentClassification: "Homestead",
    classificationSource: "Bhulekh land class field",
    permittedUses: ["Residential", "Homestead"],
    conversionRequired: false,
    redFlags: [],
    confidence: 0.9,
    confidenceBasis: "Bhulekh RoR returned with land class and 1 tenant record.",
  },
  encumbranceReasoner: {
    status: "clear",
    encumbrances: [],
    instructions: "EC returned clean for the searched 5-year period.",
    confidence: 0.85,
    confidenceBasis: "IGR EC search completed via IGR Odisha portal.",
  },
  regulatoryScreener: {
    flags: [],
    plotConfirmedInRegulatedZone: false,
    overlaySource: "Bhubaneswar Municipal Corporation Town Planning layer",
    confidence: 0.9,
    confidenceBasis: "All overlay sources completed without flagging a regulated zone.",
    completedOverlayLayers: ["bmc_town_planning", "forest", "crz"],
  },

  // No validation findings
  validationFindings: [],

  // Sprint 4 — BDA zone card (Section 3 — what you can build)
  bdaZoneData: {
    source: "bda-zoning",
    status: "success",
    data: [
      {
        tehsil: "Bhubaneswar",
        village: "Mendhasala",
        locality: "Patia",
        zone: {
          id: "residential",
          name: "Residential",
          zoneCode: "R",
          description: "Areas designated for residential development",
          permittedUses: ["Single-family residential", "Apartments"],
          restrictions: ["No industrial/commercial use"],
        },
      },
    ],
  },

  // Sprint 4 — circle rate (Section 6 — what it's worth)
  circleRateData: {
    source: "circle-rate",
    status: "success",
    data: [
      {
        mouza: "Mendhasala",
        tehsil: "Bhubaneswar",
        kisam: "Residential",
        ratePerAcre: 0,
        ratePerSqft: 1800,
        rateType: "peri-urban",
        sourceUrl: "https://regis.odisha.gov.in/Benchmark/BMV_Search.aspx",
        lastUpdated: "2024-06-01",
      },
    ],
  },

  // Adjacent plots (Section 5)
  adjacentPlots: {
    adjacentPlots: [
      { plotNo: "414", village: "Mendhasala", featureId: "F-414", geometryHash: "h-414", areaSqKm: 0.0008 },
      { plotNo: "416", village: "Mendhasala", featureId: "F-416", geometryHash: "h-416", areaSqKm: 0.0009 },
      { plotNo: "417", village: "Mendhasala", featureId: "F-417", geometryHash: "h-417", areaSqKm: 0.0011 },
    ],
    totalFound: 3,
    filteredFromTarget: 0,
    status: "success",
  },

  // Status flags that drive summary panel + provenance strip
  sourceStatus: {
    bhunaksha: "success",
    bhulekh: "success",
    ecourts: "success",
    rccms: "success",
  },
  sourceDetails: {},

  disclaimerText:
    "This report is not a legal opinion. Verify with a qualified property lawyer before transacting.",
};

/**
 * Same Khordha plot, but every optional fetcher has failed. The
 * report should still compose end-to-end and show "not available"
 * caveats rather than crashing.
 */
const DEGRADED_INPUT = {
  reportId: KHA_BK,
  generatedAt: "2026-06-12T10:30:00.000Z",
  gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
  claimedOwnerName: "Sita Patnaik",
  plotDescription: "Plot 415, Mendhasala, Bhubaneswar",

  // Bhunaksha: only the GPS chip + raw WFS plot info, no usable RoR
  geoFetch: {
    village: "Mendhasala",
    tahasil: "Bhubaneswar",
    district: "Khordha",
    state: "Odisha",
    plotNo: "415",
    gpsSource: "gps_device",
  },

  // Bhulekh failed
  revenueRecords: null,
  ownershipReasoner: null,
  landClassifier: null,
  encumbranceReasoner: null,
  regulatoryScreener: null,

  // Court sources failed
  courtCases: {
    total: 0,
    cases: [],
    sources: { ecourts: "failed", rccms: "failed" },
    searchMetadata: { ecourts: null },
  },

  registryLinks: {
    url: "https://igrodisha.gov.in/ecsearch",
    params: {
      district: "Khordha",
      sro: "Not verified",
      plotNo: "415",
    },
    instructions: "Manual EC retrieval required.",
  },

  validationFindings: [],
  adjacentPlots: null,
  bdaZoneData: { source: "bda-zoning", status: "failed", data: [] },
  circleRateData: { source: "circle-rate", status: "failed", data: [] },

  sourceStatus: {
    bhunaksha: "success",
    bhulekh: "failed",
    ecourts: "failed",
    rccms: "failed",
  },
  sourceDetails: {
    bhulekh: { status: "failed", statusReason: "Bhulekh session expired" },
    ecourts: { status: "failed", statusReason: "Captcha service unavailable" },
    rccms: { status: "failed", statusReason: "RCCMS portal returned 503" },
    bda: { status: "failed", statusReason: "BDA tile server unreachable" },
    circleRate: { status: "failed", statusReason: "IGR BMV returned no rows" },
  },

  disclaimerText: "This report is not a legal opinion.",
};

// ---------------------------------------------------------------------------
// Section-by-section assertions
// ---------------------------------------------------------------------------

/**
 * Run the full battery of "section is present + has content" assertions
 * against a generated report html. Split into one assertion per
 * concrete user-visible fact so a regression points at the actual
 * problem.
 */
function assertAllSixSections(html: string) {
  // Section 1 — The Plot
  expect(html, "Section 1 anchor missing").toContain('id="section-plot"');
  expect(html, "Section 1: village name not rendered").toContain("Mendhasala");
  expect(html, "Section 1: tahasil not rendered").toContain("Bhubaneswar");
  // Plot number is rendered inside the data-table row
  expect(
    html,
    "Section 1: plot number 415 not rendered"
  ).toMatch(/Plot Number<\/td><td class="mono">415<\/td>/);

  // Section 2 — The Owner
  expect(html, "Section 2 anchor missing").toContain('id="section-owner"');
  expect(html, "Section 2: owner name not rendered").toContain("Sita Patnaik");
  // Father/guardian is rendered in the English-only tenant table
  expect(html, "Section 2: father/guardian not rendered").toContain("Ram Patnaik");

  // Section 3 — What you can build (land classification + BDA zone)
  expect(html, "Section 3 anchor missing").toContain('id="section-land"');
  // BDA zone card headline
  expect(html, "Section 3: BDA zone label missing").toContain("BDA Master Plan zone");
  expect(html, "Section 3: BDA zone name missing").toContain("Residential");
  // Kisam (land class) is rendered in the classification card
  expect(html, "Section 3: kisam/land class missing").toMatch(/Homestead|ଘରବାରି/);

  // Section 4 — What you might lose after paying (encumbrance + EC + courts)
  expect(html, "Section 4 anchor missing").toContain('id="section-encumbrance"');
  // Court Cases & Encumbrances sub-title
  expect(html, "Section 4: court/encumbrance section title missing").toContain(
    "Court Cases"
  );
  // EC panel label — always rendered for every report
  expect(html, "Section 4: EC panel label missing").toContain("Encumbrance Certificate (EC)");

  // Section 5 — Adjacent plots
  expect(html, "Section 5 anchor missing").toContain('id="section-adjacent-plots"');
  // Neighbouring Plots section title
  expect(html, "Section 5: neighbour title missing").toContain("Neighbouring Plots");
  // At least one adjacent plot number rendered
  expect(html, "Section 5: adjacent plot numbers not rendered").toMatch(/414|416|417/);

  // Section 6 — What it's worth (circle rate)
  expect(html, "Section 6 anchor missing").toContain('id="section-benchmark"');
  expect(html, "Section 6: circle rate band label missing").toContain("Circle rate");
  // The actual rate value is rendered in the floor band
  expect(html, "Section 6: circle rate per-sqft value missing").toMatch(/1,?800 per sqft/);
}

/**
 * Assert that the report still composes and shows graceful "not
 * available" caveats for every section that depends on a now-failed
 * fetcher.
 */
function assertDegradedRender(html: string) {
  // The report itself is still a complete HTML document
  expect(html).toContain("<!DOCTYPE html>");
  expect(html).toContain("ClearDeed");

  // Section 1 — Plot — the WFS village + plot number are still in
  expect(html).toContain('id="section-plot"');
  expect(html).toContain("Mendhasala");
  expect(html).toMatch(/Plot Number<\/td><td class="mono">415<\/td>/);

  // Section 2 — Owner — Bhulekh failed, so the owner section must
  // surface the "not usable" notice
  expect(html).toContain('id="section-owner"');
  expect(html).toContain("Bhulekh did not return usable owner records");

  // Section 3 — Land classification — Bhulekh failed → "not verified"
  expect(html).toContain('id="section-land"');
  expect(html).toContain("Classification not verified");
  // BDA failed → no BDA zone card body should appear. The bda-card CSS
  // class is always in the inline <style> block (static stylesheet), so
  // we assert against the rendered card's unique body text "What you can
  // build" — only present when the card is actually rendered.
  expect(html).not.toContain("What you can build");

  // Section 4 — Encumbrance — court sources failed, EC must still
  // render its panel (the panel is unconditional)
  expect(html).toContain('id="section-encumbrance"');
  expect(html).toContain("Encumbrance Certificate (EC)");
  expect(html).toContain("Court and revenue-case status could not be verified");

  // Section 5 — Adjacent plots — fetcher failed → section is omitted
  // entirely (its buildAdjacentPlotsPanel returns ""). Either it is
  // absent or it shows the "no adjacent data" info notice. Accept both.
  const hasAdjacentSection = html.includes('id="section-adjacent-plots"');
  const hasAdjacentNotice =
    hasAdjacentSection && html.includes("No adjacent data");
  // In the degraded path the panel is suppressed — assert it is
  // NOT present with a misleading "found" badge.
  if (hasAdjacentSection) {
    expect(hasAdjacentNotice, "Section 5 must not claim adjacent plots when fetcher failed").toBe(true);
  }

  // Section 6 — Benchmark — circle-rate failed → "Not in our dataset"
  expect(html).toContain('id="section-benchmark"');
  expect(html).toContain("Not in our dataset");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Report generation — Sprint 5 regression", () => {
  it("renders all 6 sections for a complete Khordha input", () => {
    // 13 assertions across 6 sections
    const { html, title } = generateConsumerReport(COMPLETE_INPUT as any);

    expect(html, "no HTML produced").toBeTruthy();
    expect(title, "title missing").toContain("Mendhasala");
    expect(title, "title missing plot number").toContain("Plot 415");

    assertAllSixSections(html);
  });

  it("renders gracefully when optional fetchers fail", () => {
    // 12 assertions across the 6 sections (degraded path)
    const { html, title } = generateConsumerReport(DEGRADED_INPUT as any);

    expect(html, "no HTML produced").toBeTruthy();
    expect(title, "title missing").toContain("Mendhasala");

    assertDegradedRender(html);
  });
});

// ---------------------------------------------------------------------------
// Edge case fixtures (audit A.3.4)
// ---------------------------------------------------------------------------

const WORST_CASE_INPUT = {
  reportId: "CLD-EDGE-WORST-001",
  generatedAt: "2026-06-15T10:30:00.000Z",
  gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
  claimedOwnerName: "Ramesh Mohanty",
  plotDescription: "Plot 999, Mendhasala, Bhubaneswar",
  // All 4 dark sources fail
  geoFetch: { status: "not_found", statusReason: "no parcel returned", layer: "khurda_bhubaneswar" },
  bhulekhFetch: { status: "not_found", statusReason: "no record" },
  igrEcFetch: { status: "fetch_failed", statusReason: "captcha_solver_exhausted" },
  cersaiFetch: { status: "fetch_failed", statusReason: "captcha_solver_exhausted" },
  ecourtsFetch: { status: "fetch_failed", statusReason: "ecourts_403" },
  rccmsFetch: { status: "fetch_failed", statusReason: "rccms_timeout" },
  regScreening: { status: "not_run" },
  bdaZoning: { status: "not_run" },
  landClassifier: { status: "not_run" },
  circleRate: { status: "not_run" },
  publicDashboard: { status: "not_run" },
  govtFee: { status: "not_run" },
  igrCertifiedCopy: { status: "not_run" },
  ownershipReasoner: null,
  encumbranceReasoner: { status: "error", instructions: null },
  regulatoryScreener: null,
  validationFindings: [],
};

const BEST_CASE_INPUT = {
  reportId: "CLD-EDGE-BEST-001",
  generatedAt: "2026-06-15T10:30:00.000Z",
  gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
  claimedOwnerName: "Sita Patnaik",
  plotDescription: "Plot 415, Mendhasala, Bhubaneswar",
  // All green
  geoFetch: { status: "success", village: "Mendhasala", tahasil: "Bhubaneswar", plotNo: "415", plotArea: "0.05 acres" },
  bhulekhFetch: { status: "success", ownerName: "Sita Patnaik", plotNo: "415", khataNo: "1234" },
  igrEcFetch: { status: "success", entries: [], total: 0 },
  cersaiFetch: { status: "success", data: { total: 0, charges: [] } },
  ecourtsFetch: { status: "success", cases: [], total: 0 },
  rccmsFetch: { status: "success", cases: [], total: 0 },
  regScreening: { status: "clear", flags: [] },
  bdaZoning: { status: "success", zone: "residential" },
  landClassifier: { status: "success", classification: "residential" },
  circleRate: { status: "success", rate: 4500, unit: "per sqft" },
  publicDashboard: { status: "success" },
  govtFee: { status: "success" },
  igrCertifiedCopy: { status: "success" },
  ownershipReasoner: { status: "match", confidence: 0.95 },
  encumbranceReasoner: { status: "clear", instructions: null },
  regulatoryScreener: { status: "clear", flags: [] },
  validationFindings: [],
};

const BOUNDARY_CASE_INPUT = {
  reportId: "CLD-EDGE-BOUNDARY-001",
  generatedAt: "2026-06-15T10:30:00.000Z",
  gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
  claimedOwnerName: "Harihar Jena",
  plotDescription: "Plot 88, Mendhasala (boundary), Bhubaneswar",
  // Plot falls on village boundary - both Bhunaksha layers return different tahasils
  geoFetch: { status: "ambiguous", villages: ["Mendhasala", "Mahimundi"], tahasils: ["Bhubaneswar", "Jatni"] },
  bhulekhFetch: { status: "success", ownerName: "Harihar Jena", plotNo: "88", khataNo: "4567" },
  igrEcFetch: { status: "success", entries: [], total: 0 },
  cersaiFetch: { status: "success", data: { total: 0, charges: [] } },
  ecourtsFetch: { status: "success", cases: [], total: 0 },
  rccmsFetch: { status: "success", cases: [], total: 0 },
  regScreening: { status: "boundary_check_required" },
  bdaZoning: { status: "boundary" },
  landClassifier: { status: "boundary" },
  circleRate: { status: "success", rate: 4500, unit: "per sqft" },
  ownershipReasoner: { status: "ambiguous", confidence: 0.5 },
  encumbranceReasoner: { status: "clear", instructions: null },
  regulatoryScreener: { status: "boundary" },
  validationFindings: [{ dimension: "village", severity: "warning", description: "Plot falls on village boundary" }],
};

const MULTI_OWNER_INPUT = {
  reportId: "CLD-EDGE-MULTI-001",
  generatedAt: "2026-06-15T10:30:00.000Z",
  gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
  claimedOwnerName: "Multiple",
  plotDescription: "Plot 700, Mendhasala, Bhubaneswar",
  // 5+ co-owners with share fractions
  geoFetch: { status: "success", village: "Mendhasala", tahasil: "Bhubaneswar", plotNo: "700" },
  bhulekhFetch: {
    status: "success",
    owners: [
      { name: "Rama Pradhan", share: "1/5" },
      { name: "Krishna Pradhan", share: "1/5" },
      { name: "Radha Pradhan", share: "1/5" },
      { name: "Balram Pradhan", share: "1/5" },
      { name: "Sudama Pradhan", share: "1/5" },
    ],
  },
  igrEcFetch: { status: "success", entries: [], total: 0 },
  cersaiFetch: { status: "success", data: { total: 0, charges: [] } },
  ecourtsFetch: { status: "success", cases: [], total: 0 },
  rccmsFetch: { status: "success", cases: [], total: 0 },
  regScreening: { status: "clear", flags: [] },
  bdaZoning: { status: "success", zone: "residential" },
  landClassifier: { status: "success", classification: "residential" },
  circleRate: { status: "success", rate: 4500, unit: "per sqft" },
  ownershipReasoner: { status: "multi_owner", confidence: 0.8 },
  encumbranceReasoner: { status: "clear", instructions: null },
  regulatoryScreener: { status: "clear", flags: [] },
  validationFindings: [],
};

describe("Edge case fixtures (A.3.4)", () => {
  function assertComposes(html: string) {
    // Edge-case reports must compose into a valid HTML document with
    // all 6 section anchors. We do not assert field-level content
    // here because each fixture has different field values.
    expect(html, "no HTML produced").toBeTruthy();
    expect(html, "missing DOCTYPE").toContain("<!DOCTYPE html>");
    expect(html, "missing section 1 anchor").toContain('id="section-plot"');
    expect(html, "missing section 2 anchor").toContain('id="section-owner"');
    expect(html, "missing section 3 anchor").toContain('id="section-land"');
    expect(html, "missing section 4 anchor").toContain('id="section-encumbrance"');
    expect(html, "missing section 5 anchor").toContain('id="section-adjacent-plots"');
    expect(html, "missing section 6 anchor").toContain('id="section-benchmark"');
  }

  it("worst case: all 4 dark sources fail + watch-outs", () => {
    const { html, title } = generateConsumerReport(WORST_CASE_INPUT as any);

    assertComposes(html);
    // Title may be "Plot —" when fetcher returns no plotNo; that's
    // acceptable degradation. We assert it is non-empty.
    expect(title, "title missing").toBeTruthy();
    // Must show unavailability caveats
    expect(html).toMatch(/not verified|unavailable|fetch.failed|could not be/i);
  });

  it("best case: all green clean title", () => {
    const { html, title } = generateConsumerReport(BEST_CASE_INPUT as any);

    assertComposes(html);
    expect(title, "title missing").toContain("Plot 415");
  });

  it("boundary case: plot on village boundary", () => {
    const { html, title } = generateConsumerReport(BOUNDARY_CASE_INPUT as any);

    assertComposes(html);
    // Title may fall back when ambiguous fetcher results, that's OK.
    expect(title, "title missing").toBeTruthy();
    // The village-boundary warning should still surface
    expect(html).toMatch(/verify|warning|verify on ground|tehsil/i);
  });

  it("multi-owner case: 5+ tenants with share fractions", () => {
    const { html, title } = generateConsumerReport(MULTI_OWNER_INPUT as any);

    assertComposes(html);
    expect(title, "title missing").toContain("Plot 700");
  });
});

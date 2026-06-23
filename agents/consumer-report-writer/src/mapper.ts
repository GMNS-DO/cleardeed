/**
 * Maps orchestrator SourceResult[] to A10 ConsumerReportGenInput.
 *
 * A10 runs last, after all Tier 2 outputs are available.
 * This module is the bridge between the orchestrator's raw source results
 * and A10's typed input schema.
 */

import { z } from "zod";
import type { SourceResult } from "@cleardeed/schema";

// ─── Tier 2 Input ───────────────────────────────────────────────────────────────

/** Tier 2 inputs — produced by A5–A8 interpreters after Tier 1 returns. */
export interface Tier2Input {
  gps: { lat: number; lon: number };
  claimedOwnerName: string;
  /** A5 output (run after Bhulekh returns) */
  ownershipReasoner?: OwnershipReasonerResult | null;
  /** A6 output */
  landClassifier?: {
    currentClassification?: string | null;
    primaryKisam?: string;
    classificationExplanation?: string;
    conversionRequired?: boolean | null;
    conversionSteps?: string | null;
    conversionNote?: string | null;
    redFlags?: Array<{
      flag: string;
      severity: "high" | "medium" | "low";
      proximity?: string | null;
      description: string;
      recommendedAction?: string | null;
    }>;
    restrictions?: Array<{
      type: string;
      severity: "critical" | "warning" | "info";
      description: string;
      action?: string;
      citation?: string;
      source?: string;
    }>;
  } | null;
  /** A7 output */
  encumbranceReasoner?: {
    status: "clear" | "encumbered" | "manual_required" | "error";
    instructions: string | null;
  } | null;
  /** A8 output */
  regulatoryScreener?: {
    flags: Array<{
      flag: string;
      severity: "high" | "medium" | "low";
      proximity?: string | null;
      description: string;
      recommendedAction?: string | null;
    }>;
    plotConfirmedInRegulatedZone?: boolean;
    overlaySource?: string;
    confidence?: number;
    confidenceBasis?: string;
  } | null;
  /** Legal-approved consumer disclaimer text */
  disclaimerText: string;
  /** Sprint 4: Circle-rate (IGR BMV) data — floor band for Section 7. */
  circleRateData?: {
    source?: string;
    status?: string;
    data?: Array<{
      mouza?: string;
      tehsil?: string;
      kisam?: string;
      ratePerAcre?: number;
      ratePerSqft?: number;
      ratePerDecimal?: number;
      rateType?: string;
      lastUpdated?: string;
      sourceUrl?: string;
    }>;
    warnings?: Array<{ code?: string; message?: string }>;
  } | null;
  /** Sprint 4: BDA Master Plan zone data — feeds Section 3 "What you can build". */
  bdaZoneData?: {
    source?: string;
    status?: string;
    data?: Array<{
      tehsil?: string;
      village?: string;
      locality?: string;
      zone?: { id?: string; name?: string; description?: string; zoneCode?: string };
    }>;
    warnings?: Array<{ code?: string; message?: string }>;
  } | null;
  /** Sprint V5b: IGR BMV (live circle rate) — replaces the JSON seed when live. */
  igrBmvData?: {
    source?: string;
    status?: string;
    data?: { rows?: Array<Record<string, unknown>> };
    warnings?: Array<{ code?: string; message?: string }>;
  } | null;
  /** Sprint V5b: Stamp-duty breakup — Section 5 sub-card showing what the
   *  government expects the buyer to pay, plus a watch-out if the BMV floor
   *  was applied (seller under-quoted the price). */
  stampDutyData?: {
    source?: string;
    status?: string;
    data?: {
      breakup?: {
        stampDuty?: number;
        registrationFee?: number;
        cess?: number;
        totalPayable?: number;
        calculationBasis?: string;
        appliedMarketValue?: number;
        requestedMarketValue?: number;
        bmvFloorApplied?: boolean;
      };
    };
    warnings?: Array<{ code?: string; message?: string }>;
  } | null;
  /** Sprint V5b: IGR daily bulletin — Section 5 velocity sub-card
   *  ("X deeds registered in Khordha in the last N days"). 24h cache. */
  igrDailyBulletinData?: {
    source?: string;
    status?: string;
    data?: {
      days?: Array<Record<string, unknown>>;
      dateRange?: { from?: string; to?: string };
      summary?: {
        totalDeeds?: number;
        totalConsideration?: number;
        avgDeedsPerDay?: number;
      };
    };
    warnings?: Array<{ code?: string; message?: string }>;
  } | null;
  /** Sprint V5c: IGR public-dashboard page-alive probe — Section 6 sub-card
   *  "Official activity (live link)". No data parsing (server-rendered). */
  publicDashboardData?: {
    source?: string;
    status?: string;
    data?: {
      pageUrl?: string;
      pageIsLive?: boolean;
      districtFilter?: string;
      sroFilter?: string;
      notes?: string[];
    };
    warnings?: Array<{ code?: string; message?: string }>;
  } | null;
  /** Sprint V5c: Govt fee schedule (permanent typed cache) — Section 6
   *  "Official fees" table. The matched deed category (Sale by default). */
  govtFeeData?: {
    source?: string;
    status?: string;
    data?: {
      schedule?: {
        lastUpdated?: string;
        source?: string;
        deedFees?: Array<{
          category?: string;
          minStampINR?: number;
          stampPct?: number;
          registrationFeePct?: number;
          rorPostalFeeINR?: number;
          userFeeINR?: number;
          notes?: string;
        }>;
        encumbranceCertificate?: Record<string, unknown>;
        certifiedCopy?: Record<string, unknown>;
        additionalPerPlotFees?: Record<string, number>;
      };
      matchedDeedFee?: {
        category?: string;
        minStampINR?: number;
        stampPct?: number;
        registrationFeePct?: number;
        rorPostalFeeINR?: number;
        userFeeINR?: number;
        notes?: string;
      } | null;
    };
    warnings?: Array<{ code?: string; message?: string }>;
  } | null;
  /** Sprint V5c: IGR certified copy (Phase 1: index-card only) — Section 2
   *  sub-card "Previous sale deed (open index entry)" with §57 transparency
   *  note. Phase 2 (live captcha + index parsing) is parked behind D-037. */
  igrCertifiedCopyData?: {
    source?: string;
    status?: string;
    data?: {
      pageUrl?: string;
      pageIsLive?: boolean;
      section57Note?: string;
      manualInstructions?: {
        steps?: string[];
        contactSRO?: string;
        estimatedFeeINR?: number;
        expectedTime?: string;
      };
    };
    warnings?: Array<{ code?: string; message?: string }>;
  } | null;
  /** V1.2: Adjacent plot analysis (ceiling plan T-056) */
  adjacentPlots?: {
    adjacentPlots: Array<{
      plotNo: string;
      village: string;
      featureId: string;
      geometryHash: string;
      areaSqKm: number;
    }>;
    totalFound: number;
    filteredFromTarget: number;
    status: string;
  } | null;
  /** P-NEW-1A: Pattern intelligence synthesis insights */
  synthesisInsights?: Array<{
    patternCluster: string;
    clusterSummary: string;
    similarCaseCount: number;
    totalSimilarCases: number;
    decidingFactor: string;
    recommendedAction: string;
    sourceCaseRefs: Array<{
      caseId: string;
      caseNo: string;
      outcome?: string;
      buyerAction?: string;
    }>;
  }>;
  /**
   * T-051b — Owner's residence GPS for distance-aware Malipada detection
   * (Pattern 3, ROR-INS-026). Geocoded from the Bhulekh page-1 owner
   * address via a second Nominatim search call (separate cache, 30-day
   * TTL). Null when Bhulekh did not return a residence, the residence
   * string is empty, or Nominatim returned no hit. When null, ROR-INS-026
   * skips the distance check and renders an "unverified" status with a
   * "consult local SRO to verify owner's current address" action item.
   */
  ownerResidenceGPS?: { lat: number; lon: number } | null;
}

/** A5 OwnershipReasoner output (inlined to avoid cross-package import). */
export interface OwnershipReasonerResult {
  officialOwnerName: string;
  transliteratedOwnerName: string;
  nameMatch: "exact" | "partial" | "mismatch" | "unknown";
  discrepancyExplanation: string;
  coOwners: string[];
  fatherNameOnRecord?: string;
  confidence: number;
  confidenceBasis: string;
  nameMatchConfidence?: { score: number; method: string };
  claimState?: "matched" | "partial" | "mismatch" | "ambiguous" | "unavailable" | "manual_required";
  readiness?: "L0" | "L1" | "L2" | "L3" | "L4";
  inputQuality?: "full_name" | "single_token" | "initials_or_abbrev" | "empty";
  fatherHusbandMatch?: "matched" | "mismatch" | "not_provided" | "not_on_record";
  matchReasons?: Array<{ code: string; label: string; weight: number; detail?: string }>;
  blockingWarnings?: string[];
}

// ─── Orchestrator output ───────────────────────────────────────────────────────

export interface OrchestratorOutput {
  reportId: string;
  sources: SourceResult[];
  completedAt: string;
  validationFindings: Array<{
    dimension: string;
    severity: "error" | "warning" | "info";
    source: string;
    description: string;
  }>;
  igrLink?: {
    url: string;
    params: { district: string; sro: string; plotNo?: string };
    instructions?: string;
  };
}

// ─── ConsumerReportGenInput schema (permissive, avoids false validation failures) ─

/** Only top-level fields are validated strictly. Sub-objects use z.any() for flexibility. */
export const ConsumerReportGenInputSchema = z.object({
  reportId: z.string(),
  generatedAt: z.string(),
  gpsCoordinates: z.object({ latitude: z.number(), longitude: z.number() }),
  claimedOwnerName: z.string(),
  plotDescription: z.string().nullish().optional(),
  adjacentPlots: z.any().optional(),

  // Sub-objects: use z.any() to avoid field-level validation failures
  // The HTML renderer handles nulls gracefully with explicit null checks
  geoFetch: z.any().optional(),
  revenueRecords: z.any().optional(),
  // V1.5 Phase 0 — normalized ror payload for the insight engine.
  // The bhulekh registry rules read from a flat `ror.page1 / page2 /
  // plotTable / tenants / chauhaddiByPlot / section6 / mutationReferences`
  // shape. The orchestrator emits `revenueRecords` (a slim consumer view)
  // and `revenueRecords.rorDocument` (a nested document). The mapper
  // flattens the document into the rule-readable shape and exposes it
  // here. Without this field, all bhulekh rules that read `input.ror.*`
  // never fire on real customer input.
  ror: z.any().optional(),
  // V1.5 Phase 0 — normalized bhunaksha payload for the insight engine.
  // Recursive area-cross (ROR-INS-079) reads from `input.bhunaksha.area`
  // (polygon area in km²) to compare against Bhulekh recorded area.
  bhunaksha: z.any().optional(),
  // T-069 — IGR-EC rollup for the title-chain PoA rule. The IGR-EC
  // fetcher annotates each EC entry with `modeOfTransfer` and rolls up
  // to `poaOnRecord: true` when any registered instrument is a GPA
  // sale. ROR-INS-075 reads `input.igrEc.poaOnRecord` as its primary
  // signal for the Suraj Lamp red flag, with the Bhulekh textual
  // inference as fallback.
  igrEc: z.any().optional(),
  // T-051 — GPS coordinates for distance-aware owner-residence rules.
  // `plotGPS` is always populated from the user query. `ownerResidenceGPS`
  // is a T-051b follow-up: the orchestrator needs a second Nominatim
  // call on ror.page1.ownerAddress to populate it. Until that ships,
  // ROR-INS-026 (Malipada impersonation distance check) will not fire.
  plotGPS: z.any().optional(),
  ownerResidenceGPS: z.any().optional(),
  courtCases: z.any().optional(),
  registryLinks: z.any().optional(),
  ownershipReasoner: z.any().optional(),
  landClassifier: z.any().optional(),
  encumbranceReasoner: z.any().optional(),
  regulatoryScreener: z.any().optional(),
  larrRiskAssessment: z.any().optional(),
  // T-041 — Bhuvan flood hazard data (planning-only license).
  bhuvanFloodData: z.any().optional(),
  // T-049 — EOW Khordha blacklist match payload. The orchestrator
  // runs `matchBlacklist()` from @cleardeed/fetcher-eow and the result
  // is forwarded here for ROR-INS-210 / ROR-INS-211.
  eowBlacklist: z.any().optional(),
  validationFindings: z.array(z.any()).optional().default([]),
  sourceStatus: z.record(z.string()).optional().default({}),
  sourceDetails: z.record(z.any()).optional().default({}),
  disclaimerText: z.string().optional().default(""),
  // Sprint 4 — passed through from pipeline; renderer uses .any() for flexibility.
  circleRateData: z.any().optional(),
  bdaZoneData: z.any().optional(),
  // Sprint V5b — IGR public-data sub-cards for Section 5.
  igrBmvData: z.any().optional(),
  stampDutyData: z.any().optional(),
  igrDailyBulletinData: z.any().optional(),
  // Sprint V5c — IGR public-data sub-cards for Section 2 + Section 6.
  publicDashboardData: z.any().optional(),
  govtFeeData: z.any().optional(),
  igrCertifiedCopyData: z.any().optional(),
  // P-NEW-1A: Pattern intelligence synthesis insights
  synthesisInsights: z.array(z.any()).optional().default([]),
  // Bhunaksha Plot Report (per-plot, plotreportOR.jsp) — independent ROR
  // cross-check. Contains cadastral map image (base64), owner block, khatiyan.
  bhunakshaPlotReport: z.any().optional().nullable(),
  // Phase 8 / Task 36 — Plot Diagram (SVG) rendered above Land Classification.
  // The orchestrator (Task 35) stores the storage URL on the report record.
  // `status` is the WFS compose step result, `url` is the source of truth for
  // rendering, `cacheHit` indicates a 7-day cache hit, `reason` carries the
  // failure reason when status === "failed".
  //
  // Phase 2 v1 — transient geo fields. These are populated in-memory by the
  // mapper from the bhunaksha_plot_report source, but NOT persisted to the
  // reports table. They live in the rendered HTML's data-* attributes for
  // the mapcard-v1.js bootstrap script to consume. Adding them here is the
  // load-bearing contract: if a future mapper refactor drops these fields,
  // MapCard v1 silently falls back to the v0 static SVG. The regression
  // test in `src/__tests__/pipeline_input.test.ts` pins this contract.
  plotDiagram: z
    .object({
      status: z.enum(["success", "partial", "failed", "not_attempted"]),
      url: z.string().url().nullish(),
      reason: z.string().nullish(),
      cacheHit: z.boolean().optional(),
      rendered: z.boolean().optional(),
      // GeoJSON Polygon (WGS84) — the target plot polygon, single feature.
      // `z.any()` because GeoJSON's full shape is verbose; the renderer
      // passes it through as a JSON-encoded data attribute.
      targetPolygon: z.any().nullish(),
      // Up to 8 neighbour features (WFS share-edge detection).
      // Each: { plotNo, owner?, geometry, riskLevel? }
      neighbors: z.array(z.any()).nullish(),
      // LineString features from the WFS roads layer. Often empty (the
      // WFS roads layer is frequently unavailable — runPlotDiagramStep
      // logs "road_layer_unavailable" and emits an empty array).
      roads: z.array(z.any()).nullish(),
      // Bounding box of all features in WGS84. The bootstrap script
      // uses this to fit the MapLibre viewport; it clamps to the
      // Khordha district box regardless.
      bounds: z
        .object({
          minLat: z.number(),
          maxLat: z.number(),
          minLon: z.number(),
          maxLon: z.number(),
        })
        .nullish(),
      // Server-built Bhulekh deep-link URL. The bootstrap script wires
      // this into the "Verify on Bhulekh" CTA. Optional — when absent
      // (e.g. we couldn't derive the URL from village+tahasil), the
      // CTA falls back to the Bhulekh homepage.
      bhulekhUrl: z.string().nullish(),
    })
    .nullish()
    .optional(),
});

export type ConsumerReportGenInputData = z.infer<typeof ConsumerReportGenInputSchema>;

// ─── Mapper ────────────────────────────────────────────────────────────────────

/**
 * Minimal shape of the plot-diagram step result the mapper needs.
 *
 * The full type lives in `apps/web/src/lib/plot-diagram-step.ts`. We
 * re-declare the subset of fields the mapper surfaces so the consumer
 * report-writer doesn't have to depend on the pipeline package.
 * Adding new optional fields here is the load-bearing contract: if a
 * future refactor drops one, the corresponding `input.plotDiagram.*`
 * field becomes `undefined` and MapCard v1 silently falls back to
 * the v0 static SVG. The regression test in
 * `src/__tests__/pipeline_input.test.ts` pins this contract.
 */
export type MapperPlotDiagramInput = {
  status: "success" | "partial" | "failed" | "not_attempted";
  url: string | null;
  reason?: string;
  cacheHit?: boolean;
  rendered?: boolean;
  // Phase 2 v1 — transient geo data for the interactive map. See
  // apps/web/src/lib/plot-diagram-step.ts for the full PlotDiagramStepResult
  // type. All optional because cache-hit / not_attempted / failed paths
  // do not have the polygon data in scope.
  targetPolygon?: { type: "Polygon"; coordinates: number[][] } | null;
  neighbors?: Array<{
    plotNo: string;
    village: string;
    tehsil: string;
    polygon: { type: "Polygon"; coordinates: number[][] };
    areaSqKm: number;
    kisam?: string;
  }>;
  roads?: Array<{
    name?: string;
    path: number[][] | number[][][];
    roadClass?: string;
  }>;
  bounds?: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  } | null;
  // MapCard v1.1 — approximate-mode plumbing. When the diagram step
  // took the fallback path (Bhunaksha returned no polygon), the
  // step synthesizes a 60m target polygon + emits a Khordha
  // district boundary so the map still renders. The mapper threads
  // these through to MapCardInput so the bootstrap can flag the
  // district layer + adjust the caption.
  approximate?: boolean;
  approximateReason?: string | null;
  khordhaBoundary?: unknown;
} | null;

/**
 * Map orchestrator sources to A10 ConsumerReportGenInput.
 */
export function mapToReportInput(
  orchestratorOutput: OrchestratorOutput,
  tier2: Tier2Input,
  // Phase 2 v1 — the plot diagram step result. Threaded through as a
  // third optional arg so existing call sites in tests that pass only
  // the first two args continue to work. When null/undefined, the
  // resulting `input.plotDiagram` is null (the v0 behavior — no
  // map card rendered).
  plotDiagram?: MapperPlotDiagramInput
): ConsumerReportGenInputData {
  const { reportId, sources, completedAt, validationFindings, igrLink } =
    orchestratorOutput;

  const nominatim = sources.find((s) => s.source === "nominatim");
  const bhunaksha = sources.find((s) => s.source === "bhunaksha");
  const bhulekh = sources.find((s) => s.source === "bhulekh");
  const ecourts = sources.find((s) => s.source === "ecourts");
  const rccms = sources.find((s) => s.source === "rccms");
  const igrEc = sources.find((s) => s.source === "igr-ec");
  const cersai = sources.find((s) => s.source === "cersai");
  const larr = sources.find((s) => s.source === ("larr" as string));
  const bhunakshaPlotReport = sources.find((s) => s.source === "bhunaksha_plot_report");
  // T-041 — Bhuvan flood hazard WMS (planning-only license).
  const bhuvanFlood = sources.find((s) => s.source === "bhuvan-flood");

  const nominatimData = nominatim?.data as {
    displayName?: string;
    village?: string;
    tahasil?: string;
    district?: string;
    state?: string;
    postcode?: string;
  } | null;

  const bhunakshaData = bhunaksha?.data as {
    plotNo?: string;
    village?: string;
    tahasil?: string;
    area?: number;
    district?: string;
    mouza?: string;
    mouzaOdia?: string;
    areaUnit?: string;
    geometry?: unknown;
    chauhaddi?: unknown;
    neighbours?: unknown[];
  } | null;

  const geoFetch = {
    displayName: nominatimData?.displayName ?? null,
    village: bhunakshaData?.village ?? nominatimData?.village ?? null,
    tahasil: bhunakshaData?.tahasil ?? nominatimData?.tahasil ?? null,
    district: nominatimData?.district ?? null,
    state: nominatimData?.state ?? "Odisha",
    postcode: nominatimData?.postcode ?? null,
    plotNo: bhunakshaData?.plotNo ?? null,
    area: bhunakshaData?.area ?? null,
  };

  const bhulekhData = bhulekh?.data as {
    khataNo?: string;
    village?: string;
    district?: string;
    tenants?: Array<{
      tenantName?: string;
      fatherHusbandName?: string;
      surveyNo?: string;
      area?: number;
      unit?: string;
      landClass?: string;
      landClassOdia?: string;
      landClassEnglish?: string;
      conversionRequired?: boolean;
      prohibited?: boolean;
      buildable?: boolean;
    }>;
    lastUpdated?: string;
    mutationReferences?: Array<{
      caseType?: string;
      caseNo?: string;
      orderDate?: string;
      plotNo?: string;
      sourceField?: string;
      rawText?: string;
    }>;
  } | null;

  const bhulekhRawDocument = (() => {
    if (!bhulekh?.rawResponse) return null;
    try {
      const raw = JSON.parse(bhulekh.rawResponse);
      return raw ?? null;
    } catch {
      return null;
    }
  })();
  const bhulekhBackPage = bhulekhRawDocument?.backPage ?? null;

  const tenants = (bhulekhData?.tenants ?? []).map((t) => ({
    tenantName: t.tenantName ?? "—",
    fatherName: t.fatherHusbandName ?? null,
    surveyNo: t.surveyNo ?? null,
    area: t.area ?? null,
    unit: t.unit ?? null,
    // V1.1: standardized landClass (Odisha Kisam 2024-2026) + metadata
    landClass: t.landClass ?? null, // standardized Odisha Kisam (e.g. "jalasechita_single")
    landClassOdia: (t as any).landClassOdia ?? null, // raw Odia (e.g. "ଦଣ୍ଡା")
    landClassEnglish: (t as any).landClassEnglish ?? null, // display English
    areaAcresRaw: (t as any).areaAcresRaw ?? null,
    areaDecimalsRaw: (t as any).areaDecimalsRaw ?? null,
    areaHectaresRaw: (t as any).areaHectaresRaw ?? null,
    areaUnitRaw: (t as any).areaUnitRaw ?? null,
    areaComputation: (t as any).areaComputation ?? null,
    sourcePlotNo: (t as any).sourcePlotNo ?? null,
    sourceRowHash: (t as any).sourceRowHash ?? null,
    conversionRequired: (t as any).conversionRequired ?? null,
    prohibited: (t as any).prohibited ?? null,
    buildable: (t as any).buildable ?? null,
  }));

  const ecourtsData = ecourts?.data as {
    cases?: Array<{
      caseId?: string;
      caseNo?: string;
      caseType?: string;
      filingDate?: string;
      courtName?: string;
      courtComplex?: string;
      court?: string;
      petitioner?: string;
      respondent?: string;
      parties?: Array<{ name?: string; role?: string }>;
      status?: string;
      decisionDate?: string;
    }>;
    total?: number;
    searchMetadata?: {
      captchaAcceptedCount?: number;
      captchaFailedCount?: number;
      attempts?: Array<{
        outcome?: string;
        complexName?: string;
      }>;
    };
  } | null;

  const rccmsData = rccms?.data as {
    cases?: Array<{
      caseId?: string;
      caseNo?: string;
      caseType?: string;
      petitioner?: string;
      respondent?: string;
      status?: string;
      filingDate?: string;
      court?: string;
    }>;
    total?: number;
  } | null;

  const allCases = (ecourtsData?.cases ?? []).map(c => ({
    ...c,
    caseId: c.caseId ?? c.caseNo,
    caseNo: c.caseNo ?? c.caseId,
    courtName: c.courtName ?? c.court,
    court: c.court ?? c.courtName ?? c.courtComplex,
    source: 'eCourts (Civil/Criminal)',
  }))
    .concat((rccmsData?.cases ?? []).map(c => ({
      ...c,
      caseId: c.caseId ?? c.caseNo,
      caseNo: c.caseNo ?? c.caseId,
      courtName: c.court,
      court: c.court,
      source: 'RCCMS (Revenue)',
    })));

  const registryLinks = igrLink ?? {
    url: "https://igrodisha.gov.in/ecsearch",
    params: {
      district: nominatimData?.district ?? "Not verified",
      sro: "Not verified",
      plotNo: bhunakshaData?.plotNo ?? "—",
    },
    instructions: "Visit igrodisha.gov.in, select district and SRO, search by plot number or owner name.",
  };

  return {
    reportId,
    generatedAt: completedAt,
    gpsCoordinates: { latitude: tier2.gps.lat, longitude: tier2.gps.lon },
    // T-051 — plotGPS (lat/lon) is the distance-comparison anchor for
    // ROR-INS-026 (Malipada distance check). `ownerResidenceGPS` is a
    // T-051b follow-up — the orchestrator now geocodes the owner's
    // residence from the RoR via Nominatim search before building the
    // Tier2Input. When null (empty residence, geocode failure, or Bhulekh
    // didn't return a record), the rule falls back to "unverified" status.
    plotGPS: { lat: tier2.gps.lat, lon: tier2.gps.lon },
    ownerResidenceGPS: tier2.ownerResidenceGPS ?? null, // T-051b
    claimedOwnerName: tier2.claimedOwnerName,
    geoFetch,
    revenueRecords: bhulekhData
      ? {
          khataNo: bhulekhData.khataNo ?? null,
          village: bhulekhData.village ?? bhunakshaData?.village ?? null,
          district: nominatimData?.district ?? null,
          riCircle: null,
          lastUpdated: bhulekhData.lastUpdated ?? null,
          mutationReferences: (bhulekhData.mutationReferences ?? []).map((reference) => ({
            caseType: reference.caseType ?? null,
            caseNo: reference.caseNo ?? null,
            orderDate: reference.orderDate ?? null,
            plotNo: reference.plotNo ?? null,
            sourceField: reference.sourceField ?? null,
            rawText: reference.rawText ?? null,
          })),
          // V1.1 Back Page data
          backPage: bhulekhBackPage,
          rorDocument: bhulekhRawDocument,
          ownerBlocks: bhulekhRawDocument?.record?.ownerBlocks ?? [],
          plotRows: bhulekhRawDocument?.plotTable?.rows ?? [],
          plotTableTotals: bhulekhRawDocument?.plotTable?.totals ?? null,
          recordMeta: bhulekhRawDocument?.record ?? null,
          sourceMeta: bhulekhRawDocument?.source ?? null,
          dues: bhulekhRawDocument?.dues ?? null,
          remarks: bhulekhRawDocument?.remarks ?? null,
          screenshots: bhulekhRawDocument?.screenshots ?? null,
          tenants,
        }
      : null,
    // V1.5 Phase 0 — wire `bhunaksha` for the insight engine.
    //
    // The bhunaksha rules (src/insights/registry/bhunaksha/* and the
    // area-cross rule in src/insights/registry/recursive/area-cross.ts)
    // read from a normalized `input.bhunaksha.*` shape. Without this
    // block the rules pass in unit tests but never fire on real reports
    // because the mapper only used bhunaksha data internally for
    // revenueRecords (a slim consumer view). The recursive area-cross
    // rule (ROR-INS-079) specifically needs `bhunaksha.area` as the
    // polygon-area in km² to compare against Bhulekh recorded area.
    bhunaksha: bhunakshaData
      ? {
          status: bhunaksha?.status === "success" ? "verified" : bhunaksha?.status ?? "not_run",
          fetchedAt: bhunaksha?.fetchedAt ?? null,
          plotNo: bhunakshaData?.plotNo ?? null,
          village: bhunakshaData?.village ?? null,
          tahasil: bhunakshaData?.tahasil ?? null,
          district: bhunakshaData?.district ?? null,
          mouza: bhunakshaData?.mouza ?? null,
          mouzaOdia: bhunakshaData?.mouzaOdia ?? null,
          // Area as the WFS source emits it — km². ROR-INS-079 multiplies
          // by 247.105 to get acres and compares against Bhulekh's
          // recorded area. Surfacing it as the source delivered it
          // keeps the unit conversion in one place (the rule).
          area: bhunakshaData?.area ?? null,
          areaUnit: (bhunakshaData as any)?.areaUnit ?? "km2",
          geometry: (bhunakshaData as any)?.geometry ?? null,
          chauhaddi: (bhunakshaData as any)?.chauhaddi ?? null,
          neighbours: (bhunakshaData as any)?.neighbours ?? [],
        }
      : null,
    // T-069 — wire `igrEc` for the Suraj Lamp PoA rule.
    //
    // The IGR-EC fetcher annotates each EC entry with `modeOfTransfer`
    // (sale_deed / gpa_sale / court_order / gift / lease / mortgage) and
    // rolls up to a boolean `poaOnRecord` flag — true if any registered
    // instrument in the search window is a GPA sale. ROR-INS-075 reads
    // `input.igrEc.poaOnRecord` as its primary signal for the Suraj Lamp
    // red flag; the Bhulekh textual inference on the rights field is
    // the fallback when IGR data is unavailable.
    igrEc: igrEc?.data
      ? {
          status: igrEc?.status === "success" ? "verified" : igrEc?.status ?? "not_run",
          ecAvailable: (igrEc.data as any).ecAvailable ?? false,
          poaOnRecord: (igrEc.data as any).poaOnRecord === true,
          sro: (igrEc.data as any).sro ?? null,
          district: (igrEc.data as any).district ?? null,
          searchPeriod: (igrEc.data as any).searchPeriod ?? null,
          entryCount: Array.isArray((igrEc.data as any).entries)
            ? (igrEc.data as any).entries.length
            : 0,
          gpaEntries: Array.isArray((igrEc.data as any).entries)
            ? ((igrEc.data as any).entries as any[])
                .filter((e) => e.modeOfTransfer === "gpa_sale")
                .map((e) => ({
                  docNo: e.docNo ?? null,
                  regDate: e.regDate ?? null,
                  docType: e.docType ?? null,
                  party1: e.party1 ?? null,
                  party2: e.party2 ?? null,
                }))
            : [],
          fetchedAt: igrEc?.fetchedAt ?? null,
        }
      : null,
    // V1.5 Phase 0 — wire `ror` for the insight engine.
    //
    // The bhulekh registry rules (src/insights/registry/bhulekh/*) read
    // from a normalized `input.ror.*` shape — page1 / page2 / plotTable /
    // tenants / chauhaddiByPlot / section6 / mutationReferences. Without
    // this block the rules pass in unit tests (where we mock `ror` directly)
    // but never fire on real customer reports, because the orchestrator
    // only emits `revenueRecords` (a slim consumer view) and
    // `revenueRecords.rorDocument` (a parsed-but-nested document).
    //
    // This block flattens the document into the shape the rules expect.
    // It is best-effort: any field that the parser didn't capture surfaces
    // as `null` and the rule engine treats it as "no signal" (defensive
    // null-checks throughout). See the V1.5 Phase 0 wiring regression
    // test at `src/__tests__/pipeline_input.test.ts`.
    ror: bhulekhData
      ? (() => {
          const record = bhulekhRawDocument?.record ?? {};
          const loc = bhulekhRawDocument?.location ?? {};
          const rawRows: any[] =
            bhulekhRawDocument?.plotTable?.rows ??
            bhulekhData?.tenants?.map((t: any) => ({
              plotNo: t.surveyNo ?? null,
              khataNo: bhulekhData.khataNo ?? null,
              area: t.area ?? null,
              tenantName: t.tenantName ?? null,
            })) ??
            [];
          const ownerBlocks: any[] = record.ownerBlocks ?? [];
          const firstOwnerBlock = ownerBlocks[0] ?? {};
          const rightsOdia: string | null =
            record.rightsOdia ?? bhulekhBackPage?.rightsOdia ?? null;
          const ownerEnglish =
            bhulekhData?.tenants?.[0]?.tenantName ??
            firstOwnerBlock?.tenantNameOdia ??
            null;
          const ownerAddress =
            firstOwnerBlock?.residenceOdia ??
            record.residenceOdia ??
            null;
          // District comes from Nominatim (English) or Bhulekh (Odia). V1
          // is Khordha-only so a small transliteration map covers the
          // handful of variants the parser actually emits. If neither
          // path yields a value, fall back to the canonical English name
          // (the V1 cohort is Khordha by construction).
          const districtFromOdia = (odia: string | null | undefined): string | null => {
            if (!odia) return null;
            const trimmed = odia.trim();
            const map: Record<string, string> = {
              "ଖୋର୍ଦ୍ଧା": "Khordha",
              "ଭୁବନେଶ୍ୱର": "Bhubaneswar",
              "କଟକ": "Cuttack",
              "ପୁରୀ": "Puri",
              "ଗଞ୍ଜାମ": "Ganjam",
              "ମୟୂରଭଞ୍ଜ": "Mayurbhanj",
            };
            return map[trimmed] ?? trimmed;
          };
          const plotDistrictEnglish =
            bhulekhData?.district ??
            nominatimData?.district ??
            districtFromOdia(loc.districtOdia) ??
            "Khordha";
          // Tenure signal: Bhulekh writes "ପଟ୍ଟା ରୁକା" (Patta Ruka) for freehold
          // and "ଲିଜ ରୁକା" for lease. The land-kisam dictionary may normalize
          // the raw word to "khalsa" before the rule engine sees it, so we
          // re-derive the lease hint from the raw Odia here (preserves it
          // even when dictionary normalization is aggressive — Patia test).
          const tenureRawOdia = rightsOdia ?? "";
          const hasPattaTenure = /patta|ପଟ୍ଟା/i.test(tenureRawOdia);
          const hasLeaseTenure = /lease|ଲିଜ/i.test(tenureRawOdia);
          // Page 1 surface — every field read by any bhulekh rule.
          const zamindarKhewatOdia =
            (bhulekhRawDocument?.record as any)?.zamindarKhewatOdia ??
            (bhulekhRawDocument?.record as any)?.landlordOdia ??
            null;
          // Extract khewat number from the zamindar khewat string.
          // Bhulekh shows strings like "ଓଡ଼ିଶା ସରକାର ଖେୱାଟ ନମ୍ବର 1" or
          // "Government Khewat No. 1". Extract trailing Arabic or Odia digits.
          const odiaDigits = ["୦", "୧", "୨", "୩", "୪", "୫", "୬", "୭", "୮", "୯"];
          const odiaToArabic = (s: string): string => {
            let out = s;
            for (let i = 0; i < odiaDigits.length; i++) {
              out = out.replace(new RegExp(odiaDigits[i], "g"), String(i));
            }
            return out;
          };
          const khewatNoRaw = zamindarKhewatOdia ?? "";
          const khewatNoMatch = khewatNoRaw.match(
            /(\d+|[୦-୯]+)[\s​]*$/
          );
          const khewatNo = khewatNoMatch
            ? odiaToArabic(khewatNoMatch[1])
            : null;
          // V1.5 Phase 0 — infer hasPoA from rights text.
          // The RoR rights field (gvfront_ctl02_lblStatua) sometimes
          // contains "ପ୍ରାଧିକାର" or "ପ୍ରାଧିକୃତ" (authorized/attorney)
          // as a weak PoA signal. A stronger signal is from IGR deed
          // records (which list GPA/PoA instruments). This inference
          // enables ROR-INS-075 to fire on Bhulekh-only reports when
          // the rights field contains the keyword.
          const rightsText = rightsOdia ?? "";
          const hasPoA = /ପ୍ରାଧିକାର|ପ୍ରାଧିକୃତ|ସାଧାରଣ ପ୍ରାଧିକାର|GPA|Power of Attorney|attorney/i.test(
            rightsText
          );
          const page1 = {
            khatiyanNumber: record.khatiyanNo ?? bhulekhData?.khataNo ?? null,
            owner: ownerEnglish,
            ownerAddress,
            ownerOdia: firstOwnerBlock?.tenantNameOdia ?? null,
            fatherHusbandName:
              firstOwnerBlock?.guardianNameOdia ??
              record.guardianNameOdia ??
              null,
            // The plot's village / mouza / district come from the Bhulekh
            // location graph, with Nominatim / Bhunaksha as fallbacks.
            plotVillage: bhulekhData?.village ?? null,
            plotMouza: loc.mouzaOdia ?? null,
            plotTehsil: loc.tehsilOdia ?? null,
            plotDistrict: plotDistrictEnglish,
            landClass: bhulekhData?.tenants?.[0]?.landClass ?? null,
            landClassOdia: bhulekhData?.tenants?.[0]?.landClassOdia ?? null,
            landClassEnglish: bhulekhData?.tenants?.[0]?.landClassEnglish ?? null,
            rightsOdia,
            // Khewat — Zamindari-era head-of-household. Surfaced so the
            // Zamindari chain-gap rule (ROR-INS-076) can fire on era-1980
            // khatiyans. The fetcher reads it from gvfront_ctl02_lblLandlordName.
            zamindarKhewatOdia,
            khewatNo,
            hasPoA,
            leaseIndicators: {
              hasPattaTenure,
              hasLeaseTenure,
              tenureRawOdia,
            },
          };
          // Page 2 surface — the user's queried plot + every row in the
          // plot table. The "selected plot" is the first row whose plotNo
          // matches the tenant surveyNo we fetched, falling back to the
          // first row (most Bhulekh queries return the queried plot first).
          const selectedPlotNumber =
            bhulekhData?.tenants?.[0]?.surveyNo ?? rawRows[0]?.plotNo ?? null;
          const plots = rawRows.map((row: any) => ({
            plotNo: row.plotNo ?? null,
            khataNo: row.khataNo ?? bhulekhData?.khataNo ?? null,
            area: row.area ?? null,
            areaAcres: row.areaAcres ?? row.area ?? null,
            areaDecimals: row.areaDecimals ?? null,
            areaHectares: row.areaHectares ?? null,
            tenantName: row.tenantName ?? null,
            kisam: row.kisam ?? row.landClass ?? bhulekhData?.tenants?.[0]?.landClass ?? null,
            // Per-row remarks first; fall back to the document-level
            // remarks object (which the parser surfaces as a single
            // free-text block on the back page). Concatenate so the
            // Section 6 / government-land detector can match either
            // the row annotation or the back-page note.
            remarksOdia: [
              row.remarksOdia,
              row.remarks,
              typeof bhulekhRawDocument?.remarks === "string"
                ? bhulekhRawDocument.remarks
                : typeof bhulekhRawDocument?.remarks === "object" &&
                    bhulekhRawDocument?.remarks
                  ? Object.values(bhulekhRawDocument.remarks)
                      .filter((v: any) => typeof v === "string")
                      .join(" | ")
                  : null,
            ]
              .filter((s) => typeof s === "string" && s.length > 0)
              .join(" | ") || null,
          }));
          const targetRow =
            plots.find((p: any) => p.plotNo === selectedPlotNumber) ??
            plots[0] ??
            null;
          // The selected-plot row may not carry a village (the parser only
          // attaches village to the khata header). Thread it into targetRow
          // so rules that read `targetRow.village` (e.g. ROR-INS-080
          // tenancy-over-claim cross-check) and the test contract
          // (`expect(targetRow.village).toBe("Mendhasala")`) both work.
          if (targetRow) {
            (targetRow as any).village = bhulekhData?.village ?? null;
          }
          // Section 6 / government land — surfaced from remarks if present.
          const remarksObj = bhulekhRawDocument?.remarks ?? {};
          const section6Present = Object.values(remarksObj).some((v: any) =>
            /section\s*6|ଧାରା\s*୬|government|ସରକାରୀ/i.test(String(v ?? ""))
          );
          const chauhaddiByPlot =
            bhulekhRawDocument?.chauhaddiByPlot ??
            bhulekhBackPage?.chauhaddiByPlot ??
            null;
          return {
            status: bhulekh?.status === "success" ? "verified" : bhulekh?.status ?? "not_run",
            khataNo: bhulekhData?.khataNo ?? null,
            village: bhulekhData?.village ?? null,
            district: plotDistrictEnglish,
            fetchedAt: bhulekh?.fetchedAt ?? null,
            page1,
            page2: {
              selectedPlotNumber,
              plots,
            },
            plotTable: {
              rows: rawRows,
              targetRow,
              totals: bhulekhRawDocument?.plotTable?.totals ?? null,
            },
            tenants,
            chauhaddiByPlot,
            section6: {
              present: section6Present,
              referenceCount: section6Present ? 1 : 0,
              areaAcres: null,
            },
            mutationReferences: (bhulekhData?.mutationReferences ?? []).map(
              (reference: any) => ({
                caseType: reference.caseType ?? null,
                caseNo: reference.caseNo ?? null,
                orderDate: reference.orderDate ?? null,
                plotNo: reference.plotNo ?? null,
                sourceField: reference.sourceField ?? null,
                rawText: reference.rawText ?? null,
              })
            ),
            backPage: bhulekhBackPage,
            sourceMeta: bhulekhRawDocument?.source ?? null,
            recordMeta: record ?? null,
          };
        })()
      : null,
    courtCases: {
      total: allCases.length,
      cases: allCases,
      searchMetadata: {
        ecourts: ecourtsData?.searchMetadata ?? null,
        ecourtsStatusReason: ecourts?.statusReason ?? null,
        rccmsStatusReason: rccms?.statusReason ?? null,
      },
      sources: {
        ecourts: ecourts?.status ?? "not_run",
        rccms: normalizeRccmsStatus(rccms),
      },
    },
    registryLinks,
    ownershipReasoner: tier2.ownershipReasoner ? {
      officialOwnerName: tier2.ownershipReasoner.officialOwnerName,
      transliteratedOwnerName: tier2.ownershipReasoner.transliteratedOwnerName,
      nameMatch: tier2.ownershipReasoner.nameMatch,
      discrepancyExplanation: tier2.ownershipReasoner.discrepancyExplanation,
      coOwners: tier2.ownershipReasoner.coOwners,
      fatherNameOnRecord: tier2.ownershipReasoner.fatherNameOnRecord ?? null,
      confidence: tier2.ownershipReasoner.confidence,
      confidenceBasis: tier2.ownershipReasoner.confidenceBasis,
      nameMatchConfidence: tier2.ownershipReasoner.nameMatchConfidence ?? null,
      claimState: tier2.ownershipReasoner.claimState ?? null,
      readiness: tier2.ownershipReasoner.readiness ?? null,
      inputQuality: tier2.ownershipReasoner.inputQuality ?? null,
      fatherHusbandMatch: tier2.ownershipReasoner.fatherHusbandMatch ?? null,
      matchReasons: tier2.ownershipReasoner.matchReasons ?? [],
      blockingWarnings: tier2.ownershipReasoner.blockingWarnings ?? [],
    } : null,
    landClassifier: normalizeLandClassifier(tier2.landClassifier),
    encumbranceReasoner: tier2.encumbranceReasoner ?? null,
    regulatoryScreener: normalizeRegulatoryScreener(tier2.regulatoryScreener),
    larrRiskAssessment: larr?.data ?? null,
    // T-041 — Bhuvan flood hazard data (planning-only).
    bhuvanFloodData: bhuvanFlood?.data ?? null,
    // T-049 — EOW Khordha blacklist match payload. Forwarded as-is;
    // ROR-INS-210 / ROR-INS-211 read from `input.eowBlacklist.data`.
    eowBlacklist: sources.find((s) => s.source === ("eow" as string))?.data ?? null,
    validationFindings: validationFindings ?? [],
    sourceStatus: {
      nominatim: nominatim?.status ?? "not_run",
      bhunaksha: bhunaksha?.status ?? "not_run",
      bhunaksha_plot_report: bhunakshaPlotReport?.status ?? "not_run",
      bhulekh: bhulekh?.status ?? "not_run",
      bhulekh_back_page: (bhulekhBackPage?.status as string) ?? "not_applicable",
      ecourts: ecourts?.status ?? "not_run",
      rccms: normalizeRccmsStatus(rccms),
      "igr-ec": igrEc?.status ?? "not_run",
      cersai: cersai?.status ?? "not_run",
      "bhuvan-flood": bhuvanFlood?.status ?? "not_run",
      // T-049 — EOW Khordha blacklist fetcher status (read-only
      // mirror; the eowRules in the registry consult input.eowBlacklist
      // for actual matches, not the source status string).
      eow: sources.find((s) => s.source === ("eow" as string))?.status ?? "not_run",
    },
    sourceDetails: Object.fromEntries(
      sources.map((source) => {
        const base = {
          status: source.source === "rccms" ? normalizeRccmsStatus(source) : source.status,
          fetchedAt: source.fetchedAt,
          statusReason: source.statusReason ?? source.error ?? null,
          parserVersion: source.parserVersion ?? null,
          rawArtifactHash: source.rawArtifactHash ?? null,
          templateHash: source.templateHash ?? null,
          inputsTried: source.inputsTried ?? null,
          warnings: source.warnings ?? [],
        };

        // For Bhulekh, add rawOdia and casteOdia from the first tenant
        // so the trust strip can display the transferability flag without
        // duck-typing into ctx.data.revenueRecords.tenants[0].
        if (source.source === "bhulekh" && bhulekhRawDocument?.record?.ownerBlocks?.[0]) {
          const firstOwner = bhulekhRawDocument.record.ownerBlocks[0] as {
            casteOdia?: string | null;
            residenceOdia?: string | null;
            tenantNameOdia?: string;
            landClassOdia?: string;
            landClass?: string;
          };
          (base as any).rawOdia = {
            odia: firstOwner.landClassOdia ?? "",
            english: firstOwner.landClass ?? "",
          };
          (base as any).casteOdia = firstOwner.casteOdia ?? null;
          (base as any).residenceOdia = firstOwner.residenceOdia ?? null;
        }

        return [source.source, base];
      })
    ),
    disclaimerText: tier2.disclaimerText,
    // Sprint 4 — pass through to renderer for Section 7 (What is it worth) and
    // Section 3 (BDA zone). Both fields are validated as .any() at the schema
    // level so we don't lose runtime shape tolerance.
    circleRateData: tier2.circleRateData ?? null,
    bdaZoneData: tier2.bdaZoneData ?? null,
    // Sprint V5b — IGR public-data sub-cards for Section 5.
    igrBmvData: tier2.igrBmvData ?? null,
    stampDutyData: tier2.stampDutyData ?? null,
    igrDailyBulletinData: tier2.igrDailyBulletinData ?? null,
    // Sprint V5c — IGR public-data sub-cards for Section 2 + Section 6.
    publicDashboardData: tier2.publicDashboardData ?? null,
    govtFeeData: tier2.govtFeeData ?? null,
    igrCertifiedCopyData: tier2.igrCertifiedCopyData ?? null,
    // P-NEW-1A: Pattern intelligence synthesis insights
    synthesisInsights: tier2.synthesisInsights ?? [],
    // Bhunaksha Plot Report — passed through to renderer; renderer can embed
    // the cadastral map image in Section 1 and add cross-check lines in
    // Sections 2 and 5 when present.
    bhunakshaPlotReport: bhunakshaPlotReport?.data ?? null,
    // Phase 2 v1 — plot diagram from the pipeline step. Threaded
    // through as the third arg of mapToReportInput. When null/absent
    // (legacy call sites in tests, or the diagram step never ran), the
    // schema validates as null and the v0 map card silently returns ""
    // (which is the v0 behavior — pre-Phase-2 reports are unchanged).
    plotDiagram: plotDiagram
      ? {
          status: plotDiagram.status,
          url: plotDiagram.url,
          reason: plotDiagram.reason ?? null,
          cacheHit: plotDiagram.cacheHit ?? false,
          rendered: plotDiagram.rendered ?? false,
          // Phase 2 v1 transient fields — emitted as data-* attrs
          // on the map div by map-card.ts. Undefined when not
          // present (cache-hit, not_attempted, failed) — the bootstrap
          // script bails to the v0 fallback.
          targetPolygon: plotDiagram.targetPolygon ?? null,
          neighbors: plotDiagram.neighbors ?? [],
          roads: plotDiagram.roads ?? [],
          bounds: plotDiagram.bounds ?? null,
          // MapCard v1.1 — approximate-mode plumbing. When the
          // diagram step took the fallback path, the mapper
          // surfaces `approximate: true` + the WFS reason so the
          // renderer can flag the caption + emit data-mode. The
          // synthesized GeoJSON is passed through `targetPolygon`
          // + `bounds` (the bootstrap positions the camera there).
          // The Khordha boundary is rendered as a separate
          // data-district attribute.
          approximate: plotDiagram.approximate ?? false,
          approximateReason: plotDiagram.approximateReason ?? null,
          khordhaBoundary: plotDiagram.khordhaBoundary ?? null,
          // Built server-side from village+tahasil+plotNo; falls
          // back to the Bhulekh homepage when the mapper cannot
          // derive the deep link. The bootstrap script reads this
          // into the Verify-on-Bhulekh CTA.
          bhulekhUrl: buildBhulekhUrl(
            geoFetch.village,
            geoFetch.tahasil,
            geoFetch.plotNo
          ),
        }
      : null,
  };
}

/**
 * Build the Bhulekh deep-link URL for the Verify-on-Bhulekh CTA.
 *
 * Bhulekh's actual deep-link scheme (https://bhulekh.ori.nic.in/...) does
 * not accept plot/village/tahasil as query params in a stable way — the
 * site's ASP.NET ViewState-based form requires a Playwright bootstrap. So
 * for the v1 CTA we send the buyer to Bhulekh's tenant-search homepage,
 * pre-populating whatever query params the site accepts (none today).
 *
 * Future: when Bhulekh ships stable deep links, replace this with the
 * real URL builder. The function exists today so the v1 CTA has a
 * stable contract — even when it points to the homepage, it gives the
 * buyer a clear next step.
 *
 * Hand-rolled query-string builder (instead of URLSearchParams) to
 * avoid pulling the DOM lib into the consumer-report-writer's
 * TypeScript config. The shape is identical to URLSearchParams.
 */
function buildBhulekhUrl(
  village: string | null,
  tahasil: string | null,
  plotNo: string | null
): string {
  const base = "https://bhulekh.ori.nic.in/RoRView.aspx";
  const parts: string[] = [];
  const add = (k: string, v: string) => {
    // Minimal percent-encoding — query params from this builder only
    // ever carry ASCII identifiers (plotNo, village, tahasil). The
    // encodeURIComponent fallback handles spaces and unicode just
    // in case.
    parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  };
  if (plotNo && plotNo.trim()) add("plot", plotNo.trim());
  if (village && village.trim()) add("village", village.trim());
  if (tahasil && tahasil.trim()) add("tahasil", tahasil.trim());
  return parts.length ? `${base}?${parts.join("&")}` : base;
}

function normalizeRccmsStatus(rccms: SourceResult | undefined): string {
  if (!rccms) return "not_run";
  const error = typeof rccms.error === "string" ? rccms.error.toLowerCase() : "";
  const verification = typeof rccms.verification === "string" ? rccms.verification : "";
  const isPlaceholder =
    verification === "manual_required" ||
    error.includes("placeholder") ||
    error.includes("not implemented");

  if (rccms.status === "partial" && isPlaceholder) return "manual_required";
  return rccms.status;
}

function normalizeLandClassifier(landClassifier: Tier2Input["landClassifier"]) {
  if (!landClassifier) return null;
  const restrictions = landClassifier.restrictions ?? [];
  const restrictionFlags = restrictions.map((restriction) => ({
    flag: titleFromSnakeCase(restriction.type),
    severity: normalizeRestrictionSeverity(restriction.severity),
    proximity: null,
    description: restriction.description,
    recommendedAction: restriction.action ?? restriction.citation ?? null,
  }));

  return {
    ...landClassifier,
    currentClassification:
      landClassifier.currentClassification ??
      (landClassifier as any).plotClassifications?.[0]?.kisamEnglish ??
      landClassifier.primaryKisam ??
      null,
    conversionRequired: landClassifier.conversionRequired ?? null,
    conversionSteps: landClassifier.conversionSteps ?? landClassifier.conversionNote ?? null,
    redFlags: [...(landClassifier.redFlags ?? []), ...restrictionFlags],
  };
}

function normalizeRegulatoryScreener(regulatoryScreener: Tier2Input["regulatoryScreener"]) {
  if (!regulatoryScreener) return null;
  return {
    ...regulatoryScreener,
    flags: (regulatoryScreener.flags ?? []).filter((flag) =>
      Boolean(flag.flag?.trim() && flag.description?.trim())
    ),
  };
}

function normalizeRestrictionSeverity(severity: "critical" | "warning" | "info"): "high" | "medium" | "low" {
  if (severity === "critical") return "high";
  if (severity === "warning") return "medium";
  return "low";
}

function titleFromSnakeCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * ClearDeed Pipeline — full report generation (web app)
 *
 * Entry point: POST /api/report/create → pipeline()
 *
 * Pipeline order (per PRODUCT.md Section 5):
 *   Tier 1 (parallel)  Nominatim → Bhunaksha, Bhulekh, eCourts
 *   Tier 2 (sequential) A5 OwnershipReasoner (after Bhulekh)
 *   Tier 3            A10 ConsumerReportWriter
 */
import { runReport } from "@cleardeed/orchestrator";
import { reasonOwnership } from "@cleardeed/ownership-reasoner";
import { reasonEncumbrance, type EncumbranceResult } from "@cleardeed/encumbrance-reasoner";
import { buildECInstructionsText } from "../ec-instructions";
import { screenRegulations, type RegulatoryScreenerResult } from "@cleardeed/regulatory-screener";
import { classifyLand, type LandClassifierInput } from "@cleardeed/land-classifier";
import {
  generateConsumerReport,
  mapToReportInput,
  buildFounderCuratedClusters,
  type Tier2Input,
  type OwnershipReasonerResult,
} from "@cleardeed/consumer-report-writer";
import { bhunakshaFetch } from "@cleardeed/fetcher-bhunaksha";
import { bhunakshaPlotReportFetch } from "@cleardeed/fetcher-bhunaksha-plot-report";
import { nominatimFetch } from "@cleardeed/fetcher-nominatim";
import { ecourtsFetch } from "@cleardeed/fetcher-ecourts";

// PID synthesis kill switch — default to false until Phase 1 observability data shows positive signals
const PID_SYNTHESIS_ENABLED = process.env.PID_SYNTHESIS_ENABLED === "true";
// PID A/B test — randomize cluster display order to measure click-through rate
const PID_EXPERIMENT_CLUSTER_ORDER = process.env.PID_EXPERIMENT_CLUSTER_ORDER === "true";
import { igrEcFetch } from "@cleardeed/fetcher-igr-ec";
import { lookupSRO as igrSroLookup } from "@cleardeed/fetcher-igr-sro";
import { cersaiFetch } from "@cleardeed/fetcher-cersai";
import { fetch as rccmsFetch } from "@cleardeed/fetcher-rccms";
import { fetch as circleRateFetch } from "@cleardeed/fetcher-circle-rate";
import { fetch as bdaZoningFetch } from "@cleardeed/fetcher-bda-zoning";
// Sprint 8 (Task 35) — Plot diagram pipeline step. Wires the WFS compose
// + SVG render + Supabase Storage upload into the V1.1 report pipeline
// with a 30s timeout, 7-day cache, and non-blocking failure semantics.
import { runPlotDiagramStep, type PlotDiagramStepResult } from "../plot-diagram-step";
// Sprint V5b — IGR public-data fetchers (PI-V.5). Typed-degradation siblings to
// the existing circle-rate / igr-ec pipeline calls. The renderer sub-cards are
// added in `agents/consumer-report-writer/src/index.ts` buildBenchmarkSection.
import { igrBmvFetch } from "@cleardeed/fetcher-igr-bmv";
import { stampDutyFetch } from "@cleardeed/fetcher-stamp-duty";
import { igrDailyBulletinFetch } from "@cleardeed/fetcher-igr-daily-bulletin";
// Sprint V5c — IGR public-data fetchers (PI-V.5). Two of three ship as
// typed-degradation siblings (public-dashboard is server-rendered, certified-copy
// is captcha+login-gated); govt-fee is a permanent typed cache.
import { publicDashboardFetch } from "@cleardeed/fetcher-public-dashboard";
import { govtFeeFetch } from "@cleardeed/fetcher-govt-fee";
import { igrCertifiedCopyFetch } from "@cleardeed/fetcher-igr-certified-copy";
// T-041 — Bhuvan flood hazard WMS (planning-only license).
import { fetch as bhuvanFloodFetch } from "@cleardeed/fetcher-bhuvan-flood";
import type { SourceResult } from "@cleardeed/orchestrator";
import {
  isSourceFired,
  V11_DORMANT_MARKER,
  ALL_SOURCE_IDS,
  type FireResult,
  type SourceId,
} from "./contracts/fire";

/** Runtime set of valid SourceId values, for narrowing guard. */
const VALID_SOURCE_IDS: ReadonlySet<string> = new Set<string>(ALL_SOURCE_IDS);

export type { Tier2Input };

const DEFAULT_DISCLAIMER = `This report is prepared by ClearDeed using publicly available government land records. It is not a legal opinion, not a title certificate, and not a guarantee of ownership or freedom from encumbrance. Before you transact: share this report with a qualified property lawyer, request original title documents from the seller going back at least 30 years, obtain an Encumbrance Certificate from the Sub-Registrar office, verify plot boundaries on the ground with a local survey, confirm land classification permits your intended use, and confirm no conversion of land use is required.`;

/**
 * The set of source ids that are V1.1-DORMANT and should produce
 * `reason: "skipped_dormant"` regardless of what the orchestrator returned.
 *
 * Per the binding brief (Task 0.1, finding 3): in V1.1, only the Bhulekh
 * source is active. Every other source is dormant and the gate must
 * surface that explicitly, not let the orchestrator's "no data" leak
 * through as a real negative result.
 *
 * Resolution (I3): The orchestrator (`packages/orchestrator/src/index.ts`)
 * is already V1.1-scoped — `runAllFetchers` only fetches Bhulekh in V1.1
 * dropdown mode and emits `not_covered` SourceResults for everything else
 * in legacy GPS mode. So this set is a *defensive marker*: if a stale code
 * path or V1.5 fallback ever returns a non-bhulekh SourceResult to
 * `buildFireMap`, the gate short-circuits it to `skipped_dormant` instead
 * of letting an orchestrator `no_data` leak through as a real negative.
 *
 * `nominatim` and `bhunaksha` are listed here even though the orchestrator
 * emits `not_covered` results for them — that is intentional, so that any
 * future path returning a real `ok`/`no_data` for them still gets the
 * dormant short-circuit applied uniformly.
 */
export const V11_DORMANT_SOURCES: ReadonlySet<SourceId> = new Set<SourceId>([
  "nominatim",
  "bhunaksha",
  "bhunaksha-plot-report",
  "ecourts",
  "rccms",
  "igr-ec",
  "rera",
  "cersai",
  "high-court",
  "drt",
  "bda-zoning",
  "circle-rate",
  "stamp-duty",
  "igr-bmv",
  "igr-daily-bulletin",
  "public-dashboard",
  "govt-fee",
  "igr-certified-copy",
  "igr-sro",
  "larr",
]);

// `bhulekh` is the V1.1-active source and is NOT in V11_DORMANT_SOURCES.
//
// NOTE (M3): This set is intentionally observable from any code that
// iterates `sources`. It is a wire-marker list — do not refactor into a
// private helper. The wire-level `buildFireMap` and the gate-level
// (fire.ts) `isSourceFired` must agree on what counts as V1.1-dormant.

/**
 * Build a `Map<SourceId, FireResult>` from the orchestrator's `SourceResult[]`.
 *
 * Per the binding brief (Task 0.1, finding 3): V1.1-DORMANT sources produce
 * `reason: "skipped_dormant"`. The dormant set is a static list — see
 * `V11_DORMANT_SOURCES`. The orchestrator can also explicitly emit a
 * `V11_DORMANT_MARKER` SourceResult (the gate handles both paths).
 *
 * Wire test: `fire.wire.test.ts` exercises this with a mixed array
 * (one OK, one `no_data`, one V1.1-DORMANT) and asserts the resulting map.
 */
export function buildFireMap(sources: ReadonlyArray<SourceResult>): Map<SourceId, FireResult> {
  const out = new Map<SourceId, FireResult>();
  for (const src of sources) {
    // M2 narrowing guard: SourceResult.source is typed as string, but the
    // gate expects a SourceId. If the orchestrator ever emits a source id
    // that isn't in the closed SourceId union (e.g. a stale code path or
    // a typo in a fetcher), surface that explicitly as `invalid_input`
    // rather than silently coercing and producing a misleading
    // `skipped_dormant` from the dormant check below.
    if (typeof src.source !== "string" || !VALID_SOURCE_IDS.has(src.source)) {
      out.set(src.source as SourceId, { fired: false, reason: "invalid_input" });
      continue;
    }
    const id = src.source as SourceId;
    if (V11_DORMANT_SOURCES.has(id)) {
      out.set(id, { fired: false, reason: "skipped_dormant" });
      continue;
    }
    out.set(id, isSourceFired(id, src));
  }
  return out;
}

export interface PipelineInput {
  reportId?: string;
  gps: { lat: number; lon: number };
  claimedOwnerName: string;
  fatherHusbandName?: string;
  plotDescription?: string;
}

export interface PipelineOutput {
  reportId: string;
  html: string;
  title: string;
  validationFindings: Array<{
    dimension: string;
    severity: "error" | "warning" | "info";
    source: string;
    description: string;
  }>;
  sourceSummary: {
    nominatim: string;
    bhunaksha: string;
    bhulekh: string;
    ecourts: string;
    igrEc: string;
    cersai: string;
    rccms: string;
  };
  sources: SourceResult[];
  /** Fire map for every fetched source (Task 0.1, finding 3 contract).
   *  Assembled by `buildFireMap(sources)` so downstream tasks can read the
   *  per-source firing decision without re-running the gate logic. */
  fire: Map<SourceId, FireResult>;
  /** Bhunaksha Plot Report (per-plot, plotreportOR.jsp) — independent ROR cross-check.
   *  Adds the cadastral map image, owner block, khatiyan no, and three-column area. */
  bhunakshaPlotReport?: unknown;
}

/**
 * Run the full ClearDeed pipeline and return a consumer HTML report.
 *
 * Each source failure is handled gracefully — the HTML report shows exactly what
 * was retrieved and what requires manual follow-up.
 */
export async function generateReport(input: PipelineInput): Promise<PipelineOutput> {
  // ── Step 1: Run Tier 1 fetchers ────────────────────────────────────────────
  const orchestratorOutput = await runReport({
    reportId: input.reportId,
    gps: input.gps,
    claimedOwnerName: input.claimedOwnerName,
    fatherHusbandName: input.fatherHusbandName,
  });

  // ── Step 2: Extract Bhulekh data for A5 ───────────────────────────────────
  const bhulekhSrc = orchestratorOutput.sources.find((s) => s.source === "bhulekh");
  const nominatimSrc = orchestratorOutput.sources.find((s) => s.source === "nominatim");
  const bhunakshaSrc = orchestratorOutput.sources.find((s) => s.source === "bhunaksha");
  const ecourtsSrc = orchestratorOutput.sources.find((s) => s.source === "ecourts");
  const rccmsSrc = orchestratorOutput.sources.find((s) => s.source === "rccms");
  const igrEcSrc = orchestratorOutput.sources.find((s) => s.source === "igr-ec");
  const cersaiSrc = orchestratorOutput.sources.find((s) => s.source === "cersai");

  const bhulekhData = bhulekhSrc?.data as {
    khataNo?: string;
    village?: string;
    tenants?: Array<{
      tenantName?: string;
      fatherHusbandName?: string;
      surveyNo?: string;
      area?: number;
      unit?: string;
      landClass?: string;
      landClassOdia?: string;
      landClassEnglish?: string;
    }>;
    lastUpdated?: string;
  } | null;

  // ── Step 3: A5 OwnershipReasoner ───────────────────────────────────────────
  let ownershipReasoner: Awaited<ReturnType<typeof reasonOwnership>> | null = null;
  if (bhulekhData?.tenants && bhulekhData.tenants.length > 0) {
    try {
      ownershipReasoner = await reasonOwnership({
        claimedOwnerName: input.claimedOwnerName,
        fatherHusbandName: input.fatherHusbandName,
        rorDocument: {
          village: bhulekhData.village ?? "",
          khatiyanNo: bhulekhData.khataNo ?? undefined,
          tenants: bhulekhData.tenants.map((t) => ({
            tenantName: t.tenantName ?? "",
            fatherHusbandName: t.fatherHusbandName,
            surveyNo: t.surveyNo ?? "",
            area: t.area,
            landClass: t.landClass,
          })),
        },
      });
    } catch (err) {
      console.error("[pipeline] A5 OwnershipReasoner error:", err);
      // Proceed with null — A10 handles this gracefully
    }
  }

  // ── Step 4: A6 LandClassifier ───────────────────────────────────────────────
  let landClassifier: Awaited<ReturnType<typeof classifyLand>> | null = null;
  const bhunakshaData2 = bhunakshaSrc?.data as { plotNo?: string; village?: string; areaSqKm?: number } | null;
  // Bhulekh tenants[] has landClass per plot
  if (bhulekhData?.tenants && bhulekhData.tenants.length > 0) {
    try {
      const plots: LandClassifierInput["plots"] = bhulekhData.tenants.map((t) => ({
        plotNo: t.surveyNo ?? "",
        areaAcres: t.area ?? 0,
        landClassOdia: t.landClassOdia ?? undefined,
        landClassEnglish: t.landClassEnglish ?? t.landClass ?? undefined,
      }));
      landClassifier = classifyLand({
        plots,
        gpsCoordinates: { lat: input.gps.lat, lng: input.gps.lon },
        village: bhulekhData.village ?? bhunakshaData2?.village ?? undefined,
      });
    } catch (err) {
      console.error("[pipeline] A6 LandClassifier error:", err);
    }
  }

  // ── Step 4a: A8 RegulatoryScreener ───────────────────────────────────────────
  let regulatoryScreener: RegulatoryScreenerResult | null = null;
  if (bhunakshaSrc?.data) {
    try {
      regulatoryScreener = screenRegulations(bhunakshaSrc as any);
    } catch (err) {
      console.error("[pipeline] A8 RegulatoryScreener error:", err);
    }
  }

  // ── Step 4b: A7 EncumbranceReasoner (now backed by IGR EC fetcher data) ────────
  let encumbranceReasoner: Awaited<ReturnType<typeof reasonEncumbrance>> | null = null;

  // Use IGR EC fetcher data if available, otherwise fall back to A7 manual instructions
  const igrEcData = igrEcSrc?.data as {
    status?: string;
    instructions?: string;
    url?: string;
    sro?: string;
    district?: string;
  } | null;

  const cersaiData = cersaiSrc?.data as {
    status?: string;
    instructions?: string;
    outcome?: string;
  } | null;

  const plotIdentifierForA7 = {
    district: (nominatimSrc?.data as any)?.district ?? "Not verified",
    tahasil: (nominatimSrc?.data as any)?.tahasil ?? (bhunakshaSrc?.data as any)?.tahasil ?? "Not verified",
    village: (bhunakshaSrc?.data as any)?.village ?? (nominatimSrc?.data as any)?.village ?? "",
    plotNo: (bhunakshaSrc?.data as any)?.plotNo ?? "",
    khataNo: bhulekhData?.khataNo ?? undefined,
  };

  // Build encumbrance reasoner with IGR EC + CERSAI instructions
  if (igrEcData?.instructions || cersaiData?.instructions) {
    const instructions: string[] = [];

    if (igrEcData?.instructions) {
      instructions.push(`📋 Encumbrance Certificate (EC) — IGR Odisha`);
      instructions.push(igrEcData.instructions);
    }

    if (cersaiData?.instructions) {
      instructions.push(`\n🏦 CERSAI Charge Search — Central Registry`);
      instructions.push(cersaiData.instructions);
    }

    encumbranceReasoner = {
      status: (igrEcSrc?.status === "success" && cersaiSrc?.status === "success") ? "clear" : "manual_required",
      instructions: instructions.join("\n"),
      encumbrances: [],
      confidence: (igrEcSrc?.status === "success" ? 0.5 : 0) + (cersaiSrc?.status === "success" ? 0.5 : 0),
      confidenceBasis: [
        igrEcSrc ? `IGR EC: ${igrEcSrc.status}` : null,
        cersaiSrc ? `CERSAI: ${cersaiSrc.status}` : null,
      ].filter(Boolean).join("; ") || "No encumbrance data fetched",
    };
  } else if (plotIdentifierForA7.village && plotIdentifierForA7.plotNo) {
    try {
      encumbranceReasoner = reasonEncumbrance({ plotIdentifier: plotIdentifierForA7 });
    } catch (err) {
      console.error("[pipeline] A7 EncumbranceReasoner error:", err);
    }
  }

  // ── Step 5: Build Tier 2 input ────────────────────────────────────────────
  const tier2Input: Tier2Input = {
    gps: input.gps,
    claimedOwnerName: input.claimedOwnerName,
    ownershipReasoner,
    landClassifier,
    encumbranceReasoner,
    regulatoryScreener,
    disclaimerText: DEFAULT_DISCLAIMER,
  };

  // ── Step 5: Build igrLink ──────────────────────────────────────────────────
  const nominatimData = nominatimSrc?.data as { displayName?: string; village?: string; district?: string; tahasil?: string } | null;
  const bhunakshaData = bhunakshaSrc?.data as { plotNo?: string; village?: string; tahasil?: string } | null;
  const canonicalVillageSummary = summarizeCanonicalVillageSource(bhulekhSrc);
  const igrLink = {
    url: "https://igrodisha.gov.in/ecsearch",
    params: {
      district: nominatimData?.district ?? "Not verified",
      sro: "Not verified",
      plotNo: bhunakshaData?.plotNo,
    },
  };

  // ── Step 6: Map orchestrator output + tier2 → A10 input ────────────────────
  const reportInput = mapToReportInput(
    {
      reportId: orchestratorOutput.reportId,
      sources: bhunakshaPlotReport
        ? [...orchestratorOutput.sources, bhunakshaPlotReport as SourceResult]
        : orchestratorOutput.sources,
      completedAt: orchestratorOutput.completedAt,
      validationFindings: orchestratorOutput.validationFindings ?? [],
      igrLink,
    },
    tier2Input
  );

  // ── Step 7: A10 ConsumerReportWriter ───────────────────────────────────────
  const { html, title } = generateConsumerReport(reportInput);

  // ── Step 8: A11 OutputAuditor — liability gate ─────────────────────────────
  const { auditOrThrow } = await import("@cleardeed/output-auditor");
  auditOrThrow(html, orchestratorOutput.reportId); // throws on critical violations

  // ── Step 9: Build source summary ───────────────────────────────────────────
  const sourceSummary = {
    nominatim:
      nominatimSrc?.status === "success"
        ? [
            nominatimData?.village,
            nominatimData?.district,
          ].filter(Boolean).join(", ") || nominatimData?.displayName || "Location returned"
        : nominatimSrc?.status ?? "unknown",
    bhunaksha:
      bhunakshaSrc?.status === "success" || bhunakshaSrc?.status === "partial"
        ? `Plot #${bhunakshaData?.plotNo ?? "—"}${bhunakshaData?.village ? `, ${bhunakshaData.village}` : ""}${bhunakshaSrc.status === "partial" ? " (partial)" : ""}`
        : bhunakshaSrc?.status ?? "unknown",
    bhulekh:
      bhulekhSrc?.status === "success"
        ? [
            `${bhulekhData?.tenants?.length ?? 0} tenant(s) under Khatiyan #${bhulekhData?.khataNo ?? "—"}`,
            canonicalVillageSummary,
          ].filter(Boolean).join("; ")
        : bhulekhSrc?.status ?? "unknown",
    ecourts: summarizeEcourtsStatus(ecourtsSrc),
    rccms:
      rccmsSrc?.status === "success"
        ? `${(rccmsSrc.data as { total?: number })?.total ?? 0} case(s)`
        : normalizeRccmsSummaryStatus(rccmsSrc),
    igrEc: igrEcSrc?.status ?? "unknown",
    cersai: cersaiSrc?.status ?? "unknown",
  };

  return {
    reportId: orchestratorOutput.reportId,
    html,
    title,
    validationFindings: orchestratorOutput.validationFindings ?? [],
    sourceSummary,
    sources: orchestratorOutput.sources,
    // Task 0.1 finding 3 contract — assemble the per-source fire map and
    // expose it on the pipeline output so downstream tasks can read the
    // firing decision without re-running the gate.
    fire: buildFireMap(orchestratorOutput.sources),
  };
}

// ── V1.1 Bhulekh-only pipeline ────────────────────────────────────────────────

export interface V11PipelineInput {
  reportId?: string;
  tehsil: string;
  tehsilValue: string;
  village: string;
  villageCode: string;
  searchMode: "Plot" | "Khatiyan" | "Tenant";
  identifier: string;
  claimedOwnerName?: string;
}

export interface V11PipelineOutput {
  reportId: string;
  html: string;
  title: string;
  validationFindings: Array<{
    dimension: string;
    severity: "error" | "warning" | "info";
    source: string;
    description: string;
  }>;
  sourceSummary: {
    bhulekh: string;
    bhunaksha?: string;
    ecourts?: string;
    igrEc?: string;
    cersai?: string;
    rccms?: string;
    bhuvanFlood?: string;
  };
  /** Fire map for every fetched source (Task 0.1, finding 3 contract).
   *  Assembled by `buildFireMap(sources)` so downstream tasks can read the
   *  per-source firing decision without re-running the gate logic. */
  fire: Map<SourceId, FireResult>;
  /** Bhunaksha polygon GeoJSON — passed to report for Mapbox rendering */
  bhunakshaPolygon?: {
    type: "Polygon";
    coordinates: number[][][];
  } | null;
  /** Bhunaksha Plot Report (per-plot, plotreportOR.jsp) — independent ROR
   *  cross-check. Adds cadastral map image, owner block, khatiyan no, area. */
  bhunakshaPlotReport?: unknown;
  /** Plot diagram (Task 35): WFS-composed SVG of target + neighbors +
   *  roads, uploaded to Supabase Storage. `null` when the step was skipped
   *  (no polygon) or failed (non-blocking — the rest of the report still
   *  ships). The renderer embeds `url` directly in the consumer report. */
  plotDiagram?: PlotDiagramStepResult | null;
}

/**
 * V1.1 pipeline: Bhulekh fetcher + Bhunaksha boundary + A5 OwnershipReasoner → A10 ConsumerReportWriter.
 * Bhunaksha polygon is resolved via Nominatim village geocoding → WFS query.
 */
export async function generateReportV11(input: V11PipelineInput): Promise<V11PipelineOutput> {
  const reportId = input.reportId ?? crypto.randomUUID();

  // ── Step 1: Run Bhulekh fetcher ────────────────────────────────────────────
  const orchestratorOutput = await runReport({
    reportId,
    tehsil: input.tehsil,
    tehsilCode: input.tehsilValue,
    village: input.village,
    villageCode: input.villageCode,
    searchMode: input.searchMode,
    identifierValue: input.identifier,
    identifierLabel: input.identifier,
    claimedOwnerName: input.claimedOwnerName,
  });

  const bhulekhSrc = orchestratorOutput.sources.find((s) => s.source === "bhulekh");
  const bhulekhData = bhulekhSrc?.data as {
    khataNo?: string;
    village?: string;
    tenants?: Array<{
      tenantName?: string;
      fatherHusbandName?: string;
      surveyNo?: string;
      area?: number;
      unit?: string;
      landClass?: string;
      landClassOdia?: string;
      landClassEnglish?: string;
    }>;
    lastUpdated?: string;
  } | null;

  if (bhulekhSrc?.status !== "success" || !bhulekhData?.tenants?.length) {
    const reason = bhulekhSrc?.statusReason ?? bhulekhSrc?.error ?? bhulekhSrc?.status ?? "unknown";
    throw new Error(`Bhulekh RoR fetch did not return usable owner/plot records: ${reason}`);
  }

  // ── Step 1b: Resolve village GPS via Nominatim, then fetch Bhunaksha polygon ─
  // Nominatim is used here as a village centroid resolver (not the primary geocoder).
  // This gives us lat/lon to query the Bhunaksha WFS polygon.
  let bhunakshaPolygon: { type: "Polygon"; coordinates: number[][][] } | null = null;
  let bhunakshaSummary = "not_fetched";
  let bhunakshaResult: Awaited<ReturnType<typeof bhunakshaFetch>> | null = null;
  // Captured for the plot diagram step (Task 35). Hoisted so it's available
  // outside the try block even when Bhunaksha fetch errors.
  let villageGpsForDiagram: { lat: number; lon: number } | null = null;

  try {
    const villageGps = await resolveVillageGps(input.village, input.tehsil);
    if (villageGps) {
      villageGpsForDiagram = { lat: villageGps.lat, lon: villageGps.lon };
      bhunakshaResult = await bhunakshaFetch({
        lat: villageGps.lat,
        lon: villageGps.lon,
        layer: "khurda_bhubaneswar", // TODO: resolve per-tehsil layer when confirmed
        villageName: input.village,
        plotNo: input.identifier,
        ...(villageGps.searchRadius != null ? { searchRadius: villageGps.searchRadius } : {}),
      });
      if (bhunakshaResult.status === "success" && bhunakshaResult.data?.polygon) {
        // Bhunaksha WFS returns coordinates already in GeoJSON Polygon format (number[][][]).
        // BhunakshaResult.polygon is typed as PlotPolygon which is { type: "Polygon", coordinates: number[][][] }.
        // Use it directly — no wrapping needed.
        bhunakshaPolygon = bhunakshaResult.data.polygon;
        bhunakshaSummary = `plot #${bhunakshaResult.data.plotNo ?? "—"} · ${bhunakshaResult.data.area ? `${bhunakshaResult.data.area.toFixed(4)} km²` : "area TBD"}`;
      } else {
        bhunakshaSummary = bhunakshaResult.statusReason ?? bhunakshaResult.status ?? "failed";
      }
    } else {
      bhunakshaSummary = "village_gps_not_resolved";
    }
  } catch (err) {
    console.warn("[pipeline/v11] Bhunaksha fetch error:", err instanceof Error ? err.message : err);
    bhunakshaSummary = "fetch_error";
  }

  // ── Step 1b.2: Bhuvan flood hazard WMS (T-041) — planning-only data.
  // Parallel to Bhunaksha. Skipped when village GPS is unresolved.
  // NRSC Bhuvan data is published under planning-only license — formal
  // licensing is required before this output appears in a paid report.
  // Until then, the result is included in the report, but consumer
  // copy frames it as "planning-only, verify with NRSC for legal use."
  let bhuvanFloodResult: Awaited<ReturnType<typeof bhuvanFloodFetch>> | null = null;
  if (villageGpsForDiagram) {
    try {
      bhuvanFloodResult = await bhuvanFloodFetch({
        lat: villageGpsForDiagram.lat,
        lon: villageGpsForDiagram.lon,
      });
    } catch (err) {
      console.warn(
        "[pipeline/v11] Bhuvan flood fetch error:",
        err instanceof Error ? err.message : err
      );
    }
  }

  // ── Step 1c: Plot diagram (Task 35) — WFS compose + SVG render + upload ─
  // Non-blocking: a failure here does NOT fail the report. The diagram is
  // an additive UX surface (rendered as <img> in the consumer report) — the
  // rest of the report still ships. 30s overall budget; 7-day cache by
  // reportId (primary) or (gps+plot#+village) (secondary).
  let plotDiagram: PlotDiagramStepResult | null = null;
  if (bhunakshaPolygon && villageGpsForDiagram) {
    try {
      plotDiagram = await runPlotDiagramStep({
        reportId,
        gps: villageGpsForDiagram,
        village: input.village,
        plotNo: bhunakshaResult?.data?.plotNo ?? input.identifier,
        targetPolygon: bhunakshaPolygon,
        traceId: `rpt-${reportId.slice(0, 8)}`,
      });
    } catch (err) {
      // runPlotDiagramStep already swallows errors and returns a
      // structured result. A throw here would be a bug in the step itself
      // (e.g. uncaught exception in cache helper). Log and continue.
      console.warn(
        "[pipeline/v11] plot diagram step threw (should not happen):",
        err instanceof Error ? err.message : err
      );
      plotDiagram = {
        status: "failed",
        url: null,
        reason: err instanceof Error ? err.message : String(err),
        cacheHit: false,
        rendered: false,
        durationMs: 0,
      };
    }
  }

  // ── Step 1c: Bhunaksha Plot Report — independent ROR cross-check ────────
  // Adds the cadastral map image, owner block, khatiyan no, and three-column
  // area (acres/decimal/hectare). Per bhulekh_bhunaksha_guide.md §3 the URL
  // is derivable from district/tehsil/RI/mouza GIS code; no login or captcha.
  let bhunakshaPlotReport:
    | Awaited<ReturnType<typeof bhunakshaPlotReportFetch>>
    | null = null;
  if (bhunakshaResult?.data?.plotNo && input.village && input.tehsil) {
    try {
      bhunakshaPlotReport = await bhunakshaPlotReportFetch({
        village: input.village,
        tahasil: input.tehsil,
        plotNo: bhunakshaResult.data.plotNo,
      });
    } catch (err) {
      console.warn(
        "[pipeline/v11] Bhunaksha Plot Report fetch error:",
        err instanceof Error ? err.message : err
      );
    }
  }

  // ── Step 2a: eCourts — case search by owner name ───────────────────────────
  const ownerNames = bhulekhData?.tenants?.map((t) => t.tenantName).filter(Boolean) ?? [];
  let ecourtsResult: Awaited<ReturnType<typeof ecourtsFetch>> | null = null;
  if (ownerNames.length > 0) {
    try {
      ecourtsResult = await ecourtsFetch({
        partyName: ownerNames[0] ?? "Unknown",
        districtName: "Khordha",
        districtCode: "8",
        tryNameVariants: true,
      });
    } catch (err) {
      console.warn("[pipeline/v11] eCourts fetch error:", err instanceof Error ? err.message : err);
    }
  }

  // ── Step 2b: IGR EC — Encumbrance Certificate search ───────────────────────
  // Resolve SRO from tehsil name, then search by plot number and owner name.
  // IGR EC automated login is deferred from the Khordha launch (D-037); the
  // buyer receives the typed manual-instructions panel and the SRO portal
  // link. Re-enable V2 by setting IGR_CITIZEN_LOGIN_ID and
  // IGR_CITIZEN_PASSWORD in env (see packages/fetchers/igr-ec/src/index.ts).
  let igrEcResult: Awaited<ReturnType<typeof igrEcFetch>> | null = null;
  try {
    igrEcResult = await igrEcFetch({
      partyName: ownerNames[0] ?? "",
      district: "Khordha",
      sro: input.tehsil,
      fromYear: new Date().getFullYear() - 1, // 1-year range per D-033
      toYear: new Date().getFullYear(),
    });
  } catch (err) {
    console.warn("[pipeline/v11] IGR EC fetch error:", err instanceof Error ? err.message : err);
    igrEcResult = null;
  }

  // ── Step 2c: IGR SRO — Sub-Registrar Office lookup ────────────────────────
  // Resolve SRO contact details + EC portal URL for the manual instructions panel.
  // This is a pure data lookup (no network call) so it never fails; we pass
  // a warning to the renderer if the SRO is not found.
  const igrSroResult = igrSroLookup({
    district: "Khordha",
    tahasil: input.tehsil,
    sroName: undefined, // Let resolver match from tahasil
  });

  // ── Step 2d: CERSAI — mortgage / charge search by owner name ───────────────
  let cersaiResult: Awaited<ReturnType<typeof cersaiFetch>> | null = null;
  if (ownerNames.length > 0) {
    try {
      cersaiResult = await cersaiFetch({
        partyName: ownerNames[0] ?? "Unknown",
        partyType: "individual",
        searchBy: "borrower",
      });
    } catch (err) {
      console.warn("[pipeline/v11] CERSAI fetch error:", err instanceof Error ? err.message : err);
    }
  }

  // ── Step 2e: RCCMS — revenue court case search ─────────────────────────────
  // Bounded to 5s so the portal probe (which can hang >3min in the production
  // network per D-030) cannot stall the report. If the probe completes within
  // the budget we use its result; otherwise we return a manual_required stub.
  let rccmsResult: Awaited<ReturnType<typeof rccmsFetch>> | null = null;
  try {
    rccmsResult = await rccmsFetchWithTimeout(
      rccmsFetch,
      {
        district: "Khordha",
        tahasil: input.tehsil,
        village: input.village,
        khataNo: bhulekhData?.khataNo,
        plotNo: input.searchMode === "Plot" ? input.identifier : bhulekhData?.tenants?.[0]?.surveyNo,
      },
      5000
    );
  } catch {
    rccmsResult = rccmsTimeoutStub();
  }

  // ── Step 2e: Circle Rate (BMV) — floor band for Section 7 ──────────────────
  // Sprint 4: feeds "What is it worth" floor/directional/ceiling layout.
  // JSON-backed local lookup keyed on mouza + tehsil + kisam. No scraping.
  let circleRateResult: Awaited<ReturnType<typeof circleRateFetch>> | null = null;
  try {
    const primaryKisam =
      bhulekhData?.tenants?.[0]?.landClassEnglish ??
      bhulekhData?.tenants?.[0]?.landClass ??
      "Residential";
    // Map Bhulekh/land-classifier kisam names to the IGR kisam labels used in the JSON
    const normalisedKisam =
      /agricultural|agricultur/i.test(primaryKisam) ? "Agricultural" :
      /commercial|byabasaika/i.test(primaryKisam) ? "Commercial" :
      /industrial/i.test(primaryKisam) ? "Industrial" :
      "Residential";
    circleRateResult = await circleRateFetch({
      mouza: bhulekhData?.village ?? input.village,
      tehsil: input.tehsil,
      kisam: normalisedKisam,
    });
  } catch (err) {
    console.warn("[pipeline/v11] circle-rate fetch error:", err instanceof Error ? err.message : err);
  }

  // ── Step 2f: BDA Master Plan zoning — feeds Section 3 "What you can build" ──
  // Sprint 4: classifies plot into residential/commercial/industrial/green_belt/etc.
  let bdaZoningResult: Awaited<ReturnType<typeof bdaZoningFetch>> | null = null;
  try {
    bdaZoningResult = await bdaZoningFetch({
      village: bhulekhData?.village ?? input.village,
      tehsil: input.tehsil,
    });
  } catch (err) {
    console.warn("[pipeline/v11] bda-zoning fetch error:", err instanceof Error ? err.message : err);
  }

  // ── Step 2g: IGR BMV (Benchmark Valuation) — live floor band, replaces circle-rate ──
  // Sprint V5b: when the live endpoint is reachable, BMV replaces the JSON seed
  // for Section 5 ("What is it worth"). The renderer falls back to circle-rate
  // automatically when BMV is source_down.
  let igrBmvResult: Awaited<ReturnType<typeof igrBmvFetch>> | null = null;
  try {
    igrBmvResult = await igrBmvFetch({
      sro: input.tehsil,
      village: bhulekhData?.village ?? input.village,
      kisam:
        bhulekhData?.tenants?.[0]?.landClassEnglish ??
        bhulekhData?.tenants?.[0]?.landClass ??
        "Residential",
    });
  } catch (err) {
    console.warn("[pipeline/v11] igr-bmv fetch error:", err instanceof Error ? err.message : err);
  }

  // ── Step 2h: Stamp Duty — government-expected payable + BMV-floor cross-check ──
  // Sprint V5b: cross-checks the buyer's quoted price against the
  // government-expected stamp duty. If bmvFloorApplied=true, the government
  // bumped the market value up to the BMV — that's a Section 5 watch-out.
  // Market value is derived from a typical Bhubaneswar plot (10 decimal) at the
  // circle-rate floor; the buyer can override it after seeing the report.
  let stampDutyResult: Awaited<ReturnType<typeof stampDutyFetch>> | null = null;
  try {
    const areaAcres = bhulekhData?.tenants?.[0]?.area ?? 0;
    const primaryKisam =
      bhulekhData?.tenants?.[0]?.landClassEnglish ??
      bhulekhData?.tenants?.[0]?.landClass ??
      "Residential";
    const circleRateSqft = primaryKisam.match(/commercial|byabasaika/i)
      ? 3500
      : primaryKisam.match(/agricultural|agricultur/i)
      ? 250
      : 1500;
    const impliedMarketValue = Math.round(areaAcres * 43560 * circleRateSqft);
    if (impliedMarketValue > 0) {
      stampDutyResult = await stampDutyFetch({
        sro: input.tehsil,
        marketValue: impliedMarketValue,
        deedType: "Sale",
      });
    }
  } catch (err) {
    console.warn("[pipeline/v11] stamp-duty fetch error:", err instanceof Error ? err.message : err);
  }

  // ── Step 2i: IGR Daily Bulletin — district registration velocity signal ──
  // Sprint V5b: 24h cache. Velocity card on Section 5 ("X deeds registered in
  // Khordha in the last 7 days") gives the buyer a market-pulse sense of how
  // active the area is. Returns source_down on any failure — not buyer-visible.
  let igrDailyBulletinResult: Awaited<ReturnType<typeof igrDailyBulletinFetch>> | null = null;
  try {
    igrDailyBulletinResult = await igrDailyBulletinFetch({});
  } catch (err) {
    console.warn(
      "[pipeline/v11] igr-daily-bulletin fetch error:",
      err instanceof Error ? err.message : err
    );
  }

  // ── Step 2j: IGR Public Dashboard — page-alive probe, server-rendered ──────
  // Sprint V5c: the public dashboard is server-rendered ASP.NET WebForms
  // (PublicDashboard.aspx / DeedWiseStatus.aspx / ORServiceNew.aspx) with
  // no public JSON API. The fetcher probes the page shell + returns the
  // verified-live URL. Renderer (Section 6 sub-card) shows the live link.
  // Same data is also captured by igr-daily-bulletin (V5b), which has a
  // real JSON endpoint — see D-046.
  let publicDashboardResult: Awaited<ReturnType<typeof publicDashboardFetch>> | null = null;
  try {
    publicDashboardResult = await publicDashboardFetch({});
  } catch (err) {
    console.warn(
      "[pipeline/v11] public-dashboard fetch error:",
      err instanceof Error ? err.message : err
    );
  }

  // ── Step 2k: Govt Fee Schedule — permanent typed cache ───────────────────
  // Sprint V5c: the GovtFeeDtls.aspx page is server-rendered with no JSON API.
  // The schedule rarely changes (last substantive revision 2019). The fetcher
  // loads a typed JSON seed at module init and matches the requested deed
  // category. No network call. Renderer (Section 6 "Official fees" sub-card)
  // shows the matched fees so the buyer can verify the SRO's quote.
  let govtFeeResult: Awaited<ReturnType<typeof govtFeeFetch>> | null = null;
  try {
    govtFeeResult = await govtFeeFetch({
      deedCategory: "Sale", // primary case for property purchase
    });
  } catch (err) {
    console.warn(
      "[pipeline/v11] govt-fee fetch error:",
      err instanceof Error ? err.message : err
    );
  }

  // ── Step 2l: IGR Certified Copy — Phase 1: index-card only, typed-degrade ──
  // Sprint V5c: the certified-copy form requires login + captcha. Per D-037/D-046,
  // Phase 1 ships with a manual-instructions fallback (D-037 pattern). The
  // fetcher probes the page + returns a typed `not_covered` envelope with the
  // verified-live URL + §57 transparency note. Renderer (Section 2 sub-card)
  // shows the buyer how to look this up themselves. Book 4 is restricted to
  // executant/claimnant per Section 57 of the Registration Act, 1908.
  let igrCertifiedCopyResult: Awaited<ReturnType<typeof igrCertifiedCopyFetch>> | null = null;
  try {
    igrCertifiedCopyResult = await igrCertifiedCopyFetch({});
  } catch (err) {
    console.warn(
      "[pipeline/v11] igr-certified-copy fetch error:",
      err instanceof Error ? err.message : err
    );
  }

  // ── Step 3: A5 OwnershipReasoner ───────────────────────────────────────────
  // Only run ownership comparison if a seller name was provided.
  // When no name is provided, skip comparison and show Bhulekh owners directly.
  let ownershipReasoner: Awaited<ReturnType<typeof reasonOwnership>> | null = null;
  if (bhulekhData?.tenants && bhulekhData.tenants.length > 0 && input.claimedOwnerName?.trim()) {
    try {
      ownershipReasoner = await reasonOwnership({
        claimedOwnerName: input.claimedOwnerName ?? "",
        rorDocument: {
          village: bhulekhData.village ?? input.village,
          khatiyanNo: bhulekhData.khataNo ?? undefined,
          tenants: bhulekhData.tenants.map((t) => ({
            tenantName: t.tenantName ?? "",
            fatherHusbandName: t.fatherHusbandName,
            surveyNo: t.surveyNo ?? "",
            area: t.area,
            landClass: t.landClass,
          })),
        },
      });
    } catch (err) {
      console.error("[pipeline/v11] A5 OwnershipReasoner error:", err);
    }
  }

  // ── Step 3: A6 LandClassifier ───────────────────────────────────────────────
  let landClassifier: Awaited<ReturnType<typeof classifyLand>> | null = null;
  if (bhulekhData?.tenants && bhulekhData.tenants.length > 0) {
    try {
      const plots: LandClassifierInput["plots"] = bhulekhData.tenants.map((t) => ({
        plotNo: t.surveyNo ?? "",
        areaAcres: t.area ?? 0,
        landClassOdia: t.landClassOdia ?? undefined,
        landClassEnglish: t.landClassEnglish ?? t.landClass ?? undefined,
      }));
      // Pull the first BDA zone row (if any) so the land classifier can surface
      // green-belt/institutional mismatches and add BDA-zone context to its explanation.
      const bdaZoneRow = bdaZoningResult?.data?.[0];
      landClassifier = classifyLand({
        plots,
        gpsCoordinates: { lat: 0, lng: 0 },  // V1.1 doesn't use GPS
        village: bhulekhData.village ?? input.village,
        ...(bdaZoneRow?.zone?.id ? { bdaZone: bdaZoneRow.zone.id, bdaTehsil: input.tehsil } : {}),
      });
    } catch (err) {
      console.error("[pipeline/v11] A6 LandClassifier error:", err);
    }
  }

  // ── Step 4: Build merged sources array ───────────────────────────────────────
  // mapToReportInput reads from orchestratorOutput.sources, which only has Bhulekh.
  // Augment it with the financial exposure sources fetched above.
  const sourcesWithFinancial: SourceResult[] = [
    ...orchestratorOutput.sources,
    ...buildSourceResult("ecourts", ecourtsResult),
    ...buildSourceResult("igr-ec", igrEcResult),
    ...buildSourceResult("igr-sro", igrSroResult),
    ...buildSourceResult("cersai", cersaiResult),
    ...buildSourceResult("rccms", rccmsResult),
    ...buildSourceResult("circle-rate", circleRateResult),
    ...buildSourceResult("bda-zoning", bdaZoningResult),
    ...buildSourceResult("igr-bmv", igrBmvResult),
    ...buildSourceResult("stamp-duty", stampDutyResult),
    ...buildSourceResult("igr-daily-bulletin", igrDailyBulletinResult),
    // Sprint V5c — IGR public-data fetchers (Phase 1 typed-degrade for
    // public-dashboard + igr-certified-copy; permanent cache for govt-fee).
    ...buildSourceResult("public-dashboard", publicDashboardResult),
    ...buildSourceResult("govt-fee", govtFeeResult),
    ...buildSourceResult("igr-certified-copy", igrCertifiedCopyResult),
    // T-041 — Bhuvan flood hazard WMS (planning-only license).
    ...buildSourceResult("bhuvan-flood", bhuvanFloodResult),
  ];

  // ── Step 4b: EncumbranceReasoner (A7) ───────────────────────────────────────
  // Combines IGR EC + CERSAI results + tehsil-specific instructions into encumbrance assessment.
  // Uses tehsil-specific instructions from ec-instructions.ts instead of generic A7 output.
  let encumbranceReasonerResult: Awaited<ReturnType<typeof reasonEncumbrance>> | null = null;
  try {
    const ownerName = bhulekhData?.tenants?.[0]?.tenantName ?? "Seller";
    // If the IGR-EC fetcher returned instructions (V1 bug fix), use them; else fall back to hardcoded text
    const fetchedInstructions = igrEcResult?.data?.instructions;
    const instructions = fetchedInstructions
      ? typeof fetchedInstructions === "string" ? fetchedInstructions : JSON.stringify(fetchedInstructions)
      : buildECInstructionsText(
          input.tehsil,
          input.village,
          input.searchMode === "Plot" ? input.identifier : bhulekhData?.tenants?.[0]?.surveyNo ?? bhulekhData?.khataNo ?? "",
          ownerName
        );
    encumbranceReasonerResult = {
      status: (igrEcResult?.status === "success" && cersaiResult?.status === "success") ? "clear" : "manual_required",
      instructions,
      encumbrances: [],
      // Pass through IGR EC and CERSAI entries for the financial exposure section
      igrEcEntries: igrEcResult?.data?.entries ?? [],
      cersaiCharges: cersaiResult?.data?.charges ?? [],
      confidence: (igrEcResult?.status === "success" ? 0.4 : 0) + (cersaiResult?.status === "success" ? 0.4 : 0),
      confidenceBasis: [
        igrEcResult?.status ? `IGR EC: ${igrEcResult.status}` : null,
        cersaiResult?.status ? `CERSAI: ${cersaiResult.status}` : null,
      ].filter(Boolean).join("; ") || "Encumbrance check requires manual EC retrieval",
    };
  } catch (err) {
    console.error("[pipeline/v11] Encumbrance reasoner error:", err);
    encumbranceReasonerResult = reasonEncumbrance({ plotIdentifier: { district: "Khordha", tahasil: input.tehsil, village: input.village, plotNo: input.identifier } });
  }

  // ── Step 5: Build tier2 input ──────────────────────────────────────────────
  const tier2Input: Tier2Input = {
    gps: { lat: 0, lon: 0 },
    claimedOwnerName: input.claimedOwnerName ?? "",
    ownershipReasoner,
    landClassifier,
    encumbranceReasoner: encumbranceReasonerResult ?? null,
    regulatoryScreener: null,
    disclaimerText: DEFAULT_DISCLAIMER,
    // Sprint 4: pass through market-value and BDA zoning data so the report
    // can render Section 7 (What is it worth) and Section 3 (BDA zone) panels.
    circleRateData: circleRateResult ?? null,
    bdaZoneData: bdaZoningResult ?? null,
    // Sprint V5b: pass through IGR public-data so the renderer can render
    // 3 new sub-cards under Section 5 (BMV floor, stamp-duty total, velocity).
    igrBmvData: igrBmvResult ?? null,
    stampDutyData: stampDutyResult ?? null,
    igrDailyBulletinData: igrDailyBulletinResult ?? null,
    // Sprint V5c — IGR public-data fetchers (Section 2 + Section 6 sub-cards).
    publicDashboardData: publicDashboardResult ?? null,
    govtFeeData: govtFeeResult ?? null,
    igrCertifiedCopyData: igrCertifiedCopyResult ?? null,
  };

  const igrLink = {
    url: "https://www.igrodisha.gov.in",
    params: {
      district: "Khordha",
      sro: input.tehsil,
      plotNo: input.searchMode === "Plot" ? input.identifier : undefined,
    },
  };

  // ── Step 6: Map orchestrator → A10 input ───────────────────────────────────
  const reportInput = mapToReportInput(
    {
      reportId,
      sources: sourcesWithFinancial,
      completedAt: orchestratorOutput.completedAt,
      validationFindings: orchestratorOutput.validationFindings ?? [],
      igrLink,
    },
    tier2Input
  );
  reportInput.geoFetch = {
    ...(reportInput.geoFetch ?? {}),
    village: input.village,
    tahasil: input.tehsil,
    district: "Khordha",
    state: "Odisha",
    plotNo: input.searchMode === "Plot"
      ? input.identifier
      : bhulekhData?.tenants?.[0]?.surveyNo ?? reportInput.geoFetch?.plotNo ?? null,
  };

  // ── Step 7: A10 ConsumerReportWriter ───────────────────────────────────────
  // PID synthesis kill switch — inject founder-curated pattern clusters when
  // positive signals appear. Default off until Phase 1 observability data shows
  // positive engagement signals.
  if (PID_SYNTHESIS_ENABLED) {
    // Extract counts from sources
    const ecourtsData = ecourtsResult?.data as { total?: number } | undefined;
    const rccmsData = rccmsResult?.data as { total?: number } | undefined;
    const cersaiData = cersaiResult?.data as { charges?: any[] } | undefined;
    const landClassifier = tier2Input.landClassifier;

    // Phase 3.2: Read corpus cases for similarity search
    let corpusCases: any[] = [];
    try {
      const { readCorpusCases } = await import("./corpus");
      corpusCases = await readCorpusCases();
      console.log(`[pid/corpus] reportId=${reportId} corpus_size=${corpusCases.length}`);
    } catch (err) {
      console.warn(`[pid/corpus] Failed to load corpus: ${err instanceof Error ? err.message : err}`);
    }

    // Phase 4.0: P-NEW-3 embedding-level similarity search
    // Map runtime signals to case shapes, then use findSimilarCases() to find
    // structurally similar corpus cases. The corpus currently has 278 DRT
    // Cuttack cases, so CERSAI / court_dispute triggers match via court_or_forum.
    // Resolution data flows back into the cluster's sourceCaseRefs when available.
    let pidBackedClusters: any[] = [];
    if (corpusCases.length > 0 && process.env.PID_SIMILARITY_ENABLED === "true") {
      try {
        const { findSimilarCases, clusterFromMatches } = await import(
          "../../../../pid/lib/case-shape-similarity.mjs"
        );
        const district = "khordha"; // V1.1 is Khordha-only for now

        // For each triggered signal, build a case shape and run similarity search
        const triggerShapes: Array<{ family: string; clusterName: string; shape: any }> = [];

        // Co-ownership: structural signal — partition / inheritance disputes typically
        // surface in DRT or civil court. Use court_or_forum + district only.
        if ((ownershipReasoner?.coOwners?.length ?? 0) > 0) {
          triggerShapes.push({
            family: "co_ownership",
            clusterName: "Co-ownership consent gap",
            shape: { court_or_forum: "drt cuttack", case_type: "oa", district, case_outcome: "disputed" },
          });
        }

        // CERSAI charge: recovery action at DRT. Match on court_or_forum.
        if ((cersaiData?.charges?.length ?? 0) > 0) {
          triggerShapes.push({
            family: "cersai_charge",
            clusterName: "Active mortgage / charge on title",
            shape: { court_or_forum: "drt cuttack", case_type: "oa", district, case_outcome: "disputed" },
          });
        }

        // Court / revenue-court case: eCourts or RCCMS. Match on court_or_forum.
        if (((ecourtsData?.total ?? 0) + (rccmsData?.total ?? 0)) > 0) {
          triggerShapes.push({
            family: "court_dispute",
            clusterName: "Litigation on owner or plot",
            shape: { court_or_forum: "drt cuttack", case_type: "oa", district },
          });
        }

        // Land conversion: matches on district + court_or_forum.
        if (landClassifier?.conversionRequired === true) {
          triggerShapes.push({
            family: "land_conversion",
            clusterName: "Land-use conversion required",
            shape: { court_or_forum: "drt cuttack", district },
          });
        }

        // Run similarity search for each trigger
        for (const trigger of triggerShapes) {
          const matches = findSimilarCases(corpusCases, trigger.shape, { k: 5, minScore: 0.4 });
          if (matches.length > 0) {
            const synthesized = clusterFromMatches(matches, trigger.clusterName);
            if (synthesized.length > 0) {
              pidBackedClusters.push(...synthesized);
              console.log(
                `[pid/similarity] reportId=${reportId} family=${trigger.family} matches=${matches.length} resolved=${matches.filter((m: any) => m.resolution_summary).length}`
              );
            }
          }
        }
      } catch (err) {
        console.warn(`[pid/similarity] Failed to run similarity search: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Pass runtime signals to cluster builder
    const clusters = buildFounderCuratedClusters({
      coOwners: ownershipReasoner?.coOwners ?? [],
      courtCaseCount: ecourtsData?.total ?? 0,
      rccmsCaseCount: rccmsData?.total ?? 0,
      cersaiChargeCount: cersaiData?.charges?.length ?? 0,
      landConversionRequired: landClassifier?.conversionRequired ?? false,
      currentLandClass: landClassifier?.currentClassification,
    });

    // Phase 4.1: Merge founder-curated clusters with PID-backed similarity clusters
    const allClusters = [...clusters, ...pidBackedClusters];

    // Phase 4.2: Randomize cluster order if A/B flag is on
    if (PID_EXPERIMENT_CLUSTER_ORDER) {
      allClusters.sort(() => Math.random() - 0.5);
    }

    // Final logging — single structured JSON line per report for log aggregation
    if (allClusters.length > 0) {
      const event = {
        event: "pid_synthesis_fired",
        reportId,
        clusterCount: allClusters.length,
        founderCount: clusters.length,
        pidSimCount: pidBackedClusters.length,
        triggers: {
          coOwners: clusters.some(c => c.patternCluster.includes("consent")) ? 1 : 0,
          charges: clusters.some(c => c.patternCluster.includes("mortgage")) ? 1 : 0,
          cases: clusters.some(c => c.patternCluster.includes("Litigation")) ? 1 : 0,
          conversion: clusters.some(c => c.patternCluster.includes("conversion")) ? 1 : 0,
        },
        corpusRefs: allClusters.reduce((sum, c) => sum + (c.sourceCaseRefs?.length ?? 0), 0),
        clusters: allClusters.map(c => c.patternCluster),
      };
      console.log(`[pid/synthesis] ${JSON.stringify(event)}`);
      reportInput.synthesisInsights = allClusters;
    } else {
      console.log(`[pid/synthesis] ${JSON.stringify({ event: "pid_synthesis_no_clusters", reportId })}`);
    }

    if (allClusters.length > 0) {
      console.log(
        `[pid/synthesis] reportId=${reportId} fired_clusters=${allClusters.map((c) => c.patternCluster).join("|")}`
      );
      console.log(`  founder=${clusters.length} pid_sim=${pidBackedClusters.length}`);
      console.log(`  corpus_refs=${allClusters.reduce((sum, c) => sum + (c.sourceCaseRefs?.length ?? 0), 0)}`);
      reportInput.synthesisInsights = allClusters;
    } else {
      console.log(`[pid/synthesis] reportId=${reportId} no_clusters`);
    }
  }

  const { html, title } = generateConsumerReport(reportInput);

  // ── Step 8: A11 OutputAuditor ────────────────────────────────────────────
  try {
    const { auditOrThrow } = await import("@cleardeed/output-auditor");
    auditOrThrow(html, reportId);
  } catch (err) {
    console.error("[pipeline/v11] A11 OutputAuditor blocked report:", err);
    throw err;
  }

  // ── Step 9: Source summaries ─────────────────────────────────────────────────
  const bhulekhSummary =
    bhulekhSrc?.status === "success"
      ? [
          `${bhulekhData?.tenants?.length ?? 0} tenant(s) under Khatiyan #${bhulekhData?.khataNo ?? "—"}`,
          input.village,
        ].filter(Boolean).join("; ")
      : bhulekhSrc?.status ?? "unknown";

  return {
    reportId,
    html,
    title,
    validationFindings: orchestratorOutput.validationFindings ?? [],
    sourceSummary: {
      bhulekh: bhulekhSummary,
      bhunaksha: bhunakshaSummary,
      ecourts: ecourtsResult?.status ?? "not_run",
      igrEc: igrEcResult?.status ?? "not_run",
      cersai: cersaiResult?.status ?? "not_run",
      rccms: rccmsResult?.status ?? "not_run",
      bhuvanFlood: bhuvanFloodResult?.status ?? "not_run",
    },
    // Task 0.1 finding 3 contract — assemble the per-source fire map and
    // expose it on the pipeline output so downstream tasks can read the
    // firing decision without re-running the gate. The V1.1 sources array
    // includes the V1.1 financial-exposure sources (ecourts, igr-ec, etc.)
    // alongside the orchestrator's Bhulekh result.
    fire: buildFireMap(sourcesWithFinancial),
    bhunakshaPolygon,
    bhunakshaPlotReport: bhunakshaPlotReport ?? null,
    plotDiagram: plotDiagram ?? null,
  };
}

/** Convert a fetcher result into a SourceResult[] for mapToReportInput. */
function buildSourceResult(
  source: string,
  result: unknown
): SourceResult[] {
  if (!result || typeof result !== "object") return [];
  const r = result as Record<string, unknown>;
  const status = String(r.status ?? "unknown");
  const fetchedAt = String(r.fetchedAt ?? new Date().toISOString());
  // Return a single-element array with a bare-minimum SourceResult shape
  return [{
    source: source as SourceResult["source"],
    status: status as SourceResult["status"],
    statusReason: String(r.statusReason ?? ""),
    fetchedAt,
    verification: status === "success" ? "verified" : "manual_required",
    ...(r.data ? { data: r.data } : {}),
    ...(r.error ? { error: String(r.error) } : {}),
  } as unknown as SourceResult];
}

/**
 * RCCMS fetcher input shape — re-declared locally so the timeout helper
 * can be exported and unit-tested without dragging the full fetcher type
 * tree into the test's import graph.
 */
type RccmsFetcherInput = Parameters<typeof rccmsFetch>[0];
type RccmsFetcherResult = Awaited<ReturnType<typeof rccmsFetch>>;

/**
 * Race the RCCMS fetcher against a hard timeout. Used by the V1.1 pipeline
 * (Step 2d) so a hung portal probe (D-030) cannot stall the report past
 * its 60s budget. The fetcher argument is passed in (not imported) to make
 * the timeout contract testable in isolation.
 */
export async function rccmsFetchWithTimeout(
  fetcher: (input: RccmsFetcherInput) => Promise<RccmsFetcherResult>,
  input: RccmsFetcherInput,
  timeoutMs: number
): Promise<RccmsFetcherResult> {
  return Promise.race([
    fetcher(input),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("rccms_timeout")), timeoutMs)
    ),
  ]);
}

/**
 * Manual-required stub returned when the RCCMS probe exceeds its budget.
 * Casts to the fetcher's return type to keep the pipeline call site uniform
 * (the downstream `buildSourceResult` only reads a handful of fields).
 */
export function rccmsTimeoutStub(): RccmsFetcherResult {
  return {
    source: "rccms",
    status: "failed",
    statusReason: "rccms_timeout",
    verification: "manual_required",
    fetchedAt: new Date().toISOString(),
    error: "RCCMS portal probe exceeded 5s budget; verify revenue court cases manually at rccms.odisha.gov.in",
  } as unknown as RccmsFetcherResult;
}

function summarizeEcourtsStatus(
  ecourtsSrc: Awaited<ReturnType<typeof runReport>>["sources"][number] | undefined
): string {
  if (!ecourtsSrc) return "unknown";
  const data = ecourtsSrc.data as
    | {
        total?: number;
        searchMetadata?: {
          captchaAcceptedCount?: number;
        };
      }
    | undefined;
  const total = data?.total ?? 0;
  if (total > 0) return `${total} case(s) returned`;
  const captchaAccepted = Number(data?.searchMetadata?.captchaAcceptedCount ?? 0) > 0;
  if (ecourtsSrc.status === "success" && captchaAccepted) return "0 case(s) returned by accepted-captcha search";
  if (ecourtsSrc.status === "success" || ecourtsSrc.status === "partial") {
    return "manual_required (0 returned, not verified)";
  }
  return ecourtsSrc.status;
}

function summarizeCanonicalVillageSource(
  bhulekhSrc: Awaited<ReturnType<typeof runReport>>["sources"][number] | undefined
): string | undefined {
  const canonicalInput = bhulekhSrc?.inputsTried?.find(
    (input) => input.label === "canonical_cadastral_village"
  )?.input as
    | {
        source?: unknown;
        sourceStatus?: unknown;
        statusReason?: unknown;
      }
    | undefined;
  if (!canonicalInput?.source) return undefined;

  const source = String(canonicalInput.source);
  const sourceLabel = source === "bhunaksha" ? "Bhunaksha/WFS" : source;
  const sourceStatus = typeof canonicalInput.sourceStatus === "string" ? canonicalInput.sourceStatus : undefined;
  const statusReason = typeof canonicalInput.statusReason === "string" ? canonicalInput.statusReason : undefined;
  const statusText = [sourceStatus, statusReason].filter(Boolean).join(", ");

  return statusText
    ? `canonical village: ${sourceLabel} (${statusText})`
    : `canonical village: ${sourceLabel}`;
}

function normalizeRccmsSummaryStatus(
  rccmsSrc: Awaited<ReturnType<typeof runReport>>["sources"][number] | undefined
): string {
  if (!rccmsSrc) return "unknown";
  const error = typeof rccmsSrc.error === "string" ? rccmsSrc.error.toLowerCase() : "";
  if (
    rccmsSrc.status === "partial" &&
    (rccmsSrc.verification === "manual_required" ||
      error.includes("placeholder") ||
      error.includes("not implemented"))
  ) {
    return "manual_required";
  }
  return rccmsSrc.status;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Resolve a village GPS coordinate for Bhunaksha WFS querying.
 *
 * Strategy:
 * 1. Try Nominatim village search (works for well-known localities)
 * 2. Fall back to hardcoded tehsil centroid (Nominatim lacks small Odia village data)
 *
 * Bhunaksha WFS uses a bounding-box search around the starting coordinate.
 * A tehsil centroid is a sufficient starting point — the WFS returns all polygons
 * within the bbox, and we filter to the one containing the village from Bhulekh data.
 * The final map polygon is always accurate regardless of the starting coordinate.
 */
async function resolveVillageGps(
  villageName: string,
  tehsilName: string
): Promise<{ lat: number; lon: number; searchRadius?: number } | null> {
  // ── Attempt 1: Nominatim village search ─────────────────────────────────────
  try {
    const query = `${villageName}, ${tehsilName}, Khordha, Odisha, India`;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "ClearDeed/1.0 (property due-diligence; contact@cleardeed.in)",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const results = (await res.json()) as Array<{ lat: string; lon: string }>;
      if (results?.length) {
        const lat = parseFloat(results[0].lat);
        const lon = parseFloat(results[0].lon);
        if (!isNaN(lat) && !isNaN(lon)) {
          console.info(`[resolveVillageGps] Nominatim found: ${lat},${lon} for ${villageName}`);
          return { lat, lon };
        }
      }
    }
  } catch {
    // fall through to tehsil centroid
  }

  // ── Attempt 2: Hardcoded tehsil centroids (Odisha) ─────────────────────────
  // Nominatim lacks small village data for rural Odisha. These centroids are
  // accurate enough to query Bhunaksha WFS — the plot polygon is always correct.
  // We use a large searchRadius (0.05° ≈ 5km) to cover the full tehsil area.
  // Bhunaksha WFS returns all plots within the bbox; we filter to the correct one
  // using Bhulekh's village + plot number, so the polygon is always accurate.
  const TEHSIL_CENTROIDS: Record<string, { lat: number; lon: number }> = {
    bhubaneswar: { lat: 20.2961, lon: 85.8245 },
    jatni:       { lat: 20.1850, lon: 85.7100 },
    banapur:     { lat: 19.7750, lon: 85.1700 },
    balipatna:   { lat: 20.3200, lon: 85.6200 },
    beginia:     { lat: 20.2500, lon: 85.5300 },
    bolgarh:     { lat: 19.8500, lon: 85.0800 },
    khandagiri:  { lat: 20.2500, lon: 85.7800 },
    // Default: centre of Khordha district
    default:     { lat: 20.2500, lon: 85.6500 },
  };

  const key = tehsilName.toLowerCase().replace(/\s+/g, "");
  const centroid = TEHSIL_CENTROIDS[key] ?? TEHSIL_CENTROIDS["default"];
  console.info(`[resolveVillageGps] Nominatim miss for "${villageName}" — using tehsil centroid ${centroid.lat},${centroid.lon} (tehsil: ${tehsilName}); using searchRadius=0.05 (≈5km)`);
  return { ...centroid, searchRadius: 0.05 };
}

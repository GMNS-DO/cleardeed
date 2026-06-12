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
  type Tier2Input,
  type OwnershipReasonerResult,
} from "@cleardeed/consumer-report-writer";
import { bhunakshaFetch } from "@cleardeed/fetcher-bhunaksha";
import { nominatimFetch } from "@cleardeed/fetcher-nominatim";
import { ecourtsFetch } from "@cleardeed/fetcher-ecourts";
import { igrEcFetch } from "@cleardeed/fetcher-igr-ec";
import { cersaiFetch } from "@cleardeed/fetcher-cersai";
import { fetch as rccmsFetch } from "@cleardeed/fetcher-rccms";
import { fetch as circleRateFetch } from "@cleardeed/fetcher-circle-rate";
import { fetch as bdaZoningFetch } from "@cleardeed/fetcher-bda-zoning";
import type { SourceResult } from "@cleardeed/orchestrator";

export type { Tier2Input };

const DEFAULT_DISCLAIMER = `This report is prepared by ClearDeed using publicly available government land records. It is not a legal opinion, not a title certificate, and not a guarantee of ownership or freedom from encumbrance. Before you transact: share this report with a qualified property lawyer, request original title documents from the seller going back at least 30 years, obtain an Encumbrance Certificate from the Sub-Registrar office, verify plot boundaries on the ground with a local survey, confirm land classification permits your intended use, and confirm no conversion of land use is required.`;

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
      sources: orchestratorOutput.sources,
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
  };
  /** Bhunaksha polygon GeoJSON — passed to report for Mapbox rendering */
  bhunakshaPolygon?: {
    type: "Polygon";
    coordinates: number[][][];
  } | null;
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

  try {
    const villageGps = await resolveVillageGps(input.village, input.tehsil);
    if (villageGps) {
      const bhunakshaResult = await bhunakshaFetch({
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

  // ── Step 2a: eCourts — case search by owner name ───────────────────────────
  const ownerNames = bhulekhData?.tenants?.map((t) => t.tenantName).filter(Boolean) ?? [];
  let ecourtsResult: Awaited<ReturnType<typeof ecourtsFetch>> | null = null;
  if (ownerNames.length > 0) {
    try {
      ecourtsResult = await ecourtsFetch({
        partyName: ownerNames[0] ?? "Unknown",
        districtName: "Khordha",
        districtCode: "561",
        tryNameVariants: true,
      });
    } catch (err) {
      console.warn("[pipeline/v11] eCourts fetch error:", err instanceof Error ? err.message : err);
    }
  }

  // ── Step 2b: IGR EC — Encumbrance Certificate search ───────────────────────
  // Resolve SRO from tehsil name, then search by plot number and owner name.
  let igrEcResult: Awaited<ReturnType<typeof igrEcFetch>> | null = null;
  try {
    const plotIdentifier = input.searchMode === "Plot" ? input.identifier : bhulekhData?.tenants?.[0]?.surveyNo ?? "";
    igrEcResult = await igrEcFetch({
      partyName: ownerNames[0] ?? "",
      district: "Khordha",
      sro: input.tehsil,
      fromYear: new Date().getFullYear() - 5,
      toYear: new Date().getFullYear(),
    });
  } catch (err) {
    console.warn("[pipeline/v11] IGR EC fetch error:", err instanceof Error ? err.message : err);
  }

  // ── Step 2c: CERSAI — mortgage / charge search by owner name ───────────────
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

  // ── Step 2d: RCCMS — revenue court case search ─────────────────────────────
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
    ...buildSourceResult("cersai", cersaiResult),
    ...buildSourceResult("rccms", rccmsResult),
    ...buildSourceResult("circle-rate", circleRateResult),
    ...buildSourceResult("bda-zoning", bdaZoningResult),
  ];

  // ── Step 4b: EncumbranceReasoner (A7) ───────────────────────────────────────
  // Combines IGR EC + CERSAI results + tehsil-specific instructions into encumbrance assessment.
  // Uses tehsil-specific instructions from ec-instructions.ts instead of generic A7 output.
  let encumbranceReasonerResult: Awaited<ReturnType<typeof reasonEncumbrance>> | null = null;
  try {
    const ownerName = bhulekhData?.tenants?.[0]?.tenantName ?? "Seller";
    const instructions = buildECInstructionsText(
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
    },
    bhunakshaPolygon,
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

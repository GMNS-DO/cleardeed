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
import { screenRegulations, type RegulatoryScreenerResult } from "@cleardeed/regulatory-screener";
import { classifyLand, type LandClassifierInput } from "@cleardeed/land-classifier";
import {
  generateConsumerReport,
  mapToReportInput,
  type Tier2Input,
  type OwnershipReasonerResult,
} from "@cleardeed/consumer-report-writer";
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
        landClassOdia: t.landClass ?? undefined,
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
  let encumbranceReasoner: EncumbranceResult | null = null;

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
    "igr-ec": igrEcSrc?.status ?? "unknown",
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

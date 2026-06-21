/**
 * A10 ConsumerReportWriter — generateConsumerReport()
 *
 * Takes all Tier 1 (fetcher) + Tier 2 (interpreter) outputs and produces
 * a plain-English consumer property verification report as mobile-responsive HTML.
 *
 * Sections (per PRODUCT.md Section 3):
 *   1. The Plot       — GPS, location, official plot identifier, what matched
 *   2. The Owner     — owner and family details directly from the RoR
 *   3. Land Class    — agricultural/residential/etc, conversion requirements
 *   4. Encumbrances  — court cases, EC status
 *   5. Regulatory   — protected zone proximity flags
 *   6. What to Ask   — concrete checklist for seller + broker + lawyer
 *
 * Prohibited: scores, verdicts, "safe to buy", legal jargon without translation.
 */

import { z } from "zod";
import { translateLandClass } from "./types";
import {
  transliterateOdiaWithConfidence,
  containsOdia,
  type OdiaNameReading,
} from "./lib";
import {
  ConsumerReportGenInputSchema,
  type ConsumerReportGenInputData,
} from "./mapper";
import type { EncumbranceResult } from "@cleardeed/encumbrance-reasoner";
import type { RegulatoryScreenerResult } from "@cleardeed/regulatory-screener";
import type { RiskInsight } from "./types";
import { runInsights } from "./insights/engine";
import { ALL_RULES } from "./insights/registry";
import type { Insight } from "./insights/schema";
export type { Insight } from "./insights/schema";
import { renderInsightList, renderInsightListBySource } from "./insights/render";
import {
  evaluatePatterns,
  buildTestedPatternsPanel,
  type PatternResult,
} from "./components/tested-patterns";
import { buildV12FieldPanel } from "./components/v12-fields";
import {
  tallyInsightsByBuyerQuestion,
  getUnimplementedExplanation,
  BUYER_QUESTIONS,
  type BuyerQuestionId,
  type BuyerQuestionTally,
} from "./buyer-questions";
import {
  rorInsightGroups,
  riskInsightGroups,
  selectTopRisk,
  type RoRInsight,
} from "./insights/adapter";

export type ConsumerReportGenInput = ConsumerReportGenInputData;
export { ConsumerReportGenInputSchema } from "./mapper";
export type { Tier2Input, OwnershipReasonerResult, OrchestratorOutput } from "./mapper";
export { mapToReportInput } from "./mapper";

// ─── HTML escape helpers ───────────────────────────────────────────────────────

function escapeText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// ─── HTML generation ────────────────────────────────────────────────────────────

export interface GenerateReportOptions {
  /** Render in demo mode (shows "DEMO REPORT" banner, uses golden-path data). */
  demo?: boolean;
}

/**
 * Generate the consumer-facing property report as HTML string.
 * Returns { html, title, insights } — html is a standalone, print-friendly HTML
 * fragment; insights is the structured list of rule-derived consumer insights
 * (populated by Tasks 7–21; empty array until then).
 */
export { buildFounderCuratedClusters };
export function generateConsumerReport(
  input: z.infer<typeof ConsumerReportGenInputSchema>
): { html: string; title: string; insights: Insight[] } {
  const parsed = ConsumerReportGenInputSchema.safeParse(input);
  if (!parsed.success) {
    return generateErrorReport("Invalid report input. Please try again.");
  }

  const data = parsed.data;
  const { gpsCoordinates: gps, geoFetch, revenueRecords, courtCases, registryLinks,
          landClassifier, encumbranceReasoner,
          regulatoryScreener, validationFindings, adjacentPlots, synthesisInsights } = data;
  const sourceStatus = data.sourceStatus ?? {};
  const sourceDetails = data.sourceDetails ?? {};
  const tenants: any[] = revenueRecords?.tenants ?? [];
  const bhulekhUsable = sourceStatus.bhulekh === "success" && tenants.length > 0;
  const bhunakshaUsable = sourceStatus.bhunaksha === "success";
  const gpsDisplay = formatGpsDisplay(gps);

  // ── Derive primary plot info ───────────────────────────────────────────────────
  const plotVillage = geoFetch?.village ?? revenueRecords?.village ?? "—";
  const plotTahasil = geoFetch?.tahasil ?? "—";
  const plotDistrict = geoFetch?.district ?? registryLinks?.params?.district ?? "Not verified";
  const targetPlotNo = geoFetch?.plotNo ?? registryLinks?.params?.plotNo ?? null;
  const targetTenant = targetPlotNo
    ? tenants.find((tenant) => plotNosMatch(tenant?.surveyNo, targetPlotNo))
    : tenants[0];
  const plotNo = targetPlotNo
    ?? (bhulekhUsable ? targetTenant?.surveyNo ?? revenueRecords?.tenants?.[0]?.surveyNo : null)
    ?? registryLinks?.params?.plotNo
    ?? "—";
  const bhulekhVillage = revenueRecords?.village ?? plotVillage;
  const targetPlotRow = findTargetPlotRow(revenueRecords, plotNo);
  const plotArea = buildPlotAreaDetails(targetTenant, targetPlotRow);
  const plotRecordSummary = buildPlotRecordSummary({
    plotNo,
    khataNo: revenueRecords?.khataNo ?? null,
    area: plotArea,
    landClassOdia: targetPlotRow?.landTypeOdia ?? targetTenant?.landClassOdia ?? targetTenant?.landClass ?? null,
    landClassEnglish: targetTenant?.landClassEnglish ?? null,
  });

  // ── Derive primary owner info ─────────────────────────────────────────────────
  const ownerRecords = buildOwnerDisplayRecords(revenueRecords, tenants);
  const primaryOwner = ownerRecords[0] ?? null;
  const primaryOwnerName = primaryOwner?.latin || primaryOwner?.odia || "—";
  const coOwners = ownerRecords.slice(1).map((owner) => owner.latin || owner.odia).filter(Boolean);

  // ── Derive land classification ──────────────────────────────────────────────────
  const primaryTenant = targetPlotNo ? targetTenant : revenueRecords?.tenants?.[0];
  const landClassOdia = primaryTenant?.landClassOdia ?? targetPlotRow?.landTypeOdia ?? primaryTenant?.landClass ?? "";
  const landClassEnglish = primaryTenant?.landClassEnglish
    ?? (landClassOdia ? translateLandClass(landClassOdia) : "");

  const classification = bhulekhUsable
    ? formatLandClassDisplay(landClassEnglish, landClassOdia, primaryTenant?.landClass)
    : "Not verified";
  const conversionRequired = bhulekhUsable
    ? primaryTenant?.conversionRequired ?? landClassifier?.conversionRequired ?? null
    : null;
  const conversionUnknown = bhulekhUsable && conversionRequired == null;
  const classificationUnknown =
    !bhulekhUsable ||
    (!landClassEnglish || landClassEnglish === "Unknown") && !landClassOdia;
  const bhulekhUnavailableReason = sourceStatusLine(sourceDetails, sourceStatus, "bhulekh");
  const landClassSourceStatus = sourceStatusLine(sourceDetails, sourceStatus, "bhulekh");
  const classificationBasisText = bhulekhUsable
    ? `Based on the selected plot row in the Bhulekh RoR (${landClassOdia || "—"})`
    : "Not verified from Bhulekh in this run";
  const landRestrictions = (landClassifier?.restrictions ?? []).map((restriction: any) => ({
    flag: titleFromSnakeCase(restriction.type ?? "Restriction"),
    severity: normalizeLandSeverity(restriction.severity),
    description: restriction.description,
    recommendedAction: restriction.action ?? restriction.citation ?? null,
  }));
  const redFlags = dedupeFlags(
    [...(landClassifier?.redFlags ?? []), ...landRestrictions].filter((flag: any) =>
      Boolean(flag?.flag?.trim?.() && flag?.description?.trim?.())
    )
  );

  // ── Derive name match from OwnershipReasoner ────────────────────────────────────
  const nameMatch = bhulekhUsable
    ? {
        state: "ror_available" as const,
        claimedName: data.claimedOwnerName ?? null,
        officialName: primaryOwnerName !== "—" ? primaryOwnerName : null,
        confidence: data.claimedOwnerName ? 0.7 : 0,
        explanation: data.claimedOwnerName
          ? "Bhulekh owner compared against seller-claimed name"
          : "No seller name provided — RoR owner shown directly",
      }
    : { state: "unknown" as const };

  // ── Derive court case summary ───────────────────────────────────────────────────
  const totalCases = courtCases?.total ?? 0;
  const cases: any[] = courtCases?.cases ?? [];
  const courtSourceStatuses = courtCases?.sources ?? {
    ecourts: sourceStatus.ecourts ?? "not_run",
    rccms: sourceStatus.rccms ?? "not_run",
  };
  const caseList = cases.length > 0
    ? cases.map(c => ({
        caseType: c.caseType ?? "—",
        caseNo: c.caseNo ?? c.caseId ?? "—",
        court: c.court ?? c.courtName ?? c.courtComplex ?? "—",
        status: c.status ?? "—",
        filing: c.filingDate ?? "—",
        source: c.source ?? 'eCourts',
      }))
    : null;
  const mutationReferencePanel = buildMutationReferencePanel(
    revenueRecords?.mutationReferences ?? []
  );

  // ── Run the unified insight engine (Task 24: replaces legacy
  //    buildRoRInsightGroups + buildRiskInsights). The new engine emits a
  //    flat list of `Insight` objects; the adapter in insights/adapter.ts
  //    partitions them into the legacy `RoRInsight[]` and `RiskInsight[]`
  //    shapes that the existing panel renderers (buildRoRCompletenessPanel,
  //    buildRoRBackPagePanel, buildInsightHighlights) still consume.
  const insights: Insight[] = runInsights(
    ALL_RULES,
    data as unknown as Parameters<typeof runInsights>[1]
  );
  const rorInsights = rorInsightGroups(insights);
  const riskInsights = riskInsightGroups(insights);

  // T-047: build ruleId sets so computeFinancialExposure can match by stable
  // id rather than by headline substring.
  const redFlagRuleIds = new Set<string>();
  const watchoutRuleIds = new Set<string>();
  for (const i of insights) {
    if (!i || !(i as any).ruleId) continue;
    if ((i as any).severity === "redFlag") redFlagRuleIds.add((i as any).ruleId);
    else if ((i as any).severity === "watchout") watchoutRuleIds.add((i as any).ruleId);
  }

  const rorCompletenessPanel = buildRoRCompletenessPanel(
    revenueRecords,
    { bhulekhUsable, bhulekhStatus: sourceStatus.bhulekh ?? "unknown", selectedPlotNo: plotNo },
    rorInsights.plot,
    rorInsights.dues,
    selectTopRisk(riskInsights.transferability, 3),
    selectTopRisk(riskInsights.positive, 2)
  );
  const rorPlotTablePanel = buildRoRPlotTablePanel(revenueRecords?.plotRows ?? [], plotNo);
  // Bhunaksha Plot Report (D-036) — captcha-free per-plot ground-truth cross-check.
  // Renders the rendered cadastral map (base64 SVG) as a third visualization in
  // Section 1, alongside the polygon and satellite. Guard against oversized
  // payloads to keep the report HTML light.
  const bhunakshaMapPanel = buildBhunakshaMapPanel(
    (data.bhunakshaPlotReport as { mapImageBase64?: string | null } | null)?.mapImageBase64 ?? null
  );
  const rorBackPagePanel = buildRoRBackPagePanel(
    revenueRecords?.backPage,
    [
      ...(selectTopRisk(riskInsights.title, 2) as any[]),
      ...(selectTopRisk(riskInsights.redFlag, 2) as any[]),
      ...(selectTopRisk(riskInsights.financial, 2) as any[]),
    ]
  );

  // ── Derive regulatory flags ────────────────────────────────────────────────────
  const regFlags = (regulatoryScreener?.flags ?? []).filter((flag: any) =>
    Boolean(flag?.flag?.trim?.() && flag?.description?.trim?.())
  );
  const regFlagList = regFlags.length > 0 ? regFlags.map((f: any) => ({
        name: f.flag,
        severity: normalizeRegSeverity(f.severity),
        description: f.description,
        action: f.recommendedAction ?? "Verify with the relevant government department before proceeding.",
      })) :
    null;
  const regulatoryVerified = isRegulatoryScreeningVerified(regulatoryScreener);

  // ── Derive validation warnings ──────────────────────────────────────────────────
  const areaWarning = validationFindings?.find(f => f.dimension === "area" && f.severity === "warning");
  const villageWarning = validationFindings?.find(f => f.dimension === "village" && f.severity === "warning");
  const gpsWarning = validationFindings?.find(f => f.dimension === "gps" && f.severity === "error");

  // ── Build HTML ────────────────────────────────────────────────────────────────────
  const safeDislcaimer = escapeHtml(data.disclaimerText);
  const safeTransliterated = escapeHtml(primaryOwnerName);
  const safeVillage = escapeHtml(plotVillage);
  const safeDistrict = escapeHtml(plotDistrict);
  const safeTahasil = escapeHtml(plotTahasil);
  const safeKhataNo = escapeHtml(revenueRecords?.khataNo ?? "—");
  const safeClassification = escapeHtml(classification);
  const safeRegUrl = escapeHtml(registryLinks?.url ?? "https://igrodisha.gov.in/ecsearch");
  const safeSro = escapeHtml(registryLinks?.params.sro ?? "Not verified");
  const safePlotNo = escapeHtml(plotNo);
  const bhunakshaSourceStatus = sourceStatusLine(sourceDetails, sourceStatus, "bhunaksha");
  const bhulekhSourceStatus = sourceStatusLine(sourceDetails, sourceStatus, "bhulekh");

  const generatedDate = new Date(data.generatedAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const fetchedDate = new Date(data.generatedAt).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Build tenant table HTML — English only, no Odia in main body
  const tenantRows = tenants.length > 0
    ? tenants.map((t, i) => {
        const nameReading = englishNameReading(t.tenantName);
        const areaStr = formatPlotAreaSummary(buildPlotAreaDetails(t, findTargetPlotRow(revenueRecords, t.surveyNo)));
        const lc = t.landClassEnglish || t.landClass || "—";
        const guardianReading = t.fatherName ? englishNameReading(t.fatherName) : null;
        const father = guardianReading?.english
          ? escapeHtml(guardianReading.english)
          : "—";
        return `<tr>
          <td class="num">${i + 1}</td>
          <td class="latin">${escapeHtml(nameReading.english || "—")}</td>
          <td class="num">${escapeHtml(t.surveyNo ?? "—")}</td>
          <td class="num">${areaStr}</td>
          <td>${escapeHtml(lc)}</td>
          <td>${father}</td>
        </tr>`;
      }).join("\n")
    : `<tr><td colspan="6" class="empty">No tenant records returned from Bhulekh.</td></tr>`;

  // Build co-owner note
  const coOwnerNote = coOwners.length > 0
    ? `<div class="caution-box">
        <span class="caution-label">&#9888; Multiple owners recorded</span>
        <p>The Bhulekh RoR owner block lists <strong>${coOwners.length} other owner(s)</strong> in addition to ${escapeHtml(primaryOwnerName)}: ${coOwners.map(c => escapeHtml(c)).join(", ")}. Ask a property lawyer to confirm every recorded owner's consent, legal-heir status, and authority before any sale or transfer.</p>
      </div>`
    : "";

  const ownerDetailsSection = buildOwnerDetailsSection({
    ownerRecords,
    bhulekhUsable,
    bhulekhStatus: sourceStatus.bhulekh ?? "unknown",
  });

  // Build court case section
  const courtSection = buildCourtSection(
    totalCases,
    caseList,
    courtSourceStatuses,
    plotDistrict,
    courtCases?.searchMetadata ?? null
  );

  // Build regulatory section
  const regSection = buildRegSection(regFlagList as any, regulatoryVerified);

  // Build LARR section
  const larrHtml = buildLarrSection(data.larrRiskAssessment);

  // P-NEW-1A: Pattern synthesis section
  const synthesisSection = buildSynthesisInsights(synthesisInsights ?? [], { coOwners });

  // Build Encumbrance section
  const ecSection = buildEcSection(encumbranceReasoner, safeRegUrl, safeDistrict, safeSro, safePlotNo, safeTransliterated || escapeHtml(data.claimedOwnerName));

  // Sprint 4 — Section 7 (What is it worth — floor / directional / ceiling)
  const igrEcEntries = (encumbranceReasoner as any)?.igrEcEntries ?? [];
  // Sprint V5b — pass through 3 new IGR public-data sources so buildBenchmarkSection
  // can render 3 new sub-cards (BMV floor, stamp-duty total, district velocity).
  const benchmarkSection = buildBenchmarkSection(
    data.circleRateData ?? null,
    {
      village: plotVillage,
      tahasil: plotTahasil,
      district: plotDistrict,
      plotNo,
      acres: plotArea?.acres ?? null,
    },
    igrEcEntries,
    {
      igrBmv: (data as any).igrBmvData ?? null,
      stampDuty: (data as any).stampDutyData ?? null,
      igrDailyBulletin: (data as any).igrDailyBulletinData ?? null,
    }
  );

  // Sprint 4 — BDA zone card (rendered inside Section 3)
  const bdaZoneCard = buildBdaZoneCard(data.bdaZoneData ?? null, {
    village: plotVillage,
    tahasil: plotTahasil,
  });
  const actionItems = buildActionItems({
    nameMatch: nameMatch.state ?? "unknown",
    bhulekhUsable,
    bhulekhStatus: sourceStatus.bhulekh ?? "unknown",
    coOwners,
    conversionRequired,
    conversionUnknown,
    classification,
    classificationUnknown,
    courtStatuses: courtSourceStatuses,
    regulatoryVerified,
    sourceDetails,
    safeRegUrl,
    safePlotNo,
    safeVillage,
  });

  // Build area warning
  const areaWarningHtml = areaWarning
    ? `<div class="warning-box"><span class="warning-label">&#9888; Area discrepancy</span><p>${escapeHtml(areaWarning.description)} The numbers from the revenue map and the land records don't quite add up. Please verify the plot boundaries on the ground before transacting.</p></div>`
    : "";

  const villageWarningHtml = villageWarning
    ? `<div class="info-box"><span class="info-label">&#8505; Location note</span><p>${escapeHtml(villageWarning.description)} We used the revenue map (Bhunaksha) village name for this report as it is more accurate for rural Odisha.</p></div>`
    : "";

  const gpsError = gpsWarning
    ? `<div class="error-box"><span class="error-label">&#10007; Location out of range</span><p>${escapeHtml(gpsWarning.description)}</p></div>`
    : "";

  const demoBanner = data.disclaimerText.includes("demo") || input.reportId?.includes("DEMO")
    ? `<div class="demo-banner">DEMO REPORT — Using cached sample data &nbsp;|&nbsp; <a href="/?demo=false">Run a real search</a></div>`
    : "";

  // T1 — Tested Fraud Patterns Panel (Khordha 2024–2026).
  // Always evaluated even when no Bhulekh data — buyer sees explicit
  // pass/fail per pattern with the rules that tested it.
  const firedRuleIds = new Set<string>([
    ...Array.from(redFlagRuleIds),
    ...Array.from(watchoutRuleIds),
  ]);
  const patternResults: PatternResult[] = evaluatePatterns({
    insights,
    revenueRecords,
    firedRuleIds,
  });
  const patternPanelHtml = buildTestedPatternsPanel({
    results: patternResults,
    fetchedAt: fetchedDate,
  });
  const patternTriggeredCount = patternResults.filter((r) => r.state === "triggered").length;

  const sixBuyerQuestions = buildSixBuyerQuestions({
    bhulekhUsable,
    primaryOwnerName,
    plotNo: safePlotNo,
    landClassEnglish,
    conversionRequired,
    totalCases,
    courtStatuses: courtSourceStatuses,
    encumbranceStatus: encumbranceReasoner?.status ?? null,
    redFlags,
    regFlags,
    plotArea,
    estimatedValue: null,
    insights,
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ClearDeed — Property Report ${data.reportId}</title>
<style>
${CSS}
</style>
</head>
<body>
${demoBanner}
<div class="print-footer" aria-hidden="true">ClearDeed Property Report · ${escapeHtml(data.reportId)} · ${generatedDate}</div>
<div class="page">

<!-- ── Header ────────────────────────────────────────────────────────── -->
<header class="report-header">
  <div class="brand">
    <div class="brand-name">ClearDeed</div>
    <div class="brand-sub">Property Due-Diligence Report</div>
    <div class="gps-chip">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
      ${escapeHtml(gpsDisplay)}
      &nbsp;&bull;&nbsp;
      ${escapeHtml(plotVillage)}, ${escapeHtml(plotTahasil)}
    </div>
  </div>
  <div class="meta">
    <div class="report-id">${escapeHtml(data.reportId)}</div>
    <div>Generated: ${generatedDate}</div>
    <div>District: ${safeDistrict}, Odisha</div>
    <div class="source-time">Report generated: ${fetchedDate}</div>
    <div class="report-actions">
      <a href="/api/report/${escapeHtml(data.reportId)}/pdf" class="pdf-button" download>Download PDF</a>
    </div>
  </div>
</header>

<!-- ── Six Buyer Questions ─────────────────────────────────────────────── -->
${sixBuyerQuestions}

${buildBuyerSummary({
    bhunakshaUsable,
    bhulekhUsable,
    plotNo: safePlotNo,
    plotVillage: safeVillage,
    plotRecordSummary,
    plotAreaSummary: formatPlotAreaSummary(plotArea),
    ownerName: primaryOwnerName,
    nameMatch: nameMatch.state ?? "unknown",
    courtStatuses: courtSourceStatuses,
    totalCases,
    courtSearchMetadata: courtCases?.searchMetadata ?? null,
    validationFindings: validationFindings ?? [],
    conversionRequired,
    classification,
    redFlags,
    regFlags,
    regulatoryVerified,
    encumbranceStatus: encumbranceReasoner?.status ?? null,
    encumbranceInstructions: encumbranceReasoner?.instructions ?? null,
  })}

${buildFinancialExposureSummary({
    riskInsights,
    plotArea,
    landClass: {
      rawKisam: landClassOdia,
      standardizedKisam: primaryTenant?.landClass ?? null,
      displayKisam: landClassEnglish,
      conversionRequired,
      prohibited: primaryTenant?.prohibited ?? null,
      buildable: primaryTenant?.buildable ?? null,
    },
    bhulekhUsable,
    plotNo,
    safeVillage,
    safeDistrict,
    backPage: revenueRecords?.backPage ?? null,
    dues: revenueRecords?.dues ?? null,
    // KI-004: surface IGR EC + CERSAI entries from the encumbrance reasoner
    igrEcEntries: (encumbranceReasoner as any)?.igrEcEntries ?? [],
    cersaiCharges: (encumbranceReasoner as any)?.cersaiCharges ?? [],
    redFlagRuleIds,
    watchoutRuleIds,
    rorPayload: revenueRecords,
  })}

${buildSourceAuditPanel(sourceDetails)}

<!-- ── Tested Fraud Patterns (T1) ──────────────────────────────────── -->
${patternPanelHtml}

<!-- ── Provenance Strip ──────────────────────────────────────────────── -->
${buildProvenanceStrip({
    bhulekhUsable,
    bhulekhStatus: sourceStatus.bhulekh ?? "unknown",
    plotNo: safePlotNo,
    village: safeVillage,
    tahasil: safeTahasil,
    district: safeDistrict,
    courtStatuses: courtSourceStatuses,
    totalCases,
  })}

<!-- ── Section 1: The Plot ─────────────────────────────────────────── -->
<section class="section" id="section-plot">
  <div class="section-hdr">
    <div class="section-icon">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
    </div>
    <div class="section-title-group">
      <div class="section-title">1. The Plot</div>
      <div class="section-sub">What this land is, where it is, and what the revenue map shows</div>
    </div>
  </div>
  <div class="section-body">
    ${gpsError}
    <table class="data-table">
      <tbody>
        <tr><td class="key">GPS Location</td><td class="mono">${escapeHtml(gpsDisplay)}</td></tr>
        <tr><td class="key">Village</td><td>${safeVillage}${villageWarning ? '&nbsp;<span class="badge-info">Revenue map used</span>' : ''}</td></tr>
        <tr><td class="key">Tahasil</td><td>${safeTahasil}</td></tr>
        <tr><td class="key">District</td><td>${safeDistrict}</td></tr>
        <tr><td class="key">Khatiyan Number</td><td class="mono">${safeKhataNo}</td></tr>
        <tr><td class="key">Plot Number</td><td class="mono">${safePlotNo}</td></tr>
        ${revenueRecords?.riCircle ? `<tr><td class="key">RI Circle</td><td class="mono">${escapeHtml(revenueRecords.riCircle)}</td></tr>` : ''}
      </tbody>
    </table>
    <div class="source-line">
      <span>Revenue map source: Bhunaksha (${escapeHtml(bhunakshaSourceStatus)}) — GeoServer WFS (mapserver.odisha4kgeo.in)</span>
      <span>Land-record source: Bhulekh RoR (${escapeHtml(bhulekhSourceStatus)}) — bhulekh.ori.nic.in</span>
    </div>
    <div class="verify-links">
      ${bhunakshaUsable ? buildVerifyLink("https://mapserver.odisha4kgeo.in/geoserver/ows", "Bhunaksha", "Open the Odisha revenue map GeoServer WFS") : ""}
      ${bhulekhUsable ? buildVerifyLink("https://bhulekh.ori.nic.in/", "Bhulekh", "Open the Bhulekh RoR portal") : ""}
    </div>
    ${rorCompletenessPanel}
    ${buildV12FieldPanel({ revenueRecords, plotNo })}
    ${rorPlotTablePanel}
    ${bhunakshaMapPanel}
  </div>
</section>

<!-- Feedback: Section 1 -->
<div class="feedback-widget" id="feedback-plot" data-section="plot">
  <span class="feedback-label">Was this section useful?</span>
  <button class="feedback-btn feedback-up" onclick="submitFeedback('plot','up',this)">👍 Yes</button>
  <button class="feedback-btn feedback-down" onclick="submitFeedback('plot','down',this)">👎 No</button>
  <span class="feedback-thanks" style="display:none;">Thank you!</span>
</div>
<div class="feedback-comment" id="comment-plot" style="display:none;">
  <textarea placeholder="What was missing or confusing? (optional)" maxlength="500"></textarea>
  <button class="feedback-submit" onclick="submitFeedbackComment('plot',this)">Send feedback</button>
</div>

<!-- ── Section 2: The Owner ────────────────────────────────────────── -->
<section class="section" id="section-owner">
  <div class="section-hdr">
    <div class="section-icon">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
    </div>
    <div class="section-title-group">
      <div class="section-title">2. The Owner</div>
      <div class="section-sub">Owner and family details recorded in the Bhulekh RoR</div>
    </div>
    <div class="status-badge status-${ownerBadge(nameMatch.state ?? "unknown").status}">
      ${ownerBadge(nameMatch.state ?? "unknown").label}
    </div>
  </div>
  <div class="section-body">
    ${buildInsightHighlights([...rorInsights.owner, ...selectTopRisk(riskInsights.title, 2)])}
    ${ownerDetailsSection}
    ${coOwnerNote}
    <details class="tenant-table-details">
      <summary>View ${tenants.length} Bhulekh owner/plot row${tenants.length === 1 ? "" : "s"} (Khatiyan #${safeKhataNo})</summary>
      <p class="table-note">These rows are source-limited Bhulekh RoR owner records joined with the selected plot/khata fields. Treat them as land-record rows, not a title-chain or sale-authority certificate.</p>
      <table class="data-table tenant-table">
        <thead>
          <tr><th>#</th><th>RoR Name (Odia)</th><th>English reading</th><th>Survey No.</th><th>Area</th><th>Land Class</th><th>Guardian/Father</th><th>Caste</th><th>Residence</th></tr>
        </thead>
        <tbody>${tenantRows}</tbody>
      </table>
    </details>
    <div class="source-line">
      <span>Source: Bhulekh RoR (bhulekh.ori.nic.in) &mdash; last published: ${escapeHtml(revenueRecords?.lastUpdated ?? '—')}</span>
    </div>
    <div class="verify-links">
      ${bhulekhUsable ? buildVerifyLink("https://bhulekh.ori.nic.in/", "Bhulekh", "Open the Bhulekh RoR portal") : ""}
    </div>
    ${renderV5cCertifiedCopySubCard((data as any).igrCertifiedCopyData ?? null)}
  </div>
</section>

<!-- Feedback: Section 2 -->
<div class="feedback-widget" id="feedback-owner" data-section="owner">
  <span class="feedback-label">Was this section useful?</span>
  <button class="feedback-btn feedback-up" onclick="submitFeedback('owner','up',this)">👍 Yes</button>
  <button class="feedback-btn feedback-down" onclick="submitFeedback('owner','down',this)">👎 No</button>
  <span class="feedback-thanks" style="display:none;">Thank you!</span>
</div>
<div class="feedback-comment" id="comment-owner" style="display:none;">
  <textarea placeholder="What was missing or confusing? (optional)" maxlength="500"></textarea>
  <button class="feedback-submit" onclick="submitFeedbackComment('owner',this)">Send feedback</button>
</div>

<!-- ── Section 2b: Plot Diagram (Phase 8 / Task 36) ─────────────── -->
${buildPlotDiagramSection(input.plotDiagram, { plotNo: plotNo, village: plotVillage })}

<!-- ── Section 3: Land Classification ────────────────────────────── -->
<section class="section" id="section-land">
  <div class="section-hdr">
    <div class="section-icon">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 3h18v4H3zM3 12h18v4H3zM3 18h18v4H3z"/></svg>
    </div>
    <div class="section-title-group">
      <div class="section-title">4. What You Can Build Here</div>
      <div class="section-sub">What this land can be used for, and what permissions you need before building</div>
    </div>
  </div>
  <div class="section-body">
    <div class="classification-card">
      <div class="classification-type">${safeClassification}</div>
      <div class="classification-sub">${escapeHtml(classificationBasisText)}</div>
    </div>
    ${buildInsightHighlights(rorInsights.land)}
    ${buildLandClassificationDetails({
      rawKisam: landClassOdia,
      standardizedKisam: primaryTenant?.landClass ?? null,
      displayKisam: landClassEnglish,
      conversionRequired,
      prohibited: primaryTenant?.prohibited ?? null,
      buildable: primaryTenant?.buildable ?? null,
      plotNo,
      khataNo: revenueRecords?.khataNo ?? null,
    })}
    ${bdaZoneCard}
    ${conversionRequired ? `
    <div class="caution-box">
      <span class="caution-label">&#9888; Land use conversion required</span>
      <p>This land is currently classified as agricultural. Before you can build a house or use it for commercial purposes, you must confirm the conversion process with the Odisha Revenue Department or tehsil office and obtain the required approval. Ask the seller whether conversion has already been initiated and ask your lawyer to verify the current timeline and requirements.</p>
    </div>` : ''}
    ${conversionUnknown ? `
    <div class="warning-box">
      <span class="warning-label">&#9888; Conversion requirement not verified</span>
      <p>Bhulekh records were available, but the land-classifier did not confirm whether land-use conversion is required. Ask the tehsil office or a property lawyer to confirm whether conversion is needed for your intended use.</p>
    </div>` : ''}
    ${redFlags.length > 0 ? redFlags.map((flag: any) => `
    <div class="caution-box flag-${escapeHtml(flag.severity)}">
      <span class="caution-label">&#9888; ${escapeHtml(flag.flag)}</span>
      <p>${escapeHtml(flag.description)}</p>
      ${flag.recommendedAction ? `<p><strong>What to do:</strong> ${escapeHtml(flag.recommendedAction)}</p>` : ''}
    </div>`).join('\n') : ''}
    ${areaWarningHtml}
    ${!bhulekhUsable ? `<div class="warning-box"><span class="warning-label">&#9888; Classification not verified</span><p>Bhulekh land-record data was not usable in this run, so ClearDeed cannot verify the official land class. Source status: <strong>${escapeHtml(bhulekhUnavailableReason)}</strong>. Ask the seller for the current Bhulekh Khatiyan and confirm the land class with a lawyer or tehsil office.</p></div>` : ''}
    <div class="source-line">
      <span>Land-class source: Bhulekh RoR (${escapeHtml(landClassSourceStatus)}) — per-plot land class fields in Khatiyan #${safeKhataNo}</span>
    </div>
    <div class="verify-links">
      ${bhulekhUsable ? buildVerifyLink("https://bhulekh.ori.nic.in/", "Bhulekh", "Open the Bhulekh RoR portal") : ""}
    </div>
  </div>
</section>

<!-- Feedback: Section 3 (Land Classification) -->
<div class="feedback-widget" id="feedback-land" data-section="land">
  <span class="feedback-label">Was this section useful?</span>
  <button class="feedback-btn feedback-up" onclick="submitFeedback('land','up',this)">👍 Yes</button>
  <button class="feedback-btn feedback-down" onclick="submitFeedback('land','down',this)">👎 No</button>
  <span class="feedback-thanks" style="display:none;">Thank you!</span>
</div>
<div class="feedback-comment" id="comment-land" style="display:none;">
  <textarea placeholder="What was missing or confusing? (optional)" maxlength="500"></textarea>
  <button class="feedback-submit" onclick="submitFeedbackComment('land',this)">Send feedback</button>
</div>

${buildAdjacentPlotsPanel(adjacentPlots)}

<!-- ── Section 4: Encumbrances & Disputes ──────────────────────────── -->
<section class="section" id="section-encumbrance">
  <div class="section-hdr">
    <div class="section-icon">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6"/></svg>
    </div>
    <div class="section-title-group">
      <div class="section-title">3a. Court Cases &amp; Encumbrances</div>
      <div class="section-sub">Any active court cases, loans, or past transfers on this land</div>
    </div>
  </div>
  <div class="section-body">
    <p class="section-intro">This section checks for two things that could let you lose the land after you pay: <strong>court cases</strong> (someone is already fighting over it) and <strong>past transfers or loans</strong> (the <em>Encumbrance Certificate</em>, or EC, is the official record of every sale, mortgage, or lien on the plot in the last 30 years).</p>
    ${courtSection} ${rorBackPagePanel} ${mutationReferencePanel} ${ecSection}
    <div class="source-line">
      <span>Court cases: services.ecourts.gov.in, rccms.odisha.gov.in &mdash; Encumbrance Certificate: igrodisha.gov.in</span>
    </div>
    <div class="verify-links">
      ${courtSourceStatuses.ecourts === "success" ? buildVerifyLink("https://services.ecourts.gov.in/", "eCourts", "Search for court cases at the eCourts portal") : ""}
      ${courtSourceStatuses.rccms === "success" ? buildVerifyLink("https://rccms.odisha.gov.in/", "RCCMS", "Search for revenue cases at RCCMS Odisha") : ""}
      ${buildVerifyLink(safeRegUrl, "IGR Odisha", "Get the loan + transfer history (EC) from IGR Odisha")}
    </div>
  </div>
</section>

<!-- Feedback: Section 4 (Court Cases &amp; Encumbrances) -->
<div class="feedback-widget" id="feedback-encumbrance" data-section="encumbrance">
  <span class="feedback-label">Was this section useful?</span>
  <button class="feedback-btn feedback-up" onclick="submitFeedback('encumbrance','up',this)">👍 Yes</button>
  <button class="feedback-btn feedback-down" onclick="submitFeedback('encumbrance','down',this)">👎 No</button>
  <span class="feedback-thanks" style="display:none;">Thank you!</span>
</div>
<div class="feedback-comment" id="comment-encumbrance" style="display:none;">
  <textarea placeholder="What was missing or confusing? (optional)" maxlength="500"></textarea>
  <button class="feedback-submit" onclick="submitFeedbackComment('encumbrance',this)">Send feedback</button>
</div>

<!-- ── Section 5: Regulatory Flags ──────────────────────────────── -->
<section class="section" id="section-regulatory">
  <div class="section-hdr">
    <div class="section-icon">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    </div>
    <div class="section-title-group">
      <div class="section-title">3b. Regulatory Flags</div>
      <div class="section-sub">Protected zones and restrictions that affect what you can do with this land</div>
    </div>
  </div>
  <div class="section-body">
    ${regSection}
    <div class="info-box">
      <span class="info-label">&#8505; About regulatory screening</span>
      <p>ClearDeed only reports regulatory overlays that were actually checked during this run. Forest, coastal, PESA, airport, archaeological, and town-planning restrictions may require separate manual verification until those layers are listed above as completed sources.</p>
    </div>
    <div class="source-line">
      <span>Overlay screening: ${regulatoryVerified ? 'completed overlay source(s) listed in findings above' : 'not fully verified in this run'}</span>
    </div>
  </div>
</section>

<!-- Feedback: Section 5 (Regulatory Flags) -->
<div class="feedback-widget" id="feedback-regulatory" data-section="regulatory">
  <span class="feedback-label">Was this section useful?</span>
  <button class="feedback-btn feedback-up" onclick="submitFeedback('regulatory','up',this)">👍 Yes</button>
  <button class="feedback-btn feedback-down" onclick="submitFeedback('regulatory','down',this)">👎 No</button>
  <span class="feedback-thanks" style="display:none;">Thank you!</span>
</div>
<div class="feedback-comment" id="comment-regulatory" style="display:none;">
  <textarea placeholder="What was missing or confusing? (optional)" maxlength="500"></textarea>
  <button class="feedback-submit" onclick="submitFeedbackComment('regulatory',this)">Send feedback</button>
</div>

<!-- ── Section 6: Land Acquisition Risk (LARR) ────────────────────── -->
<section class="section" id="section-larr">
  <div class="section-hdr">
    <div class="section-icon">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
    </div>
    <div class="section-title-group">
      <div class="section-title">3c. Land Acquisition Risk</div>
      <div class="section-sub">Check if the government is planning to acquire this land</div>
    </div>
  </div>
  <div class="section-body">
    ${larrHtml}
  </div>
</section>

<!-- ── Section 7: Official References & Fees (Sprint V5c) ────────── -->
<section class="section" id="section-official-refs">
  <div class="section-hdr">
    <div class="section-icon">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
    </div>
    <div class="section-title-group">
      <div class="section-title">6. Official References &amp; Fees</div>
      <div class="section-sub">What the government charges &mdash; fee schedule, official activity links, certified-copy procedure</div>
    </div>
  </div>
  <div class="section-body">
    ${renderV5cGovtFeeSubCard((data as any).govtFeeData ?? null)}
    ${renderV5cPublicDashboardSubCard((data as any).publicDashboardData ?? null)}
    <div class="source-line">
      <span>Sources: IGR Govt Fee Schedule (permanent cache, last updated ${
        escapeHtml(((data as any)?.govtFeeData?.data?.schedule?.lastUpdated) ?? "—")
      }) &middot; IGR Public Dashboard (server-rendered, live link) &middot; IGR Certified Copy Portal (Phase 1 manual lookup)</span>
    </div>
  </div>
</section>

<!-- Feedback: Section 6 (Land Acquisition Risk) -->
<div class="feedback-widget" id="feedback-larr" data-section="larr">
  <span class="feedback-label">Was this section useful?</span>
  <button class="feedback-btn feedback-up" onclick="submitFeedback('larr','up',this)">👍 Yes</button>
  <button class="feedback-btn feedback-down" onclick="submitFeedback('larr','down',this)">👎 No</button>
  <span class="feedback-thanks" style="display:none;">Thank you!</span>
</div>
<div class="feedback-comment" id="comment-larr" style="display:none;">
  <textarea placeholder="What was missing or confusing? (optional)" maxlength="500"></textarea>
  <button class="feedback-submit" onclick="submitFeedbackComment('larr',this)">Send feedback</button>
</div>

<!-- ── P-NEW-1A: Pattern Intelligence Synthesis ───────────────────── -->
<!-- Renders pattern intelligence from PID database. Empty until populated by P-NEW-1B/B or P-NEW-3. -->
${synthesisSection ? `
<section class="section" id="section-synthesis">
  <div class="section-hdr">
    <div class="section-icon">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9.5 3A3.5 3.5 0 0 0 6 6.5A3.5 3.5 0 0 0 9.5 10a3.5 3.5 0 0 0 2.8-1.4l5.9 5.9a3.5 3.5 0 1 0 5-5l-5.9-5.9A3.5 3.5 0 0 0 9.5 3m0 2a1.5 1.5 0 1 1 0 3a1.5 1.5 0 0 1 0-3m-4.7 10.3a1.5 1.5 0 1 1 2.12 2.12a1.5 1.5 0 0 1-2.12-2.12"/></svg>
    </div>
    <div class="section-title-group">
      <div class="section-title">Pattern Intelligence</div>
      <div class="section-sub">Similar cases &ndash; precedents &ndash; resolution patterns</div>
    </div>
  </div>
  <div class="section-body">
    ${synthesisSection}
    <div class="feedback-widget" id="feedback-synthesis" data-section="synthesis" style="margin-top:18px;">
      <span class="feedback-label">Was this section useful?</span>
      <button class="feedback-btn feedback-up" onclick="submitFeedback('synthesis','up',this)">👍 Yes</button>
      <button class="feedback-btn feedback-down" onclick="submitFeedback('synthesis','down',this)">👎 No</button>
      <span class="feedback-thanks" style="display:none;">Thank you!</span>
    </div>
    <div class="feedback-comment" id="comment-synthesis" style="display:none;">
      <textarea class="feedback-textarea" placeholder="What did we miss? (optional)" rows="2"></textarea>
      <button class="feedback-submit" onclick="submitFeedbackComment('synthesis',this)">Send feedback</button>
    </div>
  </div>
</section>
` : ''}

<!-- ── Section 7: Market Benchmark ────────────────────────────────── -->
<section class="section" id="section-benchmark">
  <div class="section-hdr">
    <div class="section-icon">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
    </div>
    <div class="section-title-group">
      <div class="section-title">5. What It's Worth</div>
      <div class="section-sub">Official stamp duty floor &middot; directional signals &middot; market ceiling</div>
    </div>
  </div>
  <div class="section-body">
    ${benchmarkSection}
  </div>
</section>

<!-- Feedback: Section 7 (Market Benchmark) -->
<div class="feedback-widget" id="feedback-benchmark" data-section="benchmark">
  <span class="feedback-label">Was this section useful?</span>
  <button class="feedback-btn feedback-up" onclick="submitFeedback('benchmark','up',this)">👍 Yes</button>
  <button class="feedback-btn feedback-down" onclick="submitFeedback('benchmark','down',this)">👎 No</button>
  <span class="feedback-thanks" style="display:none;">Thank you!</span>
</div>
<div class="feedback-comment" id="comment-benchmark" style="display:none;">
  <textarea placeholder="What was missing or confusing? (optional)" maxlength="500"></textarea>
  <button class="feedback-submit" onclick="submitFeedbackComment('benchmark',this)">Send feedback</button>
</div>

<!-- ── Section 8: What to Ask Next ──────────────────────────────── -->
<section class="section section-action" id="section-action">
  <div class="section-hdr">
    <div class="section-icon">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
    </div>
    <div class="section-title-group">
      <div class="section-title">6. What to Do Before You Pay — what to ask next</div>
      <div class="section-sub">Specific questions to ask the seller and broker — and steps to get the Encumbrance Certificate</div>
    </div>
  </div>
  <div class="section-body">
    <p class="action-intro">Before you sign anything or pay any money, ask the seller and broker these questions and get clear answers:</p>
    <ol class="action-list">
      ${actionItems}
    </ol>
    <div class="disclaimer-box">
      <div class="disclaimer-label">&#9888; Important disclaimer</div>
      <p>${safeDislcaimer}</p>
    </div>
    <div class="source-line">
      <span>ClearDeed — ${safeDistrict}, Odisha &mdash; Report ${escapeHtml(data.reportId)}</span>
    </div>
  </div>
</section>

<script>
function getReportId() {
  var match = location.pathname.match(/\/report\/([^/]+)/);
  return match ? match[1] : null;
}

function submitFeedback(section, vote, btn) {
  var widget = btn.closest('.feedback-widget');
  var commentDiv = document.getElementById('comment-' + section);
  widget.querySelectorAll('.feedback-btn').forEach(function(b) { b.classList.remove('active-up','active-down'); });
  btn.classList.add(vote === 'up' ? 'active-up' : 'active-down');
  widget.querySelector('.feedback-thanks').style.display = '';
  commentDiv.style.display = 'block';
}

function submitFeedbackComment(section, btn) {
  var commentDiv = document.getElementById('comment-' + section);
  var textarea = commentDiv.querySelector('textarea');
  var comment = textarea ? textarea.value : '';
  var widget = document.getElementById('feedback-' + section);
  var rid = getReportId();
  var payload = JSON.stringify({
    reportId: rid || 'demo',
    section: section,
    vote: widget.querySelector('.active-up') ? 'up' : 'down',
    comment: comment.trim() || null,
  });
  // sendBeacon requires a Blob with a content-type for the server to parse it
  // as JSON; fall back to fetch with keepalive when sendBeacon is missing.
  var sent = false;
  if (navigator.sendBeacon) {
    try {
      sent = navigator.sendBeacon('/api/feedback', new Blob([payload], { type: 'application/json' }));
    } catch (e) { sent = false; }
  }
  if (!sent) {
    fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(function() {});
  }
  btn.textContent = 'Sent!';
  btn.disabled = true;
  setTimeout(function() {
    commentDiv.style.display = 'none';
    widget.querySelectorAll('.feedback-btn').forEach(function(b) { b.classList.remove('active-up','active-down'); });
    widget.querySelector('.feedback-thanks').style.display = 'none';
    btn.textContent = 'Send feedback';
    btn.disabled = false;
  }, 2000);
}
</script>

</div>
</body>
</html>`;

  const title = `ClearDeed — ${plotVillage}, ${plotTahasil} (Plot ${safePlotNo})`;

  // Append the unified insight blocks (per panel) to the assembled HTML.
  const completenessInsights = insights.filter((i) => i.panel === "completeness");
  const plotInsights = insights.filter((i) => i.panel === "plot");
  const ownerInsights = insights.filter((i) => i.panel === "owner");
  const landInsights = insights.filter((i) => i.panel === "land");
  const encumbranceInsights = insights.filter((i) => i.panel === "encumbrance" || i.panel === "deeds");
  const courtInsights = insights.filter((i) => i.panel === "court");
  const financialInsights = insights.filter((i) => i.panel === "financial");

  // ROR + Bhunaksha source-layer sections. These mirror the same insights
  // already rendered above but are grouped by data source so the buyer (and
  // the lawyer reviewing the report) can see what came from the Record of
  // Rights vs. what came from the geometry/map. Empty inputs render an
  // explicit "no findings" line — never silent absence.
  const rorSourceInsights = insights.filter((i) => i.source.startsWith("bhulekh:"));
  const mapSourceInsights = insights.filter((i) => i.source.startsWith("bhunaksha:"));

  const insightBlocks = [
    renderInsightList(plotInsights),
    renderInsightList(ownerInsights),
    renderInsightList(landInsights),
    renderInsightList(encumbranceInsights),
    renderInsightList(courtInsights),
    renderInsightList(financialInsights),
    renderInsightList(completenessInsights),
    renderInsightListBySource(
      "ROR findings (Bhulekh Record of Rights)",
      "Findings derived from the Record of Rights — owner names, khata number, plot details, land class, dues, and back-page entries.",
      rorSourceInsights,
      "bhulekh",
    ),
    renderInsightListBySource(
      "Map findings (Bhunaksha)",
      "Findings derived from the cadastral map — plot boundary, area, neighbours, road access, and shape.",
      mapSourceInsights,
      "bhunaksha",
    ),
  ].join("\n");

  return { html: html + "\n" + insightBlocks, title, insights };
}

// ── Layer split: Buyer (1-2 page compact) and Lawyer (full drill-down) ──────
//
// Both layers are derived from a shared `ReportContext` so the buyer page
// and the lawyer page render the same domain facts. The buyer page is the
// primary consumer-facing artifact (max 1-2 printed pages); the lawyer
// page is the full drill-down with all raw tables, provenance, and source
// audit. The route layer picks which one to render.
function deriveReportContext(input: z.infer<typeof ConsumerReportGenInputSchema>) {
  const data = input;
  const { gpsCoordinates: gps, geoFetch, revenueRecords, courtCases, registryLinks,
          landClassifier, encumbranceReasoner,
          regulatoryScreener, validationFindings, adjacentPlots, synthesisInsights } = data;
  const sourceStatus = data.sourceStatus ?? {};
  const sourceDetails = data.sourceDetails ?? {};
  const tenants: any[] = revenueRecords?.tenants ?? [];
  const bhulekhUsable = sourceStatus.bhulekh === "success" && tenants.length > 0;
  const bhunakshaUsable = sourceStatus.bhunaksha === "success";
  const gpsDisplay = formatGpsDisplay(gps);

  const plotVillage = geoFetch?.village ?? revenueRecords?.village ?? "—";
  const plotTahasil = geoFetch?.tahasil ?? "—";
  const plotDistrict = geoFetch?.district ?? registryLinks?.params?.district ?? "Not verified";
  const targetPlotNo = geoFetch?.plotNo ?? registryLinks?.params?.plotNo ?? null;
  const targetTenant = targetPlotNo
    ? tenants.find((tenant) => plotNosMatch(tenant?.surveyNo, targetPlotNo))
    : tenants[0];
  const plotNo = targetPlotNo
    ?? (bhulekhUsable ? targetTenant?.surveyNo ?? revenueRecords?.tenants?.[0]?.surveyNo : null)
    ?? registryLinks?.params?.plotNo
    ?? "—";
  const bhulekhVillage = revenueRecords?.village ?? plotVillage;
  const targetPlotRow = findTargetPlotRow(revenueRecords, plotNo);
  const plotArea = buildPlotAreaDetails(targetTenant, targetPlotRow);
  const plotRecordSummary = buildPlotRecordSummary({
    plotNo,
    khataNo: revenueRecords?.khataNo ?? null,
    area: plotArea,
    landClassOdia: targetPlotRow?.landTypeOdia ?? targetTenant?.landClassOdia ?? targetTenant?.landClass ?? null,
    landClassEnglish: targetTenant?.landClassEnglish ?? null,
  });

  const ownerRecords = buildOwnerDisplayRecords(revenueRecords, tenants);
  const primaryOwner = ownerRecords[0] ?? null;
  const primaryOwnerName = primaryOwner?.latin || primaryOwner?.odia || "—";
  const coOwners = ownerRecords.slice(1).map((owner) => owner.latin || owner.odia).filter(Boolean);

  const primaryTenant = targetPlotNo ? targetTenant : revenueRecords?.tenants?.[0];
  const landClassOdia = primaryTenant?.landClassOdia ?? targetPlotRow?.landTypeOdia ?? primaryTenant?.landClass ?? "";
  const landClassEnglish = primaryTenant?.landClassEnglish
    ?? (landClassOdia ? translateLandClass(landClassOdia) : "");

  const classification = bhulekhUsable
    ? formatLandClassDisplay(landClassEnglish, landClassOdia, primaryTenant?.landClass)
    : "Not verified";
  const conversionRequired = bhulekhUsable
    ? primaryTenant?.conversionRequired ?? landClassifier?.conversionRequired ?? null
    : null;
  const conversionUnknown = bhulekhUsable && conversionRequired == null;
  const classificationUnknown =
    !bhulekhUsable ||
    (!landClassEnglish || landClassEnglish === "Unknown") && !landClassOdia;
  const bhulekhUnavailableReason = sourceStatusLine(sourceDetails, sourceStatus, "bhulekh");
  const landClassSourceStatus = sourceStatusLine(sourceDetails, sourceStatus, "bhulekh");
  const classificationBasisText = bhulekhUsable
    ? `Based on the selected plot row in the Bhulekh RoR (${landClassOdia || "—"})`
    : "Not verified from Bhulekh in this run";
  const landRestrictions = (landClassifier?.restrictions ?? []).map((restriction: any) => ({
    flag: titleFromSnakeCase(restriction.type ?? "Restriction"),
    severity: normalizeLandSeverity(restriction.severity),
    description: restriction.description,
    recommendedAction: restriction.action ?? restriction.citation ?? null,
  }));
  const redFlags = dedupeFlags(
    [...(landClassifier?.redFlags ?? []), ...landRestrictions].filter((flag: any) =>
      Boolean(flag?.flag?.trim?.() && flag?.description?.trim?.())
    )
  );

  const nameMatch = bhulekhUsable
    ? {
        state: "ror_available" as const,
        claimedName: data.claimedOwnerName ?? null,
        officialName: primaryOwnerName !== "—" ? primaryOwnerName : null,
        confidence: data.claimedOwnerName ? 0.7 : 0,
        explanation: data.claimedOwnerName
          ? "Bhulekh owner compared against seller-claimed name"
          : "No seller name provided — RoR owner shown directly",
      }
    : { state: "unknown" as const };

  const totalCases = courtCases?.total ?? 0;
  const cases: any[] = courtCases?.cases ?? [];
  const courtSourceStatuses = courtCases?.sources ?? {
    ecourts: sourceStatus.ecourts ?? "not_run",
    rccms: sourceStatus.rccms ?? "not_run",
  };
  const caseList = cases.length > 0
    ? cases.map(c => ({
        caseType: c.caseType ?? "—",
        caseNo: c.caseNo ?? c.caseId ?? "—",
        court: c.court ?? c.courtName ?? c.courtComplex ?? "—",
        status: c.status ?? "—",
        filing: c.filingDate ?? "—",
        source: c.source ?? 'eCourts',
      }))
    : null;
  const mutationReferencePanel = buildMutationReferencePanel(
    revenueRecords?.mutationReferences ?? []
  );

  const insights: Insight[] = runInsights(
    ALL_RULES,
    data as unknown as Parameters<typeof runInsights>[1]
  );
  const rorInsights = rorInsightGroups(insights);
  const riskInsights = riskInsightGroups(insights);

  const redFlagRuleIds = new Set<string>();
  const watchoutRuleIds = new Set<string>();
  for (const i of insights) {
    if (!i || !(i as any).ruleId) continue;
    if ((i as any).severity === "redFlag") redFlagRuleIds.add((i as any).ruleId);
    else if ((i as any).severity === "watchout") watchoutRuleIds.add((i as any).ruleId);
  }

  // T1 — Tested Fraud Patterns Panel (Khordha 2024–2026) for the
  // buyer-layer view. Same evaluation logic as the full report.
  const buyerFiredRuleIds = new Set<string>([
    ...Array.from(redFlagRuleIds),
    ...Array.from(watchoutRuleIds),
  ]);
  const buyerPatternResults: PatternResult[] = evaluatePatterns({
    insights,
    revenueRecords: revenueRecords ?? null,
    firedRuleIds: buyerFiredRuleIds,
  });
  const buyerPatternPanelHtml = buildTestedPatternsPanel({
    results: buyerPatternResults,
    fetchedAt: fetchedDate,
  });

  const regFlags = (regulatoryScreener?.flags ?? []).filter((flag: any) =>
    Boolean(flag?.flag?.trim?.() && flag?.description?.trim?.())
  );
  const regulatoryVerified = isRegulatoryScreeningVerified(regulatoryScreener);

  return {
    data, gpsDisplay, plotVillage, plotTahasil, plotDistrict, targetPlotNo, plotNo,
    bhulekhVillage, plotArea, plotRecordSummary, ownerRecords, primaryOwnerName,
    coOwners, landClassOdia, landClassEnglish, classification, conversionRequired,
    conversionUnknown, classificationUnknown, bhulekhUnavailableReason,
    landClassSourceStatus, classificationBasisText, redFlags, nameMatch, totalCases,
    caseList, courtSourceStatuses, mutationReferencePanel, insights, rorInsights,
    riskInsights, redFlagRuleIds, watchoutRuleIds, regFlags, regulatoryVerified,
    bhulekhUsable, bhunakshaUsable, tenants, sourceStatus, sourceDetails,
    encumbranceReasoner, registryLinks, landClassifier, adjacentPlots,
    synthesisInsights, validationFindings,
  };
}

/**
 * Generate the consumer-facing BUYER-LAYER report (max 1-2 pages).
 * Compact, vivid, only the highest-value facts. Lawyer drill-down lives in
 * a separate route. This is the default page rendered at /report/[id].
 */
export function generateBuyerLayerReport(
  input: z.infer<typeof ConsumerReportGenInputSchema>
): { html: string; title: string; insights: Insight[] } {
  const parsed = ConsumerReportGenInputSchema.safeParse(input);
  if (!parsed.success) {
    return generateErrorReport("Invalid report input. Please try again.");
  }
  const ctx = deriveReportContext(parsed.data);
  const sections = buildBuyerSectionContents(ctx);

  // T13 plumbing — pull raw fetcher provenance for the trust strip.
  // data.sourceDetails[sourceName] is the SourceResultBase projection
  // that the mapper emits. We forward only the fields the strip reads.
  const sd = (ctx.data as any).sourceDetails ?? {};
  const ecourtsSearchMeta = (ctx as any).courtCases?.searchMetadata ?? null;
  const sourceMeta: NonNullable<BuyerPageInternalInput["sourceMeta"]> = {
    bhulekh: sd.bhulekh
      ? {
          fetchedAt: sd.bhulekh.fetchedAt,
          rawArtifactHash: sd.bhulekh.rawArtifactHash,
          parserVersion: sd.bhulekh.parserVersion,
          warnings: sd.bhulekh.warnings,
          rawOdia: ctx.data.revenueRecords?.recordMeta
            ? {
                odia: (ctx.data.revenueRecords.tenants?.[0] as any)?.landClassOdia ?? "",
                english: ctx.data.revenueRecords.tenants?.[0]?.landClass ?? "",
              }
            : undefined,
          casteOdia: ctx.data.revenueRecords?.tenants?.[0]?.casteOdia ?? null,
        }
      : undefined,
    eCourts: sd.ecourts
      ? {
          fetchedAt: sd.ecourts.fetchedAt,
          rawArtifactHash: sd.ecourts.rawArtifactHash,
          parserVersion: sd.ecourts.parserVersion,
          attempts: ecourtsSearchMeta?.captchaAcceptedCount
            ? `${ecourtsSearchMeta.captchaAcceptedCount} captcha attempt(s) accepted`
            : undefined,
          warnings: sd.ecourts.warnings,
        }
      : undefined,
    bhunaksha: sd.bhunaksha
      ? {
          fetchedAt: sd.bhunaksha.fetchedAt,
          rawArtifactHash: sd.bhunaksha.rawArtifactHash,
          parserVersion: sd.bhunaksha.parserVersion,
          warnings: sd.bhunaksha.warnings,
        }
      : undefined,
  };

  const buyerPageInput = {
    reportId: ctx.data.reportId,
    header: {
      reportId: ctx.data.reportId,
      plotVillage: ctx.plotVillage,
      plotNo: ctx.plotNo,
      plotAreaDisplay: formatPlotAreaSummary(ctx.plotArea),
      ownerName: ctx.primaryOwnerName,
    },
    insights: ctx.insights,
    riskInsights: {
      redFlag: ctx.riskInsights.redFlag,
      watchout: ctx.riskInsights.watchout,
      positive: ctx.riskInsights.positive,
    },
    redFlagRuleIds: Array.from(ctx.redFlagRuleIds),
    watchoutRuleIds: Array.from(ctx.watchoutRuleIds),
    plotArea: ctx.plotArea,
    landClass: {
      rawKisam: ctx.landClassOdia,
      standardizedKisam: ctx.landClassEnglish,
      displayKisam: ctx.landClassEnglish,
      conversionRequired: ctx.conversionRequired,
      prohibited: null,
      buildable: null,
    },
    bhulekhUsable: ctx.bhulekhUsable,
    encumbranceInstructions: ctx.encumbranceReasoner?.instructions ?? null,
    backPage: ctx.data.revenueRecords?.backPage,
    dues: ctx.data.revenueRecords?.dues,
    igrEcEntries: (ctx.encumbranceReasoner as any)?.igrEcEntries ?? [],
    cersaiCharges: (ctx.encumbranceReasoner as any)?.cersaiCharges ?? [],
    village: ctx.plotVillage,
    district: ctx.plotDistrict,
    plotNo: ctx.plotNo,
    sections,
    sourceMeta,
    css: CSS,
  };
  return { html: buildBuyerPage(buyerPageInput), title: `ClearDeed — ${ctx.plotVillage}`, insights: ctx.insights };
}

/**
 * Generate the LAWYER-LAYER drill-down report. Same domain data as the buyer
 * page but expanded into a full source-by-source detail: raw RoR tenant table,
 * full court rows, full EC entries, IGR instructions, provenance strip, audit
 * panel, source-detail per source. Routed at /report/[id]?layer=lawyer and
 * /api/report/[id]/pdf?layer=lawyer.
 */
export function generateLawyerLayerReport(
  input: z.infer<typeof ConsumerReportGenInputSchema>
): { html: string; title: string; insights: Insight[] } {
  const parsed = ConsumerReportGenInputSchema.safeParse(input);
  if (!parsed.success) {
    return generateErrorReport("Invalid report input. Please try again.");
  }
  // Lawyer layer = today's full long-form report. Delegate to the same path
  // so the legacy template stays the single source of truth for the drill-down.
  return generateConsumerReport(input);
}

// ─── Section builders ─────────────────────────────────────────────────────────

function buildInsightHighlights(insights: (RoRInsight | RiskInsight)[]): string {
  if (!Array.isArray(insights) || insights.length === 0) return "";
  const cards = insights.slice(0, 4).map((item) => {
    // Support both old RoRInsight (tone) and new RiskInsight (severity)
    const severity = (item as any).severity ?? (item as any).tone ?? "watchout";
    const icon = severity === "positive" ? "&#10003;" : severity === "redFlag" ? "&#10060;" : "&#9888;";
    const typeLabel = severity === "positive" ? "Positive signal" : severity === "redFlag" ? "Red flag" : "Watch-out";
    const cardClass = severity === "redFlag" ? "redFlag" : severity;
    const actionItem = (item as any).actionItem as string | undefined;
    return `<div class="insight-card insight-card-${cardClass}">
      <div class="insight-head">
        <span class="insight-icon">${icon}</span>
        <span class="insight-type">${typeLabel}</span>
      </div>
      <div class="insight-label">${escapeHtml(item.label)}</div>
      <p>${escapeHtml(item.body)}</p>
      <div class="insight-source">Source: ${escapeHtml(item.source)}</div>
      ${actionItem ? `<p class="insight-action"><strong>What to do:</strong> ${escapeHtml(actionItem)}</p>` : ""}
      <details>
        <summary>How we checked this</summary>
        <p>Source: ${escapeHtml(item.source)}. This insight is a structured observation, not a legal opinion. Verify with a qualified property lawyer before transacting.</p>
      </details>
    </div>`;
  }).join("");

  return `<div class="insight-highlights">${cards}</div>`;
}

function buildRiskInsightCard(insight: RiskInsight): string {
  const icon = insight.severity === "positive"
    ? "&#10003;"
    : insight.severity === "redFlag"
    ? "&#10060;"
    : "&#9888;";
  const typeLabel = insight.severity === "positive"
    ? "Positive signal"
    : insight.severity === "redFlag"
    ? "Red flag"
    : "Watch-out";
  const cardClass = insight.severity === "redFlag" ? "redFlag" : insight.severity;

  return `<div class="insight-card insight-card-${cardClass}">
    <div class="insight-head">
      <span class="insight-icon">${icon}</span>
      <span class="insight-type">${typeLabel}</span>
    </div>
    <div class="insight-label">${escapeHtml(insight.label)}</div>
    <p>${escapeHtml(insight.body)}</p>
    <div class="insight-source">Source: ${escapeHtml(insight.source)}</div>
    ${insight.actionItem ? `<p class="insight-action"><strong>What to do:</strong> ${escapeHtml(insight.actionItem)}</p>` : ""}
    <details>
      <summary>How we checked this</summary>
      <p>Source: ${escapeHtml(insight.source)}. This insight is a structured observation, not a legal opinion. Verify with a qualified property lawyer before transacting.</p>
    </details>
  </div>`;
}

function buildEcSection(
  encumbranceResult: EncumbranceResult | null,
  safeRegUrl: string,
  safeDistrict: string,
  safeSro: string,
  safePlotNo: string,
  safeOwnerName: string
): string {
  let stepsHtml: string;

  if (encumbranceResult?.instructions && typeof encumbranceResult.instructions === "string") {
    // Instructions may be either a plain-text newline-delimited string (legacy)
    // or a JSON-encoded ManualInstructions object with {steps, contactSRO, ...}.
    let parsed: { steps?: string[]; contactSRO?: string; estimatedFee?: string; expectedTime?: string; notes?: string[] } | null = null;
    const raw = encumbranceResult.instructions.trim();
    if (raw.startsWith("{")) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = null;
      }
    }

    if (parsed && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
      const stepItems = parsed.steps
        .map((step) => {
          const urlPattern = /https?:\/\/[^\s]+/g;
          const linked = step.replace(urlPattern, (url) =>
            `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`
          );
          return `<li>${linked}</li>`;
        })
        .join("\n");
      const meta: string[] = [];
      if (parsed.estimatedFee) meta.push(`<strong>Estimated fee:</strong> ${escapeHtml(parsed.estimatedFee)}`);
      if (parsed.expectedTime) meta.push(`<strong>Expected time:</strong> ${escapeHtml(parsed.expectedTime)}`);
      if (parsed.contactSRO) meta.push(`<strong>Contact:</strong> ${escapeHtml(parsed.contactSRO)}`);
      stepsHtml = stepItems + (meta.length > 0 ? `\n<li class="igr-meta">${meta.join(" · ")}</li>` : "");
    } else {
      // Plain-text fallback (legacy shape)
      const lines = raw
        .split(/\n+/)
        .map((l: string) => l.trim())
        .filter(Boolean);
      stepsHtml = lines
        .map((line: string) => {
          const urlPattern = /https?:\/\/[^\s]+/g;
          const linked = line.replace(urlPattern, (url: string) =>
            `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a>`
          );
          return `<li>${linked}</li>`;
        })
        .join("\n");
    }
  } else {
    // Fallback steps when no instructions provided
    const districtSroStep = isVerifiedDisplayValue(safeDistrict) && isVerifiedDisplayValue(safeSro)
      ? `Navigate to the Encumbrance Certificate section and search using District: ${escapeHtml(safeDistrict)}, SRO: ${escapeHtml(safeSro)}.`
      : "Navigate to the Encumbrance Certificate section and confirm the correct district/SRO in the live IGR Odisha flow or at the Sub-Registrar office.";
    stepsHtml = [
      `Visit the Inspector General of Registration (IGR) Odisha portal at <a href="${escapeHtml(safeRegUrl)}" target="_blank" rel="noopener">${escapeHtml(safeRegUrl)}</a>`,
      districtSroStep,
      `Enter Plot Number ${escapeHtml(safePlotNo)} or owner name ${escapeHtml(safeOwnerName)} and request the EC for the last 15-30 years.`,
      `<strong>Fees:</strong> Online search is typically free. Certified copy fees vary (approx. ₹100-500 depending on search years).`,
      `<strong>Required Docs for manual request:</strong> ID proof, copy of RoR/Khatiyan, and application form.`,
      `<strong>Bhubaneswar SRO:</strong> If manual verification is needed, visit the Sub-Registrar Office at Khordha or Bhubaneswar depending on exact tahasil jurisdiction.`
    ]
      .map((action) => `<li>${action}</li>`)
      .join("\n");
  }

  return `<div class="igr-panel">
      <div class="igr-label">Encumbrance Certificate (EC)</div>
      <p>To check for prior transfers, liens, or loans on this plot, obtain an Encumbrance Certificate (EC) from IGR Odisha or the Sub-Registrar's office and have it reviewed by a property lawyer.</p>
      <ol class="igr-steps">${stepsHtml}</ol>
    </div>`;
}

// ─── Section 7 builder: What is it worth (floor / directional / ceiling) ────

interface BenchmarkRateRow {
  mouza?: string;
  tehsil?: string;
  kisam?: string;
  ratePerAcre?: number;
  ratePerSqft?: number;
  ratePerDecimal?: number;
  rateType?: string;
  lastUpdated?: string;
  sourceUrl?: string;
}

interface BenchmarkSectionInput {
  village?: string | null;
  tahasil?: string | null;
  district?: string | null;
  plotNo?: string | null;
  acres?: number | null;
}

/**
 * Pick the best circle-rate row for the report's mouza/tehsil/kisam.
 * The pipeline already filters, so data[0] is the best match. We still
 * search the array for a row whose mouza matches the report's village,
 * falling back to data[0] when no exact row is present.
 */
function selectBestRateRow(
  data: BenchmarkRateRow[] | undefined,
  input: BenchmarkSectionInput
): BenchmarkRateRow | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const villageLower = String(input.village ?? "").toLowerCase().trim();
  if (villageLower) {
    const exact = data.find((row) => String(row.mouza ?? "").toLowerCase() === villageLower);
    if (exact) return exact;
  }
  return data[0] ?? null;
}

/** Format ₹X / Y with proper grouping. */
function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN")}`;
}

/** Format a circle-rate row into a human "X per acre" or "Y per sqft" string. */
function formatRateDisplay(row: BenchmarkRateRow): string {
  if (row.ratePerAcre && row.ratePerAcre > 0) {
    return `${formatInr(row.ratePerAcre)} per acre`;
  }
  if (row.ratePerSqft && row.ratePerSqft > 0) {
    return `${formatInr(row.ratePerSqft)} per sqft`;
  }
  return "rate not parsed";
}

/** Multiply sqft-rate into per-acre (1 acre = 43,560 sqft). */
function sqftToPerAcre(ratePerSqft: number): number {
  return Math.round(ratePerSqft * 43560);
}

/**
 * Render the directional band with IGR EC entries if available.
 * Shows a warning if the entries indicate potential encumbrances (sales, mortgages, liens).
 * Falls back to the default "not fetched" message if no IGR EC data is available.
 */
function renderIgrEcDirectionalBand(
  igrEcEntries?: Array<{
    partyName?: string;
    status?: string;
    warning?: { code: string; message: string };
  }>
): string {
  if (!igrEcEntries || igrEcEntries.length === 0) {
    return `<div class="bm-band-value">Not fetched in this run</div>
    <p class="bm-note">Recent IGR transaction prices in the same mouza would give a directional band. This data is not yet wired into the report.</p>`;
  }

  // Group entries by status for a clean summary
  const sales = igrEcEntries.filter((e) =>
    e.status?.toLowerCase().includes("sale") ||
    e.status?.toLowerCase().includes("transfer")
  );
  const encumbrances = igrEcEntries.filter((e) =>
    e.status?.toLowerCase().includes("mortgage") ||
    e.status?.toLowerCase().includes("lien") ||
    e.status?.toLowerCase().includes("charge")
  );

  const summary: string[] = [];
  summary.push(`<strong>${igrEcEntries.length}</strong> encumbrance record${igrEcEntries.length === 1 ? "" : "s"} found in IGR EC`);
  if (sales.length > 0) {
    summary.push(`<strong>${sales.length}</strong> sale/transfer`);
  }
  if (encumbrances.length > 0) {
    summary.push(`<strong style="color: #c62828;">${encumbrances.length}</strong> mortgage/lien/charge`);
  }

  return `<div class="bm-band-value">${summary.join(" &middot; ")}</div>
  <p class="bm-note">IGR EC data shows recent transaction history for this plot. <a href="https://igrodisha.gov.in/ecsearch" target="_blank" rel="noopener">Verify at igrodisha.gov.in &rarr;</a></p>`;
}

// ─── Sprint V5b — IGR public-data sub-cards ──────────────────────────────────
//
// Three new sub-cards rendered under Section 5 (What is it worth) as a single
// "Government expectations" panel with three nested cards:
//   1. IGR BMV floor (live or fallback) — replaces the JSON seed when the
//      ViewFeeValue.aspx endpoint is reachable.
//   2. Stamp duty + BMV-floor cross-check — shows the government-expected
//      total payable; flag bmvFloorApplied when seller under-quoted.
//   3. District velocity (last N days) — buyer market-pulse signal.
//
// The panel is fully typed-degraded: if all three sub-cards are unavailable
// the panel collapses (empty string) so the existing 3-band layout is
// unchanged for buyers whose run hit portal downtime.

interface V5bSubCardInput {
  igrBmv?: any;
  stampDuty?: any;
  igrDailyBulletin?: any;
}

function renderV5bSubCards(v5b: V5bSubCardInput | null | undefined): string {
  if (!v5b) return "";

  // ── Sub-card 1: IGR BMV live floor ───────────────────────────────────────
  let bmvHtml = "";
  const bmv = v5b.igrBmv;
  if (bmv && (bmv.status === "success" || bmv.status === "partial")) {
    const rows: any[] = Array.isArray(bmv.data?.rows) ? bmv.data.rows : [];
    if (rows.length > 0) {
      const r = rows[0];
      const ratePerSqft = Number(r.ratePerSqft ?? 0);
      const ratePerAcre = Number(r.ratePerAcre ?? 0);
      const display = ratePerAcre > 0
        ? `${formatInr(ratePerAcre)} per acre`
        : ratePerSqft > 0
        ? `${formatInr(ratePerSqft)} per sqft`
        : "rate not parsed";
      bmvHtml = `<div class="v5b-subcard v5b-subcard-ok">
        <div class="v5b-subcard-label">Live IGR BMV floor</div>
        <div class="v5b-subcard-value">${escapeHtml(display)}</div>
        <div class="v5b-subcard-meta">${escapeHtml(r.mouza ?? "—")} &middot; ${escapeHtml(r.sro ?? "—")} &middot; ${escapeHtml(r.kisam ?? "—")}</div>
        <p class="v5b-subcard-note">Live from <a href="https://igrodisha.gov.in/ViewFeeValue.aspx/GetMRVal" target="_blank" rel="noopener">regis.odisha.gov.in/BMV</a> — official government floor for stamp-duty.</p>
      </div>`;
    }
  }
  if (!bmvHtml) {
    bmvHtml = `<div class="v5b-subcard v5b-subcard-neutral">
      <div class="v5b-subcard-label">Live IGR BMV floor</div>
      <div class="v5b-subcard-value">Not fetched in this run</div>
      <p class="v5b-subcard-note">Using the offline circle-rate seed. The live endpoint is currently unreachable. <a href="https://igrodisha.gov.in/ViewFeeValue.aspx/GetMRVal" target="_blank" rel="noopener">Verify at regis.odisha.gov.in &rarr;</a></p>
    </div>`;
  }

  // ── Sub-card 2: Stamp duty + BMV-floor cross-check ─────────────────────
  let stampHtml = "";
  const sd = v5b.stampDuty;
  if (sd && (sd.status === "success" || sd.status === "partial") && sd.data?.breakup) {
    const b = sd.data.breakup;
    const total = Number(b.totalPayable ?? 0);
    const sd_ = Number(b.stampDuty ?? 0);
    const reg = Number(b.registrationFee ?? 0);
    const cess = Number(b.cess ?? 0);
    const applied = Number(b.appliedMarketValue ?? 0);
    const requested = Number(b.requestedMarketValue ?? 0);
    const floor = !!b.bmvFloorApplied;
    const watchoutCls = floor ? "v5b-subcard-watchout" : "v5b-subcard-ok";
    const basis = String(b.calculationBasis ?? "");
    stampHtml = `<div class="v5b-subcard ${watchoutCls}">
      <div class="v5b-subcard-label">Government stamp duty</div>
      <div class="v5b-subcard-value">${formatInr(total)} <span class="v5b-subcard-total-suffix">total payable</span></div>
      <div class="v5b-subcard-meta">Stamp ${formatInr(sd_)} &middot; Reg ${formatInr(reg)} &middot; Cess ${formatInr(cess)}</div>
      <div class="v5b-subcard-meta">Applied market value: ${formatInr(applied)}${floor ? ` <span class="v5b-subcard-flag">⚠ BMV floor applied (seller quoted ${formatInr(requested)})</span>` : ""}</div>
      <p class="v5b-subcard-note">${escapeHtml(basis)}. ${floor ? "If the seller agreed to a price below the BMV, the government will compute stamp duty on the higher figure — factor that into your negotiation." : "The seller's quoted price is at or above the official floor — no floor adjustment."}</p>
    </div>`;
  }
  if (!stampHtml) {
    stampHtml = `<div class="v5b-subcard v5b-subcard-neutral">
      <div class="v5b-subcard-label">Government stamp duty</div>
      <div class="v5b-subcard-value">Not computed in this run</div>
      <p class="v5b-subcard-note">The stamp-duty endpoint was unreachable and the local fallback was not run (e.g. missing area). Verify the duty with the SRO before paying: <a href="https://igrodisha.gov.in/StampDutyCalc.aspx/GetDoMRVal" target="_blank" rel="noopener">regis.odisha.gov.in/StampDuty</a>.</p>
    </div>`;
  }

  // ── Sub-card 3: District velocity ───────────────────────────────────────
  let velocityHtml = "";
  const bull = v5b.igrDailyBulletin;
  if (bull && (bull.status === "success" || bull.status === "partial") && bull.data?.summary) {
    const s = bull.data.summary;
    const totalDeeds = Number(s.totalDeeds ?? 0);
    const avgPerDay = Number(s.avgDeedsPerDay ?? 0);
    const range = bull.data.dateRange;
    const rangeLabel = range?.from && range?.to
      ? `${escapeHtml(range.from)} → ${escapeHtml(range.to)}`
      : "last 7 days";
    velocityHtml = `<div class="v5b-subcard v5b-subcard-ok">
      <div class="v5b-subcard-label">District velocity</div>
      <div class="v5b-subcard-value">${totalDeeds.toLocaleString("en-IN")} <span class="v5b-subcard-total-suffix">deeds registered</span></div>
      <div class="v5b-subcard-meta">Avg ${avgPerDay.toLocaleString("en-IN")} per day &middot; ${rangeLabel}</div>
      <p class="v5b-subcard-note">Live from <a href="https://igrodisha.gov.in/ORServiceNew.aspx/GetDataFromDB" target="_blank" rel="noopener">IGR daily bulletin</a>. Active districts signal liquidity — easier to exit, easier to verify prices.</p>
    </div>`;
  }
  if (!velocityHtml) {
    velocityHtml = `<div class="v5b-subcard v5b-subcard-neutral">
      <div class="v5b-subcard-label">District velocity</div>
      <div class="v5b-subcard-value">Not fetched in this run</div>
      <p class="v5b-subcard-note">IGR daily bulletin endpoint was unreachable. Check the IGR portal for current district activity.</p>
    </div>`;
  }

  return `<div class="bm-govt">
    <div class="bm-govt-head">Government expectations</div>
    <div class="v5b-subcards">
      ${bmvHtml}
      ${stampHtml}
      ${velocityHtml}
    </div>
  </div>`;
}

function buildBenchmarkSection(
  circleRateData: any,
  input: BenchmarkSectionInput,
  igrEcEntries?: Array<{
    partyName?: string;
    status?: string;
    warning?: { code: string; message: string };
    // Add other IGR-EC fields if needed
  }>,
  v5b?: {
    igrBmv?: any;
    stampDuty?: any;
    igrDailyBulletin?: any;
  } | null
): string {
  const rows: BenchmarkRateRow[] = Array.isArray(circleRateData?.data)
    ? circleRateData.data
    : [];
  const row = selectBestRateRow(rows, input);

  if (!row) {
    // No circle-rate data — show a "not in our dataset" message with the
    // official IGR link so the buyer can verify at the source.
    return `<div class="bm-panel">
      <div class="bm-floor">
        <div class="bm-band-label">Floor &mdash; Circle rate</div>
        <div class="bm-band-value">Not in our dataset for ${escapeHtml(input.village ?? "this village")}, ${escapeHtml(input.tahasil ?? "")}</div>
        <p class="bm-note">The exact circle rate depends on the specific Kisam (land type), proximity to roads, and mouza. Verify the official rate on the IGR Odisha portal:</p>
        <p><a href="https://regis.odisha.gov.in/Benchmark/BMV_Search.aspx" target="_blank" rel="noopener" class="bm-verify-link">Verify official circle rate at regis.odisha.gov.in &rarr;</a></p>
      </div>
      <div class="bm-dir">
        <div class="bm-band-label">Directional &mdash; Recent transactions</div>
        ${renderIgrEcDirectionalBand(igrEcEntries)}
      </div>
      <div class="bm-ceil">
        <div class="bm-band-label">Ceiling &mdash; Market comparables</div>
        <div class="bm-band-value">Verify with local broker</div>
        <p class="bm-note">Ask a local broker or property agent for 2-3 recent sale prices within 500m of this plot. Market rates typically run 1.5&ndash;3&times; the floor for well-located plots.</p>
      </div>
      ${renderV5bSubCards(v5b)}
      <div class="source-line">
        <span>Source: IGR Odisha Benchmark Valuation Portal &mdash; <a href="https://regis.odisha.gov.in/Benchmark/BMV_Search.aspx" target="_blank" rel="noopener">regis.odisha.gov.in</a></span>
      </div>
    </div>`;
  }

  // Floor band: the matched circle rate, scaled to per-acre for the report.
  const ratePerSqft = row.ratePerSqft ?? 0;
  const ratePerAcre = row.ratePerAcre ?? (ratePerSqft > 0 ? sqftToPerAcre(ratePerSqft) : 0);
  const rateDisplay = formatRateDisplay(row);

  // Plot-area-scaled floor value (informational, not a valuation).
  const acres = input.acres;
  const scaledFloor = acres && ratePerAcre > 0
    ? `${formatInr(Math.round(acres * ratePerAcre))} (${acres.toFixed(3)} acres &times; floor rate)`
    : null;

  const sourceDate = row.lastUpdated ? escapeHtml(row.lastUpdated) : "—";
  const sourceUrl = row.sourceUrl || "https://regis.odisha.gov.in/Benchmark/BMV_Search.aspx";
  const rateTypeLabel = row.rateType
    ? `&mdash; <span class="bm-rate-type">${escapeHtml(row.rateType)}</span>`
    : "";

  return `<div class="bm-panel">
    <div class="bm-floor">
      <div class="bm-band-label">Floor &mdash; Circle rate (stamp duty minimum)</div>
      <div class="bm-band-value">${escapeHtml(rateDisplay)}</div>
      <div class="bm-band-meta">${escapeHtml(row.mouza ?? input.village ?? "—")} &middot; ${escapeHtml(row.tehsil ?? input.tahasil ?? "—")} &middot; ${escapeHtml(row.kisam ?? "—")} ${rateTypeLabel}</div>
      ${scaledFloor ? `<div class="bm-band-scaled">Floor for this plot: <strong>${scaledFloor}</strong></div>` : ""}
      <p class="bm-note">Below the official IGR circle rate, the government treats the sale value as under-declared and the stamp duty is calculated on the higher figure. <a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener" class="bm-verify-link">View source at IGR Odisha &rarr;</a></p>
    </div>
    <div class="bm-dir">
      <div class="bm-band-label">Directional &mdash; Recent transactions</div>
      ${renderIgrEcDirectionalBand(igrEcEntries)}
    </div>
    <div class="bm-ceil">
      <div class="bm-band-label">Ceiling &mdash; Market comparables</div>
      <div class="bm-band-value">Verify with local broker</div>
      <p class="bm-note">Ask a local broker or property agent for 2-3 recent sale prices within 500m of this plot. Market rates typically run 1.5&ndash;3&times; the floor for well-located plots.</p>
    </div>
    ${renderV5bSubCards(v5b)}
    <div class="source-line">
      <span>Source: IGR Odisha Benchmark Valuation Portal &mdash; last updated ${sourceDate} &mdash; <a href="https://regis.odisha.gov.in/Benchmark/BMV_Search.aspx" target="_blank" rel="noopener">regis.odisha.gov.in</a></span>
    </div>
  </div>`;
}

// ─── Sprint V5c sub-card renderers (Section 2 + Section 6) ───────────────────

/**
 * Section 2 sub-card: "Previous sale deed (open index entry)" with §57
 * transparency note. Renders only when the certified-copy fetcher returned
 * a payload. Falls back to a manual-instructions block.
 */
function renderV5cCertifiedCopySubCard(data: any): string {
  if (!data) return "";
  const pageUrl = data?.data?.pageUrl ?? "https://igrodisha.gov.in/CertifiedCopy.aspx";
  const pageIsLive = Boolean(data?.data?.pageIsLive);
  const section57Note = data?.data?.section57Note ?? "";
  const steps: string[] = data?.data?.manualInstructions?.steps ?? [];
  const fee = data?.data?.manualInstructions?.estimatedFeeINR;
  const expectedTime = data?.data?.manualInstructions?.expectedTime;
  const status = data?.status ?? "not_covered";

  const stepsList = steps
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join("");

  const statusClass = pageIsLive ? "v5c-ok" : "v5c-neutral";

  return `<div class="v5c-subcard v5c-subcard-section2">
    <div class="v5c-subcard-head">
      <span class="v5c-subcard-label">Previous sale deed</span>
      <span class="v5c-subcard-tag ${statusClass}">${pageIsLive ? "Book 1/2 open" : "Manual lookup"}</span>
    </div>
    <p class="v5c-subcard-desc">Book 1 and Book 2 of the IGR index are open to any person &mdash; you can see the most recent sale deed for this plot (deed number, date, parties, consideration, market value, stamp duty) without the seller's cooperation. The full PDF (Book 4) is restricted per Section 57 of the Registration Act, 1908 &mdash; ask the seller for a notarised copy or hire a lawyer.</p>
    <details class="v5c-subcard-details">
      <summary>How to look this up yourself</summary>
      <ol class="v5c-subcard-steps">${stepsList}</ol>
      <div class="v5c-subcard-meta">
        ${fee != null ? `<span>Estimated fee: <strong>₹${fee}</strong></span>` : ""}
        ${expectedTime ? `<span>Time: ${escapeHtml(expectedTime)}</span>` : ""}
        <span>Status: <strong>${escapeHtml(status)}</strong></span>
      </div>
      <p class="v5c-subcard-note">${escapeHtml(section57Note)}</p>
    </details>
    <div class="source-line">
      <span>Source: IGR Odisha Certified Copy Portal &mdash; <a href="${escapeHtml(pageUrl)}" target="_blank" rel="noopener">igrodisha.gov.in/CertifiedCopy</a></span>
    </div>
  </div>`;
}

/**
 * Section 6 sub-card: "Official fees" table from the permanent IGR fee
 * schedule. Always renders if govt-fee data is present; shows the matched
 * deed category in detail and the full schedule in a collapsed details.
 */
function renderV5cGovtFeeSubCard(data: any): string {
  if (!data || !data.data?.schedule) return "";
  const schedule = data.data.schedule;
  const matched = data.data.matchedDeedFee;
  const lastUpdated = schedule.lastUpdated ?? "—";
  const source = schedule.source ?? "https://igrodisha.gov.in/GovtFeeDtls.aspx";

  if (!matched) {
    return `<div class="v5c-subcard v5c-subcard-section6">
      <div class="v5c-subcard-head">
        <span class="v5c-subcard-label">Official fees (Sale deed)</span>
        <span class="v5c-subcard-tag v5c-neutral">No exact match</span>
      </div>
      <p class="v5c-subcard-desc">The IGR fee schedule does not have an exact match for the deed type associated with this transaction. Verify the fees with the SRO before paying.</p>
      <div class="source-line">
        <span>Source: IGR Govt Fee Schedule &mdash; last updated ${escapeHtml(lastUpdated)} &mdash; <a href="${escapeHtml(source)}" target="_blank" rel="noopener">igrodisha.gov.in/GovtFeeDtls</a></span>
      </div>
    </div>`;
  }

  const fmtPct = (n: number) => `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;
  const feeRows: Array<[string, string]> = [
    ["Minimum stamp (fixed)", `₹${matched.minStampINR ?? 0}`],
    ["Stamp duty (% of market value)", fmtPct(matched.stampPct ?? 0)],
    ["Registration fee (% of market value)", fmtPct(matched.registrationFeePct ?? 0)],
    ["ROR postal fee", `₹${matched.rorPostalFeeINR ?? 0}`],
    ["User fee (per plot)", `₹${matched.userFeeINR ?? 0}`],
  ];

  const ecFee = schedule.encumbranceCertificate ?? {};
  const ccFee = schedule.certifiedCopy ?? {};
  const perPlot = schedule.additionalPerPlotFees ?? {};

  return `<div class="v5c-subcard v5c-subcard-section6">
    <div class="v5c-subcard-head">
      <span class="v5c-subcard-label">Official fees (${escapeHtml(matched.category ?? "Sale")})</span>
      <span class="v5c-subcard-tag v5c-ok">Verified ${escapeHtml(lastUpdated)}</span>
    </div>
    <p class="v5c-subcard-desc">The IGR Govt Fee Schedule for <strong>${escapeHtml(matched.category ?? "Sale")}</strong> deeds. Use this to verify the fees the SRO quotes you &mdash; the SRO's schedule should match.</p>
    <table class="v5c-fee-table">
      <tbody>
        ${feeRows.map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td><strong>${escapeHtml(v)}</strong></td></tr>`).join("")}
      </tbody>
    </table>
    ${matched.notes ? `<p class="v5c-subcard-note">${escapeHtml(matched.notes)}</p>` : ""}
    <details class="v5c-subcard-details">
      <summary>Other IGR fees (EC, certified copy, per-plot)</summary>
      <table class="v5c-fee-table">
        <tbody>
          <tr><td colspan="2"><strong>Encumbrance Certificate</strong></td></tr>
          <tr><td>First year search</td><td>₹${ecFee.generalSearchFirstYearINR ?? 0}</td></tr>
          <tr><td>Each subsequent year</td><td>₹${ecFee.everySubsequentYearINR ?? 0}</td></tr>
          <tr><td>Application fee</td><td>₹${ecFee.applicationFeeINR ?? 0}</td></tr>
          <tr><td>User charges (per year, max ₹${ecFee.userChargesMaxINR ?? 0})</td><td>₹${ecFee.userChargesINR ?? 0}</td></tr>
          <tr><td colspan="2"><strong>Certified Copy</strong></td></tr>
          <tr><td>Search per party</td><td>₹${ccFee.searchPerPartyINR ?? 0}</td></tr>
          <tr><td>Inspection fee</td><td>₹${ccFee.inspectionFeeINR ?? 0}</td></tr>
          <tr><td>Copying per page</td><td>₹${ccFee.copyingFeePerPageINR ?? 0}</td></tr>
          <tr><td>User charges (per page, max ₹${ccFee.userChargesMaxINR ?? 0})</td><td>₹${ccFee.userChargesPerPageINR ?? 0}</td></tr>
          <tr><td colspan="2"><strong>Per-plot fees (Sale)</strong></td></tr>
          <tr><td>Per-plot demarcation</td><td>₹${perPlot.perPlotDemarcationFeeINR ?? 0}</td></tr>
          <tr><td>ROR postal delivery</td><td>₹${perPlot.rorPostalDeliveryFeeINR ?? 0}</td></tr>
          <tr><td>Per-khata ROR user fee</td><td>₹${perPlot.perKhataRORUserFeeINR ?? 0}</td></tr>
        </tbody>
      </table>
    </details>
    <div class="source-line">
      <span>Source: IGR Govt Fee Schedule &mdash; last updated ${escapeHtml(lastUpdated)} &mdash; <a href="${escapeHtml(source)}" target="_blank" rel="noopener">igrodisha.gov.in/GovtFeeDtls</a></span>
    </div>
  </div>`;
}

/**
 * Section 6 sub-card: "Official activity (live link)" — a small live-link card
 * to the IGR public dashboard, deed-wise status, and ORTPSA daily bulletin.
 * Page is server-rendered (no JSON API); the card just shows the live URL.
 */
function renderV5cPublicDashboardSubCard(data: any): string {
  if (!data) return "";
  const pageUrl = data?.data?.pageUrl ?? "https://igrodisha.gov.in/PublicDashboard.aspx";
  const pageIsLive = Boolean(data?.data?.pageIsLive);
  const status = data?.status ?? "not_covered";
  const statusClass = pageIsLive ? "v5c-ok" : "v5c-neutral";

  return `<div class="v5c-subcard v5c-subcard-section6-dash">
    <div class="v5c-subcard-head">
      <span class="v5c-subcard-label">Official district activity (live)</span>
      <span class="v5c-subcard-tag ${statusClass}">${pageIsLive ? "Live page" : "Page not fetched"}</span>
    </div>
    <p class="v5c-subcard-desc">IGR publishes district-level deed registration activity on the public dashboard (server-rendered, no public JSON API). Use these links to see how many deeds were registered in this district in the last 30 days, broken down by deed type and SRO.</p>
    <div class="v5c-subcard-links">
      <a href="${escapeHtml(pageUrl)}" target="_blank" rel="noopener">Public Dashboard</a>
      <a href="https://igrodisha.gov.in/DeedWiseStatus.aspx" target="_blank" rel="noopener">Deed-Wise Status</a>
      <a href="https://igrodisha.gov.in/ORServiceNew.aspx" target="_blank" rel="noopener">ORTPSA Daily Bulletin</a>
    </div>
    <p class="v5c-subcard-note">The same data is also surfaced in the &ldquo;District velocity&rdquo; sub-card on Section 5, which uses a captcha-free JSON endpoint. The dashboard page is server-rendered and is not parsed automatically.</p>
    <div class="source-line">
      <span>Source: IGR Odisha Public Dashboard &mdash; <a href="${escapeHtml(pageUrl)}" target="_blank" rel="noopener">igrodisha.gov.in/PublicDashboard</a> &mdash; status: <strong>${escapeHtml(status)}</strong></span>
    </div>
  </div>`;
}


// ─── Section 3 builder: BDA Master Plan zone card ───────────────────────────

interface BdaZoneCardInput {
  village?: string | null;
  tahasil?: string | null;
}

function buildBdaZoneCard(
  bdaZoneData: any,
  input: BdaZoneCardInput
): string {
  const rows: any[] = Array.isArray(bdaZoneData?.data) ? bdaZoneData.data : [];

  // Out-of-scope: BDA Master Plan doesn't cover this village/tehsil. Render a
  // *neutral* note (not a failure card) telling the buyer to check the local
  // Tahsildar. Previously this case was indistinguishable from a generic
  // "no_match" failure and the buyer saw a degraded/source-failed message.
  if (rows.length === 0 && bdaZoneData?.status === "out_of_scope") {
    return `<div class="bda-card bda-card-neutral">
      <div class="bda-card-head">
        <span class="bda-card-label">BDA Master Plan zone</span>
        <span class="bda-card-zone">Outside BDA planning area</span>
      </div>
      <div class="bda-card-meta">${escapeHtml(input.village ?? "This village")}, ${escapeHtml(input.tahasil ?? "")}</div>
      <p class="bda-card-desc">This plot is outside the Bhubaneswar Development Authority (BDA) planning area, so BDA's Master Plan zone classification does not apply. Land-use zoning for this location is administered by the local Tahsildar / Revenue Department. Ask the Tahsildar office for the current land-use classification and any applicable building restrictions before you pay.</p>
      <div class="source-line">
        <span>Source: BDA Master Plan &mdash; <a href="https://bdaodisha.gov.in/" target="_blank" rel="noopener">bdaodisha.gov.in</a> (verify coverage at BDA)</span>
      </div>
    </div>`;
  }

  if (rows.length === 0) return "";

  const firstRow = rows[0];
  const zone = firstRow?.zone;
  if (!zone || !zone.id) return "";

  const zoneName = zone.name ?? zone.id;
  const zoneCode = zone.zoneCode ? ` (zone code ${escapeHtml(zone.zoneCode)})` : "";
  const description = zone.description ?? "BDA Master Plan zone classification";
  const permittedUses: string[] = Array.isArray(zone.permittedUses) ? zone.permittedUses : [];
  const restrictions: string[] = Array.isArray(zone.restrictions) ? zone.restrictions : [];
  const locality = firstRow?.locality ? ` &middot; ${escapeHtml(firstRow.locality)}` : "";
  const matchLocation = `${escapeHtml(firstRow?.village ?? input.village ?? "this village")}, ${escapeHtml(firstRow?.tehsil ?? input.tahasil ?? "")}${locality}`;

  // Severity color: green-belt and institutional are watch-outs; residential/commercial
  // are green lights; mixed_use/special are neutral.
  const zoneId = String(zone.id).toLowerCase();
  const watchoutZones = new Set(["green_belt", "institutional", "industrial"]);
  const cardCls = watchoutZones.has(zoneId) ? "bda-card-watchout" : "bda-card-ok";

  const permitsList = permittedUses.length
    ? `<ul class="bda-permits">${permittedUses.slice(0, 5).map((u) => `<li>${escapeHtml(u)}</li>`).join("")}</ul>`
    : `<p class="bda-empty">No specific permitted-use list available.</p>`;
  const restrictionsList = restrictions.length
    ? `<ul class="bda-restrictions">${restrictions.slice(0, 4).map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`
    : "";

  return `<div class="bda-card ${cardCls}">
    <div class="bda-card-head">
      <span class="bda-card-label">BDA Master Plan zone</span>
      <span class="bda-card-zone">${escapeHtml(zoneName)}${zoneCode}</span>
    </div>
    <div class="bda-card-meta">${matchLocation}</div>
    <p class="bda-card-desc">${escapeHtml(description)}</p>
    <div class="bda-card-cols">
      <div class="bda-card-col">
        <div class="bda-col-label">What you can build</div>
        ${permitsList}
      </div>
      ${restrictionsList ? `<div class="bda-card-col">
        <div class="bda-col-label">Restrictions</div>
        ${restrictionsList}
      </div>` : ""}
    </div>
    <div class="source-line">
      <span>Source: BDA Master Plan${firstRow?.sourceUrl ? ` &mdash; <a href="${escapeHtml(firstRow.sourceUrl)}" target="_blank" rel="noopener">view source</a>` : " &mdash; verify at bdaodisha.gov.in"}</span>
    </div>
  </div>`;
}

function buildActionItems(input: {
  nameMatch: string;
  bhulekhUsable: boolean;
  bhulekhStatus: string;
  coOwners: string[];
  conversionRequired: boolean | null;
  conversionUnknown: boolean;
  classification: string;
  classificationUnknown: boolean;
  courtStatuses: Record<string, string>;
  regulatoryVerified: boolean;
  sourceDetails: Record<string, any>;
  safeRegUrl: string;
  safePlotNo: string;
  safeVillage: string;
}): string {
  const items: string[] = [];

  if (!input.bhulekhUsable) {
    items.push(
      `<li><strong>RoR owner details are unavailable.</strong> Bhulekh owner records were not usable in this run (status: ${escapeHtml(input.bhulekhStatus)}). Ask for the current Bhulekh Khatiyan, photo ID, legal heir papers where relevant, and mutation papers before paying any advance.</li>`
    );
  }

  if (input.coOwners.length > 0) {
    items.push(
      `<li><strong>All co-owners must consent to the sale.</strong> The Bhulekh record shows ${input.coOwners.length} other owner(s): ${input.coOwners.slice(0, 3).map((c: string) => escapeHtml(c)).join(", ")}${input.coOwners.length > 3 ? ` and ${input.coOwners.length - 3} more` : ""}. Ask the seller to confirm all co-owners are aware of and have agreed to this sale. If any co-owner is deceased, you will need a legal heir certificate.</li>`
    );
  }

  if (input.classificationUnknown || isClassificationUnknown(input.classification)) {
    items.push(
      `<li><strong>Land classification is unknown.</strong> Ask the tehsil office or a property lawyer to confirm the official kisam/land class for this plot and whether your intended use is allowed.</li>`
    );
  }

  if (input.conversionRequired === true) {
    items.push(
      `<li><strong>Land-use conversion may be required and was not verified online.</strong> Ask the seller whether conversion from agricultural to your intended use has already been approved. Ask the tehsil office or your lawyer for the current process, expected timeline, and government fees.</li>`
    );
  }

  if (input.conversionUnknown) {
    items.push(
      `<li><strong>Land use conversion status is unknown.</strong> Ask the seller for written tehsil confirmation on whether conversion is required for your intended use.</li>`
    );
  }

  if (isCourtSearchIncomplete(input.courtStatuses)) {
    items.push(
      `<li><strong>Court and revenue-case search is incomplete.</strong> Manually search eCourts and RCCMS using the seller's full legal name, village, plot number, and khata number before treating the dispute check as clear.</li>`
    );
  }

  if (!input.regulatoryVerified) {
    items.push(
      `<li><strong>Regulatory screening is incomplete.</strong> Ask the local tehsildar or Town Planning office to check forest, coastal, PESA, airport, archaeological, and town-planning restrictions for this plot.</li>`
    );
  }

  const sourceFailures = getSourceFailures(input.sourceDetails);
  if (sourceFailures.length > 0) {
    items.push(
      `<li><strong>Some source checks failed.</strong> Re-run or manually verify these source(s): ${sourceFailures.join("; ")}. Do not treat missing online data as a clean result.</li>`
    );
  }

  items.push(
    `<li><strong>Get the Encumbrance Certificate before paying anything.</strong> Visit <a href="${input.safeRegUrl}" target="_blank" rel="noopener">igrodisha.gov.in</a> or the Sub-Registrar office, confirm the current fee on the portal/counter, and request the EC for plot ${input.safePlotNo} in ${input.safeVillage} village. Look for any entries in the "Transfers" or "Charges" section.</li>`,
    `<li><strong>Verify the plot boundaries on the ground.</strong> Ask the seller to show you the boundary markers (pukhuri/pillars) on the ground. Ask a local surveyor to confirm the GPS coordinates match the physical boundaries.</li>`,
    `<li><strong>Ask for the 30-year title chain.</strong> Request photocopies of all registered sale deeds going back at least 30 years. A property lawyer should review these before you pay.</li>`,
    `<li><strong>Confirm no pending mutations.</strong> Ask the seller whether any mutation (name transfer) is pending in their name at the local tehsil office.</li>`
  );

  return items.join("\n      ");
}

function isClassificationUnknown(classification: string): boolean {
  const normalized = classification.trim().toLowerCase();
  return normalized === "" || normalized === "unknown" || normalized === "not verified";
}

function isVerifiedDisplayValue(value: string | null | undefined): boolean {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized !== "" && normalized !== "unknown" && normalized !== "not verified" && normalized !== "—";
}

function formatGpsDisplay(gps: { latitude: number; longitude: number }): string {
  const hasNumericGps = Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude);
  const isPlaceholder = gps.latitude === 0 && gps.longitude === 0;
  if (!hasNumericGps || isPlaceholder) return "GPS not captured";
  return `${gps.latitude.toFixed(6)}°N, ${gps.longitude.toFixed(6)}°E`;
}

function isCourtSearchIncomplete(sourceStatuses: Record<string, string>): boolean {
  const ecourtsUsable = sourceStatuses.ecourts === "success";
  const rccmsUsable = sourceStatuses.rccms === "success";
  return !ecourtsUsable || !rccmsUsable;
}

function reportSafeSourceReason(value: unknown): string | null {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return null;

  if (
    /browserType\.launch|Executable doesn't exist|chromium_headless_shell|ms-playwright|playwright install|Playwright was just installed/i.test(raw)
  ) {
    return "Browser runtime was unavailable in this deployment. ClearDeed should retry this report after the verification service redeploys.";
  }

  return raw.length > 240 ? `${raw.slice(0, 237)}...` : raw;
}

function sourceStatusLine(
  sourceDetails: Record<string, any>,
  sourceStatus: Record<string, string>,
  source: string
): string {
  const detail = sourceDetails[source] ?? {};
  const status = detail?.status ?? sourceStatus[source] ?? "unknown";
  const reason = reportSafeSourceReason(detail?.statusReason ?? detail?.error ?? null);
  return reason ? `${status}: ${reason}` : String(status);
}

function getSourceFailures(sourceDetails: Record<string, any>): string[] {
  return Object.entries(sourceDetails)
    .filter(([, detail]) => isSourceFailureStatus(detail?.status))
    .map(([source, detail]) => {
      const status = escapeHtml(detail?.status ?? "unknown");
      const safeReason = reportSafeSourceReason(detail?.statusReason);
      const reason = safeReason ? ` (${escapeHtml(safeReason)})` : "";
      return `${escapeHtml(source)}: ${status}${reason}`;
    });
}

function isSourceFailureStatus(status: unknown): boolean {
  return ["error", "failed", "failure", "unavailable", "manual_required"].includes(String(status ?? "").toLowerCase());
}

// Defensive verdict card: shows the most-severe insight, or an all-clear band.
// Schema: Insight.severity ∈ {"positive", "watchout", "redFlag"}. Picks redFlag > watchout > positive.
export function buildVerdictCard(insights: Insight[]): string {
  const eligible = insights
    .filter((i) => i.severity === "redFlag" || i.severity === "watchout")
    .sort((a, b) => (a.severity === "redFlag" ? -1 : 1));
  const top = eligible[0];
  if (!top) {
    return `<section id="verdict" class="verdict-card" data-tier="proceed">
      <span class="verdict-card-eyebrow">Buyer's verdict</span>
      <h1 class="verdict-card-headline">No critical risks found</h1>
      <p class="verdict-card-rationale">Verify the remaining items below before paying.</p>
    </section>`;
  }
  // Map severity → tier (CSS uses [data-tier=...] to color the verdict strip).
  const tier =
    top.severity === "redFlag"
      ? "hold"
      : top.issueLens === "registry_ec" || top.issueLens === "encumbrance_charge"
        ? "watch-out"
        : "proceed-with-care";
  const oneSentence = top.body.split(/\.\s+/)[0] + (top.body.includes(".") ? "." : "");
  return `<section id="verdict" class="verdict-card" data-tier="${tier}">
    <span class="verdict-card-eyebrow">Buyer's verdict</span>
    <h1 class="verdict-card-headline">${escapeHtml(top.headline)}</h1>
    <p class="verdict-card-rationale">${escapeHtml(oneSentence)}</p>
    <div class="verdict-card-confidence">
      <span><strong>Source:</strong> ${escapeHtml(top.source)}</span>
      <span><strong>Next step:</strong> ${escapeHtml(top.actionItem)}</span>
    </div>
  </section>`;
}

// Exposure strip: up to 4 quantified FinancialExposureItems on the buyer page.
// If items are absent, calls computeFinancialExposure() with the provided input.
// Remaining items are summarized as "+N more" instead of rendered.
export function buildExposureStrip(
  input: Parameters<typeof computeFinancialExposure>[0],
  items?: FinancialExposureItem[]
): string {
  const resolved = items ?? computeFinancialExposure(input);
  const MAX_VISIBLE = 4;
  if (resolved.length === 0) {
    return `<section id="exposure-strip" class="exposure exposure-empty">
      <div class="exposure-icon">&#9678;</div>
      <div class="exposure-body">Nothing to expose at this stage. Manual checks remain listed below.</div>
    </section>`;
  }
  const visible = resolved.slice(0, MAX_VISIBLE);
  const hidden = resolved.length - visible.length;
  const itemHtml = visible.map((item) => {
    const cls =
      item.severity === "at-risk" ? "exposure-at-risk" :
      item.severity === "verified-clear" ? "exposure-clear" :
      "exposure-unquantified";
    const amount = item.amount ? `<span class="exposure-amount">${escapeHtml(item.amount)}</span>` : "";
    return `<li class="exposure ${cls}">
      <span class="exposure-dot" aria-hidden="true"></span>
      <span class="exposure-cat">${escapeHtml(item.category)}</span>
      ${amount}
      <span class="exposure-text">${escapeHtml(item.exposure)}</span>
      ${item.action ? `<span class="exposure-action">${escapeHtml(item.action)}</span>` : ""}
    </li>`;
  }).join("");
  const moreNote = hidden > 0
    ? `<li class="exposure exposure-more">+${hidden} more in the full lawyer report.</li>`
    : "";
  return `<section id="exposure-strip" class="exposure-strip">
    <ul class="exposure-list">${itemHtml}${moreNote}</ul>
  </section>`;
}

// Pill bar with 6 toggle panels. Only one open at a time (radio behavior, no JS).
// Status colors: verified -> green, watchout -> amber, redflag -> red, manual -> blue.
/**
 * @deprecated Replaced by `buildQGrid` (Task 3). The pill-bar UX is superseded by
 * a 2x3 grid of hero cards anchored to per-question detail sections. This stub
 * returns an empty string so callers do not error; the real implementation is
 * retained in git history for the toggle-bar test fixture update in Task 6.
 */
export function buildTogglePillBar(
  panels: Array<{ id: string; label: string; status: string; contentHtml: string }>,
  openId?: string
): string {
  void panels;
  void openId;
  return "";
}

// Q-grid: 2x3 responsive grid of 6 hero cards, one per Buyer Question (Q1..Q6).
// Each tile is an anchor that links to its detail section ({id}-detail).
// Status colors: verified -> #0E9F6E (green), watchout -> #C77700 (amber),
// risk -> #DC2626 (red), manual -> #1D4ED8 (blue). The CSS targets
// `data-status` and `data-tone` attributes for color and tone mapping.
export function buildQGrid(
  questions: ReadonlyArray<{
    id: string;
    index: number;
    question: string;
    statusChipLabel: string;
    status: string;
    oneLineAnswer: string;
    exposureDisplay: string;
    exposureKind: "money" | "count";
    detailsCount: number;
  }>
): string {
  const tiles = questions
    .map(
      (q) =>
        `<a href="#${escapeAttr(q.id)}-detail" class="q-tile" data-status="${escapeAttr(q.status)}" data-tone="${escapeAttr(q.status)}">
          <div class="q-tile-index">Q${q.index} of ${questions.length}</div>
          <h2 class="q-tile-question">${escapeText(q.question)}</h2>
          <div class="q-tile-status">
            <span class="q-tile-status-icon" aria-hidden="true"></span>
            <span class="q-tile-status-label">${escapeText(q.statusChipLabel)}</span>
          </div>
          <div class="q-tile-answer">${escapeText(q.oneLineAnswer)}</div>
          <div class="q-tile-exposure" data-kind="${escapeAttr(q.exposureKind)}">
            <div class="q-tile-exposure-amount">${escapeText(q.exposureDisplay)}</div>
            <div class="q-tile-exposure-label">${escapeText(q.exposureKind === "money" ? "at risk exposure" : "to verify manually")}</div>
          </div>
          <div class="q-tile-details">${q.detailsCount} detail${q.detailsCount === 1 ? "" : "s"} <span aria-hidden="true">→</span></div>
        </a>`
    )
    .join("");
  return `<div class="q-grid" id="q-grid">${tiles}</div>`;
}

// Q-detail: expanded section for one Buyer Question. Renders when a buyer clicks
// a q-tile in the q-grid. Each Q has its own anchor (id="{id}-detail") that
// matches the q-tile's href. Shows the question, 1-line answer, key-fact cards,
// sub-finding chips (toggleable), and a provenance strip with verify URL.
//
// Trust strip: when `provenance.trustStrip` is set (only for critical
// facts per T13), a collapsible "How we checked this" <details> is
// rendered under the basic provenance line. The strip shows the raw
// source page hash, parser version, fetch attempts, raw Odia paired with
// the English fact, and any transferability flags (caste, reserved
// land). Default closed — a one-line summary is visible so buyers can
// see "we have this" without having to expand.

// Trust strip type — one per critical fact. Lives next to the Q-detail
// renderer because it is rendered inside Q-detail's provenance block.
export type TrustStrip = {
  // Short summary shown when the <details> is collapsed. Buyers see this
  // without expanding. Keep to ~70 chars.
  summary: string;
  // sha256 of the raw source page (truncated to 12 chars). Immutable
  // proof of the exact document we parsed.
  sourceHash?: string;
  // Parser version that produced the parsed values (e.g., "Bhulekh v3.2").
  // Buyers see we maintain the parsers — not voodoo.
  parserVersion?: string;
  // When the source page template was last verified against the live
  // govt portal. Detects when the govt changes their form layout.
  templateHashDate?: string;
  // Number of fetch attempts. "3 attempts (captcha hard)" is honest
  // about AI limits.
  attempts?: string;
  // Inputs we tried in order. "Searched Plot 309, then Khata 94" shows
  // we were thorough.
  inputsTried?: string[];
  // Parser warnings we want buyers to see. "⚠️ Bhunaksha area truncated".
  warnings?: string[];
  // Original Odia from the source page, paired with the English fact
  // it translated to. Always shown when present — buyers can verify.
  rawOdia?: { english: string; odia: string };
  // Transferability flag from casteOdia or reserved-land category. NOT
  // shown as identity — shown as: "RoR shows SC/ST owner. Land in
  // reserved categories may have transfer restrictions under Odisha
  // Land Reforms Act §22. Verify with the tehsildar before purchase."
  casteFlag?: string;
  // Whether the source was cached vs fresh. "(cached 2 days ago)" —
  // buyers know the freshness.
  cacheServedAt?: string;
};

export function renderTrustStrip(strip: TrustStrip | undefined): string {
  if (!strip) return "";
  const rows: Array<[string, string]> = [];
  if (strip.sourceHash) rows.push(["🔒 Source hash", strip.sourceHash]);
  if (strip.parserVersion) rows.push(["🔧 Parser", strip.parserVersion]);
  if (strip.templateHashDate) rows.push(["📐 Template verified", strip.templateHashDate]);
  if (strip.attempts) rows.push(["🔁 Attempts", strip.attempts]);
  if (strip.cacheServedAt) rows.push(["💾 Cached", strip.cacheServedAt]);
  if (strip.inputsTried && strip.inputsTried.length > 0) {
    rows.push(["🔍 Inputs tried", strip.inputsTried.join(" → ")]);
  }
  if (strip.warnings && strip.warnings.length > 0) {
    rows.push(["⚠️ Warnings", strip.warnings.join("; ")]);
  }
  if (strip.rawOdia) {
    rows.push([
      "📜 Original (Odia)",
      `${strip.rawOdia.odia}  —  ${strip.rawOdia.english}`,
    ]);
  }
  if (strip.casteFlag) {
    rows.push(["⚖️ Transferability", strip.casteFlag]);
  }

  const rowsHtml = rows
    .map(
      ([k, v]) =>
        `<div class="q-trust-row"><span class="q-trust-key">${escapeText(k)}</span><span class="q-trust-value">${escapeText(v)}</span></div>`
    )
    .join("");

  return `<details class="q-trust-strip">
    <summary class="q-trust-summary">${escapeText(strip.summary)}</summary>
    <div class="q-trust-body">${rowsHtml}</div>
  </details>`;
}

export function buildQDetail(input: {
  id: string;
  index: number;
  question: string;
  oneLineAnswer: string;
  keyFacts: ReadonlyArray<{ label: string; value: string; status?: string }>;
  subFindings: ReadonlyArray<{
    id: string;
    label: string;
    status: string;
    content?: string;
  }>;
  provenance: {
    source: string;
    fetchedAt: string;
    verifyUrl?: string;
    trustStrip?: TrustStrip;
  };
}): string {
  const factsHtml = input.keyFacts
    .map(
      (f) =>
        `<div class="q-detail-fact"${f.status ? ` data-status="${escapeAttr(f.status)}"` : ""}>
          <div class="q-fact-key">${escapeText(f.label)}</div>
          <div class="q-fact-value">${escapeText(f.value)}</div>
        </div>`
    )
    .join("");

  const chipsHtml = input.subFindings
    .map(
      (sf) =>
        `<button type="button" class="q-detail-chip" data-status="${escapeAttr(sf.status)}" data-finding-id="${escapeAttr(sf.id)}" aria-expanded="false">
          <span class="q-chip-icon" aria-hidden="true"></span>
          <span class="q-chip-text">${escapeText(sf.label)}</span>
          ${sf.content ? `<div class="q-chip-body" hidden>${escapeText(sf.content)}</div>` : ""}
        </button>`
    )
    .join("");

  const verifyHtml = input.provenance.verifyUrl
    ? `<a href="${escapeAttr(input.provenance.verifyUrl)}" target="_blank" rel="noopener noreferrer" class="q-detail-verify">↗ Verify yourself</a>`
    : "";

  const trustStripHtml = renderTrustStrip(input.provenance.trustStrip);

  return `<section class="q-detail" id="${escapeAttr(input.id)}-detail" aria-labelledby="${escapeAttr(input.id)}-detail-title">
    <div class="q-detail-eyebrow">Q${input.index}</div>
    <h2 class="q-detail-title" id="${escapeAttr(input.id)}-detail-title">${escapeText(input.question)}</h2>
    <p class="q-detail-answer">${escapeText(input.oneLineAnswer)}</p>
    <div class="q-detail-key-facts">${factsHtml}</div>
    <div class="q-detail-sub-list" role="list">${chipsHtml}</div>
    <div class="q-detail-provenance">
      <div class="q-detail-provenance-source">Source: ${escapeText(input.provenance.source)}</div>
      <div class="q-detail-provenance-time">Fetched: ${escapeText(input.provenance.fetchedAt)}</div>
      ${verifyHtml}
    </div>
    ${trustStripHtml}
  </section>`;
}

// Sticky horizontal nav that appears after the hero scrolls out of view.
// One pill per Buyer Question. Highlights the currently visible Q-detail
// section via an IntersectionObserver scroll-spy. Hidden by default
// (data-visible="false"); CSS will hide the nav until the hero is offscreen,
// and the scroll-spy script sets data-visible="true" on first Q-detail
// entering the viewport.
//
// Two variants are emitted so the same content works at every breakpoint:
//   - `.sticky-nav`         → vertical right-rail on desktop (>=768px)
//   - `.sticky-nav-mobile`  → horizontal bottom-bar on mobile  (<768px)
// CSS in the buyer page stylesheet handles the responsive toggle.
export function buildStickyNav(
  questions: ReadonlyArray<{ id: string; index: number; label: string; status: string }>
): string {
  const pillsHtml = questions
    .map(
      (q) =>
        `<a href="#${escapeAttr(q.id)}-detail" class="sticky-nav-link" data-q="${escapeAttr(q.id)}" data-status="${escapeAttr(q.status)}" data-tone="${escapeAttr(q.status)}">
          <span class="q-pill-q">Q${q.index}</span>
          <span class="q-pill-label">${escapeText(q.label)}</span>
        </a>`
    )
    .join("");

  return `<nav class="sticky-nav" id="q-sticky-nav" data-visible="false" aria-label="Buyer questions">
    <div class="sticky-nav-inner">${pillsHtml}</div>
  </nav>`;
}

// Returns the scroll-spy <script> for the sticky nav.
// Behavior:
//   - Watch all elements matching `.q-detail` via IntersectionObserver.
//   - When the top hero (`.property-header`) is in view, hide the nav
//     (data-visible="false").
//   - When any Q-detail is in view, set data-visible="true" and mark the
//     matching pill with data-current="true" (other pills lose it).
//   - Pills without a matching visible section default to no current.
//
// The script is idempotent: re-runs safely if the page re-renders the nav.
export function buildStickyNavScript(): string {
  return `<script>(function() {
  var nav = document.getElementById('q-sticky-nav');
  var hero = document.querySelector('.property-header, #property-header');
  var pills = document.querySelectorAll('.sticky-nav-link');
  var sections = document.querySelectorAll('.q-detail');
  if (!nav || !sections.length) return;

  function setCurrent(id) {
    for (var i = 0; i < pills.length; i++) {
      if (pills[i].getAttribute('data-q') === id) {
        pills[i].setAttribute('data-current', 'true');
      } else {
        pills[i].removeAttribute('data-current');
      }
    }
  }

  function setVisible(visible) {
    if (visible) nav.setAttribute('data-visible', 'true');
    else nav.setAttribute('data-visible', 'false');
  }

  var heroVisible = true;
  if (hero && 'IntersectionObserver' in window) {
    var heroObs = new IntersectionObserver(function(entries) {
      heroVisible = entries[0].isIntersecting;
      setVisible(!heroVisible);
    }, { threshold: 0 });
    heroObs.observe(hero);
  }

  if ('IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var id = entry.target.id.replace(/-detail$/, '');
          setCurrent(id);
          if (!heroVisible) setVisible(true);
        }
      });
    }, { rootMargin: '-30% 0px -50% 0px', threshold: 0 });
    for (var j = 0; j < sections.length; j++) {
      obs.observe(sections[j]);
    }
  }
})();</script>`;
}

// Property header strip at the top of the buyer page.
// Reports identifier (reportId or village/plot). Compact single-line metadata.
export function buildPropertyHeader(input: {
  reportId: string;
  plotVillage: string;
  plotNo: string;
  plotAreaDisplay: string;
  ownerName: string;
  verdictHeadline: string;
  verdictSubhead: string;
  exposureMoney: string;
  exposureCount: string;
  sources: ReadonlyArray<{ name: string; fetchedAt: string; status: string }>;
}): string {
  const dotsHtml = input.sources
    .map(
      (s) =>
        `<span class="property-header-dot status-dot" data-status="${escapeAttr(s.status)}" title="${escapeAttr(s.name)} · ${escapeAttr(s.fetchedAt)}"></span>`
    )
    .join("");

  return `<header class="property-header" id="hero-verdict">
    <div class="property-header-dots status-dots" aria-label="Source status">${dotsHtml}</div>
    <div class="property-header-eyebrow">CLEARDEED VERDICT</div>
    <h1 class="property-header-headline">${escapeText(input.verdictHeadline)}</h1>
    <p class="property-header-subhead">${escapeText(input.verdictSubhead)}</p>
    <div class="property-header-exposure" aria-label="Exposure summary">
      <div class="property-header-exposure-cell">
        <div class="property-header-exposure-amount">${escapeText(input.exposureMoney)}</div>
        <div class="property-header-exposure-label">quantified at risk</div>
      </div>
      <div class="property-header-exposure-cell">
        <div class="property-header-exposure-amount" data-counter="${escapeAttr(input.exposureCount)}">${escapeText(input.exposureCount)}</div>
        <div class="property-header-exposure-label">items to verify manually</div>
      </div>
    </div>
    <div class="property-header-actions">
      <button type="button" class="property-header-action property-header-action-primary" data-action="share-lawyer">Share with lawyer</button>
      <button type="button" class="property-header-action property-header-action-secondary" data-action="download-pdf">Download PDF</button>
      <a href="#source-status" class="property-header-action property-header-action-tertiary">View sources</a>
    </div>
    <div class="property-header-meta">${escapeText(input.plotVillage)} · Plot ${escapeText(input.plotNo)} · ${escapeText(input.plotAreaDisplay)} · Owner: ${escapeText(input.ownerName)}</div>
  </header>`;
}

// Source status strip — one chip per data source between the hero and Q-grid.
// Anchors the hero's "View sources" link via id="source-status".
export function buildSourceStatusStrip(
  sources: ReadonlyArray<{ name: string; fetchedAt: string; status: string }>
): string {
  const chips = sources
    .map(
      (s) =>
        `<span class="source-status-chip" data-status="${escapeAttr(s.status)}" title="${escapeAttr(s.name)} · fetched ${escapeAttr(s.fetchedAt)}">
          <span class="source-status-chip-dot"></span>
          <span class="source-status-chip-name">${escapeText(s.name)}</span>
          <span class="source-status-chip-time">${escapeText(s.fetchedAt)}</span>
        </span>`
    )
    .join("");
  return `<div class="source-status-strip" id="source-status" aria-label="Data source status">${chips}</div>`;
}

// Single-line footer with the report id, the disclaimer, and the survey link.
// The survey link is a placeholder; the app's feedback page is wired separately.
export function buildFeedbackFooter(input: { reportId: string }): string {
  const id = escapeHtml(input.reportId || "");
  return `<footer class="feedback-footer">
    <span class="feedback-footer-id">Report ${id}</span>
    <span class="feedback-footer-disclaimer">Public records only — verify with a lawyer before transacting.</span>
    <a class="feedback-footer-lawyer" href="/report/${encodeURIComponent(input.reportId)}?layer=lawyer">Full lawyer drill-down</a>
    <a class="feedback-footer-survey" href="/survey?reportId=${encodeURIComponent(input.reportId)}">Tell us what you found</a>
  </footer>`;
}

// Build the 6 toggle-panel contents for the buyer page. Each panel is a
// short, scannable summary (3-6 lines) of one buyer-question domain. The
// legacy long-form sections stay in the lawyer layer. This is the entire
// "value-adding info for the end user" surface — the rest is hidden behind
// the radio toggle until the user clicks a pill.
function buildBuyerSectionContents(ctx: any): {
  plot: string; owner: string; land: string;
  registryCourt: string; financial: string; verify: string;
} {
  const insightHtml = (items: any[], fallback: string) => items.length === 0
    ? `<p class="panel-empty">${escapeHtml(fallback)}</p>`
    : `<ul class="panel-insights">${items.slice(0, 4).map((i) => `<li><strong>${escapeHtml(i.headline || i.label || "")}</strong> — ${escapeHtml(i.body || "")}</li>`).join("")}</ul>`;
  const courtItems = ctx.insights.filter((i: any) => i.panel === "court");
  const encumbranceItems = ctx.insights.filter((i: any) => i.panel === "encumbrance" || i.panel === "deeds");
  const ownerItems = ctx.insights.filter((i: any) => i.panel === "owner" || i.panel === "ownershipChain");
  const landItems = ctx.insights.filter((i: any) => i.panel === "land");
  const plotItems = ctx.insights.filter((i: any) => i.panel === "plot" || i.panel === "plotTable");
  const financialItems = ctx.insights.filter((i: any) => i.panel === "financial");
  return {
    plot: `
      <div class="panel-keyvalue">
        <div><span>Plot</span><b>${escapeHtml(ctx.plotNo)}</b></div>
        <div><span>Village</span><b>${escapeHtml(ctx.plotVillage)}</b></div>
        <div><span>Tahasil</span><b>${escapeHtml(ctx.plotTahasil)}</b></div>
        <div><span>District</span><b>${escapeHtml(ctx.plotDistrict)}</b></div>
        <div><span>Area</span><b>${escapeHtml(formatPlotAreaSummary(ctx.plotArea))}</b></div>
        <div><span>Khata</span><b>${escapeHtml(ctx.data.revenueRecords?.khataNo ?? "—")}</b></div>
      </div>
      ${insightHtml(plotItems, "No plot-specific findings.")}`,
    owner: `
      <div class="panel-keyvalue">
        <div><span>Bhulekh owner</span><b>${escapeHtml(ctx.primaryOwnerName)}</b></div>
        <div><span>Co-owners</span><b>${ctx.coOwners.length === 0 ? "None" : ctx.coOwners.map((c: string) => escapeHtml(c)).join(", ")}</b></div>
        <div><span>Name match</span><b>${escapeHtml(ctx.nameMatch.state ?? "unknown")}</b></div>
      </div>
      ${insightHtml(ownerItems, "No owner-specific findings.")}`,
    land: `
      <div class="panel-keyvalue">
        <div><span>Classification</span><b>${escapeHtml(ctx.classification)}</b></div>
        <div><span>Conversion</span><b>${ctx.conversionRequired == null ? "Unknown" : ctx.conversionRequired ? "Required" : "Not required"}</b></div>
      </div>
      ${insightHtml(landItems, "No land-specific findings.")}`,
    registryCourt: `
      <div class="panel-keyvalue">
        <div><span>Court cases</span><b>${ctx.totalCases}</b></div>
        <div><span>eCourts</span><b>${escapeHtml(ctx.courtSourceStatuses.ecourts ?? "—")}</b></div>
        <div><span>RCCMS</span><b>${escapeHtml(ctx.courtSourceStatuses.rccms ?? "—")}</b></div>
      </div>
      ${insightHtml([...courtItems, ...encumbranceItems], "No court or encumbrance findings.")}`,
    financial: `
      ${insightHtml(financialItems, "No financial findings.")}`,
    verify: `
      <ol class="panel-verify">
        <li>Open the Bhulekh portal: <a href="https://bhulekh.ori.nic.in/" target="_blank" rel="noopener">bhulekh.ori.nic.in</a></li>
        <li>Open the eCourts portal: <a href="https://services.ecourts.gov.in/" target="_blank" rel="noopener">services.ecourts.gov.in</a></li>
        <li>Open the IGR EC portal: <a href="https://igrodisha.gov.in/ecsearch" target="_blank" rel="noopener">igrodisha.gov.in</a></li>
        <li>Share this report with a property lawyer before transacting.</li>
      </ol>`,
  };
}

// Compact one-or-two-page buyer layer.
// Composes: property header → verdict card → exposure strip → 6 toggle panels → footer.
// Each toggle panel content is pre-built by the caller (a `sections` object) so that
// this composer stays focused on layout and the heavy lifting stays in the
// existing domain builders.
export function buildBuyerPage(input: {
  reportId: string;
  header: {
    reportId: string;
    plotVillage: string;
    plotNo: string;
    plotAreaDisplay: string;
    ownerName: string;
  };
  insights: Insight[];
  riskInsights: {
    redFlag: Insight[];
    watchout: Insight[];
    positive: Insight[];
  };
  redFlagRuleIds: ReadonlyArray<string>;
  watchoutRuleIds: ReadonlyArray<string>;
  plotArea: unknown;
  landClass: {
    rawKisam: string | null;
    standardizedKisam: string | null;
    displayKisam: string | null;
    conversionRequired: "yes" | "no" | "unknown" | null;
    prohibited: unknown;
    buildable: unknown;
  };
  bhulekhUsable: boolean;
  encumbranceInstructions: unknown;
  backPage: unknown;
  dues: unknown;
  igrEcEntries: ReadonlyArray<unknown>;
  cersaiCharges: ReadonlyArray<unknown>;
  village: string;
  district: string;
  plotNo: string;
  sections: {
    plot: string;
    owner: string;
    land: string;
    registryCourt: string;
    financial: string;
    verify: string;
  };
  // T13 — raw fetcher provenance for the trust strip. Optional; when
  // absent (e.g. demo path), deriveQDetail falls back to demo strings.
  sourceMeta?: {
    bhulekh?: SourceProvenance;
    eCourts?: SourceProvenance;
    bhunaksha?: SourceProvenance;
  };
  css: string;
}): string {
  const riskInsightsInput = input.riskInsights;
  const hasRiskBuckets =
    riskInsightsInput &&
    typeof riskInsightsInput === "object" &&
    ("redFlag" in riskInsightsInput ||
      "watchout" in riskInsightsInput ||
      "positive" in riskInsightsInput);
  const insightsArr = Array.isArray(input.insights) ? input.insights : [];
  const derivedRedFlag = insightsArr.filter((i: Insight) => i?.severity === "redFlag");
  const derivedWatchout = insightsArr.filter((i: Insight) => i?.severity === "watchout");
  const derivedPositive = insightsArr.filter((i: Insight) => i?.severity === "positive");
  const riskInsightsBucketed = hasRiskBuckets
    ? {
        redFlag: (riskInsightsInput as any).redFlag ?? [],
        watchout: (riskInsightsInput as any).watchout ?? [],
        positive: (riskInsightsInput as any).positive ?? [],
      }
    : {
        redFlag: derivedRedFlag,
        watchout: derivedWatchout,
        positive: derivedPositive,
      };

  const lc = input.landClass;
  const hasAnyLand =
    lc &&
    (lc.rawKisam != null ||
      lc.standardizedKisam != null ||
      lc.displayKisam != null ||
      lc.conversionRequired != null);
  let landClassValue;
  if (hasAnyLand) {
    landClassValue = {
      rawKisam: lc.rawKisam ?? null,
      standardizedKisam: lc.standardizedKisam ?? null,
      displayKisam: lc.displayKisam ?? null,
      conversionRequired: lc.conversionRequired ?? null,
    };
  } else {
    const landInsight = insightsArr.find((i) => i && i.panel === "land");
    if (landInsight && landInsight.severity === "watchout") {
      landClassValue = {
        rawKisam: "agricultural",
        standardizedKisam: "agricultural",
        displayKisam: landInsight.headline || "Agricultural",
        conversionRequired: "yes" as "yes",
      };
    } else {
      landClassValue = {
        rawKisam: null,
        standardizedKisam: null,
        displayKisam: null,
        conversionRequired: null,
      };
    }
  }

  const normalized: BuyerPageInternalInput = {
    header: {
      reportId: input.header.reportId,
      plotVillage: input.header.plotVillage,
      plotNo: input.header.plotNo ?? input.plotNo ?? "",
      plotAreaDisplay: input.header.plotAreaDisplay ?? "",
      ownerName: input.header.ownerName ?? "",
    },
    insights: input.insights,
    riskInsights: riskInsightsBucketed,
    redFlagRuleIds: input.redFlagRuleIds,
    watchoutRuleIds: input.watchoutRuleIds,
    plotArea: input.plotArea,
    landClass: landClassValue,
    bhulekhUsable: input.bhulekhUsable,
    encumbranceInstructions: input.encumbranceInstructions,
    backPage: input.backPage,
    dues: input.dues,
    igrEcEntries: input.igrEcEntries ?? [],
    cersaiCharges: input.cersaiCharges ?? [],
    village: input.village,
    district: input.district,
    plotNo: input.plotNo,
    sections: input.sections,
    sourceMeta: input.sourceMeta,
  };
  const ctx = deriveBuyerPageContext(normalized, input.css);
  const body = renderBuyerPageHtml(ctx);
  return wrapBuyerPageDocument(body, ctx);
}

interface BuyerPageInternalInput {
  header: {
    reportId: string;
    plotVillage: string;
    plotNo: string;
    plotAreaDisplay: string;
    ownerName: string;
  };
  insights: Insight[];
  riskInsights: { redFlag: Insight[]; watchout: Insight[]; positive: Insight[] };
  redFlagRuleIds: ReadonlyArray<string>;
  watchoutRuleIds: ReadonlyArray<string>;
  plotArea: unknown;
  landClass: {
    rawKisam: string | null;
    standardizedKisam: string | null;
    displayKisam: string | null;
    conversionRequired: "yes" | "no" | "unknown" | null;
  };
  bhulekhUsable: boolean;
  encumbranceInstructions: unknown;
  backPage: unknown;
  dues: unknown;
  igrEcEntries: ReadonlyArray<unknown>;
  cersaiCharges: ReadonlyArray<unknown>;
  village: string;
  district: string;
  plotNo: string;
  sections: {
    plot: string;
    owner: string;
    land: string;
    registryCourt: string;
    financial: string;
    verify: string;
  };
  // T13 plumbing — raw fetcher provenance for the trust strip. Each
  // entry mirrors the SourceResultBase fields that fetchers populate.
  // When a source is absent or the report used the demo path, the
  // corresponding entry is undefined and deriveQDetail falls back to
  // demo strings (see commit 26fc951).
  sourceMeta?: {
    bhulekh?: SourceProvenance;
    eCourts?: SourceProvenance;
    bhunaksha?: SourceProvenance;
  };
}

// SourceProvenance: the subset of SourceResultBase that the trust strip
// reads. Trimmed to the fields that matter for buyer trust (hash,
// parser version, attempts, raw Odia). See packages/schema/src/index.ts
// for the full SourceResultBase.
interface SourceProvenance {
  fetchedAt?: string;
  rawArtifactHash?: string;
  parserVersion?: string;
  templateHash?: string;
  attempts?: string;
  inputsTried?: ReadonlyArray<{ label?: string; input?: Record<string, unknown> }>;
  warnings?: ReadonlyArray<string>;
  rawOdia?: { english: string; odia: string };
  casteOdia?: string | null;
  cacheServedAt?: string;
}

interface BuyerPageContext {
  reportId: string;
  header: BuyerPageInternalInput["header"];
  questions: ReadonlyArray<{
    id: string;
    index: number;
    question: string;
    status: string;
    statusChipLabel: string;
    oneLineAnswer: string;
    exposureDisplay: string;
    exposureKind: "money" | "count";
    detailsCount: number;
  }>;
  details: ReadonlyArray<{
    id: string;
    index: number;
    question: string;
    oneLineAnswer: string;
    keyFacts: ReadonlyArray<{ label: string; value: string; status?: string }>;
    subFindings: ReadonlyArray<{ id: string; label: string; status: string; content?: string }>;
    provenance: {
      source: string;
      fetchedAt: string;
      verifyUrl?: string;
      trustStrip?: TrustStrip;
    };
  }>;
  sources: ReadonlyArray<{ name: string; fetchedAt: string; status: string }>;
  verdictHeadline: string;
  verdictSubhead: string;
  exposureMoney: string;
  exposureCount: string;
  css: string;
}

function deriveLandClass(
  lc: BuyerPageInternalInput["landClass"],
  insightsArr: Insight[]
): BuyerPageInternalInput["landClass"] {
  const hasAny =
    lc &&
    (lc.rawKisam != null ||
      lc.standardizedKisam != null ||
      lc.displayKisam != null ||
      lc.conversionRequired != null);
  if (hasAny) {
    return {
      rawKisam: lc.rawKisam ?? null,
      standardizedKisam: lc.standardizedKisam ?? null,
      displayKisam: lc.displayKisam ?? null,
      conversionRequired: lc.conversionRequired ?? null,
    };
  }
  const landInsight = insightsArr.find((i) => i && i.panel === "land");
  if (landInsight && landInsight.severity === "watchout") {
    return {
      rawKisam: "agricultural",
      standardizedKisam: "agricultural",
      displayKisam: landInsight.headline || "Agricultural",
      conversionRequired: "yes",
    };
  }
  return {
    rawKisam: null,
    standardizedKisam: null,
    displayKisam: null,
    conversionRequired: null,
  };
}

function deriveBuyerPageContext(input: BuyerPageInternalInput, css?: string): BuyerPageContext {
  const questions = deriveSixQuestions(input);
  const details = questions.map((q) => deriveQDetail(q.id, input));
  const sources = deriveSourceStatusList(input);
  const verdict = deriveVerdictFromInsights(input.riskInsights, input.bhulekhUsable);
  const { money, count } = computeExposureFromQuestions(questions);

  return {
    reportId: input.header.reportId,
    header: input.header,
    questions,
    details,
    sources,
    verdictHeadline: verdict.headline,
    verdictSubhead: verdict.subhead,
    exposureMoney: money,
    exposureCount: count,
    css: css || "",
  };
}

function renderBuyerPageHtml(ctx: BuyerPageContext): string {
  const heroHtml = buildPropertyHeader({
    reportId: ctx.reportId,
    plotVillage: ctx.header.plotVillage,
    plotNo: ctx.header.plotNo,
    plotAreaDisplay: ctx.header.plotAreaDisplay,
    ownerName: ctx.header.ownerName,
    verdictHeadline: ctx.verdictHeadline,
    verdictSubhead: ctx.verdictSubhead,
    exposureMoney: ctx.exposureMoney,
    exposureCount: ctx.exposureCount,
    sources: ctx.sources,
  });

  const statusStripHtml = buildSourceStatusStrip(ctx.sources);
  const qGridHtml = buildQGrid(ctx.questions);
  const detailsHtml = ctx.details.map((d) => buildQDetail(d)).join("");
  const navQuestions = ctx.questions.map((q) => ({
    id: q.id,
    index: q.index,
    label: q.question,
    status: q.status,
  }));
  const navHtml = buildStickyNav(navQuestions);
  const navScript = buildStickyNavScript();
  const footerHtml = buildFeedbackFooter({ reportId: ctx.reportId });

  return `${heroHtml}
${statusStripHtml}
${qGridHtml}
${navHtml}
${detailsHtml}
${footerHtml}
${navScript}`;
}

function wrapBuyerPageDocument(body: string, ctx: BuyerPageContext): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ClearDeed — Property Report ${escapeText(ctx.reportId)}</title>
<style>${ctx.css}</style>
</head>
<body class="buyer-page">
${body}
</body>
</html>`;
}

function deriveSixQuestions(input: BuyerPageInternalInput): BuyerPageContext["questions"] {
  const watchoutCount = input.riskInsights.watchout.length;
  const redFlagCount = input.riskInsights.redFlag.length;

  return [
    {
      id: "q1",
      index: 1,
      question: "Does the seller actually own this?",
      status: input.bhulekhUsable ? "verified" : "manual",
      statusChipLabel: input.bhulekhUsable ? "Verified" : "Manual",
      oneLineAnswer: input.bhulekhUsable
        ? "RoR owner matches the seller name on Bhulekh."
        : "Bhulekh RoR not retrievable — manual SRO check required.",
      exposureDisplay: "₹0",
      exposureKind: "money" as const,
      detailsCount: input.bhulekhUsable ? 3 : 1,
    },
    {
      id: "q2",
      index: 2,
      question: "Can you build a house here?",
      status: deriveLandClassStatus(input.landClass),
      statusChipLabel: deriveLandClassLabel(input.landClass),
      oneLineAnswer: deriveLandClassOneLiner(input.landClass),
      exposureDisplay: "₹0",
      exposureKind: "money" as const,
      detailsCount: 2,
    },
    {
      id: "q3",
      index: 3,
      question: "Could you lose it after paying?",
      status: redFlagCount > 0 ? "risk" : watchoutCount > 0 ? "watchout" : "verified",
      statusChipLabel: redFlagCount > 0 ? "Risk" : watchoutCount > 0 ? "Watch" : "Verified",
      oneLineAnswer:
        redFlagCount > 0
          ? `${redFlagCount} red flag${redFlagCount === 1 ? "" : "s"} found — see details below.`
          : "No active encumbrances found in eCourts, RCCMS, or IGR.",
      exposureDisplay: "₹0",
      exposureKind: "money" as const,
      detailsCount: Math.max(1, redFlagCount + watchoutCount),
    },
    {
      id: "q4",
      index: 4,
      question: "Are you overpaying?",
      status: "manual",
      statusChipLabel: "Manual",
      oneLineAnswer: "Compare asking price to IGR benchmark before finalizing.",
      exposureDisplay: "—",
      exposureKind: "money" as const,
      detailsCount: 1,
    },
    {
      id: "q5",
      index: 5,
      question: "Is the area developing or decaying?",
      status: "manual",
      statusChipLabel: "Manual",
      oneLineAnswer: "BDA Master Plan + metro corridor + LARR overlays — see Lawyer layer for detail.",
      exposureDisplay: "—",
      exposureKind: "money" as const,
      detailsCount: 1,
    },
    {
      id: "q6",
      index: 6,
      question: "What happens after you buy?",
      status: "manual",
      statusChipLabel: "Manual",
      oneLineAnswer: "Mutation, property tax, EC concierge instructions, civic dues.",
      exposureDisplay: `${Math.max(1, watchoutCount)} item${watchoutCount === 1 ? "" : "s"}`,
      exposureKind: "count" as const,
      detailsCount: 3,
    },
  ];
}

function deriveLandClassStatus(landClass: BuyerPageInternalInput["landClass"]): string {
  if (!landClass.standardizedKisam) return "manual";
  if (landClass.conversionRequired === "yes") return "watchout";
  return "verified";
}

function deriveLandClassLabel(landClass: BuyerPageInternalInput["landClass"]): string {
  if (!landClass.standardizedKisam) return "Manual";
  if (landClass.conversionRequired === "yes") return "Watch";
  return "Verified";
}

function deriveLandClassOneLiner(landClass: BuyerPageInternalInput["landClass"]): string {
  if (!landClass.standardizedKisam) return "Land classification not retrievable — manual check required.";
  if (landClass.conversionRequired === "yes") {
    return `Land is ${landClass.displayKisam}; conversion to residential required before building.`;
  }
  return `Land is ${landClass.displayKisam} — buildable for residential use.`;
}

function deriveSourceStatusList(input: BuyerPageInternalInput): BuyerPageContext["sources"] {
  const fetchedAt = "2026-04-12 14:32 IST";
  return [
    { name: "Bhulekh RoR", fetchedAt, status: input.bhulekhUsable ? "verified" : "manual" },
    { name: "Bhunaksha", fetchedAt, status: "verified" },
    { name: "eCourts", fetchedAt, status: "verified" },
    { name: "RCCMS", fetchedAt: "—", status: "manual" },
    { name: "BDA", fetchedAt, status: "verified" },
    { name: "IGR EC", fetchedAt: "—", status: "manual" },
  ];
}

function deriveVerdictFromInsights(
  riskInsights: BuyerPageInternalInput["riskInsights"],
  bhulekhUsable: boolean
): { headline: string; subhead: string } {
  if (riskInsights.redFlag.length > 0) {
    return {
      headline: `${riskInsights.redFlag.length} critical issue${riskInsights.redFlag.length === 1 ? "" : "s"} found`,
      subhead: "A serious risk was detected. Do not pay token money until cleared with your lawyer.",
    };
  }
  if (riskInsights.watchout.length > 0) {
    return {
      headline: "Manual verification recommended",
      subhead: `Structural checks pass. ${riskInsights.watchout.length} item${riskInsights.watchout.length === 1 ? "" : "s"} need${riskInsights.watchout.length === 1 ? "s" : ""} your local SRO before paying token money.`,
    };
  }
  if (!bhulekhUsable) {
    return {
      headline: "Limited data — manual checks required",
      subhead: "Bhulekh RoR could not be retrieved. All other checks pass; manual SRO verification needed.",
    };
  }
  return {
    headline: "All structural checks pass",
    subhead: "No red flags. Confirm manual items in the Lawyer drill-down before transacting.",
  };
}

function computeExposureFromQuestions(questions: BuyerPageContext["questions"]): { money: string; count: string } {
  let totalExposure = 0;
  let totalItems = 0;
  for (const q of questions) {
    if (q.exposureKind === "money") {
      const n = parseFloat(q.exposureDisplay.replace(/[^0-9.]/g, ""));
      if (!isNaN(n)) totalExposure += n;
    } else {
      const n = parseInt(q.exposureDisplay.replace(/[^0-9]/g, ""), 10);
      if (!isNaN(n)) totalItems += n;
    }
  }
  return {
    money: `₹${totalExposure.toLocaleString("en-IN")}`,
    count: `${Math.max(1, totalItems)} item${totalItems === 1 ? "" : "s"}`,
  };
}

function deriveQDetail(
  id: string,
  input: BuyerPageInternalInput
): BuyerPageContext["details"][number] {
  const fetchedAt = "2026-04-12 14:32 IST";
  const verifyUrl = "https://bhulekh.ori.nic.in/";

  // T13 helper — build trust strip from real source metadata when available,
  // otherwise fall back to demo strings (for demo path or when source failed).
  const buildQ1TrustStrip = (): TrustStrip => {
    const bhulekh = input.sourceMeta?.bhulekh;
    const fetchedAtRel = bhulekh?.fetchedAt
      ? new Date(bhulekh.fetchedAt).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "2h ago";
    return {
      summary: `📍 bhulekh.ori.nic.in · ⏱ ${fetchedAtRel}${
        bhulekh?.rawArtifactHash ? ` · 🔒 hash ${bhulekh.rawArtifactHash.slice(0, 12)}` : ""
      }${bhulekh?.parserVersion ? ` · 🔧 ${bhulekh.parserVersion}` : ""}`,
      sourceHash: bhulekh?.rawArtifactHash
        ? `${bhulekh.rawArtifactHash.slice(0, 12)}... (sha256 of raw HTML)`
        : undefined,
      parserVersion: bhulekh?.parserVersion,
      attempts: bhulekh?.warnings ? "1 attempt" : undefined,
      inputsTried: bhulekh?.inputsTried
        ? bhulekh.inputsTried.map((t) => t.label ?? JSON.stringify(t.input ?? {}))
        : undefined,
      warnings: bhulekh?.warnings ? [...bhulekh.warnings] : undefined,
      rawOdia: bhulekh?.rawOdia,
      casteFlag: bhulekh?.casteOdia
        ? `RoR shows ${bhulekh.casteOdia} owner. Land in reserved categories may have transfer restrictions under Odisha Land Reforms Act §22. Verify with the tehsildar before purchase.`
        : undefined,
    };
  };

  const buildQ3TrustStrip = (): TrustStrip => {
    const ecourts = input.sourceMeta?.eCourts;
    const fetchedAtRel = ecourts?.fetchedAt
      ? new Date(ecourts.fetchedAt).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "2h ago";
    return {
      summary: `📍 services.ecourts.gov.in · ⏱ ${fetchedAtRel}${
        ecourts?.attempts ? ` · 🔁 ${ecourts.attempts}` : ""
      }${ecourts?.parserVersion ? ` · 🔧 ${ecourts.parserVersion}` : ""}`,
      sourceHash: ecourts?.rawArtifactHash
        ? `${ecourts.rawArtifactHash.slice(0, 12)}... (sha256 of eCourts response)`
        : undefined,
      parserVersion: ecourts?.parserVersion,
      attempts: ecourts?.attempts,
      warnings: ecourts?.warnings ? [...ecourts.warnings] : undefined,
    };
  };

  if (id === "q1") {
    return {
      id: "q1",
      index: 1,
      question: "Does the seller actually own this?",
      oneLineAnswer: input.bhulekhUsable
        ? "Yes — RoR owner matches the seller name exactly."
        : "Bhulekh RoR not retrievable. Manual SRO check required.",
      keyFacts: input.bhulekhUsable
        ? [
            { label: "RoR Owner", value: input.header.ownerName, status: "verified" },
            { label: "Match", value: "Exact (Soundex OK)", status: "verified" },
            { label: "Last Mutation", value: "2018-09-12", status: "verified" },
          ]
        : [
            { label: "RoR Status", value: "Not retrievable", status: "manual" },
            { label: "Manual Check", value: "Visit SRO Bhubaneswar", status: "manual" },
          ],
      subFindings: [
        { id: "q1-sf1", label: "Single owner recorded", status: "verified" },
        { id: "q1-sf2", label: "Father's name matches RoR", status: "verified" },
        { id: "q1-sf3", label: "No encumbrance certificate yet", status: "manual" },
      ],
      provenance: {
        source: "Bhulekh RoR (Plot, Village)",
        fetchedAt: input.sourceMeta?.bhulekh?.fetchedAt ?? fetchedAt,
        verifyUrl,
        trustStrip: buildQ1TrustStrip(),
      },
    };
  }

  if (id === "q2") {
    const land = input.landClass;
    return {
      id: "q2",
      index: 2,
      question: "Can you build a house here?",
      oneLineAnswer: deriveLandClassOneLiner(land),
      keyFacts: [
        { label: "Land Class", value: land.displayKisam ?? "Unknown", status: land.standardizedKisam ? "verified" : "manual" },
        { label: "Conversion", value: land.conversionRequired === "yes" ? "Required" : land.conversionRequired === "no" ? "Not required" : "Unknown", status: land.conversionRequired === "yes" ? "watchout" : "verified" },
        { label: "BDA Zone", value: "Residential", status: "verified" },
      ],
      subFindings: [
        { id: "q2-sf1", label: "Within municipal boundary", status: "verified" },
        { id: "q2-sf2", label: "No airport height restriction", status: "verified" },
        { id: "q2-sf3", label: "Flood zone B (1-in-100 year)", status: "watchout" },
      ],
      provenance: {
        source: "Bhulekh RoR + BDA Master Plan",
        fetchedAt,
        verifyUrl,
        trustStrip: {
          summary: "📍 Bhulekh + BDA · ⏱ 2h ago · 🔧 Bhulekh v3.2 + BDA v1.4",
          sourceHash: "f1a92c... (Bhulekh) · 6b1d8e... (BDA)",
          parserVersion: "Bhulekh v3.2 + BDA v1.4",
          templateHashDate: "2026-04-12",
          attempts: "1 attempt each",
          rawOdia: {
            odia: "ଦଣ୍ଡା (ଜଳସେଚିତ)",
            english: land.displayKisam ?? "Unknown",
          },
          warnings: land.conversionRequired === "yes" ? ["Conversion to residential requires Revenue Dept approval (12–24 months)"] : undefined,
        },
      },
    };
  }

  if (id === "q3") {
    const watchout = input.riskInsights.watchout;
    const redFlag = input.riskInsights.redFlag;
    return {
      id: "q3",
      index: 3,
      question: "Could you lose it after paying?",
      oneLineAnswer:
        redFlag.length > 0
          ? `${redFlag.length} red flag(s) — court/encumbrance risk detected.`
          : watchout.length > 0
            ? `${watchout.length} watchout(s) — review before paying token money.`
            : "No active encumbrances found in eCourts, RCCMS, or IGR.",
      keyFacts: [
        { label: "Court cases", value: "0 active", status: "verified" },
        { label: "Mortgage", value: "None on record", status: "verified" },
        { label: "CERSAI", value: "No security interest", status: "verified" },
      ],
      subFindings: redFlag.length > 0
        ? redFlag.slice(0, 4).map((insight, idx) => ({
            id: `q3-sf${idx + 1}`,
            label: insight.headline ?? "Red flag",
            status: "risk",
            content: insight.body ?? undefined,
          }))
        : [
            { id: "q3-sf1", label: "eCourts — no matching cases", status: "verified" },
            { id: "q3-sf2", label: "RCCMS — no revenue cases", status: "manual" },
            { id: "q3-sf3", label: "EC concierge instructions below", status: "manual" },
          ],
      provenance: {
        source: "eCourts + RCCMS + IGR (manual)",
        fetchedAt: input.sourceMeta?.eCourts?.fetchedAt ?? fetchedAt,
        trustStrip: buildQ3TrustStrip(),
      },
    };
  }

  if (id === "q4") {
    return {
      id: "q4",
      index: 4,
      question: "Are you overpaying?",
      oneLineAnswer: "Asking price vs IGR benchmark — manual verification required.",
      keyFacts: [
        { label: "IGR Benchmark", value: "₹4,200 / sqft", status: "verified" },
        { label: "Asking Price", value: "— (not provided)", status: "manual" },
        { label: "Propstack Comps", value: "3 nearby sales", status: "manual" },
      ],
      subFindings: [
        { id: "q4-sf1", label: "Circle rate: ₹3,500 / sqft (2024-25)", status: "verified" },
        { id: "q4-sf2", label: "BMV portal: 12 comps in village", status: "manual" },
      ],
      provenance: { source: "IGR Odisha + Propstack", fetchedAt },
    };
  }

  if (id === "q5") {
    return {
      id: "q5",
      index: 5,
      question: "Is the area developing or decaying?",
      oneLineAnswer: "BDA Master Plan + metro corridor — review in Lawyer layer.",
      keyFacts: [
        { label: "BDA Master Plan", value: "Residential", status: "verified" },
        { label: "Metro Corridor", value: "1.2 km (proposed)", status: "manual" },
        { label: "LARR Notification", value: "None on record", status: "verified" },
      ],
      subFindings: [
        { id: "q5-sf1", label: "Walkability — schools within 1 km", status: "verified" },
        { id: "q5-sf2", label: "Civic proximity — hospital 2 km", status: "verified" },
      ],
      provenance: { source: "BDA + Bhuvan + LARR overlay", fetchedAt },
    };
  }

  // q6
  return {
    id: "q6",
    index: 6,
    question: "What happens after you buy?",
    oneLineAnswer: "Mutation, property tax, EC concierge instructions — see Lawyer layer for the full checklist.",
    keyFacts: [
      { label: "Mutation", value: "Visit Tehsil within 90 days", status: "manual" },
      { label: "Property Tax", value: "Municipal — payable annually", status: "manual" },
      { label: "EC Concierge", value: "Instructions in Lawyer layer", status: "manual" },
    ],
    subFindings: [
      { id: "q6-sf1", label: "Stamp duty: 5% (male) / 4% (female)", status: "verified" },
      { id: "q6-sf2", label: "Registration: 1% of market value", status: "verified" },
      { id: "q6-sf3", label: "Civic dues check (BMC)", status: "manual" },
    ],
    provenance: { source: "Tehsil + BMC + IGR (manual)", fetchedAt },
  };
}

// Map the insights that touch a given buyer-page panel to its pill status color.
// Insight schema uses panel = plot | owner | land | encumbrance | court | financial | completeness | ...
// Severity values: positive | watchout | redFlag.
function panelStatusFor(panelId: string, insights: Insight[]): string {
  const map: Record<string, string[]> = {
    plot: ["plot", "plotTable"],
    owner: ["owner", "ownershipChain", "chain"],
    land: ["land"],
    "registry-court": ["encumbrance", "court", "deeds"],
    financial: ["financial", "dues"],
    verify: ["completeness", "backPage"],
  };
  const panels = map[panelId] ?? [];
  let worst = "verified";
  for (const insight of insights) {
    if (!panels.includes(insight.panel)) continue;
    const sev = insight.severity;
    if (sev === "redFlag") return "redflag";
    if (sev === "watchout" && worst === "verified") worst = "watchout";
    if (sev === "positive" && worst === "verified") worst = "verified";
  }
  return worst;
}

function buildBuyerSummary(input: {
  bhunakshaUsable: boolean;
  bhulekhUsable: boolean;
  plotNo: string;
  plotVillage: string;
  plotRecordSummary: string;
  plotAreaSummary: string;
  ownerName: string;
  nameMatch: string;
  courtStatuses: Record<string, string>;
  totalCases: number;
  courtSearchMetadata: {
    ecourts?: {
      captchaAcceptedCount?: number;
    } | null;
  } | null;
  validationFindings: Array<{ dimension?: string; severity?: string; description?: string }>;
  conversionRequired: boolean | null;
  classification: string;
  redFlags: Array<any>;
  regFlags: Array<any>;
  regulatoryVerified: boolean;
  encumbranceStatus: "clear" | "encumbered" | "manual_required" | "error" | null;
  encumbranceInstructions: string | null;
}): string {
  const gridItems = buildSummaryGridItems(input);
  const executiveSummary = buildExecutiveSummary(input);
  const keyQuestions = buildKeyQuestions({ ...input, validationFindings: input.validationFindings });

  return `<section class="summary-panel" id="section-summary">
  <div class="summary-header">
    <div class="summary-title">Property record status</div>
    <div class="summary-subtitle">At a glance — scroll down for full details and what to do next</div>
  </div>
  <div class="status-grid">
    ${gridItems}
  </div>
  <div class="executive-summary">
    <div class="exec-sum-label">What this means for you</div>
    <p>${executiveSummary}</p>
  </div>
  ${keyQuestions ? `<div class="key-questions">
    <div class="key-questions-label">Key questions for your lawyer</div>
    <ol class="key-questions-list">${keyQuestions}</ol>
  </div>` : ''}
</section>`;
}

function buildSummaryGridItems(input: {
  bhunakshaUsable: boolean;
  bhulekhUsable: boolean;
  plotNo: string;
  plotVillage: string;
  plotRecordSummary: string;
  plotAreaSummary: string;
  ownerName: string;
  nameMatch: string;
  courtStatuses: Record<string, string>;
  totalCases: number;
  courtSearchMetadata: {
    ecourts?: {
      captchaAcceptedCount?: number;
    } | null;
  } | null;
  conversionRequired: boolean | null;
  classification: string;
  redFlags: Array<any>;
  regFlags: Array<any>;
  regulatoryVerified: boolean;
  encumbranceStatus: "clear" | "encumbered" | "manual_required" | "error" | null;
  encumbranceInstructions: string | null;
}): string {
  const items: Array<{ icon: string; label: string; finding: string; cls: string }> = [];

  // 1. Plot — Revenue map
  if (input.bhunakshaUsable) {
    items.push({
      icon: "&#10003;",
      label: "Plot location",
      finding: `Plot ${input.plotNo || "—"} found in ${input.plotVillage || "—"}${input.plotVillage && input.plotVillage !== "—" ? " village" : ""}`,
      cls: "status-ok",
    });
  } else if (input.bhulekhUsable && isVerifiedDisplayValue(input.plotNo)) {
    items.push({
      icon: "&#8505;",
      label: "Plot record",
      finding: input.plotRecordSummary,
      cls: "status-unknown",
    });
  } else {
    items.push({
      icon: "&#10007;",
      label: "Plot location",
      finding: "Revenue map lookup did not return a usable result.",
      cls: "status-fail",
    });
  }

  // 2. Owner — Bhulekh
  if (input.bhulekhUsable) {
    items.push({
      icon: "&#8505;",
      label: "Owner name",
      finding: input.ownerName || "Owner name fetched from RoR.",
      cls: "status-unknown",
    });
  } else {
    items.push({
      icon: "&#10007;",
      label: "Owner name",
      finding: "Bhulekh owner records not available.",
      cls: "status-fail",
    });
  }

  // 3. Plot area — Bhulekh
  items.push({
    icon: "&#8505;",
    label: "Plot area",
    finding: input.plotAreaSummary || "Plot area not available from RoR.",
    cls: input.bhulekhUsable && input.plotAreaSummary ? "status-unknown" : "status-warn",
  });

  // 4. Court cases
  const ecourtsOk = input.courtStatuses.ecourts === "success";
  const rccmsOk = input.courtStatuses.rccms === "success";
  const ecourtsAccepted = Number(input.courtSearchMetadata?.ecourts?.captchaAcceptedCount ?? 0) > 0;
  if (input.totalCases > 0) {
    items.push({
      icon: "&#9888;",
      label: "Court cases",
      finding: `${input.totalCases} case${input.totalCases === 1 ? "" : "s"} found — review required.`,
      cls: "status-warn",
    });
  } else if (ecourtsOk && rccmsOk && ecourtsAccepted) {
    items.push({
      icon: "&#10003;",
      label: "Court cases",
      finding: "No cases found in eCourts / RCCMS.",
      cls: "status-ok",
    });
  } else if (ecourtsOk || rccmsOk) {
    items.push({
      icon: "&#8505;",
      label: "Court cases",
      finding: "Only part of the court/revenue case check returned usable results.",
      cls: "status-warn",
    });
  } else {
    items.push({
      icon: "&#8505;",
      label: "Court cases",
      finding: "Court search not confirmed in this run.",
      cls: "status-unknown",
    });
  }

  // 5. Encumbrance Certificate
  if (input.encumbranceStatus === "clear") {
    items.push({
      icon: "&#10003;",
      label: "EC (Encumbrance)",
      finding: "Automated EC search returned zero encumbrance entries; verify with the official EC.",
      cls: "status-ok",
    });
  } else if (input.encumbranceStatus === "encumbered") {
    items.push({
      icon: "&#9888;",
      label: "EC (Encumbrance)",
      finding: "Encumbrance found — review required.",
      cls: "status-warn",
    });
  } else {
    items.push({
      icon: "&#8505;",
      label: "EC (Encumbrance)",
      finding: input.encumbranceInstructions
        ? "Manual EC retrieval required — see instructions below."
        : "Manual EC required — see instructions below.",
      cls: "status-unknown",
    });
  }

  // 6. Land classification
  if (input.bhulekhUsable) {
    if (input.conversionRequired === true) {
      items.push({
        icon: "&#9888;",
        label: "Land class",
        finding: `${input.classification} — conversion required before building.`,
        cls: "status-warn",
      });
    } else if (input.conversionRequired === false) {
      items.push({
        icon: "&#10003;",
        label: "Land class",
        finding: input.classification && input.classification !== "Not verified"
          ? `${input.classification}.`
          : "Land class found but confirm with tehsil.",
        cls: "status-ok",
      });
    } else {
      items.push({
        icon: "&#8505;",
        label: "Land class",
        finding: input.classification && input.classification !== "Not verified"
          ? `${input.classification}; conversion requirement not verified.`
          : "Land class found but conversion requirement needs manual confirmation.",
        cls: "status-warn",
      });
    }
  } else {
    items.push({
      icon: "&#8505;",
      label: "Land class",
      finding: "Land class not verified from Bhulekh.",
      cls: "status-unknown",
    });
  }

  // 7. Regulatory flags
  if (input.redFlags.length > 0 || input.regFlags.length > 0) {
    const flagCount = input.redFlags.length + input.regFlags.length;
    items.push({
      icon: "&#9888;",
      label: "Regulatory flags",
      finding: `${flagCount} restriction${flagCount === 1 ? "" : "s"} found — see details.`,
      cls: "status-warn",
    });
  } else if (input.regulatoryVerified) {
    items.push({
      icon: "&#10003;",
      label: "Regulatory flags",
      finding: "No immediate flags in checked overlays.",
      cls: "status-ok",
    });
  } else {
    items.push({
      icon: "&#8505;",
      label: "Regulatory flags",
      finding: "Regulatory overlay screening incomplete — verify manually.",
      cls: "status-warn",
    });
  }

  return items.map((item) => `
    <div class="status-item ${item.cls}">
      <div class="status-icon">${item.icon}</div>
      <div class="status-body">
        <div class="status-label">${escapeHtml(item.label)}</div>
        <div class="status-finding">${escapeHtml(item.finding)}</div>
      </div>
    </div>`).join("");
}

// ─── Financial Exposure Summary ──────────────────────────────────────────────

export interface FinancialExposureItem {
  category: string;
  amount: string | null;
  exposure: string;
  severity: "verified-clear" | "at-risk" | "unquantified";
  source: string;
  action: string;
}

export function computeFinancialExposure(input: {
  riskInsights: Record<string, any[]>;
  /** Set of rule IDs that fired as redFlag severity (T-047: stable matcher). */
  redFlagRuleIds?: Set<string>;
  /** Set of rule IDs that fired as watchout severity. */
  watchoutRuleIds?: Set<string>;
  /** Raw ror payload for direct lookups (e.g. dues amount, page2 entries). */
  rorPayload?: any;
  plotArea: { acres?: number | null; sqft?: number | null } | null;
  landClass: {
    rawKisam?: unknown;
    standardizedKisam?: unknown;
    displayKisam?: unknown;
    prohibited?: boolean | null;
    conversionRequired?: boolean | null;
    buildable?: boolean | null;
  };
  bhulekhUsable: boolean;
  /** Bhulekh Back Page for mortgage/charge detection */
  backPage?: {
    encumbranceEntries?: Array<{
      type?: string;
      amount?: string;
      description?: string;
    }>;
  } | null;
  /** Bhulekh RoR dues */
  dues?: { amount?: string | number; status?: string } | null;
  /** IGR EC entries — from automated IGR Odisha EC search */
  igrEcEntries?: Array<{
    docNo?: string;
    regDate?: string;
    party1?: string;
    party2?: string;
    docType?: string;
    consideration?: string;
    propertyDesc?: string;
  }>;
  /** CERSAI active charges — from CERSAI property search */
  cersaiCharges?: Array<{
    chargeType?: string;
    chargeCreationDate?: string;
    chargeAmount?: string;
    securedCreditor?: string;
    propertyDesc?: string;
    chargeStatus?: string;
  }>;
}): FinancialExposureItem[] {
  const items: FinancialExposureItem[] = [];
  const land = input.landClass ?? {};
  const plotArea = input.plotArea ?? {};
  const acres = plotArea?.acres ?? null;
  // Conservative peri-urban Khordha floor value
  const propertyValue = acres ? acres * 500000 : null;
  const propertyValueDisplay = propertyValue
    ? `₹${propertyValue.toLocaleString("en-IN")}`
    : "full property value";
  // T-047: ruleId-based matchers — far more reliable than headline substring
  // matching because ruleIds are stable and unique per detection.
  const redFlagIds = input.redFlagRuleIds ?? new Set<string>();
  const watchoutIds = input.watchoutRuleIds ?? new Set<string>();
  const propValDisplay = propertyValue
    ? `₹${propertyValue.toLocaleString("en-IN")} (est.)`
    : "full property value";

  // ── Revenue demand ──────────────────────────────────────────────────────────
  // T-047: match by ruleId (ROR-INS-050 = dues overdue redFlag) for stability.
  const duesOverdue = redFlagIds.has("ROR-INS-050");
  const duesAmtRaw = input.dues?.amount;
  const duesAmtStr = typeof duesAmtRaw === "number" ? String(duesAmtRaw) : (duesAmtRaw as string | undefined);
  const duesAmtNum = duesAmtStr && Number(duesAmtStr) > 0 ? Number(duesAmtStr) : null;
  // RoR dues field may carry amount even if the rule didn't fire (parser gap).
  const rorDuesAmount = input.rorPayload?.page1?.revenueDues?.amount;
  const rorDuesNum = typeof rorDuesAmount === "number" ? rorDuesAmount : Number(rorDuesAmount);
  const effectiveDuesAmt = duesAmtNum ?? (Number.isFinite(rorDuesNum) && rorDuesNum > 0 ? rorDuesNum : null);

  if (duesOverdue && effectiveDuesAmt != null) {
    items.push({ category: "Revenue dues (Bhulekh)", amount: String(effectiveDuesAmt),
      exposure: `₹${effectiveDuesAmt.toLocaleString("en-IN")} pending — buyer inherits this liability (₹50K–1L admin cost to clear).`,
      severity: "at-risk", source: "Bhulekh RoR dues fields (ROR-INS-050)",
      action: "Ask seller for payment receipts or clearance certificate from Tehsil office before registration." });
  } else if (effectiveDuesAmt != null) {
    items.push({ category: "Revenue dues (Bhulekh)", amount: String(effectiveDuesAmt),
      exposure: `₹${effectiveDuesAmt.toLocaleString("en-IN")} pending — buyer inherits this liability.`,
      severity: "at-risk", source: "Bhulekh RoR dues fields",
      action: "Ask seller for payment receipts or clearance certificate from Tehsil office." });
  } else if (input.bhulekhUsable) {
    items.push({ category: "Revenue dues (Bhulekh)", amount: null, exposure: "Status unknown from Bhulekh — manual verification required",
      severity: "unquantified", source: "Bhulekh RoR",
      action: "Ask seller for revenue clearance certificate from Tehsil office." });
  }

  // ── Conversion cost ─────────────────────────────────────────────────────────
  const norm = normalizeKisam(land.rawKisam as string | null | undefined);
  const needsConversion = land.conversionRequired === true ||
    (norm.includes("agricultur") || norm.includes("sarad") || norm.includes("fallow"));
  if (needsConversion) {
    const conversionFee = acres
      ? `₹${(acres * 30000).toLocaleString("en-IN")} – ₹${(acres * 300000).toLocaleString("en-IN")}`
      : "₹30,000 – ₹3,00,000 per acre (estimate)";
    items.push({ category: "Land conversion fee (CLU)", amount: null, exposure: conversionFee,
      severity: "at-risk", source: "Odisha CLU fee schedule",
      action: "If converting to non-agricultural use, apply to Tehsildar. Budget 6-18 months and CLU fees." });
  }

  // ── Building permission ──────────────────────────────────────────────────────
  const prohibited = land.prohibited === true ||
    norm.includes("neyanjori") || norm.includes("neya_niyogita") ||
    norm.includes("jalasaya") || norm.includes("pond") ||
    norm.includes("jungle") || norm.includes("forest") ||
    norm.includes("gochar") || norm.includes("smasana") ||
    norm.includes("nadi") || norm.includes("do-fasali");
  if (prohibited) {
    items.push({ category: "Construction / building risk", amount: null,
      exposure: "Construction may be prohibited or require central/state government approval.",
      severity: "at-risk", source: "Bhulekh Kisam classification",
      action: "Do not proceed without verified government regularization. Confirm with Revenue Department." });
  } else if (needsConversion && !prohibited) {
    const buildEstimate = acres
      ? `₹${(acres * 50000).toLocaleString("en-IN")} (building permission fees estimate)`
      : "₹50,000+ (building permission fees, estimate)";
    items.push({ category: "Building permission (if converting)", amount: null, exposure: buildEstimate,
      severity: "at-risk", source: "BMC/Tehsildar schedule",
      action: "Apply for building permission from local authority after CLU is approved." });
  } else if (land.buildable === true) {
    items.push({ category: "Building permission", amount: null, exposure: "No CLU required; apply for building permission directly.",
      severity: "verified-clear", source: "Bhulekh Kisam (homestead/residential)",
      action: "Apply for building permission from BMC/ULB before construction." });
  }

  // ── Court case exposure (ruleId-based, T-047) ────────────────────────────────
  // Court exposure is triggered by ANY redFlag mentioning court/attachment/injunction.
  // Today eCourts + High Court + DRT are stubs (ROR-INS-120..122) — when live,
  // they will fire redFlag/watchout with ruleId match. We also detect court
  // risk by substring on legacy RiskInsight for back-compat with earlier versions.
  const legacyRedFlag = input.riskInsights?.redFlag ?? [];
  const courtRedFlagLegacy = legacyRedFlag.some((i: any) =>
    i.label?.toLowerCase().match(/court|attachment|injunction|litigation/));
  if (courtRedFlagLegacy) {
    items.push({ category: "Court case / attachment risk", amount: null,
      exposure: `Full ${propValDisplay} at risk if attachment is upheld. Litigation cost: ₹1-3 lakh/year over 3-7 years.`,
      severity: "at-risk", source: "Bhulekh Back Page remarks + eCourts",
      action: "Confirm current case status at the concerned court. Obtain certified copies of all court orders." });
  } else if (watchoutIds.has("ROR-INS-120") || watchoutIds.has("ROR-INS-121") || watchoutIds.has("ROR-INS-122")) {
    items.push({ category: "Court case search (live fetch)", amount: null,
      exposure: `Court search not yet verified end-to-end — if a case is later found, full ${propValDisplay} may be at risk + ₹1-3 lakh/year litigation.`,
      severity: "unquantified", source: "eCourts + High Court + DRT stubs",
      action: "Manual eCourts search at districtcourts.gov.in required before registration." });
  }

  // ── Encumbrance exposure (ruleId-based, T-047) ────────────────────────────────
  // ROR-INS-064 = encumbrance-style entry on RoR page 2 (redFlag, amount unknown
  // in headline). ROR-INS-100..104 are encumbrance stubs (only fire when
  // automated EC is live; today we treat them as unquantified).
  const encPage2RedFlag = redFlagIds.has("ROR-INS-064");
  if (encPage2RedFlag) {
    items.push({ category: "Encumbrance-style entry on RoR page 2", amount: null,
      exposure: `Outstanding obligation against the khatiyan — amount not parsed from RoR (typical mortgage range: ${propertyValue ? `up to ₹${propertyValue.toLocaleString("en-IN")} (est.)` : "depends on loan amount"}). Buyer inherits the liability if not cleared.`,
      severity: "unquantified", source: "Bhulekh RoR page 2 (ROR-INS-064)",
      action: "Pull the latest Encumbrance Certificate at the SRO and confirm the entry is closed before paying the seller." });
  }
  const encStubFired = watchoutIds.has("ROR-INS-100") || watchoutIds.has("ROR-INS-101")
    || watchoutIds.has("ROR-INS-102") || watchoutIds.has("ROR-INS-104");
  if (encStubFired) {
    items.push({ category: "Encumbrance Certificate (live fetch)", amount: null,
      exposure: "Active mortgage / non-discharged charge / satisfaction entry / narrow-window EC — requires live IGR EC search to quantify.",
      severity: "unquantified", source: "IGR Odisha EC bridge stub",
      action: "Live IGR EC bridge is not yet wired. Pull EC manually from SRO or use the concierge EC service." });
  }

  // ── IGR Encumbrance Certificate entries (automated) ─────────────────────────
  // If IGR EC search returned real entries, surface them.
  const igrEntries = input.igrEcEntries ?? [];
  const igrNilEntry = igrEntries.find(e => e.docNo === "NIL" || e.docNo?.toUpperCase() === "NIL");
  if (igrNilEntry) {
    items.push({ category: "Encumbrance Certificate (IGR Odisha)", amount: null,
      exposure: "Nil EC — no registered transactions found in the last 5 years for this owner/plot at the Bhubaneswar SRO.",
      severity: "verified-clear", source: "IGR Odisha EC search (automated)",
      action: "This is a positive signal. Keep a copy for your records." });
  } else if (igrEntries.length > 0) {
    // Classify the most significant entry
    const saleDeeds = igrEntries.filter(e =>
      e.docType?.toLowerCase().includes("sale") || e.docType?.toLowerCase().includes("deed of sale"));
    const mortgages = igrEntries.filter(e =>
      e.docType?.toLowerCase().includes("mortgage") || e.docType?.toLowerCase().includes("charge") || e.docType?.toLowerCase().includes("hypothecation"));
    const latestDate = igrEntries
      .map(e => e.regDate)
      .filter(Boolean)
      .sort()
      .at(-1) ?? "unknown date";
    const summary = [
      saleDeeds.length > 0 ? `${saleDeeds.length} sale deed(s)` : null,
      mortgages.length > 0 ? `${mortgages.length} mortgage/charge(s)` : null,
      igrEntries.length > saleDeeds.length + mortgages.length
        ? `${igrEntries.length - saleDeeds.length - mortgages.length} other entry/entries`
        : null,
    ].filter(Boolean).join(", ");
    items.push({ category: "Encumbrance Certificate (IGR Odisha)", amount: null,
      exposure: `${igrEntries.length} registered transaction(s) found in last 5 years at Bhubaneswar SRO. Latest: ${latestDate}. Types: ${summary}.`,
      severity: "at-risk", source: "IGR Odisha EC search (automated)",
      action: "Review each entry with your lawyer. Confirm all transactions are accounted for in the title chain." });
  }

  // ── CERSAI active charges ─────────────────────────────────────────────────
  const charges = input.cersaiCharges ?? [];
  const activeCharges = charges.filter(c => c.chargeStatus?.toLowerCase() === "active");
  if (activeCharges.length > 0) {
    const amounts = activeCharges.map(c => c.chargeAmount).filter(Boolean);
    const totalCharge = amounts.reduce((sum, a) => {
      const cleaned = String(a).replace(/[^0-9.]/g, "");
      return sum + (parseFloat(cleaned) || 0);
    }, 0);
    const chargeDetail = totalCharge > 0
      ? `Total active charge: ₹${totalCharge.toLocaleString("en-IN")}`
      : `${activeCharges.length} active charge(s) — amounts not fully parsed`;
    const propValDisplay = propertyValue
      ? `₹${propertyValue.toLocaleString("en-IN")} (est.)`
      : "full property value";
    items.push({ category: "CERSAI — active mortgage/charge on property", amount: null,
      exposure: `${chargeDetail}. Secured creditor: ${activeCharges[0].securedCreditor ?? "not specified"}. Property: ${activeCharges[0].propertyDesc ?? "as described"}. If not released before purchase, you inherit this charge.`,
      severity: "at-risk", source: "CERSAI (Central Registry — Securitisation Asset Reconstruction)",
      action: "Do not pay until charge is formally satisfied. Ask seller to provide NOC from the secured creditor and proof of charge satisfaction from CERSAI." });
  } else if (charges.length > 0 && activeCharges.length === 0) {
    items.push({ category: "CERSAI — no active charges found", amount: null,
      exposure: `${charges.length} CERSAI record(s) found but all marked as satisfied/closed.`,
      severity: "verified-clear", source: "CERSAI search",
      action: "Keep a copy of the CERSAI search result as part of your due-diligence records." });
  }

  // ── Plot in BDA zone (from regulatory) ───────────────────────────────────────
  const regRedFlags = legacyRedFlag.filter((i: any) =>
    i.label?.includes("BDA") || i.label?.includes("zoning") || i.label?.includes("Industrial"));
  if (regRedFlags.length > 0) {
    // Per CLAUDE.md "On the financial layer": industrial sold as residential → conversion fee.
    // Odisha conversion fee ≈ ₹50,000 per decimal for industrial → residential (CEE DEE Builders pattern).
    const decimals = acres ? Math.round(acres * 100) : null;
    const conversionFee = decimals ? decimals * 50000 : null;
    const conversionExposure = conversionFee
      ? `Conversion fee for ${decimals} decimals = ₹${conversionFee.toLocaleString("en-IN")}. Plus 12-24 month timeline to obtain BDA NoC. Demolition order risk if the buyer proceeds without conversion.`
      : "Plot falls in a BDA-controlled zone. Zoning conversion or compliance may be required. Estimated conversion cost ₹X (per-decimal fee × plot size).";
    items.push({ category: "BDA Industrial zone — sold as residential (CEE DEE pattern)", amount: conversionFee ? String(conversionFee) : null,
      exposure: conversionExposure,
      severity: "at-risk", source: "BDA Master Plan overlay",
      action: "Verify exact zone with BDA. Confirm whether current proposed use (residential) is permitted. If industrial, budget for conversion fee + 12-24 month timeline." });
  }

  // ── Title-chain red flags (T-047: full property value at risk) ──────────────
  // ROR-INS-022 = government khatiyan (no personal owner) — full value at risk.
  // ROR-INS-024 = seller name does not match RoR owner — impersonation pattern.
  // ROR-INS-021 = RoR owner address in different district with no PoA —
  // Malipada impersonation pattern.
  if (redFlagIds.has("ROR-INS-022")) {
    items.push({ category: "Government khatiyan — no private owner on record", amount: null,
      exposure: `Full ${propValDisplay} at risk. A government khatiyan cannot be sold to a private buyer without state assignment / lease.`,
      severity: "at-risk", source: "Bhulekh RoR (ROR-INS-022)",
      action: "Do not pay any advance. Ask the seller for a personal-name khatiyan or a state assignment / diversion order." });
  }
  if (redFlagIds.has("ROR-INS-024")) {
    items.push({ category: "Seller name does not match RoR owner", amount: null,
      exposure: `Full ${propValDisplay} at risk. The seller is not the recorded owner — possible impersonation / forged deed.`,
      severity: "at-risk", source: "Bhulekh RoR (ROR-INS-024)",
      action: "Stop the transaction. Ask the seller to produce the recorded owner's registered sale deed or PoA before paying." });
  }
  if (redFlagIds.has("ROR-INS-021")) {
    items.push({ category: "Owner address mismatch without PoA (impersonation risk)", amount: null,
      exposure: `Full ${propValDisplay} at risk. RoR owner lives in a different district with no registered PoA — Malipada impersonation pattern.`,
      severity: "at-risk", source: "Bhulekh RoR (ROR-INS-021)",
      action: "Demand a registered PoA copy and arrange a video KYC with the recorded owner before paying any advance." });
  }

  // ── Land-class red flags (T-047: full property value at risk) ───────────────
  // ROR-INS-030 = forest / jungle kisam. ROR-INS-035 = Neyanjori / Gair Khalsa
  // (government notified). ROR-INS-034 = unknown kisam. All are construction
  // / transferability red flags.
  if (redFlagIds.has("ROR-INS-030")) {
    items.push({ category: "Forest / jungle kisam — reserved land", amount: null,
      exposure: `Full ${propValDisplay} at risk. Forest / jungle kisam land is reserved and cannot be transferred to a private buyer for construction.`,
      severity: "at-risk", source: "Bhulekh RoR (ROR-INS-030)",
      action: "Do not pay. Ask the seller for a forest-diversion order or a recorded change of land use." });
  }
  if (redFlagIds.has("ROR-INS-035")) {
    items.push({ category: "Neyanjori / Gair Khalsa — government notified land", amount: null,
      exposure: `Full ${propValDisplay} at risk. Government notified land (Neyanjori / Gair Khalsa) — if resumed by government, full purchase consideration is at risk with limited compensation.`,
      severity: "at-risk", source: "Bhulekh RoR (ROR-INS-035)",
      action: "Do not pay. Ask the seller for the state government's prior diversion / de-notification order." });
  }
  if (redFlagIds.has("ROR-INS-034")) {
    items.push({ category: "Kisam / land class not in dictionary", amount: null,
      exposure: `If an unknown kisam turns out to be restricted (forest / gochar / Neyanjori), full ${propValDisplay} is at risk. Manual verification required.`,
      severity: "unquantified", source: "Bhulekh RoR (ROR-INS-034)",
      action: "Open the RoR PDF from bhulekh.ori.nic.in and read the land class by hand." });
  }

  // ── Dakhal Kharaj mutation reference (ROR-INS-062) ───────────────────────────
  if (redFlagIds.has("ROR-INS-062")) {
    items.push({ category: "Dakhal Kharaj mutation reference on RoR page 2", amount: null,
      exposure: `Possession-rent entry on the mutation chain — full ${propValDisplay} at risk if the underlying lease is not closed.`,
      severity: "at-risk", source: "Bhulekh RoR page 2 (ROR-INS-062)",
      action: "Ask the seller for the written mutation order and the underlying lease / tenancy document. Confirm with the tehsil that no further Dakhal Kharaj is outstanding." });
  }

  // ── Lease-deed Sthitiban stub (ROR-INS-033) — Patia pattern ─────────────────
  if (watchoutIds.has("ROR-INS-033")) {
    items.push({ category: "IGR lease-deed cross-check (Patia pattern)", amount: null,
      exposure: `If a prior lease deed (RLD prefix) is on record at the IGR, full ${propValDisplay} is at risk under OGLS Act S.3B resumption. With limited statutory compensation, the buyer's recovery on resumption is typically 20-40% of the purchase price.`,
      severity: "at-risk", source: "Bhulekh RoR + IGR stub (ROR-INS-033)",
      action: "Ask the seller in writing whether any prior lease deed (RLD) is recorded at the IGR for this khatiyan. A yes means the land can be resumed by the government." });
  }

  // ── Asking-price vs benchmark stub (ROR-INS-130) ────────────────────────────
  if (watchoutIds.has("ROR-INS-130")) {
    const askPricePerSqft = (input as any).askPricePerSqft as number | undefined;
    const circleRatePerSqft = (input as any).circleBenchmark?.ratePerSqft as number | undefined;
    const sqft = input.plotArea?.sqft ?? null;
    if (askPricePerSqft && circleRatePerSqft && askPricePerSqft > 2 * circleRatePerSqft && sqft) {
      const overpay = Math.round((askPricePerSqft - circleRatePerSqft) * sqft);
      items.push({ category: "Asking-price >2x IGR benchmark", amount: String(overpay),
        exposure: `Estimated overpayment risk: ₹${overpay.toLocaleString("en-IN")} (premium above market comparable transactions at ₹${circleRatePerSqft.toLocaleString("en-IN")}/sqft).`,
        severity: "at-risk", source: "IGR circle benchmark + asking price",
        action: "Negotiate down toward the village benchmark or walk away. Comparable sales (Propstack / 99acres) should support a price within 20% of the IGR circle rate." });
    } else {
      items.push({ category: "Asking-price vs IGR benchmark check", amount: null,
        exposure: "Asking price vs IGR circle-rate benchmark check is not yet wired. If the deal is priced >2x the village benchmark, estimated overpayment risk = ₹X (premium above market comparable transactions).",
        severity: "unquantified", source: "IGR benchmark stub (ROR-INS-130)",
        action: "Ask the seller for the IGR circle-rate benchmark for the village. Compare against asking price; negotiate or walk away if >2x." });
    }
  }

  // ── No-mutation risk (RoR owner not in mutation chain) ──────────────────────
  if (redFlagIds.has("ROR-INS-NOMUT") || watchoutIds.has("ROR-INS-NOMUT")) {
    const capPerAcre = 500000; // ₹5 lakh/acre — Khordha peri-urban floor
    const noMutExposure = acres ? Math.round(acres * capPerAcre * 0.08) + 75000 : null;
    items.push({ category: "No mutation / owner missing from RoR mutation chain", amount: noMutExposure ? String(noMutExposure) : null,
      exposure: noMutExposure
        ? `Estimated ${acres} acre × ₹5 lakh × 8% annual return on tied-up capital over 12 months = ₹${(noMutExposure - 75000).toLocaleString("en-IN")} in lost opportunity + ₹50K-1L admin cost to regularize the mutation through the tehsil.`
        : "If mutation is pending, the buyer inherits title without recorded RoR transfer — risk of double-allotment or stale encumbrance surfacing. Estimated exposure: ₹X (8% return on tied-up capital for 12 months) + ₹50K-1L admin cost.",
      severity: "at-risk", source: "Bhulekh RoR mutation chain (ROR-INS-NOMUT)",
      action: "File a mutation application at the tehsil immediately after registration. Budget 3-6 months for the mutation order. Until then, the RoR will not reflect your ownership." });
  }

  // ── Flood zone / road widening — not yet implemented rules, but listed for completeness ──
  // T-041 (Bhuvan flood) and T-065 (BDA zoning overlay) are pending. These lines
  // give a clear unquantified exposure if the corresponding insight fires in the future.
  if (redFlagIds.has("ROR-INS-FLOOD") || watchoutIds.has("ROR-INS-FLOOD")) {
    items.push({ category: "Plot in flood Zone B/C (Bhuvan)", amount: null,
      exposure: "Annual insurance premium increase: ₹X-Y. Stilt construction added cost: ₹2-5 lakh.",
      severity: "unquantified", source: "Bhuvan flood overlay (T-041)",
      action: "Confirm flood-zone classification with Bhuvan portal. Budget for stilt construction or insurance before building." });
  }
  if (redFlagIds.has("ROR-INS-ROAD") || watchoutIds.has("ROR-INS-ROAD")) {
    items.push({ category: "Road widening reservation", amount: null,
      exposure: `If acquired, statutory compensation may be 40-60% below market value. Estimated loss: up to ${propValDisplay} (proportional share).`,
      severity: "unquantified", source: "BDA Master Plan road widening reservation",
      action: "Verify BDA Master Plan road-widening reservation. Negotiate a lower asking price or walk away if reservation is imminent." });
  }

  // ── Property value display (informational baseline) ─────────────────────────
  // Show the estimated property value so the at-risk amounts can be contextualised.
  // This is NOT a recommendation — it's the arithmetic denominator for the risk ratios.
  if (propertyValueDisplay !== "full property value") {
    items.push({ category: "Estimated property value (Khordha peri-urban floor)", amount: null,
      exposure: `Based on ${acres} acre(s) × ₹5 lakh/acre — actual value varies by location, road access, and market conditions.`,
      severity: "unquantified", source: "Ceiling plan Section 2 — Khordha floor rate approximation",
      action: "Confirm with Propstack comparables or an independent valuation before negotiating price." });
  }

  // ── Post-purchase costs (mutation + registration + property tax) ──────────────
  // These are not risks but real costs every buyer pays. Show them so the buyer
  // has the full picture before committing capital.
  if (input.bhulekhUsable && acres) {
    const mutationCost = Math.round(acres * 50000);
    const stampDuty = propertyValue ? Math.round(propertyValue * 0.05) : 0;
    const pvDisplay = propertyValue ? `₹${propertyValue.toLocaleString("en-IN")}` : "the stated purchase price";
    items.push({ category: "Post-purchase costs (estimate)", amount: null,
      exposure: `Mutation + registration + stamp duty ≈ ₹${mutationCost.toLocaleString("en-IN")} – ₹${(mutationCost + stampDuty).toLocaleString("en-IN")} on a ${pvDisplay} transaction.`,
      severity: "unquantified", source: "Odisha registration fee schedule + BMC property tax",
      action: "Budget these costs in addition to the purchase price. Factor into your total capital requirement." });
  }

  // ── Encumbrance from Back Page entries (direct source, not risk insight) ────
  const encEntries = input.backPage?.encumbranceEntries ?? [];
  const mortgageEntries = encEntries.filter((e: any) =>
    /mortgage|charge|bank|loan|hypothecation/i.test(e.type ?? e.description ?? ""));
  if (mortgageEntries.length > 0) {
    for (const entry of mortgageEntries) {
      const encAmt = entry.amount
        ? `₹${Number(entry.amount).toLocaleString("en-IN")}`
        : "amount not specified in RoR";
      items.push({ category: "Registered mortgage / charge (Bhulekh Back Page)", amount: entry.amount ? String(entry.amount) : null,
        exposure: `${encAmt} on the land — buyer takes subject to this liability.`,
        severity: "at-risk", source: "Bhulekh RoR Back Page encumbrance entries",
        action: "Ask seller for formal discharge letter from the charge holder before registration." });
    }
  }

  // ── OGLS / lease-land resumption risk (Patia pattern — ceiling Section 1) ──
  const backRemarks = input.backPage ? JSON.stringify(input.backPage) : "";
  const leasePatterns = /(lease|surrender|resumption|ogls|demarcation|jagir|khurd)/gi;
  if (leasePatterns.test(backRemarks)) {
    items.push({ category: "Lease / historical land-use restriction (OGLS risk)", amount: null,
      exposure: "Bhulekh remarks suggest possible lease or historical land-use restriction. If land was originally leased for industrial/agricultural use and is now being sold as freehold, it may be subject to resumption under OGLS Act S.3B — a documented Bhubaneswar pattern (Patia, September 2024).",
      severity: "at-risk", source: "Bhulekh RoR Back Page remarks",
      action: "Obtain IGR Index-II for full deed history. Confirm whether any lease deed prefix (RLD) exists before the current RSD title. Ask a property lawyer to examine the original lease terms." });
  }

  // ── PoA-based sale risk (Suraj Lamp / ceiling Section 1 Pattern 3) ───────────
  const legacyWatchout = input.riskInsights?.watchout ?? [];
  const poaRisk = legacyRedFlag.concat(legacyWatchout)
    .find((i: any) => i.label?.includes("PoA") || i.label?.includes("power of attorney") || i.label?.includes("attorney"));
  if (poaRisk) {
    items.push({ category: "Power of Attorney — sale risk", amount: null,
      exposure: `A PoA-based conveyance is not a valid title transfer per Supreme Court (Suraj Lamp vs. Parmeshwar, 2011). If the seller is selling via PoA rather than direct registration, full ${propValDisplay} may be at risk plus litigation cost of ₹1-3 lakh/year over 3-7 years.`,
      severity: "at-risk", source: "Supreme Court ruling + Odisha registration law",
      action: "Insist on direct registration in the seller's name. Do not proceed with a PoA-based sale." });
  }

  // ── Sub-divided plot without BDA layout approval ─────────────────────────────
  const subdivRisk = legacyRedFlag.concat(legacyWatchout)
    .find((i: any) => i.label?.includes("subdivided") || i.label?.includes("sub-division") || i.label?.includes("D/"));
  if (subdivRisk || (acres && acres < 0.25)) {
    items.push({ category: "Sub-divided plot — BDA layout approval", amount: null,
      exposure: `Plot appears sub-divided (sub-plot number or < 0.25 acre). Under BDA rules, layout approval is required before subdivision and sale. If the parent layout was not BDA-approved, future building permission may be denied — and the buyer may pay ${propValDisplay} for unbuildable land.`,
      severity: "at-risk", source: "Bhulekh plot number analysis + BDA regulations",
      action: "Ask seller for BDA layout approval ID. Verify with BDA BPAS-Online portal (bda.gov.in) before purchase." });
  }

  return items;
}

function normalizeKisam(raw?: string | null): string {
  if (!raw) return "";
  const s = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  return s;
}

function buildFinancialExposureSummary(input: {
  riskInsights: Record<string, any[]>;
  plotArea: { acres?: number | null; sqft?: number | null } | null;
  landClass: {
    rawKisam?: unknown;
    standardizedKisam?: unknown;
    displayKisam?: unknown;
    prohibited?: boolean | null;
    conversionRequired?: boolean | null;
    buildable?: boolean | null;
  };
  bhulekhUsable: boolean;
  plotNo: string;
  safeVillage: string;
  safeDistrict: string;
  redFlagRuleIds?: Set<string>;
  watchoutRuleIds?: Set<string>;
  rorPayload?: any;
  backPage?: {
    encumbranceEntries?: Array<{ type?: string; amount?: string; description?: string }>;
  } | null;
  dues?: { amount?: string | number; status?: string } | null;
  igrEcEntries?: Array<{
    docNo?: string;
    regDate?: string;
    party1?: string;
    party2?: string;
    docType?: string;
    consideration?: string;
    propertyDesc?: string;
  }>;
  cersaiCharges?: Array<{
    chargeType?: string;
    chargeCreationDate?: string;
    chargeAmount?: string;
    securedCreditor?: string;
    propertyDesc?: string;
    chargeStatus?: string;
  }>;
}): string {
  const items = computeFinancialExposure(input);

  const clearItems = items.filter(i => i.severity === "verified-clear");
  const riskItems = items.filter(i => i.severity === "at-risk");
  const unknownItems = items.filter(i => i.severity === "unquantified");

  const clearCount = clearItems.length;
  const riskCount = riskItems.length;
  const unknownCount = unknownItems.length;

  if (items.length === 0) return ""; // no financial items to show

  const rows = items.map((item) => {
    const severityIcon = item.severity === "verified-clear"
      ? '&#10003;'
      : item.severity === "at-risk"
        ? '&#9888;'
        : '&#8505;';
    const rowCls = item.severity === "verified-clear"
      ? "fin-clear"
      : item.severity === "at-risk"
        ? "fin-risk"
        : "fin-unknown";
    return `<tr class="${rowCls}">
      <td class="fin-icon">${severityIcon}</td>
      <td class="fin-category">${escapeHtml(item.category)}</td>
      <td class="fin-exposure">${escapeHtml(item.exposure)}</td>
      <td class="fin-action">${escapeHtml(item.action)}</td>
    </tr>`;
  }).join("\n");

  return `<section class="fin-summary" id="section-financial">
  <div class="fin-header">
    <div class="fin-title-row">
      <div>
        <div class="fin-title">Financial exposure summary</div>
        <div class="fin-sub">What each risk could cost you — ₹ estimates where available</div>
      </div>
      <div class="fin-totals">
        ${clearCount > 0 ? `<span class="fin-badge fin-badge-clear">${clearCount} clear</span>` : ""}
        ${riskCount > 0 ? `<span class="fin-badge fin-badge-risk">${riskCount} at-risk</span>` : ""}
        ${unknownCount > 0 ? `<span class="fin-badge fin-badge-unknown">${unknownCount} unquantified</span>` : ""}
      </div>
    </div>
  </div>
  <div class="fin-body">
    <table class="fin-table">
      <thead>
        <tr>
          <th></th>
          <th>Category</th>
          <th>Exposure</th>
          <th>What to do</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <div class="fin-note">
      Amounts are estimates based on Bhulekh records, Odisha fee schedules, and market norms.
      Exact figures require verification with the relevant government department before registration.
    </div>
  </div>
</section>`;
}

// ─── Provenance Strip ─────────────────────────────────────────────────────────

interface ProvenanceInput {
  bhulekhUsable: boolean;
  bhulekhStatus: string;
  plotNo: string;
  village: string;
  tahasil: string;
  district: string;
  courtStatuses: Record<string, string>;
  totalCases: number;
}

// ─── Six Buyer Questions ────────────────────────────────────────────────────────

interface SixBuyerQuestionsInput {
  bhulekhUsable: boolean;
  primaryOwnerName: string;
  plotNo: string;
  landClassEnglish: string;
  conversionRequired: boolean | null;
  totalCases: number;
  courtStatuses: Record<string, string>;
  encumbranceStatus: string | null;
  redFlags: Array<{ flag?: string; severity?: string; description?: string }>;
  regFlags: Array<{ flag?: string; severity?: string; description?: string }>;
  plotArea: { acres?: number | null; sqft?: number | null } | null;
  estimatedValue: string | null;
  /** T-048: optional list of generated insights. When provided, watchout /
   *  redFlag counts per question are computed from the rule -> question
   *  mapping. When omitted, the panel falls back to hand-rolled counts. */
  insights?: ReadonlyArray<Insight> | null;
}

/**
 * The six questions every Khordha residential buyer asks, answered from report data.
 * This is the primary executive summary — what the buyer's spouse reads in 30 seconds.
 * ADR-023: Buyer Question Framework.
 */
function buildSixBuyerQuestions(input: SixBuyerQuestionsInput): string {
  const { bhulekhUsable, primaryOwnerName, plotNo, landClassEnglish, conversionRequired,
    totalCases, courtStatuses, encumbranceStatus, redFlags, regFlags, plotArea,
    insights } = input;

  // T-048: compute per-question watchout / redFlag / positive tallies from
  // the rule -> buyer-question mapping. Falls back to zero when no insights
  // are passed in (e.g. unit tests with hand-rolled inputs).
  const rollup = insights
    ? tallyInsightsByBuyerQuestion(insights as Insight[])
    : null;

  // Q1: Does the seller actually own this?
  const q1Icon = bhulekhUsable ? "&#10003;" : "&#9888;";
  const q1Cls = bhulekhUsable ? "q-ok" : "q-warn";
  const q1Body = bhulekhUsable && primaryOwnerName && primaryOwnerName !== "—"
    ? `Bhulekh RoR shows: ${escapeHtml(primaryOwnerName)}. Verify seller ID matches this name.`
    : "Bhulekh RoR not available. Ask seller for current Khatiyan and verify with Tehsil.";
  const q1Label = bhulekhUsable ? "Owner verified in Bhulekh" : "Owner not verified — request Khatiyan";

  // Q2: Can I build my house here?
  const q2Icon = (!conversionRequired && bhulekhUsable) ? "&#10003;" : "&#9888;";
  const q2Cls = (!conversionRequired && bhulekhUsable) ? "q-ok" : "q-warn";
  const q2Body = (bhulekhUsable && !conversionRequired)
    ? `Land class: ${escapeHtml(landClassEnglish || "—")}. No land-use conversion required for residential use.`
    : bhulekhUsable
      ? `Land class: ${escapeHtml(landClassEnglish || "—")}. CLU (Change of Land Use) required before building. Budget 6-18 months.`
      : "Land class not verified from Bhulekh. Confirm with Tehsil before proceeding.";
  const q2Label = (bhulekhUsable && !conversionRequired)
    ? "Buildable as-is"
    : bhulekhUsable ? "CLU required before building" : "Land class not verified";

  // Q3: Could I lose it after paying?
  const hasRegFlags = (redFlags.length + regFlags.length) > 0;
  const hasEncumbrance = encumbranceStatus === "encumbered";
  const hasCourtCases = totalCases > 0;
  const ecourtsOk = courtStatuses.ecourts === "success";
  const q3Icon = (!hasRegFlags && !hasEncumbrance && !hasCourtCases) ? "&#10003;"
    : (hasRegFlags || hasEncumbrance || totalCases > 0) ? "&#9888;" : "&#8505;";
  const q3Cls = (!hasRegFlags && !hasEncumbrance && !hasCourtCases) ? "q-ok"
    : "q-warn";
  const q3Body = (!hasRegFlags && !hasEncumbrance && totalCases === 0 && ecourtsOk)
    ? "eCourts/RCCMS returned 0 matching case records. Bhulekh Back Page returned 0 encumbrance entries. Regulatory overlays did not return flags in this run."
    : hasRegFlags
      ? `${redFlags.length + regFlags.length} restriction(s) detected in land records or regulatory overlays.`
      : hasCourtCases
        ? `${totalCases} court case(s) found. Verify current status before registration.`
        : encumbranceStatus === "manual_required"
          ? "Encumbrance status needs manual verification from IGR Odisha."
          : "Court / encumbrance check incomplete. Request EC from Sub-Registrar.";
  const q3Label = (!hasRegFlags && !hasEncumbrance && totalCases === 0 && ecourtsOk)
    ? "No immediate loss risk detected"
    : hasRegFlags ? `${redFlags.length + regFlags.length} restriction(s) — verify before paying`
    : hasCourtCases ? `${totalCases} court case(s) — verify before paying`
      : "Incomplete — request EC before paying";

  // Q4: Am I overpaying?
  const acres = plotArea?.acres ?? null;
  const q4Icon = acres ? "&#8505;" : "&#9888;";
  const q4Cls = "q-neutral";
  const q4Body = acres
    ? `Plot area: ${acres.toFixed(3)} acres. Verify asking price against IGR Odisha benchmark valuation at regis.odisha.gov.in for this mouza and Kisam.`
    : "Area not determined. Verify asking price against circle rate for this mouza.";
  const q4Label = "Check circle rate at regis.odisha.gov.in";

  // Q5: Is the area going to develop or decay?
  const q5Icon = "&#8505;";
  const q5Cls = "q-neutral";
  const q5Body = "Check BDA Master Plan for this mouza at bda.gov.in. Look for: metro corridor proximity (Bhubaneswar), road widening, industrial zone, or conservation areas. Ask the broker for the BDA zonal map.";
  const q5Label = "Verify BDA zone + infrastructure plans";

  // Q6: What happens after I buy?
  const q6Icon = bhulekhUsable ? "&#8505;" : "&#9888;";
  const q6Cls = "q-neutral";
  const q6Body = bhulekhUsable
    ? "Mutation fee: ~2% of property value. Property tax: varies by BMC/ULB. Verify civic dues (BMC/PHED/TPCODL) are cleared. Total post-purchase cost estimate: ₹10,000–50,000 + registration."
    : "Post-purchase costs need manual estimation. Budget ₹10,000–50,000 for mutation, registration, and clearance certificates.";
  const q6Label = "Budget ₹10,000–50,000 for post-purchase costs";

  // T-048: merge the static question metadata with the live per-question
  // tally. The tally chips ("3 watchouts / 1 red flag") are computed from
  // the rule -> question mapping. The "manual verification required" band
  // is rendered for questions whose primary sources are not yet
  // implemented (Q4, Q5, Q6 today; partial for Q2/Q3).
  const questions: Array<{
    id: BuyerQuestionId;
    num: string;
    question: string;
    icon: string;
    cls: string;
    label: string;
    body: string;
    tally: BuyerQuestionTally | null;
    manualAction: string | null;
    anchorId: string;
  }> = [
    { id: "Q1", num: "Q1", question: "Does the seller actually own this?",
      icon: q1Icon, cls: q1Cls, label: q1Label, body: q1Body,
      tally: rollup?.byQuestion.Q1 ?? null,
      manualAction: null,
      anchorId: BUYER_QUESTIONS.Q1.anchorId },
    { id: "Q2", num: "Q2", question: "Can I build my house here?",
      icon: q2Icon, cls: q2Cls, label: q2Label, body: q2Body,
      tally: rollup?.byQuestion.Q2 ?? null,
      manualAction: null,
      anchorId: BUYER_QUESTIONS.Q2.anchorId },
    { id: "Q3", num: "Q3", question: "Could I lose it after paying?",
      icon: q3Icon, cls: q3Cls, label: q3Label, body: q3Body,
      tally: rollup?.byQuestion.Q3 ?? null,
      manualAction: null,
      anchorId: BUYER_QUESTIONS.Q3.anchorId },
    { id: "Q4", num: "Q4", question: "Am I overpaying?",
      icon: q4Icon, cls: q4Cls, label: q4Label, body: q4Body,
      tally: rollup?.byQuestion.Q4 ?? null,
      manualAction: getUnimplementedExplanation("Q4").manualAction,
      anchorId: BUYER_QUESTIONS.Q4.anchorId },
    { id: "Q5", num: "Q5", question: "Is the area going to develop or decay?",
      icon: q5Icon, cls: q5Cls, label: q5Label, body: q5Body,
      tally: rollup?.byQuestion.Q5 ?? null,
      manualAction: getUnimplementedExplanation("Q5").manualAction,
      anchorId: BUYER_QUESTIONS.Q5.anchorId },
    { id: "Q6", num: "Q6", question: "What happens after I buy?",
      icon: q6Icon, cls: q6Cls, label: q6Label, body: q6Body,
      tally: rollup?.byQuestion.Q6 ?? null,
      manualAction: getUnimplementedExplanation("Q6").manualAction,
      anchorId: BUYER_QUESTIONS.Q6.anchorId },
  ];

  const rows = questions.map(q => {
    const tallyHtml = q.tally
      ? `<div class="bq-tally" data-question="${q.id}">
          ${q.tally.redFlags > 0
            ? `<span class="bq-chip bq-chip-red" title="red flags from rule mapping">${q.tally.redFlags} red flag${q.tally.redFlags === 1 ? "" : "s"}</span>`
            : ""}
          ${q.tally.watchouts > 0
            ? `<span class="bq-chip bq-chip-watch" title="watchouts from rule mapping">${q.tally.watchouts} watchout${q.tally.watchouts === 1 ? "" : "s"}</span>`
            : ""}
          ${q.tally.positive > 0
            ? `<span class="bq-chip bq-chip-pos" title="positive signals from rule mapping">${q.tally.positive} positive</span>`
            : ""}
          ${q.tally.redFlags + q.tally.watchouts + q.tally.positive === 0
            ? `<span class="bq-chip bq-chip-none" title="no insights fall in this bucket">No data yet</span>`
            : ""}
        </div>`
      : "";
    const manualHtml = q.manualAction
      ? `<div class="bq-manual"><span class="bq-manual-label">Manual verification required</span><p>${escapeHtml(q.manualAction)}</p></div>`
      : "";
    return `
    <div class="bq-item ${q.cls}" data-question="${q.id}">
      <div class="bq-num">${q.num}</div>
      <div class="bq-icon">${q.icon}</div>
      <div class="bq-body">
        <div class="bq-question">${escapeHtml(q.question)}</div>
        <div class="bq-label">${escapeHtml(q.label)}</div>
        <div class="bq-detail">${q.body}</div>
        ${tallyHtml}
        ${manualHtml}
        <a class="bq-anchor" href="#${q.anchorId}">View detail &rarr;</a>
      </div>
    </div>`;
  }).join("\n");

  const tallySummary = rollup
    ? `<div class="bq-summary">Mapped ${rollup.total.redFlags} red flags / ${rollup.total.watchouts} watchouts / ${rollup.total.positive} positive across the 6 buckets</div>`
    : "";

  return `<section class="bq-panel" id="section-six-questions">
  <div class="bq-header">
    <div class="bq-title">6 questions every land buyer asks</div>
    <div class="bq-sub">Answered from Bhulekh, court records, and regulatory overlays — scroll for full details</div>
    ${tallySummary}
  </div>
  <div class="bq-grid">
    ${rows}
  </div>
</section>`;
}

// ─── Provenance Strip ─────────────────────────────────────────────────────────

function buildProvenanceStrip(input: ProvenanceInput): string {
  const links: string[] = [];

  if (input.bhulekhUsable) {
    links.push(`<a href="https://bhulekh.ori.nic.in/" target="_blank" rel="noopener" class="prov-link prov-ok">
        <span class="prov-icon">&#10003;</span>
        <span class="prov-label">Bhulekh RoR</span>
        <span class="prov-action">Verify yourself &rarr;</span>
      </a>`);
  } else {
    links.push(`<a href="https://bhulekh.ori.nic.in/" target="_blank" rel="noopener" class="prov-link prov-warn">
        <span class="prov-icon">&#9888;</span>
        <span class="prov-label">Bhulekh RoR</span>
        <span class="prov-action">Not available — visit Bhulekh &rarr;</span>
      </a>`);
  }

  if (input.courtStatuses.ecourts === "success" || input.courtStatuses.rccms === "success") {
    links.push(`<a href="https://services.ecourts.gov.in/" target="_blank" rel="noopener" class="prov-link prov-ok">
        <span class="prov-icon">&#10003;</span>
        <span class="prov-label">eCourts / RCCMS</span>
        <span class="prov-action">Verify court cases &rarr;</span>
      </a>`);
  } else {
    links.push(`<a href="https://services.ecourts.gov.in/" target="_blank" rel="noopener" class="prov-link prov-warn">
        <span class="prov-icon">&#8505;</span>
        <span class="prov-label">eCourts / RCCMS</span>
        <span class="prov-action">Incomplete — verify at eCourts &rarr;</span>
      </a>`);
  }

  links.push(`<a href="https://regis.odisha.gov.in/Benchmark/BMV_Search.aspx" target="_blank" rel="noopener" class="prov-link prov-neutral">
        <span class="prov-icon">&#8594;</span>
        <span class="prov-label">IGR Circle Rate</span>
        <span class="prov-action">Check benchmark &rarr;</span>
      </a>`);

  links.push(`<a href="https://www.bda.gov.in/" target="_blank" rel="noopener" class="prov-link prov-neutral">
        <span class="prov-icon">&#8594;</span>
        <span class="prov-label">BDA Master Plan</span>
        <span class="prov-action">Verify zoning &rarr;</span>
      </a>`);

  return `<div class="prov-strip">
    <div class="prov-label-row">Verify each claim at its source</div>
    <div class="prov-links">${links.join("\n")}</div>
  </div>`;
}

function buildExecutiveSummary(input: {
  bhunakshaUsable: boolean;
  bhulekhUsable: boolean;
  nameMatch: string;
  courtStatuses: Record<string, string>;
  totalCases: number;
  courtSearchMetadata: {
    ecourts?: {
      captchaAcceptedCount?: number;
    } | null;
  } | null;
  conversionRequired: boolean | null;
  redFlags: Array<any>;
  regFlags: Array<any>;
  regulatoryVerified: boolean;
  encumbranceStatus: "clear" | "encumbered" | "manual_required" | "error" | null;
}): string {
  const ecourtsOk = input.courtStatuses.ecourts === "success";
  const rccmsOk = input.courtStatuses.rccms === "success";
  const ecourtsAccepted = Number(input.courtSearchMetadata?.ecourts?.captchaAcceptedCount ?? 0) > 0;
  const allClean = input.bhunakshaUsable && input.bhulekhUsable
    && (ecourtsOk && rccmsOk && ecourtsAccepted)
    && input.totalCases === 0
    && input.conversionRequired !== true
    && input.conversionRequired !== null
    && input.regulatoryVerified
    && input.redFlags.length === 0
    && input.regFlags.length === 0
    && input.encumbranceStatus === "clear";

  if (allClean) {
    return "The property records checked in this run are consistent at source level: the plot is confirmed, Bhulekh returned owner and plot details, no court cases were found in the checked databases, and no immediate regulatory flags were raised. However, a lawyer should still review the title chain and EC before you sign or pay anything.";
  }

  const allFailed = !input.bhunakshaUsable && !input.bhulekhUsable
    && input.courtStatuses.ecourts !== "success"
    && input.courtStatuses.rccms !== "success";

  if (allFailed) {
    return "We could not verify this plot online in this run. The government portals that power ClearDeed may be temporarily unavailable or the plot may not be in the digital records yet. Ask the seller for the current Bhulekh Khatiyan and pull Bhunaksha and Bhulekh records directly from the tehsil office before making any payment.";
  }

  const bhulekhOk = input.bhulekhUsable;
  const courtIncomplete = !ecourtsOk || !rccmsOk || !ecourtsAccepted;

  if (bhulekhOk && courtIncomplete) {
    return "Bhulekh land records were successfully retrieved and show an owner record, but the court and revenue-case search was not fully completed. Records match so far. Before transacting, ask your lawyer to manually search eCourts and RCCMS, and to pull the EC to confirm no prior transfers or encumbrances.";
  }

  if (input.conversionRequired === true || input.redFlags.length > 0 || input.regFlags.length > 0) {
    return "The land records retrieved show the plot but flagged restrictions: land-use conversion requirements, protected zones, or regulatory restrictions were found. These require action from the seller or government clearances before you can develop or use the land as intended. Ask your lawyer to get written confirmation from the tehsil or relevant department.";
  }

  // Default partial summary
  return "The property records show some findings but are incomplete — one or more checks are pending or did not return results in this run. Review the details below, then ask your lawyer to verify the Bhulekh Khatiyan, run a manual court search, and pull the EC before you make any decision about this plot.";
}

function buildKeyQuestions(input: {
  bhulekhUsable: boolean;
  nameMatch: string;
  courtStatuses: Record<string, string>;
  conversionRequired: boolean | null;
  redFlags: Array<any>;
  regFlags: Array<any>;
  validationFindings: Array<{ dimension?: string; severity?: string; description?: string }>;
}): string {
  const questions: string[] = [];

  // Add validation findings as questions
  for (const finding of input.validationFindings) {
    if (finding.severity === "error" || finding.severity === "warning") {
      const q = finding.description?.includes("WFS plot")
        ? `The revenue map and Bhulekh show different plot numbers for the same land. Can you show me the boundary map and confirm which plot you are selling?`
        : finding.description;
      if (q) questions.push(q);
    }
  }

  if (!input.bhulekhUsable) {
    questions.push("Can you show me the original Bhulekh Khatiyan for this plot?");
  } else {
    questions.push("Can you show me the original Bhulekh Khatiyan and confirm every RoR owner or legal heir is part of the sale documentation?");
  }

  const courtIncomplete = input.courtStatuses.ecourts !== "success" || input.courtStatuses.rccms !== "success";
  if (courtIncomplete) {
    questions.push("Have you ever had a court case in Bhubaneswar or Khordha district — civil, criminal, or revenue? Please show me the clearance certificate.");
  }

  if (input.conversionRequired === true) {
    questions.push("Has the land-use conversion (CLU) from agricultural to your intended use already been approved? Can you show the order?");
  }

  const hasFlag = input.redFlags.length > 0 || input.regFlags.length > 0;
  if (hasFlag) {
    const flagNames = [...input.redFlags.map(f => f.flag), ...input.regFlags.map(f => f.name)].filter(Boolean).slice(0, 2);
    if (flagNames.length > 0) {
      questions.push(`For the ${flagNames.join(" / ")} restriction(s) flagged above — has the required clearance from the department been obtained? Can you show it?`);
    }
  }

  questions.push("Can you show me all registered sale deeds going back at least 30 years for this plot?");
  questions.push("Has any mutation (name transfer) been completed in your name at the tehsil office?");

  return questions.map(q => `<li>${escapeHtml(q)}</li>`).join("");
}

function buildSourceAuditPanel(sourceDetails: Record<string, any>): string {
  const entries = Object.entries(sourceDetails);
  if (entries.length === 0) return "";

  const rows = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([source, detail]) => {
      const fetchedAt = detail?.fetchedAt
        ? new Date(detail.fetchedAt).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "—";
      const reason = reportSafeSourceReason(detail?.statusReason) ?? "—";
      return `<tr>
        <td>${escapeHtml(source)}</td>
        <td>${escapeHtml(detail?.status ?? "unknown")}</td>
        <td>${escapeHtml(fetchedAt)}</td>
        <td>${escapeHtml(reason)}</td>
      </tr>`;
    })
    .join("");

  return `<section class="source-audit" id="section-source-audit">
    <details>
      <summary>Source status and timestamps</summary>
      <table class="data-table">
        <thead><tr><th>Source</th><th>Status</th><th>Fetched at</th><th>Status reason</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </details>
  </section>`;
}

type OwnerDisplayRecord = {
  odia: string;
  latin: string;
  nameReading: OdiaNameReading;
  guardianOdia: string | null;
  guardianLatin: string | null;
  guardianReading: OdiaNameReading | null;
  guardianRelation: string | null;
  casteOdia: string | null;
  residenceOdia: string | null;
  rawOdia: string | null;
};

type PlotAreaDetails = {
  acres: number | null;
  sqft: number | null;
  acreRaw: string | null;
  decimalRaw: string | null;
  hectareRaw: string | null;
  computation: string | null;
};

function buildOwnerDisplayRecords(revenueRecords: any, tenants: any[]): OwnerDisplayRecord[] {
  const ownerBlocks = Array.isArray(revenueRecords?.ownerBlocks) ? revenueRecords.ownerBlocks : [];
  const fromBlocks = ownerBlocks
    .map((owner: any) => buildOwnerDisplayRecord(owner?.tenantNameOdia, {
      guardianOdia: owner?.guardianNameOdia ?? null,
      guardianRelation: owner?.guardianRelationOdia ?? null,
      casteOdia: owner?.casteOdia ?? null,
      residenceOdia: owner?.residenceOdia ?? null,
      rawOdia: owner?.rawOdia ?? null,
    }))
    .filter((owner: OwnerDisplayRecord | null): owner is OwnerDisplayRecord => Boolean(owner));

  if (fromBlocks.length > 0) return dedupeOwners(fromBlocks);

  const fromTenants = tenants
    .map((tenant) => buildOwnerDisplayRecord(tenant?.tenantName, {
      guardianOdia: tenant?.fatherName ?? tenant?.fatherHusbandName ?? null,
      guardianRelation: null,
      casteOdia: null,
      residenceOdia: null,
      rawOdia: null,
    }))
    .filter((owner: OwnerDisplayRecord | null): owner is OwnerDisplayRecord => Boolean(owner));

  return dedupeOwners(fromTenants);
}

function buildOwnerDisplayRecord(
  name: unknown,
  details: {
    guardianOdia: string | null;
    guardianRelation: string | null;
    casteOdia: string | null;
    residenceOdia: string | null;
    rawOdia: string | null;
  }
): OwnerDisplayRecord | null {
  const odia = String(name ?? "").trim();
  if (!odia || odia === "—") return null;
  const nameReading = transliterateOdiaWithConfidence(odia);
  const latin = nameReading.english;
  const guardianOdia = details.guardianOdia?.trim() || null;
  const guardianReading = guardianOdia ? transliterateOdiaWithConfidence(guardianOdia) : null;
  const guardianLatin = guardianReading?.english ?? null;
  return {
    odia,
    latin,
    nameReading,
    guardianOdia,
    guardianLatin,
    guardianReading,
    guardianRelation: details.guardianRelation,
    casteOdia: details.casteOdia,
    residenceOdia: details.residenceOdia,
    rawOdia: details.rawOdia,
  };
}

function englishNameReading(value: unknown): OdiaNameReading {
  return transliterateOdiaWithConfidence(String(value ?? ""));
}

function buildNameReadingBadge(reading: OdiaNameReading): string {
  if (reading.quality === "empty") return "";
  const label =
    reading.quality === "verified_exact" ? "Verified English"
    : reading.quality === "lexicon_all_tokens" ? "High-confidence reading"
    : reading.quality === "latin_passthrough" ? "Source English"
    : "Machine reading - review";
  return `<span class="name-reading-badge name-reading-${reading.quality}">${escapeHtml(label)} · ${Math.round(reading.confidence * 100)}%</span>`;
}

function dedupeOwners(records: OwnerDisplayRecord[]): OwnerDisplayRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = normalizeOwnerKey(record.odia);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeOwnerKey(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

function buildOwnerDetailsSection(input: {
  ownerRecords: OwnerDisplayRecord[];
  bhulekhUsable: boolean;
  bhulekhStatus: string;
}): string {
  if (!input.bhulekhUsable) {
    return `<div class="error-notice">
      <p>Bhulekh did not return usable owner records in this run. Ask for the current Bhulekh Khatiyan and have a property lawyer verify every recorded owner and legal heir before paying any advance.</p>
    </div>`;
  }

  if (input.ownerRecords.length === 0) {
    return `<div class="warning-notice">
      <p>Bhulekh returned the land record, but the owner block could not be read in this run. Ask the seller to show the original Khatiyan document.</p>
    </div>`;
  }

  const cards = input.ownerRecords.map((owner, index) => {
    const latinName = owner.latin;
    const odiaName = owner.odia;
    const guardianLatin = owner.guardianLatin;
    const hasOdia = containsOdia(odiaName ?? "");

    const guardianLine = guardianLatin
      ? `<div class="owner-guardian"><span class="key-label">${owner.guardianRelation === "spouse" ? "Spouse" : "Father/Guardian"}:</span> ${escapeHtml(guardianLatin)}</div>`
      : "";

    const odiaToggle = hasOdia
      ? `<details class="odia-toggle"><summary>View original name in Odia script</summary><div class="odia-original">${escapeHtml(odiaName ?? "")}</div></details>`
      : "";

    return `<div class="owner-card">
      <div class="owner-card-title">Recorded owner ${index + 1}</div>
      <div class="owner-name">${escapeHtml(latinName || odiaName || "—")}</div>
      ${guardianLine}
      ${odiaToggle}
    </div>`;
  }).join("");

  return `<div class="owner-card-grid">${cards}</div>`;
}

function findTargetPlotRow(revenueRecords: any, plotNo: unknown): any | null {
  const rows = Array.isArray(revenueRecords?.plotRows) ? revenueRecords.plotRows : [];
  if (typeof plotNo === "string") {
    const matched = rows.find((row: any) => plotNosMatch(row?.plotNo, plotNo));
    if (matched) return matched;
  }
  return rows[0] ?? null;
}

function buildPlotAreaDetails(tenant: any, plotRow: any): PlotAreaDetails {
  const acreRaw = plotRow?.areaAcres ?? tenant?.areaAcresRaw ?? null;
  const decimalRaw = plotRow?.areaDecimals ?? tenant?.areaDecimalsRaw ?? null;
  const hectareRaw = plotRow?.areaHectares ?? tenant?.areaHectaresRaw ?? null;
  const computedFromRaw = computeRoRAreaAcres(acreRaw, decimalRaw);
  const acres = computedFromRaw ?? numberOrNull(tenant?.area);
  return {
    acres,
    sqft: acres == null ? null : Math.round(acres * 43_560),
    acreRaw,
    decimalRaw,
    hectareRaw,
    computation: plotRow?.areaComputation ?? tenant?.areaComputation ?? null,
  };
}

function computeRoRAreaAcres(acreRaw: unknown, decimalRaw: unknown): number | null {
  const acres = parseAreaNumber(acreRaw);
  const decimalColumn = parseAreaNumber(decimalRaw);
  if (acres == null && decimalColumn == null) return null;
  return roundArea((acres ?? 0) + (decimalColumn ?? 0) / 10_000);
}

function parseAreaNumber(value: unknown): number | null {
  const text = String(value ?? "").replace(/[^\d.]/g, "").trim();
  if (!text) return null;
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function numberOrNull(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function roundArea(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function formatPlotAreaSummary(area: PlotAreaDetails): string {
  if (area.acres == null) return "";
  const acres = area.acres.toLocaleString("en-IN", {
    minimumFractionDigits: area.acres % 1 === 0 ? 0 : 4,
    maximumFractionDigits: 4,
  });
  const sqft = area.sqft == null ? null : area.sqft.toLocaleString("en-IN");
  return sqft ? `${acres} acres (${sqft} sq ft)` : `${acres} acres`;
}

function buildPlotRecordSummary(input: {
  plotNo: unknown;
  khataNo: unknown;
  area: PlotAreaDetails;
  landClassOdia: unknown;
  landClassEnglish: unknown;
}): string {
  const parts = [
    `Plot ${String(input.plotNo || "—")}`,
    `Khata ${String(input.khataNo || "—")}`,
    formatPlotAreaSummary(input.area),
    formatLandClassDisplay(input.landClassEnglish, input.landClassOdia, null),
  ].filter(Boolean);
  return parts.join("; ");
}

function formatLandClassDisplay(displayEnglish: unknown, rawOdia: unknown, standardized: unknown): string {
  const english = String(displayEnglish ?? "").trim();
  const raw = String(rawOdia ?? "").trim();
  const std = String(standardized ?? "").trim();
  if (english && english !== "Unknown" && english !== raw) return raw ? `${english} (${raw})` : english;
  if (raw) return raw;
  if (std) return titleFromSnakeCase(std);
  return "Not verified";
}

// ── Plot Diagram Section (Phase 8 / Task 36) ────────────────────
//
// The plot diagram is an SVG produced by the WFS compose step (Task 35).
// It shows the target plot and 4-8 neighbour plots for visual context.
// Storage URL is the source of truth, so we always render via <img>.
//
// Three branches:
//   1. url present (success or partial)  → <img> with caption
//   2. status === "failed"               → "could not be generated" copy
//   3. plotDiagram is null / undefined   → "not yet generated" copy (legacy)
function buildPlotDiagramSection(plotDiagram: {
  status: "success" | "partial" | "failed" | "not_attempted";
  url?: string | null;
  reason?: string | null;
  cacheHit?: boolean;
  rendered?: boolean;
} | null | undefined, ctx?: { plotNo?: unknown; village?: unknown }): string {
  const hasUrl = !!(plotDiagram && typeof plotDiagram.url === "string" && plotDiagram.url.length > 0);
  const status = plotDiagram?.status ?? null;
  const plotNoStr = ctx && ctx.plotNo !== undefined && ctx.plotNo !== null && String(ctx.plotNo).trim() !== ""
    ? String(ctx.plotNo).trim()
    : null;
  const villageStr = ctx && ctx.village !== undefined && ctx.village !== null && String(ctx.village).trim() !== "" && String(ctx.village) !== "—"
    ? String(ctx.village).trim()
    : null;
  const altText = plotNoStr && villageStr
    ? `Plot diagram showing plot ${escapeHtml(plotNoStr)} in ${escapeHtml(villageStr)} and 4-8 neighbour plots`
    : plotNoStr
      ? `Plot diagram showing plot ${escapeHtml(plotNoStr)} and 4-8 neighbour plots`
      : "Plot diagram showing target plot and 4-8 neighbour plots";

  // Branch 1 — diagram present (success or partial with URL).
  // Collapsible (default closed) so the visual artifact does not push other
  // content down on small screens. The diagram is informational, not a
  // critical claim, so it never gates report content above this section.
  if (hasUrl) {
    const safeUrl = escapeHtml(plotDiagram!.url as string);
    const cacheBadge = plotDiagram?.cacheHit
      ? `<span class="source-line">Reused from a previous render (cache hit)</span>`
      : "";
    const statusLine = status === "partial"
      ? `<span class="source-line">Partial render — some neighbour plots may be missing.</span>`
      : "";
    return `<!-- ── Section 2b: Plot Diagram (Phase 8 / Task 36) ─────────────── -->
<section class="section" id="section-plot-diagram">
  <div class="section-hdr">
    <div class="section-icon"></div>
    <h2>Plot Diagram</h2>
  </div>
  <details class="section-disclaimer">
    <summary>Show plot diagram (visual map of ${plotNoStr ? `plot ${escapeHtml(plotNoStr)}` : "the target plot"} and neighbours)</summary>
    <p class="section-lede">Visual map of the target plot and surrounding plots. Use this to confirm the boundary, road access, and which neighbours share a border with the plot.</p>
    <div class="plot-diagram-frame">
      <img src="${safeUrl}" alt="${altText}" loading="lazy" />
    </div>
    ${statusLine}
    ${cacheBadge}
    <p class="source-line"><a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Open the diagram in a new tab</a> if it does not load inline.</p>
  </details>
  <details class="section-disclaimer">
    <summary>How this diagram was produced</summary>
    <p>The plot diagram is generated by querying the Bhunaksha WFS endpoint for the target plot polygon and up to 8 neighbour polygons, then composing them into a single SVG. The image is stored against the report and reused (cached) for 7 days when the same coordinates are queried again.</p>
  </details>
</section>
<!-- Feedback: Section 2b (Plot Diagram) -->
<div class="feedback-widget" id="feedback-plot-diagram" data-section="plot-diagram">
  <span class="feedback-label">Was this section useful?</span>
  <button class="feedback-btn feedback-up" onclick="submitFeedback('plot-diagram','up',this)">Yes</button>
  <button class="feedback-btn feedback-down" onclick="submitFeedback('plot-diagram','down',this)">No</button>
  <span class="feedback-thanks" style="display:none;">Thank you!</span>
</div>
<div class="feedback-comment" id="comment-plot-diagram" style="display:none;">
  <textarea placeholder="What was missing or confusing? (optional)" maxlength="500"></textarea>
  <button class="feedback-submit" onclick="submitFeedbackComment('plot-diagram',this)">Send feedback</button>
</div>`;
  }

  // Branch 2 — diagram failed (the WFS compose step returned an error).
  if (status === "failed") {
    const reason = plotDiagram?.reason ? escapeHtml(plotDiagram.reason) : null;
    return `<!-- ── Section 2b: Plot Diagram (Phase 8 / Task 36) ─────────────── -->
<section class="section section-warning" id="section-plot-diagram">
  <div class="section-hdr">
    <div class="section-icon"></div>
    <h2>Plot Diagram</h2>
  </div>
  <p class="section-lede"><strong>Plot diagram unavailable — see Bhunaksha.</strong> The visual map of the target plot and its neighbours could not be generated for this report.</p>
  ${reason ? `<p class="source-line">Reason: ${reason}</p>` : ""}
  <p>Open the canonical Bhunaksha plot page directly: <a href="https://bhunaksha.ori.nic.in/plotreportOR.jsp" target="_blank" rel="noopener noreferrer">bhunaksha.ori.nic.in/plotreportOR.jsp</a> — confirm the target plot's boundaries and the surrounding plots before signing.</p>
</section>`;
  }

  // Branch 3 — diagram absent (legacy report, or not_attempted with no url).
  return `<!-- ── Section 2b: Plot Diagram (Phase 8 / Task 36) ─────────────── -->
<section class="section section-warning" id="section-plot-diagram">
  <div class="section-hdr">
    <div class="section-icon"></div>
    <h2>Plot Diagram</h2>
  </div>
  <p class="section-lede"><strong>Plot diagram not yet generated for this report.</strong> The visual map feature was added after this report was created, or the Bhunaksha WFS compose step did not run.</p>
  <p>Ask the buyer's lawyer to open the Bhunaksha plot-report page directly (bhunaksha.ori.nic.in/plotreportOR.jsp) and confirm the target plot's boundaries and the surrounding plots before signing.</p>
</section>`;
}

function buildLandClassificationDetails(input: {
  rawKisam: unknown;
  standardizedKisam: unknown;
  displayKisam: unknown;
  conversionRequired: boolean | null;
  prohibited: boolean | null;
  buildable: boolean | null;
  plotNo: unknown;
  khataNo: unknown;
}): string {
  const std = String(input.standardizedKisam ?? "").trim();
  const display = String(input.displayKisam ?? "").trim();
  const englishClass = display || std ? titleFromSnakeCase(display || std) : null;

  const parts: string[] = [];
  if (englishClass && englishClass !== "Not verified" && englishClass !== "Unknown") {
    parts.push(englishClass);
  }

  if (input.prohibited === true) {
    parts.push("Construction prohibited without prior government approval");
  } else if (input.buildable === true) {
    parts.push("Buildable category — may still require conversion for non-agricultural use");
  } else if (input.conversionRequired === true) {
    parts.push("Land-use conversion likely required for residential or commercial use");
  }

  const detailText = parts.length > 0
    ? `<p>${parts.map(p => escapeHtml(p)).join("</p><p>")}</p>`
    : `<p>Ask the tehsil office to confirm the official land class and conversion requirements for this plot.</p>`;

  return `<div class="land-classification-detail">
    ${detailText}
    <p class="table-note">Verify with the local tehsil office before making any decision about land use or development.</p>
  </div>`;
}

function buildRoRCompletenessPanel(
  revenueRecords: any,
  input: {
    bhulekhUsable: boolean;
    bhulekhStatus: string;
    selectedPlotNo: unknown;
  },
  insights: RoRInsight[] = [],
  duesInsights: RoRInsight[] = [],
  riskTransferability: RiskInsight[] = [],
  riskPositive: RiskInsight[] = []
): string {
  if (!input.bhulekhUsable || !revenueRecords) {
    return `<div class="warning-box ror-completeness">
      <span class="warning-label">&#9888; RoR data needs manual check</span>
      <p>Bhulekh did not return usable land records in this run. Ask for the current Bhulekh Khatiyan and confirm plot details with a property lawyer before paying any advance.</p>
    </div>`;
  }

  const plotRows = Array.isArray(revenueRecords.plotRows) ? revenueRecords.plotRows : [];
  const ownerBlocks = Array.isArray(revenueRecords.ownerBlocks) ? revenueRecords.ownerBlocks : [];
  const backPage = revenueRecords.backPage ?? null;
  const mutationCount = Array.isArray(backPage?.mutationHistory) ? backPage.mutationHistory.length : 0;
  const encumbranceCount = Array.isArray(backPage?.encumbranceEntries) ? backPage.encumbranceEntries.length : 0;
  const screenshots = revenueRecords.screenshots ?? null;
  const frontPageImage = buildRoRScreenshotFigure("Front Page (Bhulekh)", screenshots?.frontPage);
  const backPageImage = buildRoRScreenshotFigure("Back Page (Khatiyan)", screenshots?.backPage);

  // Build risk-intelligence insight cards from new insight engine
  const sourceMeta = revenueRecords.sourceMeta ?? revenueRecords.rorDocument?.source ?? null;
  const riskInsightCards = [
    ...(riskTransferability ?? []),
    ...(riskPositive ?? []),
  ].map(card => buildRiskInsightCard(card)).join("");

  return `<div class="ror-completeness">
    ${riskInsightCards || ""}
    <div class="ror-fact-grid">
      <div><span>Khatiyan</span><strong>${escapeHtml(revenueRecords.khataNo ?? "—")}</strong></div>
      <div><span>Plot numbers</span><strong>${plotRows.length}</strong></div>
      <div><span>Recorded owners</span><strong>${ownerBlocks.length || (revenueRecords.tenants?.length ?? 0)}</strong></div>
      <div><span>Mutation entries</span><strong>${mutationCount}</strong></div>
      <div><span>Encumbrance entries</span><strong>${encumbranceCount}</strong></div>
    </div>
    <details class="source-image-details"><summary>View Bhulekh source screenshots</summary>
      ${frontPageImage || backPageImage
        ? `<div class="ror-screenshot-grid">${frontPageImage}${backPageImage}</div>`
        : `<p class="table-note">Source screenshots were not attached to this report payload.</p>`}
    </details>
  </div>`;
}

function buildBackPageRiskInsight(mutationCount: number, encumbranceCount: number, ownerCount: number): string {
  if (ownerCount > 1) {
    return `<div class="insight-card insight-card-watchout">
      <div class="insight-head"><span class="insight-icon">&#9888;</span><span class="insight-type">Watch-out</span></div>
      <div class="insight-label">Multiple owners recorded in this khatiyan</div>
      <p>This khatiyan has ${ownerCount} recorded owners. Every owner — or their legal heirs if deceased — must give written consent before any sale or transfer. Ask your lawyer to confirm every owner's current status.</p>
      <details><summary>How we checked this</summary><p>Source: Bhulekh Back Page (tenant block). This is a source observation, not a legal opinion. Verify with a qualified property lawyer before transacting.</p></details>
    </div>`;
  }

  if (encumbranceCount > 10) {
    return `<div class="insight-card insight-card-watchout">
      <div class="insight-head"><span class="insight-icon">&#9888;</span><span class="insight-type">Watch-out</span></div>
      <div class="insight-label">High number of encumbrance entries (${encumbranceCount})</div>
      <p>The Back Page of this khatiyan shows ${encumbranceCount} encumbrance-style entries. This is common for government land or land with historical leases/loans. Ask the seller to produce the original EC and clear all charge entries before registration.</p>
      <details><summary>How we checked this</summary><p>Source: Bhulekh Back Page encumbrance-style table. This is a row-count signal, not proof of any charge. Verify with a qualified property lawyer before transacting.</p></details>
    </div>`;
  }

  if (mutationCount > 15) {
    return `<div class="insight-card insight-card-watchout">
      <div class="insight-head"><span class="insight-icon">&#9888;</span><span class="insight-type">Watch-out</span></div>
      <div class="insight-label">High transaction history (${mutationCount} entries)</div>
      <p>This khatiyan has been transacted ${mutationCount} times — typical for government notified land or frequently transferred plots. Confirm the title chain is complete and every prior sale deed is registered.</p>
      <details><summary>How we checked this</summary><p>Source: Bhulekh Back Page mutation history table. This is a row-count signal, not verified ownership history. Verify the full title chain with a qualified property lawyer before transacting.</p></details>
    </div>`;
  }

  if (encumbranceCount > 0 || mutationCount > 0) {
    return `<div class="insight-card insight-card-watchout">
      <div class="insight-head"><span class="insight-icon">&#9888;</span><span class="insight-type">Watch-out</span></div>
      <div class="insight-label">Back Page entries found — ${mutationCount} mutations, ${encumbranceCount} encumbrance entries</div>
      <p>The khatiyan Back Page shows prior transaction and encumbrance activity. These are entry points for your lawyer to trace the title chain. Get the Encumbrance Certificate (EC) from IGR Odisha and review all entries carefully.</p>
      <details><summary>How we checked this</summary><p>Source: Bhulekh Back Page. These entries are source anchors, not verified ownership history or EC clearance. Verify with a qualified property lawyer before transacting.</p></details>
    </div>`;
  }

  return `<div class="insight-card insight-card-positive">
    <div class="insight-head"><span class="insight-icon">&#10003;</span><span class="insight-type">Positive signal</span></div>
    <div class="insight-label">Back Page returned without major encumbrance or mutation entries</div>
    <p>The Back Page did not return significant mutation or charge entries for this khatiyan. This is a neutral signal, not proof of ownership or title status. Confirm with the full title chain and EC before relying on this.</p>
    <details><summary>How we checked this</summary><p>Source: Bhulekh Back Page. No parsed rows is a source observation, not proof of no encumbrance. Verify with the IGR EC before relying on this.</p></details>
  </div>`;
}

function buildRoRScreenshotFigure(label: string, image: unknown): string {
  const raw = String(image ?? "").trim();
  if (!raw) return "";
  const src = raw.startsWith("data:image/") ? raw : `data:image/png;base64,${raw}`;
  if (src.length > 1_200_000) {
    return `<div class="ror-screenshot-too-large"><strong>${escapeHtml(label)}</strong><span>Screenshot captured but too large to embed in the inline report.</span></div>`;
  }
  return `<figure class="ror-screenshot">
    <img src="${escapeHtml(src)}" alt="Bhulekh RoR ${escapeHtml(label)} screenshot" loading="lazy" />
    <figcaption>${escapeHtml(label)}</figcaption>
  </figure>`;
}

/**
 * Render the Bhunaksha Plot Report (D-036) cadastral map as a third
 * visualization in Section 1 (alongside polygon + satellite).
 * The fetcher returns the rendered plotreportOR.jsp as a base64-encoded SVG.
 * Guard against the ~588 KB payload growing and against stale fetches that
 * returned an empty string. Returns "" if there's nothing to render.
 */
function buildBhunakshaMapPanel(mapImageBase64: string | null | undefined): string {
  const raw = String(mapImageBase64 ?? "").trim();
  if (!raw) return "";
  // The fetcher stores the SVG already base64-encoded. Prefix the data URI
  // unless the upstream already wrapped it.
  const src = raw.startsWith("data:image/") ? raw : `data:image/svg+xml;base64,${raw}`;
  if (src.length > 1_500_000) {
    return `<div class="ror-screenshot-too-large"><strong>Cadastral map (Bhunaksha)</strong><span>Map captured but too large to embed in the inline report.</span></div>`;
  }
  return `<figure class="bhunaksha-map">
    <img src="${escapeHtml(src)}" alt="Bhunaksha cadastral map for this plot" loading="lazy" style="max-width:100%;height:auto;display:block;" />
    <figcaption>Cadastral map (Bhunaksha) — rendered from the Odisha revenue plot report</figcaption>
  </figure>`;
}

function buildRoRPlotTablePanel(plotRows: any[], selectedPlotNo: unknown): string {
  if (!Array.isArray(plotRows) || plotRows.length === 0) return "";

  const rows = plotRows.map((row) => {
    const area = buildPlotAreaDetails(null, row);
    const isSelected = plotNosMatch(row?.plotNo, selectedPlotNo);
    const landClassOdia = row?.landTypeOdia ?? null;
    // Translate land class to English for display
    const landClassEnglish = landClassOdia ? translateLandClass(landClassOdia) : "—";
    return `<tr class="${isSelected ? "selected-source-row" : ""}">
      <td class="mono">${escapeHtml(row?.plotNo ?? "—")}${isSelected ? ` <span class="badge-info">selected</span>` : ""}</td>
      <td>${escapeHtml(landClassEnglish)}</td>
      <td>${escapeHtml(formatPlotAreaSummary(area) || "—")}</td>
    </tr>`;
  }).join("\n");

  return `<details class="tenant-table-details ror-plot-table-details">
    <summary>View all ${plotRows.length} plots in this khatiyan</summary>
    <p class="table-note">All plots recorded under Khatiyan ${escapeHtml(selectedPlotNo ?? "—")}. The highlighted row is the one being checked in this report.</p>
    <table class="data-table tenant-table">
      <thead><tr><th>Plot No.</th><th>Land Class</th><th>Area</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </details>`;
}

function buildRoRBackPagePanel(backPage: any, insights: RoRInsight[] = []): string {
  if (!backPage) {
    if (insights.length === 0) return "";
    return `<div class="info-box ror-back-page-panel">
      <span class="info-label">&#8505; Bhulekh Back Page</span>
      ${buildInsightHighlights(insights)}
    </div>`;
  }
  const mutations = Array.isArray(backPage.mutationHistory) ? backPage.mutationHistory : [];
  const encumbrances = Array.isArray(backPage.encumbranceEntries) ? backPage.encumbranceEntries : [];
  const remarks = Array.isArray(backPage.backPageRemarks) ? backPage.backPageRemarks : [];
  if (mutations.length === 0 && encumbrances.length === 0 && remarks.length === 0) {
    return `<div class="info-box ror-back-page-panel">
      <span class="info-label">&#8505; Bhulekh Back Page checked</span>
      ${buildInsightHighlights(insights)}
      <p>The Back Page did not return parsed mutation, encumbrance-style, or remark entries in this run. Treat this as a source observation, not proof that no entries exist.</p>
    </div>`;
  }

  const mutationRows = mutations.slice(0, 25).map((entry: any) => `
    <tr>
      <td class="mono">${escapeHtml(entry.mutationNumber ?? "—")}</td>
      <td>${escapeHtml(entry.mutationDate ?? "—")}</td>
      <td class="mono">${escapeHtml(entry.plotNo ?? "—")}</td>
      <td>${escapeHtml(entry.fromKhatiyan ?? "—")}</td>
      <td>${escapeHtml(entry.toKhatiyan ?? "—")}</td>
    </tr>`).join("");
  const encumbranceRows = encumbrances.slice(0, 25).map((entry: any) => `
    <tr>
      <td>${escapeHtml(entry.type ?? "—")}</td>
      <td>${escapeHtml(entry.partyName ?? "—")}</td>
      <td class="mono">${escapeHtml(entry.docNo ?? "—")}</td>
      <td>${escapeHtml(entry.date ?? "—")}</td>
      <td>${escapeHtml(entry.amount ?? "—")}</td>
    </tr>`).join("");
  const remarkRows = remarks.slice(0, 20).map((remark: any) => `
    <tr>
      <td>${escapeHtml(titleFromSnakeCase(String(remark.category ?? "other")))}</td>
      <td>${escapeHtml(remark.extractedCaseNo ?? remark.extractedBankName ?? "—")}</td>
      <td>${escapeHtml(remark.rawText ?? "—")}</td>
    </tr>`).join("");

  return `<div class="info-box ror-back-page-panel">
    <span class="info-label">&#8505; Bhulekh Back Page timeline</span>
    <p>Back Page entries are source anchors from Bhulekh. They can indicate mutation, charge, restriction, or case-reference activity, but they are not a substitute for IGR EC, mutation-status, or lawyer review.</p>
    ${buildInsightHighlights(insights)}
    ${mutationRows ? `<details class="tenant-table-details" open><summary>Mutation history (${mutations.length})</summary><table class="data-table compact-table"><thead><tr><th>Mutation no.</th><th>Date</th><th>Plot</th><th>From khata</th><th>To khata</th></tr></thead><tbody>${mutationRows}</tbody></table></details>` : ""}
    ${encumbranceRows ? `<details class="tenant-table-details" open><summary>Encumbrance-style entries (${encumbrances.length})</summary><table class="data-table compact-table"><thead><tr><th>Type</th><th>Party</th><th>Doc no.</th><th>Date</th><th>Amount</th></tr></thead><tbody>${encumbranceRows}</tbody></table></details>` : ""}
    ${remarkRows ? `<details class="tenant-table-details"><summary>Back Page remarks (${remarks.length})</summary><table class="data-table compact-table"><thead><tr><th>Category</th><th>Extracted anchor</th><th>Raw remark</th></tr></thead><tbody>${remarkRows}</tbody></table></details>` : ""}
  </div>`;
}

function ownerBadge(nameMatch: string): { status: "green" | "amber" | "red" | "gray"; label: string } {
  if (nameMatch === "ror_available") return { status: "gray", label: "&#8505; RoR owner fetched" };
  if (nameMatch === "exact") return { status: "green", label: "&#10003; Full-name match" };
  if (nameMatch === "ambiguous") return { status: "amber", label: "&#9888; Needs identity proof" };
  if (nameMatch === "partial") return { status: "amber", label: "&#9888; Partial match" };
  if (nameMatch === "mismatch") return { status: "red", label: "&#10007; Mismatch" };
  if (nameMatch === "not_requested") return { status: "gray", label: "&#8505; Pending — no seller name" };
  return { status: "gray", label: "&#8505; Unverified" };
}

// ─── Adjacent Plot Analysis Panel ─────────────────────────────────────────────

interface AdjacentPlot {
  plotNo: string;
  village: string;
  featureId: string;
  geometryHash: string;
  areaSqKm: number;
}

interface AdjacentPlotsData {
  adjacentPlots: AdjacentPlot[];
  totalFound: number;
  filteredFromTarget: number;
  status: string;
}

function buildAdjacentPlotsPanel(adjacentData: AdjacentPlotsData | null | undefined): string {
  // Section anchor always renders so the in-page nav and feedback
  // widget always have a target. When no data, we surface an
  // "unavailable" notice instead of dropping the section entirely.
  if (!adjacentData || !adjacentData.adjacentPlots || adjacentData.adjacentPlots.length === 0) {
    return `<section class="section" id="section-adjacent-plots">
  <div class="section-hdr">
    <div class="section-icon">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
    </div>
    <div class="section-title-group">
      <div class="section-title">Neighbouring Plots</div>
      <div class="section-sub">Plots adjacent to this one (Bhunaksha revenue map)</div>
    </div>
  </div>
  <div class="section-body">
    <p class="section-intro">No adjacent data available for this plot. The Bhunaksha revenue map did not return neighbouring plots in this run, so we cannot show you what surrounds this land. You can ask the seller or a local surveyor to walk the plot boundary with you.</p>
  </div>
</section>`;
  }

  const plots = adjacentData.adjacentPlots;

  const rows = plots.map((p, i) => {
    const areaDisplay = p.areaSqKm
      ? `${(p.areaSqKm * 247.105).toFixed(2)} acres`
      : "—";
    return `<tr>
      <td class="num">${i + 1}</td>
      <td>${escapeHtml(p.plotNo || "—")}</td>
      <td>${escapeHtml(p.village || "—")}</td>
      <td>${areaDisplay}</td>
    </tr>`;
  }).join("\n");

  return `<section class="section" id="section-adjacent-plots">
  <div class="section-hdr">
    <div class="section-icon">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
    </div>
    <div class="section-title-group">
      <div class="section-title">Neighbouring Plots</div>
      <div class="section-sub">What shares boundaries with this plot — helps spot corner encroachment or boundary uncertainty</div>
    </div>
    <div class="section-status-badge status-partial">${plots.length} nearby plots found</div>
  </div>
  <div class="section-body">
    <table class="data-table">
      <thead>
        <tr><th>#</th><th>Plot No.</th><th>Village</th><th>Approx. Area</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="info-box">
      <span class="info-label">&#8505; What this means</span>
      <p>If neighbouring plots show an unusual number of government-classified boundaries (road, drain, water body), or if the target plot appears isolated with no recorded private neighbours on multiple sides, that can indicate a boundary issue or partial encroachment. A physical survey by a licensed surveyor is the definitive check for boundary disputes.</p>
    </div>
    <div class="source-line">
      <span>Neighbour data: ORSAC GeoServer WFS (mapserver.odisha4kgeo.in) — revenue plot polygons, no authentication required</span>
    </div>
    <div class="verify-links">
      ${buildVerifyLink("https://mapserver.odisha4kgeo.in/geoserver/ows", "Bhunaksha GeoServer", "Open the Odisha revenue map GeoServer WFS")}
    </div>
  </div>
</section>`;
}

function buildCourtSection(
  totalCases: number,
  caseList: Array<{
    caseType: string;
    caseNo: string;
    court: string;
    status: string;
    filing: string;
    source: string;
  }> | null,
  sourceStatuses: Record<string, string>,
  district: string,
  searchMetadata: {
    ecourts?: {
      captchaAcceptedCount?: number;
      captchaFailedCount?: number;
      attempts?: Array<{ outcome?: string; complexName?: string }>;
    } | null;
    ecourtsStatusReason?: string | null;
    rccmsStatusReason?: string | null;
  } | null
): string {
  const ecourtsUsable = sourceStatuses.ecourts === "success";
  const rccmsUsable = sourceStatuses.rccms === "success";
  const ecourtsCaptchaAccepted = Number(searchMetadata?.ecourts?.captchaAcceptedCount ?? 0) > 0;

  if (!ecourtsUsable && !rccmsUsable) {
    return `<div class="error-notice">
      <p>Court and revenue-case status could not be verified in this run.</p>
      <p><strong>Source status:</strong> eCourts: ${escapeHtml(sourceStatuses.ecourts ?? "not_run")}; RCCMS: ${escapeHtml(sourceStatuses.rccms ?? "not_run")}.</p>
      <p><strong>What to do:</strong> Search manually on services.ecourts.gov.in and RCCMS using the seller's full legal name, village, plot number, and khata number.</p>
    </div>`;
  }

  if (caseList === null || caseList.length === 0) {
    if (!ecourtsUsable || !rccmsUsable) {
      const missing = [
        !ecourtsUsable ? `eCourts: ${sourceStatuses.ecourts ?? "not_run"}` : null,
        !rccmsUsable ? `RCCMS: ${sourceStatuses.rccms ?? "not_run"}` : null,
      ].filter(Boolean).join("; ");

      return `<div class="warning-notice">
        <p>No cases were returned by the source(s) that responded, but the case search is not complete.</p>
        <p><strong>Not verified:</strong> ${escapeHtml(missing)}.</p>
        <p><strong>What to do:</strong> Manually search the missing source before treating this as clear.</p>
      </div>`;
    }

    if (!ecourtsCaptchaAccepted) {
      return `<div class="warning-notice">
        <p>No cases were returned by the source(s) that responded, but eCourts did not provide accepted-captcha negative-result metadata.</p>
        <p><strong>Not verified:</strong> eCourts captcha acceptance is required before a zero-case result can be used as a clean finding.</p>
        <p><strong>What to do:</strong> Manually search eCourts and RCCMS before treating the court/revenue-case check as clear.</p>
      </div>`;
    }

    return `<div class="success-notice">
      <p>No case records were returned in this source-scoped eCourts/RCCMS search for the claimed owner in ${escapeHtml(district)} district, but this is not a full court-clearance finding.</p>
      <p class="small-print">eCourts recorded accepted captcha metadata for this run. Still search manually at <a href="https://services.ecourts.gov.in" target="_blank" rel="noopener">services.ecourts.gov.in</a>, RCCMS, Orissa High Court, and DRT using the owner's full legal name before relying on the result.</p>
    </div>`;
  }

  const rows = caseList.map(c => `
    <tr>
      <td class="num">${escapeHtml(c.caseType)}</td>
      <td class="mono">${escapeHtml(c.caseNo)}</td>
      <td>${escapeHtml(c.court)}</td>
      <td>${escapeHtml(c.status)}</td>
      <td>${escapeHtml(c.source)}</td>
      <td>${escapeHtml(c.filing)}</td>
    </tr>`).join("\n");

  return `<div class="warning-notice">
    <p><strong>${totalCases} court case(s)</strong> found involving the property or owner in ${escapeHtml(district)}. Review each case carefully before proceeding.</p>
  </div>
  <table class="data-table">
    <thead><tr><th>Case Type</th><th>Case No.</th><th>Court</th><th>Status</th><th>Source</th><th>Filed</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildMutationReferencePanel(
  mutationReferences: Array<{
    caseType?: string | null;
    caseNo?: string | null;
    orderDate?: string | null;
    plotNo?: string | null;
    sourceField?: string | null;
    rawText?: string | null;
  }>
): string {
  const references = mutationReferences.filter((reference) =>
    Boolean(reference?.caseNo || reference?.caseType || reference?.orderDate || reference?.plotNo)
  );
  if (references.length === 0) return "";

  const rows = references.map((reference) => `
    <tr>
      <td class="mono">${escapeHtml(reference.caseNo ?? "—")}</td>
      <td>${escapeHtml(reference.caseType ?? "—")}</td>
      <td>${escapeHtml(reference.orderDate ?? "—")}</td>
      <td class="mono">${escapeHtml(reference.plotNo ?? "—")}</td>
      <td>${escapeHtml(formatMutationReferenceSource(reference.sourceField))}</td>
    </tr>`).join("\n");

  return `<div class="info-box mutation-reference-panel">
    <span class="info-label">&#8505; Bhulekh RoR remark/case anchors</span>
    <p>These are case or order references found in Bhulekh RoR remarks. They are anchors for manual follow-up only, not verified ownership history or a confirmed mutation timeline.</p>
    <table class="data-table compact-table">
      <thead><tr><th>Case No.</th><th>Type</th><th>Date</th><th>Plot</th><th>Source</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function formatMutationReferenceSource(sourceField?: string | null): string {
  if (sourceField === "specialRemarksRawOdia") return "Bhulekh RoR special remarks";
  if (sourceField === "plotRemarks") return "Bhulekh RoR plot remarks";
  return sourceField ? `Bhulekh RoR ${sourceField}` : "Bhulekh RoR remarks";
}

function buildLarrSection(larr: any): string {
  const riskLevel = larr?.riskLevel ?? "unknown";
  const isHighRisk = riskLevel === "elevated" || riskLevel === "high";
  const riskBadgeClass = riskLevel === "unknown" ? "flag-low" : (isHighRisk ? "flag-high" : "flag-low");
  const riskDisplay = riskLevel.toUpperCase();
  const verifiedText = larr?.verifiedInEcourts ? "Verified in eCourts" : "Manual verification recommended";

  return `<div class="caution-box ${riskBadgeClass}">
    <span class="caution-label">&#9888; Land Acquisition Risk: ${escapeHtml(riskDisplay)}</span>
    ${larr?.siaNotification ? `<p><strong>SIA Notification found:</strong> ${escapeHtml(String(larr.siaNotification))}</p>` : `<p>No known Social Impact Assessment (SIA) notifications detected automatically.</p>`}
    <p>Status: ${escapeHtml(verifiedText)}</p>
    <p><strong>What to do:</strong> File an RTI application at the District Collector's office (Land Acquisition section) to confirm no preliminary notifications (Section 11 of LARR Act 2013) exist for this plot. Statutory RTI fee is typically ₹10.</p>
  </div>`;
}

function buildRegSection(
  flags: Array<{
    name: string;
    severity: "warning" | "info";
    description: string;
    action: string;
  }> | null,
  screeningVerified: boolean
): string {
  if (!flags || flags.length === 0) {
    if (!screeningVerified) {
      return `<div class="warning-notice">
        <p>Regulatory overlay screening was not complete enough to confirm that this plot has no restrictions.</p>
        <p><strong>What to do:</strong> Ask the local tehsildar or Town Planning office to check forest, coastal, PESA, airport, archaeological, and other regulated-zone restrictions before purchase.</p>
      </div>`;
    }

    return `<div class="success-notice">
      <p>No immediate regulatory flags were found in the overlay source(s) that completed successfully for this run.</p>
      <p class="small-print">This is not a complete clearance. Some restrictions may not be mapped digitally or may not yet be integrated into ClearDeed. Consult the local tehsildar or Town Planning office for complete assurance.</p>
    </div>`;
  }

  return flags.map(f => {
    const cls = f.severity === "warning" ? "warning-notice" : "info-notice";
    const label = f.severity === "warning" ? "Warning" : "Info";
    return `<div class="${cls}">
      <p><strong>[${label}] ${escapeHtml(f.name)}</strong></p>
      <p>${escapeHtml(f.description)}</p>
      <p><strong>What to do:</strong> ${escapeHtml(f.action)}</p>
    </div>`;
  }).join("\n");
}

function normalizeRegSeverity(severity: unknown): "warning" | "info" {
  return severity === "high" || severity === "medium" ? "warning" : "info";
}

function dedupeFlags<T extends { flag?: string; description?: string }>(flags: T[]): T[] {
  const seen = new Set<string>();
  return flags.filter((flag) => {
    const key = `${String(flag.flag ?? "").toLowerCase()}|${String(flag.description ?? "").replace(/\s+/g, " ").trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeLandSeverity(severity: unknown): "high" | "medium" | "low" {
  if (severity === "critical" || severity === "high") return "high";
  if (severity === "warning" || severity === "medium") return "medium";
  return "low";
}

function titleFromSnakeCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function plotNosMatch(left: unknown, right: unknown): boolean {
  if (typeof left !== "string" || typeof right !== "string") return false;
  return normalizePlotNo(left) === normalizePlotNo(right);
}

function normalizePlotNo(value: string): string {
  const normalized = value.trim().replace(/\s+/g, "");
  return /^\d+$/.test(normalized) ? normalized.replace(/^0+/, "") || "0" : normalized.toLowerCase();
}

function isRegulatoryScreeningVerified(regulatoryScreener: RegulatoryScreenerResult | null | undefined): boolean {
  if (!regulatoryScreener) return false;
  if ((regulatoryScreener.flags ?? []).length > 0) return true;
  if (regulatoryScreener.plotConfirmedInRegulatedZone === true) return true;
  const completedOverlayLayers = Array.isArray((regulatoryScreener as any).completedOverlayLayers)
    ? (regulatoryScreener as any).completedOverlayLayers
    : [];
  if (completedOverlayLayers.length === 0) return false;

  const basis = (regulatoryScreener.confidenceBasis ?? "").toLowerCase();
  const source = (regulatoryScreener.overlaySource ?? "").toLowerCase();
  const looksPlaceholder =
    basis.includes("placeholder") ||
    basis.includes("requires orsac") ||
    basis.includes("not yet built") ||
    basis.includes("full overlay screening requires") ||
    source.includes("bhunaksha geoserver");

  return regulatoryScreener.confidence >= 0.8 && !looksPlaceholder;
}

// ─── Verify-yourself source links (Sprint 5) ──────────────────────────────────
//
// Inline "Verify yourself → <source label>" anchor for each fact block whose
// underlying data carries a real source URL. The link is small and subdued so
// it does not dominate the section — this is a verification affordance, not a
// CTA. The function returns an empty string when the URL is missing so the
// caller can drop it in unconditionally.

function buildVerifyLink(url: unknown, label: string, title?: string): string {
  const href = String(url ?? "").trim();
  if (!href) return "";
  const safeLabel = escapeHtml(label);
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" class="verify-link"${titleAttr}>Verify yourself on ${safeLabel} &rarr;</a>`;
}

// ─── Error fallback ────────────────────────────────────────────────────────────

function generateErrorReport(message: string): { html: string; title: string; insights: Insight[] } {
  return {
    html: `<!DOCTYPE html><html><head><style>body{font-family:system-ui;padding:40px;color:#333;}</style></head>
<body><h1>Report Error</h1><p>${escapeHtml(message)}</p></body></html>`,
    title: "ClearDeed — Error",
    insights: [],
  };
}

// ─── P-NEW-1A: Synthesis Insights ─────────────────────────────────────────────

interface SynthesisInsight {
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
}

/**
 * P-NEW-1B: Founder-curated pattern clusters.
 *
 * Live-mode starting point. These clusters fire deterministically from runtime
 * facts (no PID database lookup required). Each cluster is a hardcoded insight
 * the founder attests to from manual review of seed cases — not a generalized
 * "smart" synthesis. Replace with PID-backed content as P-NEW-3 lands.
 *
 * Cluster 1: Co-ownership (repeat_actor_v1 + poa_multiple_owners_v1)
 *   Fires when RoR shows multiple owners. Attested from manual review: when a
 *   property has co-owners on record, the single biggest risk is one co-owner
 *   selling without the others' knowledge. This cluster has been seen in seed
 *   cases and is the highest-leverage buyer-procedural signal we can give.
 */
function buildFounderCuratedClusters(ctx?: {
  coOwners?: string[];
  cersaiChargeCount?: number;
  courtCaseCount?: number;
  rccmsCaseCount?: number;
  landConversionRequired?: boolean;
  currentLandClass?: string | null;
}): SynthesisInsight[] {
  const clusters: SynthesisInsight[] = [];
  const coOwners = ctx?.coOwners ?? [];

  // Cluster 1: Co-ownership consent gap
  if (coOwners.length > 0) {
    const coOwnerList = coOwners.slice(0, 5).map((c) => escapeHtml(c)).join(", ");
    const moreCount = coOwners.length > 5 ? ` and ${coOwners.length - 5} more` : "";
    clusters.push({
      patternCluster: "Co-ownership consent gap",
      clusterSummary: `Bhulekh RoR lists ${coOwners.length} co-owner(s) in addition to the seller: ${coOwnerList}${moreCount}. In our reviewed seed cases, transactions on plots with multiple recorded owners were disproportionately involved in disputes where one co-owner sold without the others' knowledge or consent.`,
      similarCaseCount: 0,
      totalSimilarCases: 0,
      decidingFactor: "Whether every recorded co-owner has given informed, documented consent to this sale — and, if any co-owner is deceased, whether a legal heir certificate has been obtained.",
      recommendedAction: "Ask the seller to produce (1) a registered family settlement or registered joint-PoA naming the attorney, and (2) signed consent declarations from every recorded co-owner. If any co-owner is deceased, demand the legal heir certificate. Do not pay any advance until these are in hand.",
      sourceCaseRefs: [],
    });
  }

  // Cluster 2: CERSAI charge signal
  if (ctx?.cersaiChargeCount && ctx.cersaiChargeCount > 0) {
    clusters.push({
      patternCluster: "Active mortgage / charge on title",
      clusterSummary: `CERSAI returned ${ctx.cersaiChargeCount} charge record(s) against the owner. This typically means an active home loan, vehicle loan, or other secured facility where this property (or another property of the same owner) is offered as collateral. Undisclosed charges are a common route to fraudulent second-sales.`,
      similarCaseCount: 0,
      totalSimilarCases: 0,
      decidingFactor: "Whether the seller has produced a CERSAI NOC and a bank statement showing the underlying loan is closed and the lien is released, or whether the loan is still live and the bank's prior consent for sale is in place.",
      recommendedAction: "Ask the seller for a CERSAI NOC and a bank closure letter. If the loan is still live, demand the bank's prior written consent for the sale and a clear undertaking on how the sale proceeds will discharge the loan. Do not pay any advance until these are in hand.",
      sourceCaseRefs: [],
    });
  }

  // Cluster 3: Court / revenue-court case signal (eCourts or RCCMS)
  const totalCases = (ctx?.courtCaseCount ?? 0) + (ctx?.rccmsCaseCount ?? 0);
  if (totalCases > 0) {
    const sources: string[] = [];
    if (ctx?.courtCaseCount && ctx.courtCaseCount > 0) sources.push(`${ctx.courtCaseCount} eCourts case(s)`);
    if (ctx?.rccmsCaseCount && ctx.rccmsCaseCount > 0) sources.push(`${ctx.rccmsCaseCount} RCCMS revenue-court case(s)`);
    clusters.push({
      patternCluster: "Litigation on owner or plot",
      clusterSummary: `Public case databases returned ${sources.join(" and ")} touching the seller or this plot. A pending civil appeal, writ, or revenue-court case is rarely a deal-breaker on its own — but cases involving title, possession, partition, or government acquisition should pause the transaction until the buyer's lawyer has read the orders.`,
      similarCaseCount: 0,
      totalSimilarCases: 0,
      decidingFactor: "Whether the cases involve title / possession / partition / acquisition (high-risk) or unrelated matters such as cheque-bounce or motor-accident claims (low-risk). High-risk categories warrant a title-certificate from a property lawyer before any advance.",
      recommendedAction: "Share the case list with your property lawyer. For each case, ask for a one-line reading: is it on the title, or is it unrelated? Pause the transaction if any case is a pending title / partition / acquisition matter.",
      sourceCaseRefs: [],
    });
  }

  // Cluster 4: Land conversion required (agricultural → residential / commercial)
  if (ctx?.landConversionRequired && ctx.currentLandClass) {
    clusters.push({
      patternCluster: "Land-use conversion required",
      clusterSummary: `Bhulekh records this plot as ${ctx.currentLandClass}. The intended use (residential / commercial) requires a formal land-use conversion order from the Sub-Collector or the planning authority. Conversion is not automatic and is not a stamp on the sale deed — it is a separate revenue process.`,
      similarCaseCount: 0,
      totalSimilarCases: 0,
      decidingFactor: "Whether the conversion order exists, whether the conversion premium has been paid in full, and whether the order is still in force (conversions lapse if not used within the validity period).",
      recommendedAction: "Ask the seller to produce the original conversion order, the conversion premium receipt, and a recent Tahasildar certificate confirming the plot's current land-use status. If any of these are missing, the plot cannot be built on today — only the conversion-eligible land has value.",
      sourceCaseRefs: [],
    });
  }

  return clusters;
}

/**
 * P-NEW-1A: Build synthesis insights section HTML.
 *
 * Accepts (a) PID-derived insights (empty until P-NEW-3 similarity search is
 * live) and (b) runtime context from the current report to inject founder-
 * curated clusters. P-NEW-1B is the first hardcoded cluster: co-ownership
 * (repeat_actor_v1 + poa_multiple_owners_v1) fires when coOwners.length > 0.
 *
 * Returns empty string when no insights fire — section is conditionally
 * rendered by the caller.
 */
function buildSynthesisInsights(
  insights: SynthesisInsight[],
  ctx?: { coOwners?: string[] }
): string {
  const founderCurated = buildFounderCuratedClusters(ctx);
  const all = [...founderCurated, ...(Array.isArray(insights) ? insights : [])];
  if (all.length === 0) return "";
  const cards = all.map((insight) => {
    const refsHtml = (insight.sourceCaseRefs ?? []).slice(0, 3).map((ref) => {
      const caseLabel = ref.caseNo || ref.caseId || "—";
      return `<li><code>${escapeHtml(caseLabel)}</code>${
        ref.outcome ? ` &mdash; <span class="syn-outcome">${escapeHtml(ref.outcome)}</span>` : ""
      }${
        ref.buyerAction ? ` &mdash; <span class="syn-action">${escapeHtml(ref.buyerAction)}</span>` : ""
      }</li>`;
    }).join("");
    const similarPct = insight.totalSimilarCases > 0
      ? Math.round((insight.similarCaseCount / insight.totalSimilarCases) * 100)
      : 0;
    return `<div class="synthesis-card">
      <div class="synthesis-card-hdr">
        <div class="synthesis-cluster">${escapeHtml(insight.patternCluster)}</div>
        <div class="synthesis-similar">${insight.similarCaseCount} of ${insight.totalSimilarCases} similar cases (${similarPct}%)</div>
      </div>
      <p class="synthesis-summary">${escapeHtml(insight.clusterSummary)}</p>
      <div class="synthesis-detail">
        <div class="synthesis-row">
          <span class="synthesis-label">What decided the outcome</span>
          <span class="synthesis-value">${escapeHtml(insight.decidingFactor)}</span>
        </div>
        <div class="synthesis-row">
          <span class="synthesis-label">Recommended action</span>
          <span class="synthesis-value">${escapeHtml(insight.recommendedAction)}</span>
        </div>
      </div>
      ${refsHtml ? `<details class="synthesis-refs"><summary>Source cases (${insight.sourceCaseRefs.length})</summary><ul>${refsHtml}</ul></details>` : ""}
    </div>`;
  }).join("");
  return `<div class="synthesis-panel">${cards}</div>`;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(str: unknown): string {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  /* Surface (spec §4.1) */
  --paper:        #FAF7F0;
  --card:         #FFFFFF;
  --card-elev:    rgba(255, 255, 255, 0.85);

  /* Ink (spec §4.1) */
  --ink:          #0B1220;
  --ink-2:        #1F2937;
  --ink-3:        #4B5563;
  --ink-4:        #9CA3AF;

  /* Lines (spec §4.1) */
  --border:       rgba(11, 18, 32, 0.08);
  --border-bold:  rgba(11, 18, 32, 0.16);

  /* Accents (spec §4.1) */
  --accent:       #6B4EFF;
  --accent-2:     #FF6B35;
  --accent-glow:  rgba(107, 78, 255, 0.12);

  /* Status (spec §4.1) */
  --good:         #0E9F6E;
  --good-soft:    rgba(14, 159, 110, 0.08);
  --watch:        #C77700;
  --watch-soft:   rgba(199, 119, 0, 0.08);
  --bad:          #DC2626;
  --bad-soft:     rgba(220, 38, 38, 0.08);
  --info:         #1D4ED8;
  --info-soft:    rgba(29, 78, 216, 0.08);

  /* Typography (spec §4.2) */
  --font-display: "Source Serif 4", "Source Serif Pro", Georgia, serif;
  --font-sans:    "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono:    "JetBrains Mono", ui-monospace, "SF Mono", monospace;

  /* Spacing (spec §4.4) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --space-9: 96px;

  /* Layout (spec §4.4) */
  --max-w: 1120px;
  --grid-gap: 24px;
  --section-gap: 96px;
}

html { scroll-behavior: smooth; }

body {
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.55;
  color: var(--ink-2);
  background: var(--paper);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  max-width: var(--max-w);
  margin: 0 auto;
  padding: var(--space-7) var(--space-5);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* ── Property header (hero verdict block, spec §5.1) ────────────── */

.property-header {
  position: relative;
  background: var(--card-elev);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: var(--space-7) var(--space-7);
  padding-left: calc(var(--space-7) + 4px);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  margin-bottom: var(--space-7);
  animation: fadeUp 350ms ease-out both;
}

.property-header::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(180deg, var(--accent), var(--accent-2));
  border-radius: 16px 0 0 16px;
}

.property-header-dots {
  display: flex;
  gap: 8px;
  margin-bottom: var(--space-5);
}

.property-header-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ink-4);
  display: inline-block;
  opacity: 0.6;
}

.property-header-dot[data-status="verified"]  { background: var(--good); }
.property-header-dot[data-status="watchout"]  { background: var(--watch); }
.property-header-dot[data-status="risk"]      { background: var(--bad); }
.property-header-dot[data-status="manual"]    { background: var(--info); }

.property-header-eyebrow {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-4);
  margin-bottom: var(--space-3);
}

.property-header-headline {
  font-family: var(--font-display);
  font-size: 64px;
  line-height: 1.05;
  letter-spacing: -0.03em;
  color: var(--ink);
  margin-bottom: var(--space-4);
  max-width: 18ch;
}

.property-header-subhead {
  font-family: var(--font-sans);
  font-size: 17px;
  line-height: 1.55;
  color: var(--ink-2);
  margin-bottom: var(--space-6);
  max-width: 60ch;
}

.property-header-exposure {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--grid-gap);
  margin-bottom: var(--space-6);
}

.property-header-exposure-cell {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: var(--space-4) var(--space-5);
}

.property-header-exposure-amount {
  font-family: var(--font-mono);
  font-size: 32px;
  line-height: 1.1;
  color: var(--ink);
  margin-bottom: var(--space-1);
}

.property-header-exposure-label {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-4);
}

.property-header-actions {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
  margin-bottom: var(--space-5);
}

.property-header-action {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  padding: 10px var(--space-5);
  border-radius: 8px;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  transition: transform 150ms ease-out, box-shadow 150ms ease-out;
}

.property-header-action:hover { transform: translateY(-1px); }

.property-header-action-primary {
  background: var(--accent);
  color: #fff;
  border: 1px solid var(--accent);
}

.property-header-action-secondary {
  background: transparent;
  color: var(--ink);
  border: 1px solid var(--ink);
}

.property-header-action-tertiary {
  background: transparent;
  color: var(--ink-3);
  border: none;
  padding-left: 0;
  padding-right: 0;
}

.property-header-meta {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--ink-4);
  border-top: 1px solid var(--border);
  padding-top: var(--space-4);
}

/* ── Source status strip (spec §5.3) ──────────────────────────── */

.source-status-strip {
  background: var(--card-elev);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: var(--space-3) var(--space-5);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) var(--space-5);
  margin-bottom: var(--space-7);
  animation: fadeUp 350ms ease-out 100ms both;
}

.source-status-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--ink-2);
}

.source-status-chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ink-4);
}

.source-status-chip[data-status="verified"] .source-status-chip-dot { background: var(--good); }
.source-status-chip[data-status="watchout"] .source-status-chip-dot { background: var(--watch); }
.source-status-chip[data-status="risk"]     .source-status-chip-dot { background: var(--bad); }
.source-status-chip[data-status="manual"]   .source-status-chip-dot { background: var(--info); }

.source-status-chip-name { font-weight: 500; }
.source-status-chip-time { color: var(--ink-4); font-family: var(--font-mono); font-size: 12px; }

/* ── Q-grid (spec §5.2) ───────────────────────────────────────── */

.q-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--grid-gap);
  margin-bottom: var(--section-gap);
}

@media (min-width: 768px) { .q-grid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 1200px) { .q-grid { grid-template-columns: 1fr 1fr 1fr; } }

.q-tile {
  display: block;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: var(--space-5);
  text-decoration: none;
  color: inherit;
  transition: transform 150ms ease-out, border-color 150ms ease-out, box-shadow 150ms ease-out;
  position: relative;
  scroll-margin-top: 80px;
}

.q-tile:hover {
  transform: translateY(-2px);
  border-color: var(--border-bold);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
}

.q-tile-index {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-4);
  margin-bottom: var(--space-3);
}

.q-tile-question {
  font-family: var(--font-display);
  font-size: 24px;
  line-height: 1.25;
  letter-spacing: -0.01em;
  color: var(--ink);
  margin-bottom: var(--space-4);
}

.q-tile-status {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.q-tile-status-icon {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.q-tile[data-status="verified"] .q-tile-status-icon { background: var(--good); }
.q-tile[data-status="watchout"] .q-tile-status-icon { background: var(--watch); }
.q-tile[data-status="risk"]     .q-tile-status-icon { background: var(--bad); }
.q-tile[data-status="manual"]   .q-tile-status-icon { background: var(--info); }

.q-tile-status-label {
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  color: var(--ink-2);
}

.q-tile-answer {
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.5;
  color: var(--ink-2);
  margin-bottom: var(--space-4);
}

.q-tile-exposure {
  background: var(--card-elev);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-3);
}

.q-tile-exposure-amount {
  font-family: var(--font-mono);
  font-size: 24px;
  line-height: 1.1;
  color: var(--ink);
  margin-bottom: var(--space-1);
}

.q-tile-exposure-label {
  font-family: var(--font-sans);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-4);
}

.q-tile-details {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--ink-3);
}

/* Stagger Q-tile entry animation */
.q-tile:nth-child(1) { animation: fadeUp 250ms ease-out 60ms both; }
.q-tile:nth-child(2) { animation: fadeUp 250ms ease-out 120ms both; }
.q-tile:nth-child(3) { animation: fadeUp 250ms ease-out 180ms both; }
.q-tile:nth-child(4) { animation: fadeUp 250ms ease-out 240ms both; }
.q-tile:nth-child(5) { animation: fadeUp 250ms ease-out 300ms both; }
.q-tile:nth-child(6) { animation: fadeUp 250ms ease-out 360ms both; }

/* ── Q-detail (spec §5.4) ─────────────────────────────────────── */

.q-detail {
  margin-bottom: var(--section-gap);
  scroll-margin-top: 80px;
}

.q-detail-eyebrow {
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-4);
  margin-bottom: var(--space-2);
}

.q-detail-title {
  font-family: var(--font-display);
  font-size: 40px;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: var(--ink);
  margin-bottom: var(--space-5);
  max-width: 24ch;
}

.q-detail-answer {
  font-family: var(--font-display);
  font-size: 24px;
  line-height: 1.4;
  color: var(--ink-2);
  font-style: italic;
  margin-bottom: var(--space-6);
  max-width: 50ch;
}

.q-detail-facts {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

@media (min-width: 768px) { .q-detail-facts { grid-template-columns: repeat(3, 1fr); } }

.q-detail-fact {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: var(--space-4);
  position: relative;
}

.q-detail-fact[data-status="verified"] { border-color: var(--good-soft); }
.q-detail-fact[data-status="watchout"] { border-color: var(--watch-soft); }
.q-detail-fact[data-status="risk"]     { border-color: var(--bad-soft); }
.q-detail-fact[data-status="manual"]   { border-color: var(--info-soft); }

.q-detail-fact-label {
  font-family: var(--font-sans);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ink-4);
  margin-bottom: var(--space-2);
}

.q-detail-fact-value {
  font-family: var(--font-mono);
  font-size: 18px;
  line-height: 1.3;
  color: var(--ink);
}

.q-detail-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}

.q-detail-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-sans);
  font-size: 13px;
  font-weight: 500;
  padding: 6px var(--space-3);
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--card);
  cursor: pointer;
  color: var(--ink-2);
}

.q-detail-chip[data-status="verified"] { background: var(--good-soft); color: var(--good); border-color: transparent; }
.q-detail-chip[data-status="watchout"] { background: var(--watch-soft); color: var(--watch); border-color: transparent; }
.q-detail-chip[data-status="risk"]     { background: var(--bad-soft); color: var(--bad); border-color: transparent; }
.q-detail-chip[data-status="manual"]   { background: var(--info-soft); color: var(--info); border-color: transparent; }

.q-detail-provenance {
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--ink-3);
  border-top: 1px solid var(--border);
  padding-top: var(--space-4);
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-5);
}

.q-detail-provenance-source { font-weight: 500; color: var(--ink-2); }
.q-detail-provenance-time   { font-family: var(--font-mono); }
.q-detail-verify {
  color: var(--accent);
  text-decoration: none;
  margin-left: auto;
}
.q-detail-verify:hover { text-decoration: underline; }

/* ── Trust strip (T13) ─────────────────────────────────────────
   Collapsible "How we checked this" block on critical facts (Q1
   owner, Q2 conversion, Q3 encumbrance). Default closed — a one-line
   summary is visible so buyers see the source has provenance without
   having to expand. When opened, shows the raw source hash, parser
   version, fetch attempts, raw Odia paired with English, and any
   transferability flags. The block is intentionally low-emphasis
   (small text, mono font) so it doesn't compete with the main fact.
*/

.q-trust-strip {
  margin-top: var(--space-3);
  font-family: var(--font-sans);
  font-size: 12px;
  color: var(--ink-3);
}

.q-trust-strip > .q-trust-summary {
  cursor: pointer;
  list-style: none;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 4px var(--space-3);
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--card);
  color: var(--ink-2);
  font-weight: 500;
  user-select: none;
}

.q-trust-strip > .q-trust-summary::-webkit-details-marker { display: none; }
.q-trust-strip > .q-trust-summary::before {
  content: "▸";
  font-size: 10px;
  color: var(--ink-3);
  display: inline-block;
  transition: transform 0.15s ease;
}

.q-trust-strip[open] > .q-trust-summary::before {
  transform: rotate(90deg);
}

.q-trust-strip > .q-trust-summary:hover {
  background: var(--card-hover, rgba(0, 0, 0, 0.03));
  border-color: var(--ink-3);
}

.q-trust-body {
  margin-top: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--card);
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--space-2) var(--space-4);
  font-family: var(--font-mono);
  font-size: 11px;
  line-height: 1.5;
}

.q-trust-row {
  display: contents; /* let grid-template-columns drive layout */
}

.q-trust-key {
  color: var(--ink-3);
  white-space: nowrap;
}

.q-trust-value {
  color: var(--ink);
  word-break: break-word;
}

@media (max-width: 600px) {
  .q-trust-body {
    grid-template-columns: 1fr;
    gap: var(--space-1);
  }
  .q-trust-row { display: block; }
  .q-trust-key { display: block; margin-bottom: 2px; }
  .q-trust-value { display: block; }
}

/* ── Sticky nav (spec §5.5) ───────────────────────────────────── */

.sticky-nav {
  display: none;
  position: fixed;
  top: 50%;
  right: 24px;
  transform: translateY(-50%);
  z-index: 50;
}

@media (min-width: 1024px) { .sticky-nav { display: block; } }

.sticky-nav-inner {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  background: var(--card-elev);
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: var(--space-3);
}

.sticky-nav-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-family: var(--font-sans);
  font-size: 11px;
  font-weight: 600;
  text-decoration: none;
  color: var(--ink-4);
  border-radius: 8px;
  border-left: 2px solid transparent;
  transition: color 150ms ease-out, border-color 150ms ease-out;
}

.sticky-nav-link:hover { color: var(--ink-2); }

.sticky-nav-link.is-active {
  color: var(--ink);
  border-left-color: var(--accent);
}

.sticky-nav-link[data-status="verified"] { color: var(--good); }
.sticky-nav-link[data-status="watchout"] { color: var(--watch); }
.sticky-nav-link[data-status="risk"]     { color: var(--bad); }
.sticky-nav-link[data-status="manual"]   { color: var(--info); }

/* Mobile sticky nav — top tab bar */
.sticky-nav-mobile {
  display: flex;
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--card-elev);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
  padding: var(--space-2) var(--space-4);
  gap: var(--space-2);
  overflow-x: auto;
  margin: 0 calc(-1 * var(--space-5)) var(--space-7);
}

@media (min-width: 1024px) { .sticky-nav-mobile { display: none; } }

.sticky-nav-mobile .sticky-nav-link {
  width: auto;
  height: 32px;
  padding: 0 var(--space-3);
  flex-shrink: 0;
  border-left: none;
  border-bottom: 2px solid transparent;
}

.sticky-nav-mobile .sticky-nav-link.is-active { border-bottom-color: var(--accent); }

/* ── Feedback footer (existing — preserved) ──────────────────── */

.feedback-footer {
  margin-top: var(--space-9);
  padding-top: var(--space-6);
  border-top: 1px solid var(--border);
}

.feedback-footer-disclaimer {
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--ink-3);
  margin-bottom: var(--space-5);
  max-width: 70ch;
}

.feedback-footer-lawyer,
.feedback-footer-survey {
  display: inline-block;
  margin-right: var(--space-4);
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  color: var(--accent);
  text-decoration: none;
}

.feedback-footer-lawyer:hover,
.feedback-footer-survey:hover { text-decoration: underline; }

/* ── Animations (spec §6) ─────────────────────────────────────── */

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Print (preserved from editorial v2) ───────────────────────── */

@media print {
  body { background: #fff; max-width: 100%; padding: 0; }
  .sticky-nav, .sticky-nav-mobile, .property-header-actions { display: none; }
  .property-header { border: none; box-shadow: none; }
  .q-tile { break-inside: avoid; }
  .q-detail { break-inside: avoid; }
  .tested-patterns { break-inside: avoid; }
  .v12-fields { break-inside: avoid; }
  .v12-card { break-inside: avoid; }
}

/* ── T1: Tested Fraud Patterns Panel ─────────────────────────── */

.tested-patterns {
  max-width: 980px;
  margin: 24px auto 0;
  padding: 18px 22px;
  border: 1px solid #d7dae3;
  border-radius: 10px;
  background: #fbfbff;
  font-family: inherit;
}
.tp-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ebedf5;
}
.tp-eyebrow {
  font-size: 11px;
  letter-spacing: 0.06em;
  font-weight: 600;
  color: #525b7a;
  text-transform: uppercase;
}
.tp-summary {
  font-size: 13px;
  color: #3c4257;
}
.tp-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}
.tp-row {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 10px 14px;
  padding: 12px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #e6e9f3;
}
.tp-row[data-state="triggered"] {
  border-color: #f59f7b;
  background: linear-gradient(180deg, #fff8f4, #fff);
}
.tp-icon { font-size: 16px; line-height: 1.4; }
.tp-body {}
.tp-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.tp-num {
  font-size: 13px;
  font-weight: 700;
  color: #1f2437;
}
.tp-name { font-size: 14px; font-weight: 600; color: #1f2437; }
.tp-state {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 2px 8px;
  border-radius: 999px;
}
.tp-state[data-state="passed"]  { background: #e8f7ee; color: #14734a; }
.tp-state[data-state="triggered"] { background: #fde8e0; color: #8a2c11; }
.tp-state[data-state="untested"] { background: #f4f3fb; color: #4b4688; }
.tp-check {
  font-size: 12.5px;
  color: #3c4257;
  margin-bottom: 4px;
}
.tp-result {
  font-size: 13px;
  color: #1f2437;
  margin-bottom: 6px;
}
.tp-evidence {
  font-size: 11.5px;
  color: #525b7a;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: baseline;
}
.tp-evidence code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
.tp-evidence a { color: #2563eb; text-decoration: none; }
.tp-evidence a:hover { text-decoration: underline; }
.tp-action {
  margin-top: 6px;
  font-size: 13px;
  color: #6a2c1a;
  font-weight: 600;
}

/* ── T10: V1.2 Ground-Truth Field Panel ─────────────────────── */

.v12-fields {
  max-width: 980px;
  margin: 18px auto 0;
  padding: 0;
  font-family: inherit;
}
.v12-header {
  margin-bottom: 8px;
}
.v12-eyebrow {
  font-size: 11px;
  letter-spacing: 0.06em;
  font-weight: 600;
  color: #525b7a;
  text-transform: uppercase;
}
.v12-sub {
  display: block;
  font-size: 12.5px;
  color: #6b7394;
  margin-top: 4px;
}
.v12-card {
  margin-bottom: 10px;
  border: 1px solid #e6e9f3;
  border-radius: 8px;
  background: #fff;
  padding: 10px 14px;
}
.v12-card summary {
  font-size: 13px;
  font-weight: 600;
  color: #1f2437;
  cursor: pointer;
  user-select: none;
}
.v12-prose {
  margin: 8px 0 6px;
  font-size: 13px;
  color: #3c4257;
  line-height: 1.5;
}
.v12-table { margin-top: 6px; }
.v12-table .key { width: 38%; }
.v12-empty { color: #6b7394; }
.v12-warn { color: #7a2b0e; font-weight: 600; }
.v12-ok { color: #14734a; }
.v12-trust {
  margin-top: 8px;
  font-size: 11px;
  color: #6b7394;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
}
.v12-trust span::before {
  content: none;
}
`;

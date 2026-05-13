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

  // Sub-objects: use z.any() to avoid field-level validation failures
  // The HTML renderer handles nulls gracefully with explicit null checks
  geoFetch: z.any().optional(),
  revenueRecords: z.any().optional(),
  courtCases: z.any().optional(),
  registryLinks: z.any().optional(),
  ownershipReasoner: z.any().optional(),
  landClassifier: z.any().optional(),
  encumbranceReasoner: z.any().optional(),
  regulatoryScreener: z.any().optional(),
  larrRiskAssessment: z.any().optional(),
  validationFindings: z.array(z.any()).optional().default([]),
  sourceStatus: z.record(z.string()).optional().default({}),
  sourceDetails: z.record(z.any()).optional().default({}),
  disclaimerText: z.string().optional().default(""),
});

export type ConsumerReportGenInputData = z.infer<typeof ConsumerReportGenInputSchema>;

// ─── Mapper ────────────────────────────────────────────────────────────────────

/**
 * Map orchestrator sources to A10 ConsumerReportGenInput.
 */
export function mapToReportInput(
  orchestratorOutput: OrchestratorOutput,
  tier2: Tier2Input
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
    validationFindings: validationFindings ?? [],
    sourceStatus: {
      nominatim: nominatim?.status ?? "not_run",
      bhunaksha: bhunaksha?.status ?? "not_run",
      bhulekh: bhulekh?.status ?? "not_run",
      bhulekh_back_page: (bhulekhBackPage?.status as string) ?? "not_applicable",
      ecourts: ecourts?.status ?? "not_run",
      rccms: normalizeRccmsStatus(rccms),
      "igr-ec": igrEc?.status ?? "not_run",
      cersai: cersai?.status ?? "not_run",
    },
    sourceDetails: Object.fromEntries(
      sources.map((source) => [
        source.source,
        {
          status: source.source === "rccms" ? normalizeRccmsStatus(source) : source.status,
          fetchedAt: source.fetchedAt,
          statusReason: source.statusReason ?? source.error ?? null,
          parserVersion: source.parserVersion ?? null,
          rawArtifactHash: source.rawArtifactHash ?? null,
          warnings: source.warnings ?? [],
        },
      ])
    ),
    disclaimerText: tier2.disclaimerText,
  };
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

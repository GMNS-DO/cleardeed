/**
 * ConsumerReportWriter (A10) — Input/Output Zod schemas
 *
 * Defines the contract between the orchestrator (Tier 1+2 outputs) and
 * the ConsumerReportWriter sub-agent.
 */

import { z } from "zod";

// ── Tier 1 — Data Fetcher outputs ──────────────────────────────────────────────

export const GeoFetchResultSchema = z.object({
  village: z.string().optional(),
  tahasil: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  displayName: z.string().optional(),
  gpsSource: z.string().optional(), // e.g. "nominatim", "gps_device"
});

export const BhulekhTenantSchema = z.object({
  tenantName: z.string().optional(), // Odia or transliterated
  surveyNo: z.string().optional(),
  area: z.number().optional(),
  unit: z.string().optional(), // "acre" | "decimil"
  landClass: z.string().optional(), // e.g. "ଦଣ୍ଡା" (irrigated), "ବାର୍ମ" (dry)
  fatherName: z.string().optional(),
});

export const RoRDocumentV1Schema = z.object({
  khataNo: z.string().optional(),
  village: z.string().optional(),
  district: z.string().optional(),
  riCircle: z.string().optional(),
  lastUpdated: z.string().optional(), // ISO date or Odia text
  tenants: z.array(BhulekhTenantSchema).optional(),
  // Extended RoR fields (future)
  khatiyanType: z.string().optional(), // "Khatiyan" | "Naeka"
  pattaType: z.string().optional(),
});

export const CourtCaseSchema = z.object({
  caseId: z.string().optional(),
  caseType: z.string().optional(),
  filingDate: z.string().optional(),
  courtName: z.string().optional(),
  courtComplex: z.string().optional(),
  petitioner: z.string().optional(),
  respondent: z.string().optional(),
  status: z.string().optional(),
  decisionDate: z.string().optional(),
});

export const CourtCaseResultSchema = z.object({
  total: z.number(),
  cases: z.array(CourtCaseSchema).optional(),
});

export const RegistryLinksSchema = z.object({
  url: z.string().url(),
  params: z.object({
    district: z.string(),
    sro: z.string(),
    plotNo: z.string().optional(),
    ownerName: z.string().optional(),
  }),
  instructions: z.string().optional(),
});

// ── Tier 2 — Domain Interpreter outputs ───────────────────────────────────────

export const NameMatchSchema = z.enum(["exact", "partial", "mismatch", "unknown"]);
export const NameMatchConfidenceSchema = z.object({
  score: z.number().min(0).max(1),
  method: z.string().optional(), // e.g. "dice_coefficient", "phonetic", "exact"
});

export const OwnershipReasonerResultSchema = z.object({
  officialOwnerName: z.string().optional(), // from Bhulekh RoR
  transliteratedOwnerName: z.string().optional(), // Latin script version
  nameMatch: NameMatchSchema,
  nameMatchConfidence: NameMatchConfidenceSchema.optional(),
  discrepancyExplanation: z.string().optional(),
  coOwners: z.array(z.string()).optional(), // other names on RoR
  fatherNameOnRecord: z.string().optional(),
  // Confidence band (0–1)
  confidence: z.number().min(0).max(1),
  confidenceBasis: z.string().optional(),
});

export const RedFlagSchema = z.object({
  flag: z.string(), // e.g. "PESA", "CRZ", "Forest", "Ceiling Act"
  severity: z.enum(["high", "medium", "low"]),
  proximity: z.string().optional(), // e.g. "within 500m", "adjacent"
  description: z.string(), // plain-English explanation
  recommendedAction: z.string().optional(),
});

export const LandClassificationReportSchema = z.object({
  currentClassification: z.string().optional(), // e.g. "Agricultural", "Residential"
  classificationSource: z.string().optional(), // Bhulekh land class field
  permittedUses: z.array(z.string()).optional(),
  conversionRequired: z.boolean().optional(),
  conversionSteps: z.string().optional(),
  redFlags: z.array(RedFlagSchema).optional(),
  confidence: z.number().min(0).max(1),
  confidenceBasis: z.string().optional(),
});

export const EncumbranceReasonerResultSchema = z.object({
  status: z.enum(["clear", "encumbered", "manual_required", "error"]),
  encumbrances: z
    .array(
      z.object({
        type: z.string(), // "mortgage", "lien", "court_order", "mutation_pending"
        party: z.string().optional(),
        amount: z.string().optional(),
        date: z.string().optional(),
        registrationNo: z.string().optional(),
        source: z.string().optional(),
      })
    )
    .optional(),
  clearPeriod: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
    })
    .optional(),
  instructions: z.string().optional(),
  confidence: z.number().min(0).max(1),
  confidenceBasis: z.string().optional(),
});

export const RegulatoryFlagsReportSchema = z.object({
  flags: z.array(RedFlagSchema),
  plotConfirmedInRegulatedZone: z.boolean().optional(),
  overlaySource: z.string().optional(), // e.g. "ORSAC KML", "CRZ 2019 map", "Forest Survey of India"
  confidence: z.number().min(0).max(1),
  confidenceBasis: z.string().optional(),
});

// ── Tier 4 — Validation ───────────────────────────────────────────────────────

export const ValidationFindingSchema = z.object({
  dimension: z.enum([
    "village",
    "tahasil",
    "area",
    "plotNo",
    "ownerName",
    "classification",
    "gps",
    "session",
  ]),
  severity: z.enum(["error", "warning", "info"]),
  source: z.string(),
  description: z.string(),
  raw: z.record(z.unknown()).optional(),
});

// ── Consumer Report Writer INPUT ───────────────────────────────────────────────

export const ConsumerReportInputSchema = z.object({
  // Identity
  reportId: z.string(),
  generatedAt: z.string(), // ISO 8601

  // User-provided
  gpsCoordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }),
  claimedOwnerName: z.string(),
  plotDescription: z.string().optional(),

  // Tier 1 outputs
  geoFetch: GeoFetchResultSchema.nullable(),
  revenueRecords: RoRDocumentV1Schema.nullable(),
  courtCases: CourtCaseResultSchema.nullable(),
  registryLinks: RegistryLinksSchema.nullable(),

  // Tier 2 outputs
  ownershipReasoner: OwnershipReasonerResultSchema.nullable(),
  landClassifier: LandClassificationReportSchema.nullable(),
  encumbranceReasoner: EncumbranceReasonerResultSchema.nullable(),
  regulatoryScreener: RegulatoryFlagsReportSchema.nullable(),

  // Validation
  validationFindings: z.array(ValidationFindingSchema),

  // Disclaimer (approved text from legal/)
  disclaimerText: z.string(),
});

export type ConsumerReportInput = z.infer<typeof ConsumerReportInputSchema>;
export type GeoFetchResult = z.infer<typeof GeoFetchResultSchema>;
export type RoRDocumentV1 = z.infer<typeof RoRDocumentV1Schema>;
export type CourtCaseResult = z.infer<typeof CourtCaseResultSchema>;
export type RegistryLinks = z.infer<typeof RegistryLinksSchema>;
export type OwnershipReasonerResult = z.infer<typeof OwnershipReasonerResultSchema>;
export type LandClassificationReport = z.infer<typeof LandClassificationReportSchema>;
export type EncumbranceReasonerResult = z.infer<typeof EncumbranceReasonerResultSchema>;
export type RegulatoryFlagsReport = z.infer<typeof RegulatoryFlagsReportSchema>;
export type ValidationFinding = z.infer<typeof ValidationFindingSchema>;

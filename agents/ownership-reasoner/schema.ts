/**
 * OwnershipReasoner (A5) — Input/Output Zod schemas
 *
 * Contract between orchestrator (Tier 1 outputs) and A5 name-matching logic.
 */

import { z } from "zod";

// ── Bhulekh RoR document (simplified for name matching) ──────────────────────

export const BhulekhTenantSchema = z.object({
  tenantName: z.string(), // Odia or transliterated
  fatherHusbandName: z.string().optional(),
  surveyNo: z.string(),
  area: z.number().optional(),
  landClass: z.string().optional(),
  share: z.string().optional(),
});

export const BhulekhRoRDocumentSchema = z.object({
  khatiyanNo: z.string().optional(),
  village: z.string(),
  riCircle: z.string().optional(),
  tenants: z.array(BhulekhTenantSchema),
  // Also accept raw BhulekhRoRDocumentV1 shape (extended fields)
  schemaVersion: z.enum(["bhulekh-ror-v1"]).optional(),
  plotTable: z.object({
    rows: z
      .object({
        plotNo: z.string().nullable(),
        landTypeOdia: z.string().nullable(),
        areaAcres: z.string().nullable(),
      })
      .array()
      .optional(),
  }).optional(),
});

// ── Input ─────────────────────────────────────────────────────────────────────

export const OwnershipReasonerInputSchema = z.object({
  claimedOwnerName: z.string(),
  fatherHusbandName: z.string().optional(),
  rorDocument: BhulekhRoRDocumentSchema,
});

export type OwnershipReasonerInput = z.infer<typeof OwnershipReasonerInputSchema>;

// ── Output ────────────────────────────────────────────────────────────────────

export const NameMatchConfidenceSchema = z.object({
  score: z.number().min(0).max(1),
  method: z.string(), // e.g. "odia_surname_map", "dice_transliterated", "phonetic", "none"
});

export const OwnerValidationReasonSchema = z.object({
  code: z.string(),
  label: z.string(),
  weight: z.number(),
  detail: z.string().optional(),
});

export const OwnerClaimValidationSchema = z.object({
  claimState: z.enum([
    "matched",
    "partial",
    "mismatch",
    "ambiguous",
    "unavailable",
    "manual_required",
  ]),
  readiness: z.enum(["L0", "L1", "L2", "L3", "L4"]),
  inputQuality: z.enum(["full_name", "single_token", "initials_or_abbrev", "empty"]),
  matchedTenantIndex: z.number().optional(),
  officialOwnerName: z.string(),
  transliteratedOwnerName: z.string(),
  fatherHusbandMatch: z.enum(["matched", "mismatch", "not_provided", "not_on_record"]),
  confidence: z.number().min(0).max(1),
  reasons: z.array(OwnerValidationReasonSchema),
  blockingWarnings: z.array(z.string()),
});

export const OwnerTransliterationProvenanceSchema = z.object({
  sourceTenantIndex: z.number(),
  rawOwnerName: z.string(),
  transliteratedOwnerName: z.string(),
  ownerTransliterationMethod: z.enum([
    "known_name_dictionary",
    "odia_transliteration_v1",
    "latin_passthrough",
    "empty",
  ]),
  rawGuardianName: z.string().optional(),
  transliteratedGuardianName: z.string().optional(),
  guardianTransliterationMethod: z.enum([
    "known_name_dictionary",
    "odia_transliteration_v1",
    "latin_passthrough",
    "empty",
  ]),
});

export const OwnershipReasonerResultSchema = z.object({
  officialOwnerName: z.string(), // from Bhulekh RoR (Odia)
  transliteratedOwnerName: z.string(), // Latin script version
  nameMatch: z.enum(["exact", "partial", "mismatch", "unknown"]),
  nameMatchConfidence: NameMatchConfidenceSchema.optional(),
  discrepancyExplanation: z.string(), // plain English — what this means for a buyer
  coOwners: z.array(z.string()), // other tenant names on RoR
  fatherNameOnRecord: z.string().optional(),
  confidence: z.number().min(0).max(1),
  confidenceBasis: z.string(),
  matchedTenantIndex: z.number().optional(), // which tenant matched (0-based)
  claimState: OwnerClaimValidationSchema.shape.claimState.optional(),
  readiness: OwnerClaimValidationSchema.shape.readiness.optional(),
  inputQuality: OwnerClaimValidationSchema.shape.inputQuality.optional(),
  fatherHusbandMatch: OwnerClaimValidationSchema.shape.fatherHusbandMatch.optional(),
  matchReasons: z.array(OwnerValidationReasonSchema).optional(),
  blockingWarnings: z.array(z.string()).optional(),
  ownerClaimValidation: OwnerClaimValidationSchema.optional(),
  matchedOwnerProvenance: OwnerTransliterationProvenanceSchema.optional(),
});

export type OwnershipReasonerResult = z.infer<typeof OwnershipReasonerResultSchema>;
export type NameMatch = z.infer<typeof OwnershipReasonerResultSchema>["nameMatch"];
export type OwnerClaimValidation = z.infer<typeof OwnerClaimValidationSchema>;

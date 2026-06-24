import { z } from "zod";

// Valid source IDs are the same set the pipeline's fire gate uses.
// Mirrored here so the schema can validate without importing the fire module.
export const PID_SOURCE_IDS = [
  "bhulekh",
  "ecourts",
  "rccms",
  "igr-ec",
  "rera",
  "cersai",
  "high-court",
  "drt",
  "bhunaksha",
  "nominatim",
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
  "bhunaksha-plot-report",
  "bhuvan-flood",
  "eow",
] as const;
export type PidSourceId = (typeof PID_SOURCE_IDS)[number];

const hex64 = z.string().regex(/^[0-9a-f]{64}$/, "must be 64 hex chars");
const uuid = z.string().uuid();
const iso8601 = z.string().datetime({ offset: true });

export const SourceArtifactSchema = z.object({
  artifactKey: hex64,
  sourceId: z.enum(PID_SOURCE_IDS),
  collectionRunId: uuid.optional(),
  artifactType: z.string().min(1),
  documentType: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  sourceOrigin: z.string().optional(),
  accessMode: z.string().optional(),
  query: z.record(z.unknown()).default({}),
  storagePath: z.string().min(1),
  storageBucket: z.string().optional(),
  storageKey: z.string().optional(),
  sha256: hex64,
  byteSize: z.number().int().nonnegative().optional(),
  contentType: z.string().optional(),
  httpStatus: z.number().int().min(100).max(599).optional(),
  retrievedAt: iso8601.optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type SourceArtifact = z.infer<typeof SourceArtifactSchema>;

export const FactAssertionInputSchema = z.object({
  subjectType: z.string().min(1),
  subjectId: uuid.optional(),
  predicate: z.string().min(1),
  rawValue: z.string().optional(),
  normalizedValue: z.string().optional(),
  valueJson: z.record(z.unknown()).default({}),
  sourceId: z.enum(PID_SOURCE_IDS),
  artifactId: uuid.optional(),
  pageNumber: z.number().int().positive().optional(),
  charStart: z.number().int().nonnegative().optional(),
  charEnd: z.number().int().nonnegative().optional(),
  bbox: z.record(z.unknown()).optional(),
  confidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type FactAssertionInput = z.infer<typeof FactAssertionInputSchema>;

export const EventInputSchema = z.object({
  eventType: z.string().min(1),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  recordedAt: iso8601.optional(),
  propertyId: uuid.optional(),
  documentId: uuid.optional(),
  caseId: uuid.optional(),
  chargeId: uuid.optional(),
  sourceId: z.enum(PID_SOURCE_IDS),
  artifactId: uuid.optional(),
  eventSummary: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  reviewStatus: z
    .enum(["unreviewed", "approved", "rejected", "needs_followup", "lead_only"])
    .default("lead_only"),
  metadata: z.record(z.unknown()).default({}),
});
export type EventInput = z.infer<typeof EventInputSchema>;

export const PropertyInputSchema = z.object({
  canonicalKey: z.string().optional(),
  state: z.string().default("Odisha"),
  district: z.string().optional(),
  tahasil: z.string().optional(),
  village: z.string().optional(),
  mouza: z.string().optional(),
  khataNumber: z.string().optional(),
  plotNumber: z.string().optional(),
  surveyNumber: z.string().optional(),
  areaValue: z.number().nonnegative().optional(),
  areaUnit: z.string().optional(),
  geometryRef: z.string().optional(),
  identityConfidence: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type PropertyInput = z.infer<typeof PropertyInputSchema>;

// ── Sub-plan B: pattern detector writes ────────────────────────────────────
// When a fraud pattern detector (ROR-INS-XXX) fires, we persist:
//   1) one pid_pattern_candidates row (per unique candidateKey)
//   2) one pid_event of eventType "pattern_detected"
//   3) one pid_fact_assertion with predicate "pattern_fired:<ruleId>"
//
// candidateKey is the idempotency key: same rule firing twice on the same
// subject (same plot/khata/owner) bumps evidence_count instead of creating
// a duplicate row. Format: "<ruleId>:<sha256_first_16_hex_of_canonical_subject>".

export const PATTERN_EVENT_TYPE = "pattern_detected" as const;
export const PATTERN_FACT_PREDICATE_PREFIX = "pattern_fired:" as const;

export const PatternCandidateStatusSchema = z.enum([
  "RAW_SIGNAL",
  "CANDIDATE",
  "REVIEWED",
  "PROBABLE",
  "VALIDATED",
  "REJECTED",
]);
export type PatternCandidateStatus = z.infer<typeof PatternCandidateStatusSchema>;

export const PatternCandidateInputSchema = z.object({
  candidateKey: z.string().min(1).max(256),
  patternFamily: z.string().min(1),
  candidateName: z.string().optional(),
  logicDescription: z.string().optional(),
  status: PatternCandidateStatusSchema.default("RAW_SIGNAL"),
  evidenceCount: z.number().int().nonnegative().default(1),
  reviewedExampleCount: z.number().int().nonnegative().default(0),
  supportingEventIds: z.array(uuid).default([]),
  supportingArtifactIds: z.array(uuid).default([]),
  ruleVersion: z.string().min(1),
  falsePositiveNotes: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type PatternCandidateInput = z.infer<typeof PatternCandidateInputSchema>;

// Reuse the existing FactAssertionInputSchema for pattern_fired facts.
// The convention is: predicate starts with PATTERN_FACT_PREDICATE_PREFIX and
// value_json carries { ruleId, candidateKey, severity, panel, headline, disclosure }.
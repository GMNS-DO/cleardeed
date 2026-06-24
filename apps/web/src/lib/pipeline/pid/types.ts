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
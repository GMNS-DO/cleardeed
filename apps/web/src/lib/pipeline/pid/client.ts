/**
 * Typed DB client for the PID layer.
 *
 * One function per table. No mega-write functions — every operation is
 * independently tested, independently callable, and returns the row's UUID
 * (or null on failure). PID writes are best-effort; a failure here must
 * never break the report pipeline (per D-024/D-025).
 *
 * All writes go through supabaseAdmin() (service role) — the tables
 * have RLS that blocks anon access.
 */
import { supabaseAdmin } from "../../db";
import {
  SourceArtifactSchema,
  FactAssertionInputSchema,
  EventInputSchema,
  PropertyInputSchema,
  PatternCandidateInputSchema,
  type SourceArtifact,
  type FactAssertionInput,
  type EventInput,
  type PropertyInput,
  type PatternCandidateInput,
} from "./types";

// Top-level key transform: TS Zod schemas use camelCase, Postgres columns are
// snake_case. Without this, Supabase would quote camelCase keys as columns and
// the server would reject with "column does not exist" — and the error was
// being swallowed, silently dropping every PID write.
// We only transform top-level keys; nested JSONB columns (query, metadata,
// bbox, value_json, parties) keep their inner shape — they're written as JSON
// via the JSONB column type and the inner keys are caller-controlled.
const CAMEL_TO_SNAKE: Record<string, string> = {
  artifactKey: "artifact_key",
  artifactType: "artifact_type",
  sourceId: "source_id",
  collectionRunId: "collection_run_id",
  documentType: "document_type",
  sourceUrl: "source_url",
  sourceOrigin: "source_origin",
  accessMode: "access_mode",
  storagePath: "storage_path",
  storageBucket: "storage_bucket",
  storageKey: "storage_key",
  byteSize: "byte_size",
  contentType: "content_type",
  httpStatus: "http_status",
  retrievedAt: "retrieved_at",
  canonicalKey: "canonical_key",
  khataNumber: "khata_number",
  plotNumber: "plot_number",
  surveyNumber: "survey_number",
  areaValue: "area_value",
  areaUnit: "area_unit",
  geometryRef: "geometry_ref",
  identityConfidence: "identity_confidence",
  eventType: "event_type",
  eventDate: "event_date",
  recordedAt: "recorded_at",
  propertyId: "property_id",
  documentId: "document_id",
  caseId: "case_id",
  chargeId: "charge_id",
  eventSummary: "event_summary",
  reviewStatus: "review_status",
  subjectType: "subject_type",
  subjectId: "subject_id",
  rawValue: "raw_value",
  normalizedValue: "normalized_value",
  valueJson: "value_json",
  artifactId: "artifact_id",
  extractionId: "extraction_id",
  pageNumber: "page_number",
  charStart: "char_start",
  charEnd: "char_end",
  candidateKey: "candidate_key",
  patternFamily: "pattern_family",
  candidateName: "candidate_name",
  logicDescription: "logic_description",
  evidenceCount: "evidence_count",
  reviewedExampleCount: "reviewed_example_count",
  supportingEventIds: "supporting_event_ids",
  supportingArtifactIds: "supporting_artifact_ids",
  ruleVersion: "rule_version",
  falsePositiveNotes: "false_positive_notes",
};

function camelToSnake<T extends Record<string, unknown>>(input: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    out[CAMEL_TO_SNAKE[k] ?? k] = v;
  }
  return out;
}

async function singleInsert(
  table: string,
  payload: Record<string, unknown>,
  conflictTarget?: string
): Promise<string | null> {
  try {
    const supabase = supabaseAdmin();
    const query = supabase.from(table).insert(payload);
    const { data, error } = await query.select("id").single();
    if (error || !data) {
      console.warn(`[pid/client] insert ${table} failed: ${error?.message ?? "no data"}`);
      return null;
    }
    return (data as { id: string }).id;
  } catch (err) {
    console.warn(`[pid/client] insert ${table} threw: ${(err as Error).message}`);
    return null;
  }
}

async function singleUpsert(
  table: string,
  payload: Record<string, unknown>,
  onConflict: string
): Promise<string | null> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from(table)
      .upsert(payload, { onConflict, ignoreDuplicates: false })
      .select("id")
      .single();
    if (error || !data) {
      console.warn(`[pid/client] upsert ${table} failed: ${error?.message ?? "no data"}`);
      return null;
    }
    return (data as { id: string }).id;
  } catch (err) {
    console.warn(`[pid/client] upsert ${table} threw: ${(err as Error).message}`);
    return null;
  }
}

export async function pidUpsertArtifact(input: SourceArtifact): Promise<string | null> {
  const parsed = SourceArtifactSchema.safeParse(input);
  if (!parsed.success) {
    console.warn(`[pid/client] pidUpsertArtifact validation failed: ${parsed.error.message}`);
    return null;
  }
  return singleUpsert(
    "pid_artifacts",
    camelToSnake(parsed.data as unknown as Record<string, unknown>),
    "artifact_key",
  );
}

export async function pidInsertFactAssertion(input: FactAssertionInput): Promise<string | null> {
  const parsed = FactAssertionInputSchema.safeParse(input);
  if (!parsed.success) {
    console.warn(`[pid/client] pidInsertFactAssertion validation failed: ${parsed.error.message}`);
    return null;
  }
  return singleInsert(
    "pid_fact_assertions",
    camelToSnake(parsed.data as unknown as Record<string, unknown>),
  );
}

export async function pidInsertEvent(input: EventInput): Promise<string | null> {
  const parsed = EventInputSchema.safeParse(input);
  if (!parsed.success) {
    console.warn(`[pid/client] pidInsertEvent validation failed: ${parsed.error.message}`);
    return null;
  }
  return singleInsert(
    "pid_events",
    camelToSnake(parsed.data as unknown as Record<string, unknown>),
  );
}

export async function pidUpsertProperty(input: PropertyInput): Promise<string | null> {
  const parsed = PropertyInputSchema.safeParse(input);
  if (!parsed.success) {
    console.warn(`[pid/client] pidUpsertProperty validation failed: ${parsed.error.message}`);
    return null;
  }
  // Canonical key is the natural unique key. If not provided, build one from
  // (district, tahasil, village, khata, plot) — collisions across the same
  // tuple upsert into the same row, which is what we want.
  // camelToSnake first so payload.* lookups below use snake_case keys.
  const payload = camelToSnake(parsed.data as unknown as Record<string, unknown>);
  if (!payload.canonical_key) {
    payload.canonical_key = [
      payload.district,
      payload.tahasil,
      payload.village,
      payload.khata_number,
      payload.plot_number,
    ]
      .filter(Boolean)
      .join("|");
  }
  return singleUpsert("pid_properties", payload, "canonical_key");
}

// ── Sub-plan B: pattern candidate persistence ──────────────────────────────
// Insert-only path: first time a detector fires on a unique subject, the
// candidate row is created. Returns the new id, or null on any failure
// (validation, unique conflict, network). Conflicts are intentionally not
// surfaced here — the orchestrator (B.4) does a pre-read to decide whether
// to insert or upsert, because singleInsert swallows Supabase error codes
// (AD-4 of the Sub-plan B plan).
export async function pidInsertPatternCandidate(
  input: PatternCandidateInput,
): Promise<string | null> {
  const parsed = PatternCandidateInputSchema.safeParse(input);
  if (!parsed.success) {
    console.warn(
      `[pid/client] pidInsertPatternCandidate validation failed: ${parsed.error.message}`,
    );
    return null;
  }
  return singleInsert(
    "pid_pattern_candidates",
    camelToSnake(parsed.data as unknown as Record<string, unknown>),
  );
}

// Upsert path: repeat firings of the same (ruleId, subject) candidate bump
// evidence_count, append supporting_event_ids, and update updated_at.
// onConflict = "candidate_key" — the unique index from migration 006.
export async function pidUpsertPatternCandidateByKey(
  input: PatternCandidateInput,
): Promise<string | null> {
  const parsed = PatternCandidateInputSchema.safeParse(input);
  if (!parsed.success) {
    console.warn(
      `[pid/client] pidUpsertPatternCandidateByKey validation failed: ${parsed.error.message}`,
    );
    return null;
  }
  return singleUpsert(
    "pid_pattern_candidates",
    camelToSnake(parsed.data as unknown as Record<string, unknown>),
    "candidate_key",
  );
}
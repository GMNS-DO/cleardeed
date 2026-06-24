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
  type SourceArtifact,
  type FactAssertionInput,
  type EventInput,
  type PropertyInput,
} from "./types";

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
  return singleUpsert("pid_artifacts", parsed.data as unknown as Record<string, unknown>, "artifact_key");
}

export async function pidInsertFactAssertion(input: FactAssertionInput): Promise<string | null> {
  const parsed = FactAssertionInputSchema.safeParse(input);
  if (!parsed.success) {
    console.warn(`[pid/client] pidInsertFactAssertion validation failed: ${parsed.error.message}`);
    return null;
  }
  return singleInsert("pid_fact_assertions", parsed.data as unknown as Record<string, unknown>);
}

export async function pidInsertEvent(input: EventInput): Promise<string | null> {
  const parsed = EventInputSchema.safeParse(input);
  if (!parsed.success) {
    console.warn(`[pid/client] pidInsertEvent validation failed: ${parsed.error.message}`);
    return null;
  }
  return singleInsert("pid_events", parsed.data as unknown as Record<string, unknown>);
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
  const payload = parsed.data as unknown as Record<string, unknown>;
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
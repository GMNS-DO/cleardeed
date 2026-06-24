/**
 * PID corpus reader (server-side only) + legacy stub.
 *
 * - The legacy `readCorpusCases()` / `readCorpusCasesByFamily()` no-op stubs
 *   are kept so the gated `await import("./corpus")` in pipeline/index.ts
 *   continues to resolve cleanly. The PID synthesis block is gated on
 *   `PID_SYNTHESIS_ENABLED` and short-circuits when these return [].
 * - The new `readPidArtifactsForReport()` and `readPidEventsForProperty()`
 *   are the live read paths for the PID layer. They are best-effort: a
 *   failure returns [] and never throws.
 */
import { supabaseAdmin } from "../db";

// ── Legacy no-op stubs (D-024/D-025 — keep the import path alive) ──────────
export interface CorpusCase {
  id: string;
  case_no?: string;
  title?: string;
  parties?: string[];
  disposition?: string;
  court_type?: string;
  judicial_district?: string;
  filing_year?: number;
  judgment_year?: number;
  reported?: boolean;
  case_family?: string;
  case_tags?: string[];
  created_at?: string;
}

export async function readCorpusCases(): Promise<CorpusCase[]> {
  return [];
}

export async function readCorpusCasesByFamily(
  _family: string,
  _limit: number = 10
): Promise<CorpusCase[]> {
  return [];
}

export function _resetCorpusCache(): void {
  // no-op
}

// ── PID read paths ──────────────────────────────────────────────────────────
export interface PidArtifact {
  id: string;
  source_id: string;
  storage_path: string;
  sha256: string;
  retrieved_at: string;
  metadata: Record<string, unknown>;
}

export interface PidEvent {
  id: string;
  event_type: string;
  source_id: string | null;
  event_date: string | null;
  event_summary: string | null;
  property_id: string | null;
  review_status: string;
  metadata: Record<string, unknown>;
}

export async function readPidArtifactsForReport(
  reportId: string
): Promise<PidArtifact[]> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("pid_artifacts")
      .select("id, source_id, storage_path, sha256, retrieved_at, metadata")
      .eq("metadata->>report_id", reportId)
      .order("retrieved_at", { ascending: false })
      .limit(500);
    if (error || !data) return [];
    return data as PidArtifact[];
  } catch (err) {
    console.warn(`[pid/corpus] readPidArtifactsForReport failed: ${(err as Error).message}`);
    return [];
  }
}

export async function readPidEventsForProperty(
  propertyId: string
): Promise<PidEvent[]> {
  try {
    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("pid_events")
      .select("id, event_type, source_id, event_date, event_summary, property_id, review_status, metadata")
      .eq("property_id", propertyId)
      .order("event_date", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error || !data) return [];
    return data as PidEvent[];
  } catch (err) {
    console.warn(`[pid/corpus] readPidEventsForProperty failed: ${(err as Error).message}`);
    return [];
  }
}
/**
 * PID corpus reader (server-side only) — STUB
 *
 * The PID track was removed in commit fb6a2aa (D-024/D-025). This module
 * remains as a no-op stub so that the gated `await import("./corpus")` in
 * pipeline/index.ts continues to resolve cleanly. The PID synthesis block
 * is also gated on `PID_SYNTHESIS_ENABLED` (default false) and short-
 * circuits when this returns an empty array.
 *
 * If/when the PID track is reinstated, restore the real implementation
 * (which previously read from `pid/data/corpus/cases.jsonl`).
 */
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

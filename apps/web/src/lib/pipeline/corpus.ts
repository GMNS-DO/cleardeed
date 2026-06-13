/**
 * PID corpus reader (server-side only)
 *
 * Server-side wrapper around the PID corpus store. Reads cases.jsonl lazily
 * and caches results in memory for the lifetime of the process. Used by the
 * pipeline to seed the pattern similarity engine.
 *
 * This file imports from the root-level `pid/` directory (relative path) — it
 * is Node.js-only and MUST NOT be imported by any client-rendered code.
 */
import type { readJsonl as readJsonlFn } from "../../../../pid/lib/corpus-store.mjs";

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

let cachedCases: CorpusCase[] | null = null;
let cachedAt: number = 0;
const CACHE_TTL_MS = 5_000; // 5-second TTL

/**
 * Read all corpus cases. Caches the result in-memory for 5 seconds so that
 * report generation, which can issue many back-to-back reads, doesn't re-parse
 * the JSONL file on every call.
 */
export async function readCorpusCases(): Promise<CorpusCase[]> {
  const now = Date.now();
  if (cachedCases && now - cachedAt < CACHE_TTL_MS) {
    return cachedCases;
  }

  try {
    // Dynamic import — `pid/lib/corpus-store.mjs` is a Node.js ESM module
    const { readJsonl } = (await import("../../../../pid/lib/corpus-store.mjs")) as {
      readJsonl: typeof readJsonlFn;
    };
    const casesPath = new URL("../../../../pid/data/corpus/cases.jsonl", import.meta.url).pathname;
    const cases = (await readJsonl(casesPath)) as CorpusCase[];
    cachedCases = cases;
    cachedAt = now;
    return cases;
  } catch (err) {
    console.warn("[corpus] Failed to read corpus cases:", err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Read corpus cases filtered by family. Returns up to `limit` cases.
 */
export async function readCorpusCasesByFamily(
  family: string,
  limit: number = 10
): Promise<CorpusCase[]> {
  const all = await readCorpusCases();
  return all.filter((c) => c.case_family === family).slice(0, limit);
}

/**
 * For testing only — clears the in-memory cache.
 */
export function _resetCorpusCache(): void {
  cachedCases = null;
  cachedAt = 0;
}

/**
 * ClearDeed Orchestrator — V1.1 Bhulekh-only
 *
 * V1.1 scope: Bhulekh (Front + Back pages) + Bhunaksha screenshot only.
 * All other sources are dormant — see CLEARDEED_HANDOFF_V1.1.md §1.
 *
 * User flow for V1.1:
 * 1. User selects Tehsil + Village from cached location graph dropdowns
 * 2. User picks search mode: Plot | Khatiyan | Tenant name
 * 3. User types identifier → fetcher scrapes dropdown options → ranked picker
 * 4. User selects from ranked picker → identifierValue + identifierLabel passed
 * 5. Bhulekh fetches Front Page + Back Page with screenshots
 * 6. Report generated → founder review → WhatsApp delivery
 *
 * Supports both V1.1 dropdown mode (tehsil+village) and legacy GPS mode.
 * In V1.1, only the dropdown path is active.
 *
 * Timeout: 30 seconds total.
 * Report status: pending_review (founder must approve before delivery).
 */

import type { SourceResult } from "@cleardeed/schema";
import { fetch as bhulekhFetch } from "@cleardeed/fetcher-bhulekh";

// Re-export schema types for consumers
export type { SourceResult } from "@cleardeed/schema";

const OVERALL_TIMEOUT_MS = 30_000;

export interface RunReportInput {
  /** GPS-based input (legacy): lat/lon for GPS→village lookup */
  gps?: { lat: number; lon: number };
  /** Legacy: claimed owner name for owner-match */
  claimedOwnerName?: string;
  fatherHusbandName?: string;
  /** V1.1: Bhulekh tehsil name (e.g. "Bhubaneswar", "Kordha") — from dropdown */
  tehsil?: string;
  /** V1.1: Bhulekh village name — from dropdown, scoped to tehsil */
  village?: string;
  /** V1.1: Search mode */
  searchMode?: "Plot" | "Khatiyan" | "Tenant";
  /** V1.1: User-selected identifier value from ranked picker dropdown */
  identifierValue?: string;
  /** V1.1: User-selected identifier label (display string from dropdown) */
  identifierLabel?: string;
  reportId?: string;
}

export interface RunReportOutput {
  reportId: string;
  sources: SourceResult[];
  completedAt: string;
  validationFindings?: Array<{
    source: string;
    severity: "error" | "warning" | "info";
    description: string;
    dimension: string;
  }>;
}

export async function runReport(input: RunReportInput): Promise<RunReportOutput> {
  const reportId = input.reportId ?? crypto.randomUUID();
  const completedAt = new Date().toISOString();
  const completedSources = new Map<string, SourceResult>();

  const recordResult = (result: SourceResult): SourceResult => {
    completedSources.set(result.source, result);
    return result;
  };

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<SourceResult[]>((resolve) => {
    timeoutId = setTimeout(() => {
      console.error("[orchestrator] runReport timed out after 30s; returning completed sources");
      resolve(Array.from(completedSources.values()));
    }, OVERALL_TIMEOUT_MS);
  });

  const fetcherPromise = runAllFetchers(input, recordResult, completedSources);

  let sources: SourceResult[];
  try {
    sources = await Promise.race([fetcherPromise, timeoutPromise]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[orchestrator] pipeline error:", msg);
    sources = Array.from(completedSources.values());
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  return { reportId, sources, completedAt };
}

async function runAllFetchers(
  input: RunReportInput,
  recordResult: (r: SourceResult) => SourceResult,
  completedSources: Map<string, SourceResult>
): Promise<SourceResult[]> {
  // ─── V1.1 mode: tehsil+village dropdown input ───────────────────────────────
  if (input.tehsil && input.village) {
    const identifierVal = input.identifierValue ?? "";
    const bhulekhResult = await runFetcher("bhulekh", () =>
      bhulekhFetch({
        tehsil: input.tehsil,
        village: input.village as string,  // always string when tehsil+village path is taken
        searchMode: input.searchMode ?? "Khatiyan",
        identifierValue: identifierVal,
        identifierLabel: input.identifierLabel ?? "",
        ownerName: input.claimedOwnerName,
      })
    );
    recordResult(bhulekhResult);
    return Array.from(completedSources.values());
  }

  // ─── Legacy mode: GPS input (deprecated in V1.1 — returns not_covered) ───────
  // V1.1 uses dropdowns. Legacy GPS path returns not_covered for all sources.
  // Restore full legacy chain when V1.2 adds GPS-based Bhunaksha resolver.
  recordResult(notCoveredResult("nominatim", "GPS mode deprecated in V1.1 — use tehsil+village dropdown"));
  recordResult(notCoveredResult("bhunaksha", "GPS mode deprecated in V1.1 — use tehsil+village dropdown"));

  if (input.gps) {
    recordResult(notCoveredResult("bhulekh", "GPS input requires V1.2 Bhunaksha GPS resolver"));
  } else {
    recordResult(failedResult("bhulekh", "No tehsil/village (V1.1) or GPS (legacy) provided"));
  }

  return Array.from(completedSources.values());
}

function notCoveredResult(source: string, reason: string): SourceResult {
  return {
    source,
    status: "not_covered",
    statusReason: `V1.1-DORMANT: ${reason} — see CLEARDEED_HANDOFF_V1.1.md §1`,
    verification: "not_covered",
    fetchedAt: new Date().toISOString(),
  } as unknown as SourceResult;
}

function failedResult(source: string, reason: string): SourceResult {
  return {
    source,
    status: "failed",
    statusReason: reason,
    verification: "manual_required",
    fetchedAt: new Date().toISOString(),
    error: reason,
  } as unknown as SourceResult;
}

async function runFetcher(
  source: string,
  fn: () => Promise<SourceResult>
): Promise<SourceResult> {
  console.log(`[orchestrator] starting source: ${source}`);
  const start = Date.now();
  try {
    const result = await fn();
    const elapsed = Date.now() - start;
    console.log(`[orchestrator] completed source: ${source} (${elapsed}ms) status=${result.status}`);
    return result;
  } catch (err) {
    const elapsed = Date.now() - start;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[orchestrator] error in ${source} (${elapsed}ms):`, msg);
    return {
      source,
      status: "failed",
      statusReason: msg,
      verification: "manual_required",
      fetchedAt: new Date().toISOString(),
      error: msg,
    } as SourceResult;
  }
}
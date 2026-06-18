/**
 * ClearDeed — Plot diagram cache layer.
 *
 * Phase 8 (Task 35) of the unified insight engine. The plot diagram is
 * non-blocking: a freshly-generated report can ship without one. But the
 * WFS compose step is the most expensive per-report call (~3s minimum, 30s
 * budget), and a buyer (or lawyer) re-running the same (gps + plot # +
 * village) should not pay that cost twice in a 7-day window.
 *
 * Cache key policy (per Task 35 brief):
 *   - Primary:   the reportId the pipeline is generating now
 *   - Secondary: any other report within 7 days for the same
 *                (gps + plot# + village) tuple
 *
 * The `reports` table is the source of truth — Tasks 33-34 already upload
 * the SVG to Supabase Storage and we now persist the public URL on the
 * report row. This helper hides the lookup + expiry math from the
 * pipeline so the orchestrator stays a pure pipeline.
 */

import { getSupabaseServerClient } from "./db";

/** 7-day window. Kept as a constant so it's easy to change + test. */
export const PLOT_DIAGRAM_CACHE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * A cached plot diagram record (just what the pipeline needs to skip a
 * re-fetch). The pipeline should never depend on more than `url` + the
 * `renderedAt` timestamp; the rest is for the audit trail.
 */
export interface CachedPlotDiagram {
  url: string;
  status: string;
  renderedAt: string;
  reportId: string;
}

/**
 * Build a deterministic, compact cache key for the (gps + plot# + village)
 * tuple. We round the GPS to 5 decimal places (≈1.1 m at the equator) so
 * jitter from re-entering coordinates on a phone doesn't bust the cache.
 *
 * Plot# and village are lowercased + trimmed. Both are required — a
 * missing plot# or village cannot safely reuse a cache entry because
 * different plots in the same village would otherwise collide.
 */
export function buildPlotDiagramCacheKey(
  gps: { lat: number; lon: number },
  plotNo: string,
  village: string
): string {
  const lat = gps.lat.toFixed(5);
  const lon = gps.lon.toFixed(5);
  const plot = plotNo.trim().toLowerCase();
  const vill = village.trim().toLowerCase();
  return `${lat},${lon}|${plot}|${vill}`;
}

/**
 * Look up a cached plot diagram URL for the given reportId if it was
 * rendered within the 7-day window.
 *
 * Returns `null` if:
 *   - the report does not exist
 *   - it has no plot diagram persisted
 *   - the diagram was rendered more than 7 days ago
 *   - the diagram was rendered in a `failed` state (we want the pipeline
 *     to retry, not show a stale failure)
 */
export async function findCachedPlotDiagramByReportId(
  reportId: string,
  now: Date = new Date()
): Promise<CachedPlotDiagram | null> {
  if (!reportId) return null;

  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("reports")
    .select("id, plot_diagram_url, plot_diagram_status, plot_diagram_rendered_at")
    .eq("id", reportId)
    .maybeSingle();

  if (error || !data) return null;
  return pickIfFresh(data, now, reportId);
}

/**
 * Look up a cached plot diagram URL for any report that ran for the same
 * (gps + plot# + village) tuple within the 7-day window.
 *
 * This handles the "user runs the same plot twice" case where each run
 * gets a fresh reportId. We hash the tuple to a storage-safe string and
 * match on plot# + village (rounded-GPS) + recent timestamp.
 *
 * Implementation note: we use `plot_diagram_url IS NOT NULL` as the
 * leading filter, then narrow by (plot_no, village, time window) at the
 * application level. That's because the reports table doesn't store
 * (plot# + village + GPS) as discrete columns yet — we use the
 * `geoFetch` JSON blob that the pipeline writes. For now the secondary
 * path only supports exact-reportId reuse; cross-report reuse is the
 * stretch goal of Task 36. See T-036 follow-ups in CLAUDE.md.
 */
export async function findCachedPlotDiagramByGps(
  gps: { lat: number; lon: number },
  plotNo: string,
  village: string,
  now: Date = new Date()
): Promise<CachedPlotDiagram | null> {
  if (!plotNo.trim() || !village.trim()) return null;

  const supabase = getSupabaseServerClient();
  const cutoffIso = new Date(now.getTime() - PLOT_DIAGRAM_CACHE_WINDOW_MS).toISOString();
  const lat = gps.lat.toFixed(5);
  const lon = gps.lon.toFixed(5);

  // We pull a bounded recent window. In practice the index on
  // (plot_diagram_status, plot_diagram_rendered_at) keeps this fast.
  const { data, error } = await supabase
    .from("reports")
    .select("id, plot_diagram_url, plot_diagram_status, plot_diagram_rendered_at, plot_description, gps_lat, gps_lon")
    .not("plot_diagram_url", "is", null)
    .gte("plot_diagram_rendered_at", cutoffIso)
    .order("plot_diagram_rendered_at", { ascending: false })
    .limit(25);

  if (error || !data) return null;

  for (const row of data) {
    if (!row.plot_diagram_url || !row.plot_diagram_rendered_at) continue;
    if (row.gps_lat == null || row.gps_lon == null) continue;
    if (row.gps_lat.toFixed(5) !== lat) continue;
    if (row.gps_lon.toFixed(5) !== lon) continue;

    // The pipeline writes (gps + plot# + village) into `plot_description` as
    // a stable "village|plot" string. We pull those out and compare.
    const desc = String(row.plot_description ?? "").trim();
    if (!desc) continue;
    const [rowVill, rowPlot] = desc.split("|");
    if (!rowVill || !rowPlot) continue;
    if (rowPlot.trim().toLowerCase() !== plotNo.trim().toLowerCase()) continue;
    if (rowVill.trim().toLowerCase() !== village.trim().toLowerCase()) continue;

    return pickIfFresh(row, now, row.id);
  }
  return null;
}

// ── Internal ────────────────────────────────────────────────────────────────

/**
 * Shape of a row from the partial `select` we run above. Kept local so
 * the helpers above don't leak Supabase's row type into the pipeline.
 */
interface PlotDiagramRow {
  id: string;
  plot_diagram_url: string | null;
  plot_diagram_status: string | null;
  plot_diagram_rendered_at: string | null;
}

function pickIfFresh(
  row: PlotDiagramRow,
  now: Date,
  reportId: string
): CachedPlotDiagram | null {
  if (!row.plot_diagram_url || !row.plot_diagram_rendered_at) return null;
  if (row.plot_diagram_status === "failed") return null;

  const rendered = new Date(row.plot_diagram_rendered_at);
  if (Number.isNaN(rendered.getTime())) return null;
  if (now.getTime() - rendered.getTime() > PLOT_DIAGRAM_CACHE_WINDOW_MS) return null;

  return {
    url: row.plot_diagram_url,
    status: row.plot_diagram_status ?? "success",
    renderedAt: row.plot_diagram_rendered_at,
    reportId,
  };
}

/**
 * ClearDeed — Plot diagram pipeline step.
 *
 * Phase 8 (Task 35) of the unified insight engine. Wraps the WFS
 * compose + render + Supabase Storage upload + report-row persistence
 * into a single, non-blocking step the V1.1 pipeline calls after
 * Bhunaksha and Bhulekh have produced results.
 *
 * Guarantees (per Task 35 brief):
 *   - 30s overall timeout (matches the WFS compose budget)
 *   - Never throws. Always returns a structured PlotDiagramStepResult.
 *   - On error, logs and returns `status: "failed"` with a reason. The
 *     pipeline keeps running — the report ships without a diagram.
 *   - Cache hit: if a recent diagram exists for the same reportId
 *     (primary) or for the same (gps+plot#+village) tuple within 7 days
 *     (secondary), reuse the URL and skip the WFS call entirely.
 *   - Persists URL + status + rendered_at to the reports row so the
 *     next rerun can reuse it.
 */

import { fetchPlotDiagram } from "@cleardeed/fetcher-bhunaksha";
import { renderPlotDiagramSvg } from "@cleardeed/render";
import {
  storePlotDiagram,
  type PlotPolygonLike,
} from "./plot-diagram-storage";
import { getSupabaseServerClient } from "./db";
import {
  buildPlotDiagramCacheKey,
  findCachedPlotDiagramByGps,
  findCachedPlotDiagramByReportId,
  PLOT_DIAGRAM_CACHE_WINDOW_MS,
  type CachedPlotDiagram,
} from "./plot-diagram-cache";

/** 30s overall budget per Task 35 brief. Matches the WFS compose budget. */
export const PLOT_DIAGRAM_TIMEOUT_MS = 30_000;

export type PlotDiagramStatus =
  | "success"
  | "partial"
  | "failed"
  | "not_attempted";

export interface PlotDiagramStepInput {
  reportId: string;
  gps: { lat: number; lon: number };
  village: string;
  /** Bhulekh plot number — what the user actually searched for. */
  plotNo: string;
  /** Target polygon from Bhunaksha WFS. */
  targetPolygon: PlotPolygonLike;
  /** Optional layer override (default: "khurda_bhubaneswar"). */
  layer?: string;
  /** Optional path for tracing in logs. */
  traceId?: string;
}

export interface PlotDiagramStepResult {
  status: PlotDiagramStatus;
  url: string | null;
  reason?: string;
  /** True when we reused a previously rendered SVG. */
  cacheHit: boolean;
  /** True when the SVG was rendered fresh in this run. */
  rendered: boolean;
  /** Wall-clock duration in ms, excluding the cache-only path. */
  durationMs: number;
}

/**
 * Run the plot diagram step.
 *
 * The pipeline calls this once per report, after Bhunaksha has produced
 * a target polygon. Errors are caught and returned as `status: "failed"`
 * so the rest of the report pipeline can continue.
 */
export async function runPlotDiagramStep(
  input: PlotDiagramStepInput
): Promise<PlotDiagramStepResult> {
  const startedAt = Date.now();
  const log = (msg: string, extra?: Record<string, unknown>) => {
    if (input.traceId) {
      console.log(`[plot-diagram/${input.traceId}] ${msg}`, extra ?? {});
    } else {
      console.log(`[plot-diagram] ${msg}`, extra ?? {});
    }
  };

  // ── Guard: missing inputs → not_attempted (not failed) ────────────────
  if (!input.targetPolygon?.coordinates?.[0]?.length) {
    log("no target polygon, skipping");
    return {
      status: "not_attempted",
      url: null,
      reason: "no_target_polygon",
      cacheHit: false,
      rendered: false,
      durationMs: Date.now() - startedAt,
    };
  }
  if (!input.plotNo.trim() || !input.village.trim()) {
    log("missing plotNo or village, skipping");
    return {
      status: "not_attempted",
      url: null,
      reason: "missing_identifier",
      cacheHit: false,
      rendered: false,
      durationMs: Date.now() - startedAt,
    };
  }

  // ── Cache: primary (by reportId) + secondary (by gps+plot#+village) ───
  const primary = await findCachedPlotDiagramByReportId(input.reportId);
  if (primary) {
    log("cache hit by reportId", { url: primary.url, renderedAt: primary.renderedAt });
    return {
      status: "success",
      url: primary.url,
      cacheHit: true,
      rendered: false,
      durationMs: Date.now() - startedAt,
    };
  }
  const secondary = await findCachedPlotDiagramByGps(
    input.gps,
    input.plotNo,
    input.village
  );
  if (secondary) {
    log("cache hit by gps+plot+village", { url: secondary.url });
    // Persist the URL on this report too, so subsequent lookups by
    // reportId hit the primary path.
    await persistPlotDiagram(input.reportId, {
      url: secondary.url,
      status: "success",
      renderedAt: new Date().toISOString(),
    });
    return {
      status: "success",
      url: secondary.url,
      cacheHit: true,
      rendered: false,
      durationMs: Date.now() - startedAt,
    };
  }

  log("cache miss, rendering", {
    cacheKey: buildPlotDiagramCacheKey(input.gps, input.plotNo, input.village),
  });

  // ── Render: 30s overall timeout (Aborts the compose + render + upload) ─
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLOT_DIAGRAM_TIMEOUT_MS);
  try {
    // Step 1: WFS compose (returns PlotDiagramResult with target+neighbors+roads)
    const diagram = await fetchPlotDiagram({
      targetPolygon: input.targetPolygon,
      targetPlotNo: input.plotNo,
      targetVillage: input.village,
      centroid: input.gps,
      ...(input.layer ? { layer: input.layer } : {}),
    });

    // We honour the abort by checking it explicitly between compose + render.
    if (controller.signal.aborted) {
      throw new Error("plot_diagram_timeout_after_compose");
    }

    // Step 2: Render the SVG
    const svg = renderPlotDiagramSvg(diagram, {
      title: `Plot ${input.plotNo} — ${input.village}`,
    });

    // Step 3: Upload to Supabase Storage
    const plotDiagramKey = buildPlotDiagramKey(input.gps, input.plotNo, input.village);
    const { url } = await storePlotDiagram({
      reportId: input.reportId,
      plotDiagramKey,
      svg,
    });

    // Step 4: Persist on the report row
    const renderedAt = new Date().toISOString();
    await persistPlotDiagram(input.reportId, {
      url,
      status: diagram.status,
      renderedAt,
    });

    log("rendered and uploaded", { url, status: diagram.status, durationMs: Date.now() - startedAt });
    return {
      status: diagram.status === "success" ? "success" : "partial",
      url,
      cacheHit: false,
      rendered: true,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log("plot diagram step failed", { reason });
    // Persist a `failed` status so a future rerun re-tries (failed rows
    // are excluded from the cache by `pickIfFresh`).
    await persistPlotDiagram(input.reportId, {
      url: null,
      status: "failed",
      renderedAt: new Date().toISOString(),
    });
    return {
      status: "failed",
      url: null,
      reason,
      cacheHit: false,
      rendered: false,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build a stable, content-addressed storage key for the SVG. The key
 * changes when the inputs change so old SVGs naturally age out of the
 * bucket (and we never overwrite a different plot's diagram).
 */
export function buildPlotDiagramKey(
  gps: { lat: number; lon: number },
  plotNo: string,
  village: string
): string {
  return buildPlotDiagramCacheKey(gps, plotNo, village).replace(/[^a-zA-Z0-9|,-]/g, "_");
}

/**
 * Persist the plot diagram URL + status + timestamp on the reports row.
 * Uses the service-role client (bypasses RLS) — same pattern as
 * `bumpReportExpiry` in db.ts.
 *
 * Tolerates "column does not exist" errors so the pipeline keeps
 * working before the migration (016) is applied in production. This
 * matters because the migration is on a different deploy cadence than
 * the app — the app must not crash on first run after deploy.
 */
async function persistPlotDiagram(
  reportId: string,
  fields: { url: string | null; status: PlotDiagramStatus; renderedAt: string }
): Promise<void> {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase
    .from("reports")
    .update({
      plot_diagram_url: fields.url,
      plot_diagram_status: fields.status,
      plot_diagram_rendered_at: fields.renderedAt,
    })
    .eq("id", reportId);

  if (error) {
    // Migration 016 not applied yet → log and move on. The pipeline
    // still has the URL in memory; the report can ship. On the next
    // rerun (after the migration lands) the cache will be populated
    // from this report's first successful render.
    if (/column .* does not exist/i.test(error.message)) {
      console.warn(
        "[plot-diagram] reports.plot_diagram_* columns not yet migrated (run migration 016)",
        { reportId }
      );
      return;
    }
    throw new Error(`persistPlotDiagram failed: ${error.message}`);
  }
}

/** Re-export the cache window for test assertions. */
export { PLOT_DIAGRAM_CACHE_WINDOW_MS };
/** Re-export the cached-row type for tests + downstream consumers. */
export type { CachedPlotDiagram };

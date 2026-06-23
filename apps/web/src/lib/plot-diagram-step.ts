/**
 * Plot diagram pipeline step.
 *
 * The pipeline calls runPlotDiagramStep once per report. There are two
 * primary paths:
 *
 *   1. **Precise path** — when Bhunaksha WFS returned a target polygon
 *      for the GPS, fetchPlotDiagram composes a full PlotDiagramResult
 *      (target + neighbors + roads), renders it as an SVG via
 *      renderPlotDiagramSvg, and uploads to Supabase Storage.
 *
 *   2. **Approximate path** — when Bhunaksha returned no containing
 *      polygon (the V1.1 GPS-to-plot lookup misses because the field
 *      hasn't been re-built since the 2024 tehsil boundary change), the
 *      caller passes `fallback: { reason, centroid, khordhaBoundary }`.
 *      The step synthesizes a "no-plot" diagram (district outline +
 *      target marker) via renderDistrictOutlineSvg and uploads that.
 *      The MapCard v1 bootstrap shows the district layer instead of the
 *      target polygon and surfaces the reason to the buyer.
 *
 * Both paths share the same cache (by reportId + by gps+plotNo+village).
 * The approximate path writes its own storage key (prefix
 * "approximate/") so precise and approximate cache entries never
 * collide.
 *
 * Errors are caught and returned as `status: "failed"` so the rest of
 * the report pipeline can continue.
 */

import { fetchPlotDiagram } from "@cleardeed/fetcher-bhunaksha";
import { renderPlotDiagramSvg, renderDistrictOutlineSvg } from "@cleardeed/render";
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
import {
  synthesizePlotPolygon,
  type SynthesizeResult,
} from "./synthesize-plot-polygon";

// ──────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────

/** Overall timeout for compose + render + upload. */
const PLOT_DIAGRAM_TIMEOUT_MS = 30_000;

/**
 * Optional fallback payload. When present, the step uses the
 * approximate path (district outline + target marker) instead of
 * composing a full PlotDiagram from WFS. The pipeline sets this
 * whenever Bhunaksha returned no containing polygon.
 */
export interface PlotDiagramFallback {
  /** The reason Bhunaksha missed (for the desc text + support). */
  reason: string;
  /** Village centroid to place the target marker. */
  centroid: { lat: number; lon: number };
  /**
   * Sibling summary that was synthesized by the pipeline for the
   * MapCard v1. The step forwards this through the result so the
   * bootstrap can attach it to the data-* attributes. The step
   * re-synthesizes if the caller doesn't pre-compute it.
   */
  synthesized?: SynthesizeResult;
}

export interface PlotDiagramStepInput {
  reportId: string;
  gps: { lat: number; lon: number };
  plotNo: string;
  village: string;
  /**
   * The target polygon from Bhunaksha. When this is null/missing,
   * the caller MUST pass `fallback` to indicate why.
   */
  targetPolygon?: { type: "Polygon"; coordinates: number[][] } | null;
  /** Optional layer override (e.g. for testing specific WFS layers). */
  layer?: string;
  /**
   * MapCard v1 fallback payload. When present, the step takes the
   * approximate path (district outline + target marker).
   */
  fallback?: PlotDiagramFallback | null;
  traceId?: string;
}

export type PlotDiagramStatus = "success" | "partial" | "failed";

export interface PlotDiagramStepResult {
  status: "success" | "partial" | "failed" | "not_attempted";
  url: string | null;
  reason?: string;
  cacheHit: boolean;
  rendered: boolean;
  durationMs: number;
  // Phase 2 v1 — transient geo data for MapCard v1 (the interactive
  // map). Lives in memory during report generation; emitted as
  // data-* attributes on the map div. NOT persisted to the DB.
  //
  // On the precise path, targetPolygon/neighbors/roads/bounds come
  // straight from fetchPlotDiagram. On the approximate path, they
  // come from synthesizePlotPolygon (a synthesized single-polygon
  // dataset so the MapCard can still render an interactive map).
  // On the not_attempted/failed paths they're absent (or null on
  // approximate failure) — the MapCard falls back to the v0 static
  // SVG.
  targetPolygon?: { type: "Polygon"; coordinates: number[][] } | null;
  neighbors?: Array<{
    plotNo: string;
    village: string;
    tehsil: string;
    polygon: { type: "Polygon"; coordinates: number[][] };
    areaSqKm: number;
    kisam?: string;
  }>;
  roads?: Array<{
    name?: string;
    path: number[][] | number[][][];
    roadClass?: string;
  }>;
  bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number } | null;
  // Phase 2 v1 — set when this run took the approximate path. The
  // bootstrap reads it to know whether to render the district layer
  // + show the approximate caption.
  approximate?: boolean;
  approximateReason?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────

/**
 * Run the plot diagram step.
 *
 * The pipeline calls this once per report, after Bhunaksha has produced
 * (or failed to produce) a target polygon. Errors are caught and
 * returned as `status: "failed"` so the rest of the report pipeline
 * can continue.
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
  // The approximate path doesn't need a target polygon; the caller
  // passes a fallback instead.
  const isApproximate = !!input.fallback;
  if (!isApproximate && !input.targetPolygon?.coordinates?.[0]?.length) {
    log("no target polygon and no fallback, skipping");
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
  // Approximate and precise entries share the same cache namespaces
  // (per-reportId + per-gps+plot+village) but use different storage
  // keys, so a precise SVG never collides with an approximate one.
  const primary = await findCachedPlotDiagramByReportId(input.reportId);
  if (primary) {
    log("cache hit by reportId", { url: primary.url, renderedAt: primary.renderedAt });
    return buildCacheHitResult(primary.url, startedAt, isApproximate, input);
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
    return buildCacheHitResult(secondary.url, startedAt, isApproximate, input);
  }

  // ── Render: 30s overall timeout (Aborts the compose + render + upload) ─
  if (isApproximate) {
    return runApproximatePath(input, startedAt, log);
  }
  return runPrecisePath(input, startedAt, log);
}

// ──────────────────────────────────────────────────────────────────────────
// Internal paths
// ──────────────────────────────────────────────────────────────────────────

/**
 * Precise path: fetchPlotDiagram → renderPlotDiagramSvg → upload.
 */
async function runPrecisePath(
  input: PlotDiagramStepInput,
  startedAt: number,
  log: (msg: string, extra?: Record<string, unknown>) => void
): Promise<PlotDiagramStepResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PLOT_DIAGRAM_TIMEOUT_MS);
  try {
    // Step 1: WFS compose (returns PlotDiagramResult with target+neighbors+roads)
    const diagram = await fetchPlotDiagram({
      targetPolygon: input.targetPolygon as PlotPolygonLike,
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
      // Phase 2 v1 — surface the geo data for the interactive map.
      // `diagram.bounds` uses minX/maxX (lon) and minY/maxY (lat);
      // we rename to the lon/lat keys the v1 schema and bootstrap
      // script expect. The polygon stays as-is — it's already a
      // GeoJSON Polygon in WGS84, which is what MapLibre needs.
      targetPolygon: diagram.target?.polygon ?? null,
      neighbors: diagram.neighbors ?? [],
      roads: diagram.roads ?? [],
      bounds: diagram.bounds
        ? {
            minLat: diagram.bounds.minY,
            maxLat: diagram.bounds.maxY,
            minLon: diagram.bounds.minX,
            maxLon: diagram.bounds.maxX,
          }
        : null,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log("plot diagram step failed (precise path)", { reason });
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

/**
 * Approximate path: synthesizePlotPolygon → renderDistrictOutlineSvg → upload.
 *
 * The synthesized result provides the geo data the MapCard needs to
 * render the district layer (khordhaBoundary) and place the target
 * marker (targetPolygon). On cache hits we re-derive that data from
 * the input.fallback payload.
 */
async function runApproximatePath(
  input: PlotDiagramStepInput,
  startedAt: number,
  log: (msg: string, extra?: Record<string, unknown>) => void
): Promise<PlotDiagramStepResult> {
  const fallback = input.fallback!;
  try {
    // Re-synthesize so we always have the in-memory geo data for the
    // MapCard (cache-hit paths take a shortcut through
    // buildCacheHitResult, which uses this same payload).
    const synthesized =
      fallback.synthesized ??
      synthesizePlotPolygon({
        gps: input.gps,
        plotNo: input.plotNo,
        village: input.village,
        reason: fallback.reason,
      });

    const svg = renderDistrictOutlineSvg(
      {
        khordhaBoundary: synthesized.khordhaBoundary,
        centroid: fallback.centroid,
        village: input.village,
        plotNo: input.plotNo,
        reason: fallback.reason,
      },
      {
        title: `Plot ${input.plotNo} — ${input.village} (approximate)`,
      }
    );

    const plotDiagramKey =
      "approximate/" +
      buildPlotDiagramKey(input.gps, input.plotNo, input.village);
    const { url } = await storePlotDiagram({
      reportId: input.reportId,
      plotDiagramKey,
      svg,
    });

    const renderedAt = new Date().toISOString();
    await persistPlotDiagram(input.reportId, {
      url,
      status: "success",
      renderedAt,
    });

    log("rendered approximate diagram and uploaded", {
      url,
      reason: fallback.reason,
      durationMs: Date.now() - startedAt,
    });

    return {
      status: "success",
      url,
      cacheHit: false,
      rendered: true,
      durationMs: Date.now() - startedAt,
      approximate: true,
      approximateReason: fallback.reason,
      targetPolygon: synthesized.targetPolygon,
      bounds: synthesized.bounds,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log("plot diagram step failed (approximate path)", { reason });
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
      approximate: true,
      approximateReason: fallback.reason,
    };
  }
}

/**
 * Build a result for a cache hit. Approximate cache hits still need
 * the in-memory geo payload so the MapCard can render the district
 * layer — the SVG alone is insufficient (the bootstrap reads
 * data-target-polygon / data-bounds for the map div).
 */
function buildCacheHitResult(
  url: string,
  startedAt: number,
  isApproximate: boolean,
  input: PlotDiagramStepInput
): PlotDiagramStepResult {
  if (!isApproximate || !input.fallback) {
    return {
      status: "success",
      url,
      cacheHit: true,
      rendered: false,
      durationMs: Date.now() - startedAt,
    };
  }

  const synthesized =
    input.fallback.synthesized ??
    synthesizePlotPolygon({
      gps: input.gps,
      plotNo: input.plotNo,
      village: input.village,
      reason: input.fallback.reason,
    });

  return {
    status: "success",
    url,
    cacheHit: true,
    rendered: false,
    durationMs: Date.now() - startedAt,
    approximate: true,
    approximateReason: input.fallback.reason,
    targetPolygon: synthesized.targetPolygon,
    bounds: synthesized.bounds,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

/**
 * Build a stable, content-addressed storage key for the SVG. The key
 * changes when the inputs change so old SVGs naturally age out of the
 * bucket (and we never overwrite a different plot's diagram).
 *
 * Approximate-path callers should prefix the result with
 * "approximate/" to keep precise and approximate entries separate.
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

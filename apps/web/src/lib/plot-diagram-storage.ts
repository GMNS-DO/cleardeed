/**
 * ClearDeed — Plot Diagram SVG storage helpers.
 *
 * Phase 8 (Task 34) of the unified insight engine. The renderer in
 * `@cleardeed/render/plot-diagram-svg` produces a self-contained SVG
 * string. This module uploads that SVG to Supabase Storage under the
 * `plot-diagrams` bucket and returns a public URL the consumer report
 * can embed directly.
 *
 * Path convention: `reports/{reportId}/plot-diagram-{plotDiagramKey}.svg`
 *
 * The upload uses `upsert: true` so regenerating an SVG for the same
 * (reportId, plotDiagramKey) overwrites cleanly — useful when the WFS
 * plot-diagram fetcher is rerun and the SVG is re-rendered.
 *
 * The `plot-diagrams` bucket is created by migration
 * `infra/supabase/migrations/015_plot_diagrams_storage.sql`.
 */
import { getSupabaseServerClient } from "./db";

export const PLOT_DIAGRAMS_BUCKET = "plot-diagrams";

/**
 * The minimal shape of a target polygon the plot diagram pipeline needs.
 * Bhunaksha's `data.polygon` is structurally compatible (see BhunakshaResult
 * schema in packages/schema) so we accept it loosely here to avoid pulling
 * the full zod schema into the storage helper.
 */
export interface PlotPolygonLike {
  type: "Polygon";
  coordinates: number[][][];
}

/**
 * Build the canonical storage path for a plot diagram SVG.
 *
 * Exported so tests and other code (e.g. cleanup, signed-URL generators)
 * can use the same path layout without re-deriving it.
 */
export function buildPlotDiagramPath(
  reportId: string,
  plotDiagramKey: string,
): string {
  if (!reportId) {
    throw new Error("buildPlotDiagramPath: reportId is required");
  }
  if (!plotDiagramKey) {
    throw new Error("buildPlotDiagramPath: plotDiagramKey is required");
  }
  return `reports/${reportId}/plot-diagram-${plotDiagramKey}.svg`;
}

/**
 * Store a plot diagram SVG string in Supabase Storage and return its
 * public URL.
 *
 * Throws if the upload fails. Callers in API routes should map the
 * error to a 500 response and treat the SVG as a non-critical render
 * artifact (the report can still publish without the diagram).
 */
export async function storePlotDiagram(params: {
  reportId: string;
  plotDiagramKey: string;
  svg: string;
}): Promise<{ url: string; path: string }> {
  const path = buildPlotDiagramPath(params.reportId, params.plotDiagramKey);

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.storage
    .from(PLOT_DIAGRAMS_BUCKET)
    .upload(path, params.svg, {
      contentType: "image/svg+xml",
      upsert: true,
    });

  if (error) {
    throw new Error(`storePlotDiagram upload failed: ${error.message}`);
  }

  const { data } = supabase.storage
    .from(PLOT_DIAGRAMS_BUCKET)
    .getPublicUrl(path);

  return { url: data.publicUrl, path };
}

/**
 * Synchronous getter for the public URL of a stored plot diagram SVG.
 *
 * Returns `null` if either argument is empty — callers can use this as
 * a defensive guard before rendering `<img src=...>` in the report.
 *
 * Note: this builds the URL from the bucket's public base + path; it
 * does NOT verify the object exists. Use `storePlotDiagram()` (which
 * returns the URL after a successful upload) when an actual upload has
 * just happened.
 */
export function getPlotDiagramUrl(
  reportId: string,
  plotDiagramKey: string,
): string | null {
  if (!reportId || !plotDiagramKey) return null;
  return buildPublicUrl(buildPlotDiagramPath(reportId, plotDiagramKey));
}

/**
 * Build the public URL for a given storage path inside the plot-diagrams
 * bucket.
 *
 * The Supabase Storage public URL shape is:
 *   {SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}
 *
 * We avoid calling the SDK here so this stays synchronous and works
 * without an active Supabase client — useful for SSR rendering of the
 * report page where the path is known but we don't want to block on
 * a client round trip.
 */
function buildPublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) {
    throw new Error(
      "getPlotDiagramUrl: NEXT_PUBLIC_SUPABASE_URL is not set",
    );
  }
  const trimmed = base.replace(/\/+$/, "");
  return `${trimmed}/storage/v1/object/public/${PLOT_DIAGRAMS_BUCKET}/${path}`;
}
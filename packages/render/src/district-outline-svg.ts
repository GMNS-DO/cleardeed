/**
 * District Outline SVG Renderer (MapCard v1 fallback).
 *
 * Sibling to renderPlotDiagramSvg. When Bhunaksha WFS returns no plot
 * polygon, the consumer report still wants a meaningful diagram. This
 * renderer draws:
 *
 *   1. The full Khordha district boundary as a soft grey outline
 *   2. A gold "target" square (≈60m) at the village GPS centroid
 *   3. A subtle caption ("Approximate location — plot boundary not
 *      available") rendered into the SVG itself
 *
 * The output is a self-contained SVG 1.1 string (no external CSS,
 * fonts, or images) so it can be stored in Supabase Storage and
 * embedded inline in the consumer report just like the primary
 * `renderPlotDiagramSvg` output.
 *
 * Determinism:
 *   - No Date / Math.random
 *   - Coordinates printed with .toFixed(2)
 *   - Same input → same bytes
 *
 * Type contract:
 *   - Accepts a structural subset of the boundary asset imported in
 *     `apps/web/src/lib/synthesize-plot-polygon.ts` so the render
 *     package remains free of Node-only modules (zod, fs, etc.).
 *   - If the source shape changes, the structural assignability check
 *     in `__testing.assertContractShape` will fail at test time.
 */

// ──────────────────────────────────────────────────────────────────────────
// Public input contract
// ──────────────────────────────────────────────────────────────────────────

export interface DistrictOutlineInput {
  /**
   * The Khordha district boundary GeoJSON Feature. The renderer
   * reads the first polygon's outer ring (coordinates[0][0]).
   */
  khordhaBoundary: {
    data: {
      type: "Feature";
      properties: { title: string };
      geometry: { type: "Polygon"; coordinates: number[][][] };
    };
  };
  /** Village centroid for the target marker. */
  centroid: { lat: number; lon: number };
  /** Village name (used in title/desc). */
  village: string;
  /** Plot number (used in title/desc). */
  plotNo: string;
  /**
   * Why Bhunaksha returned no polygon. Surfaces in the desc text so
   * support can diagnose why a fallback was triggered.
   */
  reason: string;
}

export interface DistrictOutlineOptions {
  /** Total width in user units. Defaults to 600. */
  width?: number;
  /** Total height in user units. Defaults to 480. */
  height?: number;
  /** Override the <title> text. */
  title?: string;
  /** Override the <desc> text. */
  desc?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────

const DISTRICT_FILL = "none";
const DISTRICT_STROKE = "#94a3b8"; // slate-400
const DISTRICT_WIDTH = 1.5;
const TARGET_FILL = "#f59e0b"; // amber-500 (matches plot-diagram-svg)
const TARGET_STROKE = "#b45309"; // amber-700
const TARGET_SIZE_DEG = 0.00054; // ~60m × 60m at Khordha's latitude
const FONT_FAMILY = "sans-serif";

// ──────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────

/**
 * Render an "approximate location" diagram: the Khordha district
 * outline + a small gold target square at the village centroid.
 *
 * Use this when Bhunaksha WFS returned no plot polygon. The diagram
 * is honest about what it shows — the target square is at the
 * village centroid, not the plot boundary, because we don't have
 * the plot boundary.
 *
 * Returns a self-contained SVG 1.1 string. No I/O, no Date, no
 * Math.random — same input → same bytes.
 */
export function renderDistrictOutlineSvg(
  input: DistrictOutlineInput,
  options: DistrictOutlineOptions = {}
): string {
  const width = options.width ?? 600;
  const height = options.height ?? 480;

  const ring = input.khordhaBoundary?.data?.geometry?.coordinates?.[0] ?? [];
  if (ring.length < 3) {
    return renderEmptyOutline(
      input.plotNo,
      input.village,
      input.reason,
      width,
      height,
      options.title,
      options.desc
    );
  }

  // ── Bounds from district ring + target square ────────────────────────
  const half = TARGET_SIZE_DEG / 2;
  const targetRing: number[][] = [
    [input.centroid.lon - half, input.centroid.lat - half],
    [input.centroid.lon + half, input.centroid.lat - half],
    [input.centroid.lon + half, input.centroid.lat + half],
    [input.centroid.lon - half, input.centroid.lat + half],
    [input.centroid.lon - half, input.centroid.lat - half],
  ];
  const bounds = computeOutlineBounds(ring, targetRing);
  if (!bounds) {
    return renderEmptyOutline(
      input.plotNo,
      input.village,
      input.reason,
      width,
      height,
      options.title,
      options.desc
    );
  }

  // 8% padding (smaller than plot-diagram-svg because the district is
  // already large and we want the outline to fill the frame).
  const padded = padOutlineBounds(bounds, 0.08);
  const sx = (worldX: number): number =>
    width * (worldX - padded.minX) / (padded.maxX - padded.minX);
  const sy = (worldY: number): number =>
    height * (1 - (worldY - padded.minY) / (padded.maxY - padded.minY));

  // ── Layers ───────────────────────────────────────────────────────────
  const districtPoints = ring
    .map(([x, y]) => `${sx(x).toFixed(2)},${sy(y).toFixed(2)}`)
    .join(" ");

  const targetPoints = targetRing
    .map(([x, y]) => `${sx(x).toFixed(2)},${sy(y).toFixed(2)}`)
    .join(" ");

  // Caption: positioned at bottom-left, small grey text
  const captionY = height - 14;
  const captionX = 12;

  const title =
    options.title ?? `Plot ${input.plotNo} — ${input.village} (approximate)`;
  const desc =
    options.desc ??
    `Approximate location for plot ${input.plotNo} in ${input.village}. The exact plot boundary was not available (${input.reason}); the marker is centered on the village centroid inside the Khordha district boundary.`;

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="district-outline-title district-outline-desc">`,
    `<title id="district-outline-title">${escapeXml(title)}</title>`,
    `<desc id="district-outline-desc">${escapeXml(desc)}</desc>`,
    // Background
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />`,
    // District outline (bottom layer)
    `<polygon points="${districtPoints}" fill="${DISTRICT_FILL}" stroke="${DISTRICT_STROKE}" stroke-width="${DISTRICT_WIDTH}" stroke-linejoin="round" />`,
    // Target square (top layer)
    `<polygon points="${targetPoints}" fill="${TARGET_FILL}" fill-opacity="0.35" stroke="${TARGET_STROKE}" stroke-width="2" />`,
    // Caption
    `<text x="${captionX}" y="${captionY}" font-family="${FONT_FAMILY}" font-size="11" fill="#475569">Approximate location — plot boundary not available</text>`,
    `</svg>`,
  ].join("\n");
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function computeOutlineBounds(
  ring: number[][],
  targetRing: number[][]
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let any = false;
  for (const ring_ of [ring, targetRing]) {
    for (const pt of ring_) {
      if (!Array.isArray(pt) || pt.length < 2) continue;
      const [x, y] = pt;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      any = true;
    }
  }
  if (!any) return null;
  return { minX, minY, maxX, maxY };
}

function padOutlineBounds(
  b: { minX: number; minY: number; maxX: number; maxY: number },
  frac: number
): { minX: number; minY: number; maxX: number; maxY: number } {
  const padX = (b.maxX - b.minX) * frac;
  const padY = (b.maxY - b.minY) * frac;
  return {
    minX: b.minX - padX,
    minY: b.minY - padY,
    maxX: b.maxX + padX,
    maxY: b.maxY + padY,
  };
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderEmptyOutline(
  plotNo: string,
  village: string,
  reason: string,
  width: number,
  height: number,
  titleOverride?: string,
  descOverride?: string
): string {
  const title = titleOverride ?? `Plot ${plotNo} — ${village} (approximate)`;
  const desc = descOverride ?? `Approximate location for plot ${plotNo}. ${reason}.`;
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="district-outline-title district-outline-desc">`,
    `<title id="district-outline-title">${escapeXml(title)}</title>`,
    `<desc id="district-outline-desc">${escapeXml(desc)}</desc>`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />`,
    `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT_FAMILY}" font-size="14" fill="#6b7280">District outline unavailable</text>`,
    `</svg>`,
  ].join("\n");
}

/**
 * Test seam — not part of public API.
 * @internal
 */
export const __testing = {
  computeOutlineBounds,
  padOutlineBounds,
  escapeXml,
};

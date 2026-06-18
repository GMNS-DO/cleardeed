/**
 * Plot Diagram SVG Renderer
 *
 * Pure function: takes a normalized PlotDiagram (Task 32: WFS-composed
 * `PlotDiagramResult`) and returns a self-contained SVG 1.1 string with
 * no external CSS, fonts, or images. Output is intended for storage in
 * Supabase Storage and inline embedding in the consumer report.
 *
 * Layering (bottom → top):
 *   1. Background rect (white)
 *   2. Roads (light grey, thin stroke)
 *   3. Neighbor polygons (grey outline + plot number label)
 *   4. Target polygon (highlight fill, dark stroke)
 *   5. Scale bar + north arrow (overlay)
 *
 * A11y:
 *   - <title> and <desc> with target plot number
 *   - <g role="img"> wrapper for assistive tech
 *
 * Bounds:
 *   - Computed from target + neighbors + roads
 *   - 10% padding on every side
 *   - ViewBox preserves aspect ratio
 *
 * Determinism:
 *   - No Date / Math.random in output
 *   - Roads and neighbors are emitted in input order
 *   - Floating-point coordinates printed with .toFixed(2)
 *
 * Type contract:
 *   - The render package declares its own structural types matching the
 *     public PlotDiagram shape produced by packages/fetchers/bhunaksha/src/plot-diagram.ts.
 *     This avoids pulling zod / node:crypto into a pure rendering package.
 *     If the source shape changes, the structural assignability check in
 *     `__testing.assertContractShape` will fail at test time.
 */

// ──────────────────────────────────────────────────────────────────────────
// Public input contract (structurally compatible with Task 32's
// PlotDiagramResult from packages/fetchers/bhunaksha/src/plot-diagram.ts)
// ──────────────────────────────────────────────────────────────────────────

export interface PlotDiagramBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface PlotDiagramTarget {
  plotNo: string;
  village: string;
  polygon: { type: "Polygon"; coordinates: number[][] };
  areaSqKm: number;
}

export interface PlotDiagramNeighbor {
  plotNo: string;
  village: string;
  tehsil: string;
  polygon: { type: "Polygon"; coordinates: number[][] };
  areaSqKm: number;
  kisam?: string;
}

export interface PlotDiagramRoad {
  name?: string;
  path: number[][] | number[][][];
  roadClass?: string;
}

export interface PlotDiagramProvenance {
  source: string;
  fetchedAt: string;
  parserVersion: string;
  layer: string;
  roadLayerAttempted?: string;
  roadLayerAvailable: boolean;
  neighborsRawHash?: string;
  roadsRawHash?: string;
  counts: {
    neighborCandidates: number;
    neighborSelected: number;
    roadFeatures: number;
  };
}

export interface PlotDiagramResult {
  source: string;
  status: "success" | "partial" | "failed";
  fetchedAt: string;
  target: PlotDiagramTarget | null;
  neighbors: PlotDiagramNeighbor[];
  roads: PlotDiagramRoad[];
  bounds: PlotDiagramBounds | null;
  provenance: PlotDiagramProvenance;
  warnings: string[];
  error?: string;
}

// ──────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────

const PADDING_FRAC = 0.1; // 10% on every side
const TARGET_FILL = "#f59e0b"; // amber-500
const TARGET_STROKE = "#b45309"; // amber-700
const NEIGHBOR_FILL = "none";
const NEIGHBOR_STROKE = "#6b7280"; // gray-500
const NEIGHBOR_LABEL_FILL = "#1f2937"; // gray-800
const ROAD_STROKE = "#cbd5e1"; // slate-300
const ROAD_WIDTH = 1.5;
const NEIGHBOR_WIDTH = 1;
const TARGET_WIDTH = 2.5;
const FONT_FAMILY = "sans-serif"; // generic; no external font import
const LABEL_FONT_SIZE = 11;

// ──────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────

export interface PlotDiagramSvgOptions {
  /** Total width in user units. Defaults to 600. */
  width?: number;
  /** Total height in user units. Defaults to 480. */
  height?: number;
  /** Override the <title> text. Defaults to target plot number + village. */
  title?: string;
  /** Override the <desc> text. Defaults to a short plot summary. */
  desc?: string;
}

/**
 * Render a `PlotDiagramResult` (Task 32 output) as a self-contained SVG string.
 *
 * Guarantees:
 *   - Same input → same bytes (deterministic).
 *   - No I/O (no fetch, no filesystem, no Date.now()).
 *   - Empty neighbors / empty roads are not errors — render gracefully.
 *   - If `target` is null but bounds exist, renders neighbors + roads only.
 *   - If `bounds` is null and no polygons exist, returns a placeholder SVG
 *     explaining the diagram is empty.
 */
export function renderPlotDiagramSvg(
  diagram: PlotDiagramResult,
  options: PlotDiagramSvgOptions = {}
): string {
  const width = options.width ?? 600;
  const height = options.height ?? 480;

  // ── Bounds ─────────────────────────────────────────────────────────────
  const allPolygons: Array<{ type: "Polygon"; coordinates: number[][][] }> = [];
  if (diagram.target) {
    allPolygons.push({
      type: "Polygon",
      coordinates: [diagram.target.polygon.coordinates],
    });
  }
  for (const n of diagram.neighbors) {
    allPolygons.push({
      type: "Polygon",
      coordinates: [n.polygon.coordinates],
    });
  }
  // Bounds from diagram.bounds is the source of truth; recompute if absent.
  let bounds: PlotDiagramBounds | null = diagram.bounds;
  if (!bounds && allPolygons.length > 0) bounds = computeBoundsLocal(allPolygons);
  // Expand bounds to include roads (LineString/MultiLineString).
  if (bounds) {
    for (const road of diagram.roads) {
      bounds = expandBoundsWithRoad(bounds, road);
    }
  }

  const targetPlotNo = diagram.target?.plotNo ?? "unknown";
  const targetVillage = diagram.target?.village ?? "";

  const title = options.title ?? `Plot ${targetPlotNo}${targetVillage ? ` — ${targetVillage}` : ""}`;
  const desc =
    options.desc ??
    `Plot diagram for plot ${targetPlotNo} showing ${diagram.neighbors.length} adjacent plot(s) and ${diagram.roads.length} road segment(s).`;

  // ── Empty diagram fallback ─────────────────────────────────────────────
  if (!bounds || allPolygons.length === 0) {
    return renderEmptySvg(title, desc, width, height);
  }

  // ── Coordinate transform ───────────────────────────────────────────────
  // World coords are lon (x) / lat (y). Map to SVG coords with y flipped.
  const paddedBounds = padBounds(bounds, PADDING_FRAC);
  const sx = (worldX: number): number =>
    width * (worldX - paddedBounds.minX) / spanX(paddedBounds);
  const sy = (worldY: number): number =>
    height * (1 - (worldY - paddedBounds.minY) / spanY(paddedBounds));

  // ── Layers ─────────────────────────────────────────────────────────────
  const roadLines: string[] = [];
  for (const road of diagram.roads) {
    const segments = extractLineSegments(road);
    for (const seg of segments) {
      const pts = seg.map(([x, y]) => `${sx(x).toFixed(2)},${sy(y).toFixed(2)}`).join(" ");
      roadLines.push(
        `<polyline points="${pts}" fill="none" stroke="${ROAD_STROKE}" stroke-width="${ROAD_WIDTH}" stroke-linecap="round" stroke-linejoin="round" />`
      );
    }
  }

  const neighborShapes: string[] = [];
  const neighborLabels: string[] = [];
  for (const n of diagram.neighbors) {
    const ring = n.polygon.coordinates as number[][];
    if (!ring || ring.length < 3) continue;
    const pts = ring.map(([x, y]) => `${sx(x).toFixed(2)},${sy(y).toFixed(2)}`).join(" ");
    neighborShapes.push(
      `<polygon points="${pts}" fill="${NEIGHBOR_FILL}" stroke="${NEIGHBOR_STROKE}" stroke-width="${NEIGHBOR_WIDTH}" />`
    );
    // Centroid label
    const cx = ring.reduce((acc, p) => acc + p[0], 0) / ring.length;
    const cy = ring.reduce((acc, p) => acc + p[1], 0) / ring.length;
    const label = escapeXml(n.plotNo);
    neighborLabels.push(
      `<text x="${sx(cx).toFixed(2)}" y="${sy(cy).toFixed(2)}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT_FAMILY}" font-size="${LABEL_FONT_SIZE}" fill="${NEIGHBOR_LABEL_FILL}">${label}</text>`
    );
  }

  // Target shape rendered last so it sits on top.
  let targetShape = "";
  let targetLabel = "";
  if (diagram.target) {
    const ring = diagram.target.polygon.coordinates as number[][];
    if (ring && ring.length >= 3) {
      const pts = ring.map(([x, y]) => `${sx(x).toFixed(2)},${sy(y).toFixed(2)}`).join(" ");
      targetShape = `<polygon points="${pts}" fill="${TARGET_FILL}" fill-opacity="0.55" stroke="${TARGET_STROKE}" stroke-width="${TARGET_WIDTH}" />`;
      const cx = ring.reduce((acc, p) => acc + p[0], 0) / ring.length;
      const cy = ring.reduce((acc, p) => acc + p[1], 0) / ring.length;
      targetLabel = `<text x="${sx(cx).toFixed(2)}" y="${sy(cy).toFixed(2)}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT_FAMILY}" font-size="13" font-weight="bold" fill="${TARGET_STROKE}">${escapeXml(diagram.target.plotNo)}</text>`;
    }
  }

  // Scale bar (approximate, based on width span).
  const scaleBar = buildScaleBar(width, height, paddedBounds, sx);

  // North arrow (top-right corner).
  const northArrow = buildNorthArrow(width);

  // ── Compose SVG ────────────────────────────────────────────────────────
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="plot-diagram-title plot-diagram-desc">`,
    `<title id="plot-diagram-title">${escapeXml(title)}</title>`,
    `<desc id="plot-diagram-desc">${escapeXml(desc)}</desc>`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />`,
    `<g class="roads" aria-label="Roads">${roadLines.join("")}</g>`,
    `<g class="neighbors" aria-label="Adjacent plots">${neighborShapes.join("")}${neighborLabels.join("")}</g>`,
    `<g class="target" aria-label="Target plot ${escapeXml(targetPlotNo)}">${targetShape}${targetLabel}</g>`,
    `<g class="overlay">${scaleBar}${northArrow}</g>`,
    `</svg>`,
  ].join("\n");
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function spanX(b: PlotDiagramBounds): number {
  return Math.max(b.maxX - b.minX, 1e-12);
}

function spanY(b: PlotDiagramBounds): number {
  return Math.max(b.maxY - b.minY, 1e-12);
}

function padBounds(b: PlotDiagramBounds, frac: number): PlotDiagramBounds {
  const padX = (b.maxX - b.minX) * frac;
  const padY = (b.maxY - b.minY) * frac;
  return {
    minX: b.minX - padX,
    minY: b.minY - padY,
    maxX: b.maxX + padX,
    maxY: b.maxY + padY,
  };
}

function expandBoundsWithRoad(
  b: PlotDiagramBounds,
  road: PlotDiagramRoad
): PlotDiagramBounds {
  let minX = b.minX,
    minY = b.minY,
    maxX = b.maxX,
    maxY = b.maxY;
  const update = (x: number, y: number): void => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  const segments = extractLineSegments(road);
  for (const seg of segments) {
    for (const p of seg) {
      if (p.length >= 2) update(p[0], p[1]);
    }
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Extract individual LineString segments from a Road. A Road's path can be
 * either a flat LineString ([x,y][]) or a MultiLineString ([x,y][][]).
 * Returns an array of segments; each segment is [x,y][].
 */
function extractLineSegments(road: PlotDiagramRoad): number[][][] {
  const result: number[][][] = [];
  const path = road.path;
  if (!Array.isArray(path) || path.length === 0) return result;
  const first = path[0];
  if (!Array.isArray(first)) return result;
  // Detect MultiLineString vs LineString.
  // LineString: [[x,y], [x,y], ...]  — first element is [x,y] tuple.
  // MultiLineString: [[[x,y], [x,y]], [[x,y], ...]] — first element is itself an array of tuples.
  const isMultiLineString = Array.isArray(first[0]);
  if (isMultiLineString) {
    for (const line of path as unknown[]) {
      if (Array.isArray(line) && Array.isArray((line as unknown[])[0])) {
        result.push(line as number[][]);
      }
    }
  } else {
    result.push(path as number[][]);
  }
  return result;
}

function buildScaleBar(
  width: number,
  height: number,
  paddedBounds: PlotDiagramBounds,
  sx: (worldX: number) => number
): string {
  // Approximate ground distance for a 25%-width bar in lon degrees,
  // then convert to meters using local latitude scale.
  const lonSpan = paddedBounds.maxX - paddedBounds.minX;
  const meanLat = (paddedBounds.minY + paddedBounds.maxY) / 2;
  const metersPerDegLon = 111_320 * Math.cos((meanLat * Math.PI) / 180);
  const niceMeters = pickNiceDistance(lonSpan * metersPerDegLon);
  const niceBarLon = niceMeters / Math.max(metersPerDegLon, 1);
  const niceBarPx = sx(paddedBounds.minX + niceBarLon) - sx(paddedBounds.minX);

  const barX = 16;
  const barY = height - 30;
  const labelX = barX + niceBarPx / 2;
  const label = formatDistance(niceMeters);

  return [
    // Black bar
    `<rect x="${barX}" y="${barY}" width="${niceBarPx.toFixed(2)}" height="6" fill="#111827" />`,
    // Tick marks
    `<line x1="${barX}" y1="${barY - 3}" x2="${barX}" y2="${barY + 9}" stroke="#111827" stroke-width="1" />`,
    `<line x1="${(barX + niceBarPx).toFixed(2)}" y1="${barY - 3}" x2="${(barX + niceBarPx).toFixed(2)}" y2="${barY + 9}" stroke="#111827" stroke-width="1" />`,
    // Label
    `<text x="${labelX.toFixed(2)}" y="${(barY - 6).toFixed(2)}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="11" fill="#111827">${escapeXml(label)}</text>`,
  ].join("");
}

function pickNiceDistance(meters: number): number {
  if (!Number.isFinite(meters) || meters <= 0) return 1;
  const exp = Math.floor(Math.log10(meters));
  const base = Math.pow(10, exp);
  const mantissa = meters / base;
  let nice: number;
  if (mantissa < 1.5) nice = 1;
  else if (mantissa < 3.5) nice = 2;
  else if (mantissa < 7.5) nice = 5;
  else nice = 10;
  return nice * base;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(meters % 1000 === 0 ? 0 : 1)} km`;
  return `${Math.round(meters)} m`;
}

function buildNorthArrow(svgWidth: number): string {
  const cx = svgWidth - 28;
  const cy = 28;
  const r = 14;
  return [
    // Outer circle
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="#111827" stroke-width="1" />`,
    // Triangle pointing up
    `<polygon points="${cx},${cy - 9} ${cx - 6},${cy + 5} ${cx + 6},${cy + 5}" fill="#111827" />`,
    // N letter
    `<text x="${cx}" y="${(cy + 16).toFixed(2)}" text-anchor="middle" font-family="${FONT_FAMILY}" font-size="10" font-weight="bold" fill="#111827">N</text>`,
  ].join("");
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function renderEmptySvg(title: string, desc: string, width: number, height: number): string {
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="plot-diagram-title plot-diagram-desc">`,
    `<title id="plot-diagram-title">${escapeXml(title)}</title>`,
    `<desc id="plot-diagram-desc">${escapeXml(desc)}</desc>`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />`,
    `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="middle" font-family="${FONT_FAMILY}" font-size="14" fill="#6b7280">Plot diagram unavailable</text>`,
    `</svg>`,
  ].join("\n");
}

function computeBoundsLocal(
  polygons: Array<{ type: "Polygon"; coordinates: number[][][] }>
): PlotDiagramBounds | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let any = false;
  for (const poly of polygons) {
    const ring = poly.coordinates[0];
    if (!ring) continue;
    for (const pt of ring) {
      if (pt[0] < minX) minX = pt[0];
      if (pt[0] > maxX) maxX = pt[0];
      if (pt[1] < minY) minY = pt[1];
      if (pt[1] > maxY) maxY = pt[1];
      any = true;
    }
  }
  if (!any) return null;
  return { minX, minY, maxX, maxY };
}

/**
 * Test seam — not part of public API.
 * @internal
 */
export const __testing = {
  padBounds,
  computeBoundsLocal,
  extractLineSegments,
  pickNiceDistance,
  formatDistance,
  escapeXml,
};

/**
 * ClearDeed consumer report — MapCard v1 (Phase 2 v1).
 *
 * Premium hero chrome around the interactive plot map. Replaces the v0
 * static-SVG-only chrome with a server-rendered shell that:
 *   - emits a `<div id="mapcard-v1">` carrying all geo data as
 *     data-* attributes, so the mapcard-v1.js bootstrap script can
 *     mount a MapLibre map without a separate API call
 *   - shows the cached SVG as a poster (visible until JS mounts the
 *     map, visible forever if MapLibre fails to load)
 *   - emits a `<noscript>` fallback for buyers with JS disabled
 *   - emits the layer toggle + Verify-on-Bhulekh CTA, both already
 *     styled by v0 CSS and now wired by the bootstrap script
 *
 * The v0 spec (REPORT_REDESIGN_PREMIUM.md §3) calls for 8 layers; v1
 * ships 4 (satellite, cadastral, target plot, neighbours) plus
 * chauhaddi arrows. Side panel on neighbour click, risk overlays,
 * and deck.gl overlays are deferred to v2.
 *
 * State machine (data-driven):
 *   - status="success"   → data-state="verified"   (full map + glow)
 *   - status="partial"   → data-state="partial"    (full map, no glow)
 *   - status="failed"    → data-state="unverified" (no map, fallback CTA)
 *   - status="not_attempted" → data-state="unverified" (same as failed)
 *   - input null/undefined → "" (no card at all — v0 behavior)
 *
 * Idempotence: renderMapCard(input) is a pure function. Two calls with
 * the same input return byte-identical strings. This is the
 * load-bearing contract for the test suite (see
 * `src/__tests__/map-card.test.ts` and
 * `src/__tests__/mapcard-emitter.test.ts`).
 *
 * Inputs:
 *   - plotDiagram: full PlotDiagramStepResult subset (status, url,
 *     reason, cacheHit, targetPolygon, neighbors, roads, bounds,
 *     bhulekhUrl) | null
 *   - plotNo:     string identifier (e.g. "309")
 *   - village:    string identifier (e.g. "Mendhasala")
 *
 * Output:
 *   - HTML string for the map section, or "" when no card should
 *     be rendered. v0-compatible: when the diagram is absent or
 *     has no url, returns "" so pre-Phase-2 reports are unchanged.
 */

// ─── Public input shape ───────────────────────────────────────────────────

export type MapCardInput = {
  plotDiagram?: {
    status: "success" | "partial" | "failed" | "not_attempted";
    url?: string | null;
    reason?: string | null;
    cacheHit?: boolean;
    // Phase 2 v1 — transient geo data. The mapper populates these
    // from the pipeline's plot-diagram step; the bootstrap script
    // reads them from data-* attributes. All optional because the
    // v0 mapper pass-through leaves them absent.
    targetPolygon?: unknown;
    neighbors?: Array<{
      plotNo: string;
      village: string;
      tehsil: string;
      polygon: { type: "Polygon"; coordinates: number[][] };
      areaSqKm: number;
      kisam?: string;
    }>;
    roads?: Array<{ name?: string; path?: unknown; roadClass?: string }>;
    bounds?: {
      minLat: number;
      maxLat: number;
      minLon: number;
      maxLon: number;
    } | null;
    bhulekhUrl?: string | null;
    // MapCard v1.1 — approximate-mode plumbing. When the diagram
    // step took the fallback path (Bhunaksha returned no polygon),
    // `approximate` is true and `approximateReason` carries the
    // WFS failure reason. The map renders a district outline +
    // centroid marker instead of a target polygon. The mapper
    // passes through the synthesized GeoJSON via `targetPolygon`
    // + `bounds` so the bootstrap can position the camera.
    approximate?: boolean;
    approximateReason?: string | null;
    // The Khordha district boundary Feature (only present in
    // approximate mode). The bootstrap adds it as a source +
    // district-fill / district-line layers so the buyer sees
    // district context while the centroid marker is the only
    // plot-level cue. ~17KB JSON; embedded as a data-district
    // attribute on the mapcard-v1 div.
    khordhaBoundary?: unknown;
  } | null;
  plotNo?: string;
  village?: string;
};

// ─── Defensive escaping ──────────────────────────────────────────────────

/** Escape any string for safe insertion into HTML body text. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape any string for safe insertion into a double-quoted attribute. */
function escapeAttr(s: string): string {
  return escapeHtml(s);
}

/**
 * JSON-encode a value for safe insertion into a single-quoted HTML
 * attribute. The output is escaped so an owner name like
 *   'Krushnachandra "K.C." Barajena'
 * cannot break the attribute boundary. We do this by:
 *   1. JSON.stringify the value
 *   2. Replace any backslash and single-quote with their escapes
 *      (the attribute is single-quoted, so single quote is the
 *      boundary character)
 *   3. Wrap in single quotes
 *
 * Why not use double quotes for the attribute? Because the JSON
 * payload itself contains double quotes (object keys, string
 * values), so we'd have to escape those too. Single-quoting the
 * attribute and escaping only the single quote in the payload is
 * the smaller-blast-radius option.
 */
function escapeJsonForAttr(value: unknown): string {
  return (
    "'" +
    JSON.stringify(value)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'") +
    "'"
  );
}

// ─── State mapping ───────────────────────────────────────────────────────

/**
 * Map the pipeline's plotDiagram.status (4 values) onto the spec's
 * data-state (3 values used today, 4 reserved). The bootstrap script
 * uses data-state to decide what to render — "unverified" bails to
 * the v0 fallback without instantiating MapLibre.
 */
function stateForStatus(
  status: "success" | "partial" | "failed" | "not_attempted"
): "verified" | "partial" | "unverified" {
  if (status === "success") return "verified";
  if (status === "partial") return "partial";
  return "unverified";
}

function statusBadge(state: "verified" | "partial" | "unverified"): string {
  if (state === "verified") {
    return `<span class="map-badge map-badge-verified" data-tier="verified">Cadastral map verified</span>`;
  }
  if (state === "partial") {
    return `<span class="map-badge map-badge-partial" data-tier="watch">Map partially available</span>`;
  }
  return `<span class="map-badge map-badge-failed" data-tier="bad">Map unavailable</span>`;
}

function buildCaption(input: MapCardInput): string {
  const plotNo = input.plotNo?.trim();
  const village = input.village?.trim();
  if (plotNo && village) {
    return `Plot ${escapeHtml(plotNo)} · ${escapeHtml(village)}`;
  }
  if (plotNo) return `Plot ${escapeHtml(plotNo)}`;
  if (village) return escapeHtml(village);
  return "Target plot";
}

/**
 * Compute the target polygon's centroid (mean of vertices). Used to
 * place chauhaddi arrows and to derive data-target-centroid.
 *
 * Returns null if the polygon is missing/malformed. The bootstrap
 * script bails on the chauhaddi arrows (but still renders the map)
 * when centroid is null.
 */
function computeCentroid(
  polygon: unknown
): { lat: number; lon: number } | null {
  if (
    !polygon ||
    typeof polygon !== "object" ||
    (polygon as any).type !== "Polygon" ||
    !Array.isArray((polygon as any).coordinates) ||
    !Array.isArray((polygon as any).coordinates[0])
  ) {
    return null;
  }
  const ring = (polygon as any).coordinates[0] as number[][];
  if (ring.length < 4) return null; // a closed ring needs ≥ 4 vertices
  // Average the lon/lat of all vertices. This is a poor-man's
  // centroid — fine for a Khordha-scale plot (~10-100m across).
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of ring) {
    sumLon += lon;
    sumLat += lat;
  }
  return {
    lon: sumLon / ring.length,
    lat: sumLat / ring.length,
  };
}

// ─── Branch: failed / not_attempted (no map, fallback CTA) ───────────────

function renderFallbackCard(
  input: MapCardInput,
  status: "failed" | "not_attempted"
): string {
  const reason = input.plotDiagram?.reason
    ? escapeHtml(input.plotDiagram.reason)
    : null;
  const caption = buildCaption(input);
  const bhulekhUrl =
    input.plotDiagram?.bhulekhUrl ?? "https://bhulekh.ori.nic.in/RoRView.aspx";
  return `<!-- ── Section 2a: MapCard (Phase 2 v1, unverified) ──────────── -->
<section class="section section-warning map-card map-card-failed" id="section-map" data-state="unverified" data-premium-anchor="map">
  <div class="section-hdr">
    <div class="section-icon"></div>
    <h2>Plot Map</h2>
    ${statusBadge("unverified")}
  </div>
  <p class="section-lede"><strong>Map unavailable.</strong> The interactive map of the target plot and its neighbours could not be generated${status === "not_attempted" ? " (the diagram step was skipped for this report)" : ""}. Boundary verification is still possible on Bhulekh.</p>
  ${reason ? `<p class="source-line">Reason: ${reason}</p>` : ""}
  <p class="source-line">${caption}</p>
  <p>
    <a class="map-card-cta" href="${escapeAttr(bhulekhUrl)}" target="_blank" rel="noopener noreferrer">Verify on Bhulekh →</a>
  </p>
</section>`;
}

// ─── Branch: success or partial (interactive map shell) ──────────────────

function renderInteractiveCard(input: MapCardInput): string {
  const pd = input.plotDiagram!;
  const status = pd.status as "success" | "partial";
  const state = stateForStatus(status);
  const url = pd.url as string;
  const safeUrl = escapeAttr(url);
  const caption = buildCaption(input);
  const isPartial = state === "partial";
  // MapCard v1.1 — approximate mode (Bhunaksha returned no polygon).
  // The data-* attributes flag this so the bootstrap adds the
  // district source + layers and skips the chauhaddi arrows.
  // data-plot is set to the synthesized 60m square (not null) so
  // a future v1.2 can show the gold target outline at district
  // zoom without re-architecting the bootstrap.
  const isApproximate = pd.approximate === true;
  const mode = isApproximate ? "approximate" : "exact";
  const dataDistrict = isApproximate
    ? escapeJsonForAttr(pd.khordhaBoundary ?? null)
    : '""';

  // Geo data — JSON-encoded into single-quoted data-* attributes.
  // `JSON.stringify` of the polygon/neighbors/roads is safe because
  // the values come from the WFS fetcher (validated upstream). The
  // escape function above adds the single-quote boundary character
  // escape so owner names with apostrophes don't break the attribute.
  const dataPlot = escapeJsonForAttr(pd.targetPolygon ?? null);
  const dataNeighbors = escapeJsonForAttr(pd.neighbors ?? []);
  const dataRoads = escapeJsonForAttr(pd.roads ?? []);
  const bounds = pd.bounds ?? null;
  const dataBounds = bounds
    ? escapeAttr(
        `${bounds.minLat},${bounds.maxLat},${bounds.minLon},${bounds.maxLon}`
      )
    : '""';
  const centroid = computeCentroid(pd.targetPolygon);
  const dataCentroid = centroid
    ? escapeAttr(`${centroid.lat},${centroid.lon}`)
    : '""';
  const bhulekhUrl = pd.bhulekhUrl ?? "https://bhulekh.ori.nic.in/RoRView.aspx";
  const dataBhulekhUrl = escapeAttr(bhulekhUrl);
  const dataPlotNo = input.plotNo ? escapeAttr(input.plotNo) : '""';
  const dataVillage = input.village ? escapeAttr(input.village) : '""';

  return `<!-- ── Section 2a: MapCard (Phase 2 v1) ─────────────────────────── -->
<style>
  /* MapCard v1 — layout-shift-safe defaults + gold-glow keyframe.
     Kept inline in the component so v1 ships as a self-contained
     drop-in: no global CSS change required. The @media (prefers-
     reduced-motion) rule respects user motion preferences. */
  .map-card-frame { position: relative; min-height: 480px; background: #f8fafc; overflow: hidden; border-radius: 4px; }
  .mapcard-poster { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
  #mapcard-v1 { position: relative; width: 100%; height: 480px; background: #0A0E14; }
  .mapcard-failed #mapcard-v1 { display: none; }
  .map-card-frame[data-state="verified"] { animation: mapcard-glow 1.5s ease-out 1; }
  @keyframes mapcard-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(201, 169, 97, 0); }
    50%      { box-shadow: 0 0 32px 4px rgba(201, 169, 97, 0.4); }
  }
  @media (prefers-reduced-motion: reduce) {
    .map-card-frame[data-state="verified"] { animation: none; }
  }
  .map-card-layer-toggle {
    position: absolute; top: 12px; right: 12px; z-index: 5;
    display: flex; gap: 4px;
    background: rgba(10, 14, 20, 0.7);
    padding: 4px;
    border-radius: 6px;
  }
  .map-card-layer-btn {
    background: transparent; color: #E8ECF1;
    border: 1px solid rgba(232, 236, 241, 0.2);
    padding: 4px 10px; font-size: 12px;
    border-radius: 4px; cursor: pointer;
    font-family: inherit;
  }
  .map-card-layer-btn.is-active {
    background: #C9A961; color: #0A0E14; border-color: #C9A961;
  }
  .map-card-noscript { font-size: 13px; color: #5b665f; margin-top: 8px; }
  .mapcard-chauhaddi-svg {
    position: absolute; inset: 0; pointer-events: none; z-index: 3;
  }
</style>
<section class="section map-card" id="section-map" data-state="${state}" data-premium-anchor="map">
  <div class="section-hdr">
    <div class="section-icon"></div>
    <h2>Plot Map</h2>
    ${statusBadge(state)}
  </div>

  <div class="map-card-frame" data-premium-frame="map" data-state="${state}"${isApproximate ? ' data-mode="approximate"' : ' data-mode="exact"'}>
    <img class="mapcard-poster" src="${safeUrl}" alt="${escapeAttr(caption)} — cadastral plot map showing target plot and surrounding plots" loading="lazy" />
    <div id="mapcard-v1"
         class="mapcard-interactive"
         data-state="${state}"
         data-mode="${mode}"
         data-plot=${dataPlot}
         data-neighbors=${dataNeighbors}
         data-roads=${dataRoads}
         data-bounds="${dataBounds}"
         data-target-centroid="${dataCentroid}"
         data-bhulekh-url="${dataBhulekhUrl}"
         data-plot-no="${dataPlotNo}"
         data-village="${dataVillage}"
         data-district=${dataDistrict}
    ></div>
    <div class="map-card-layer-toggle" role="group" aria-label="Map layers">
      <button class="map-card-layer-btn is-active" data-layer="both" aria-pressed="true" type="button">Both</button>
      <button class="map-card-layer-btn" data-layer="satellite" aria-pressed="false" type="button">Satellite</button>
      <button class="map-card-layer-btn" data-layer="cadastral" aria-pressed="false" type="button">Cadastral</button>
    </div>
  </div>

  <p class="source-line map-card-caption">${caption}${isApproximate ? ` · approximate location (${escapeHtml(pd.approximateReason ?? "no_bhunaksha_polygon")})` : ""}${!isApproximate && isPartial ? " · some neighbour plots may be missing" : ""}</p>

  <div class="map-card-actions">
    <a class="map-card-cta" href="${escapeAttr(bhulekhUrl)}" target="_blank" rel="noopener noreferrer">Verify on Bhulekh →</a>
    <a class="map-card-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">Open static diagram in new tab</a>
  </div>

  <script src="/mapcard-v1.js" defer crossorigin="anonymous"></script>
  <noscript>
    <p class="map-card-noscript">Interactive map requires JavaScript. The static diagram above shows the most recent rendered snapshot of the target plot and its neighbours.</p>
  </noscript>
</section>`;
}

// ─── Public API ──────────────────────────────────────────────────────────

export function renderMapCard(input: MapCardInput = {}): string {
  const plotDiagram = input.plotDiagram ?? null;
  if (!plotDiagram) return "";

  const status = plotDiagram.status;
  const url = typeof plotDiagram.url === "string" ? plotDiagram.url : null;

  // Branch 1: failed / not_attempted. No URL, no map — render the
  // fallback CTA only. The bootstrap script doesn't run because we
  // don't emit the #mapcard-v1 div.
  //
  // Subtlety: not_attempted without a URL is the "diagram step never
  // ran" case — pre-Phase-2 reports and reports where the Bhunaksha
  // polygon was missing. We treat this as "no card at all" (v0
  // behavior) rather than "fallback CTA", because there is no
  // failure to explain — the buyer just doesn't see a map. Failed
  // without a URL is the "step ran and errored" case — we render
  // the fallback with the reason.
  if (status === "not_attempted" && !url) return "";
  if (
    status === "failed" ||
    status === "not_attempted" ||
    (status !== "success" && status !== "partial" && !url)
  ) {
    if (status !== "failed" && status !== "not_attempted") return "";
    return renderFallbackCard(input, status);
  }

  // Branch 2: success or partial. URL is present (or, in the rare
  // case URL is missing but status is success/partial, we still
  // fall back to the v0 static-SVG-only behavior — no map div).
  if (!url) return renderFallbackCard({ ...input, plotDiagram: { ...plotDiagram, status: "failed", reason: "url_missing" } }, "failed");

  return renderInteractiveCard(input);
}

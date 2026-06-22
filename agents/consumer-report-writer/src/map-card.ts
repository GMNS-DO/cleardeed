/**
 * ClearDeed consumer report — MapCard v0 (Phase 2 v0).
 *
 * Premium hero chrome around the existing plot diagram. The data
 * path (Bhunaksha WFS → cached SVG) is shipped today; this
 * component is the *UI shell* the spec calls for — gold border,
 * "Verify on Bhulekh" button, status badge, layer toggle stub.
 * MapLibre / deck.gl / client JS come in Phase 2 v1; this version
 * is server-rendered only.
 *
 * State machine (data-driven, per REPORT_REDESIGN_PREMIUM.md §3):
 *   - success  → "Verified by one source" badge, gold border, <img>
 *   - partial  → "Verified by one source" + neighbour-missing caption
 *   - failed   → "Map unavailable — see Bhulekh" fallback, no <img>
 *   - none/null/absent → "" (no card, no chrome)
 *
 * Compatibility:
 *   - When plotDiagram is null/undefined or has no url and status
 *     is not "failed", renderMapCard returns "". Existing reports
 *     that don't have a diagram remain byte-for-byte identical.
 *   - All URLs and identifiers go through escapeHtml/escapeAttr —
 *     the URL comes from storage (plotDiagram.url), which is
 *     pre-validated but the renderer must still defend.
 *
 * Inputs:
 *   - plotDiagram: { status, url?, reason?, cacheHit? } | null
 *   - plotNo?:     string identifier (e.g. "309")
 *   - village?:    string identifier (e.g. "Mendhasala")
 *
 * Outputs:
 *   - HTML string for the map section, or "" when no card should
 *     be rendered.
 */

export type MapCardInput = {
  plotDiagram?: {
    status: "success" | "partial" | "failed" | "not_attempted";
    url?: string | null;
    reason?: string | null;
    cacheHit?: boolean;
  } | null;
  plotNo?: string;
  village?: string;
};

// escapeHtml / escapeAttr — defensive; URLs come from storage which
// is pre-validated, but renderer must defend.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

function statusBadge(status: "success" | "partial" | "failed"): string {
  if (status === "success") {
    return `<span class="map-badge map-badge-verified" data-tier="verified">Verified by one source</span>`;
  }
  if (status === "partial") {
    return `<span class="map-badge map-badge-partial" data-tier="watch">Verified by one source — neighbours partial</span>`;
  }
  // failed
  return `<span class="map-badge map-badge-failed" data-tier="bad">Map unavailable</span>`;
}

function buildCaption(input: MapCardInput): string {
  const plotNo = input.plotNo?.trim();
  const village = input.village?.trim();
  if (plotNo && village) {
    return `Plot ${escapeHtml(plotNo)} · ${escapeHtml(village)}`;
  }
  if (plotNo) {
    return `Plot ${escapeHtml(plotNo)}`;
  }
  if (village) {
    return escapeHtml(village);
  }
  return "Target plot";
}

export function renderMapCard(input: MapCardInput = {}): string {
  const plotDiagram = input.plotDiagram ?? null;
  if (!plotDiagram) return "";

  const status = plotDiagram.status;
  const url = typeof plotDiagram.url === "string" ? plotDiagram.url : null;

  // Branch: failed (no URL or explicit failed) — fallback message.
  if (status === "failed" || (status !== "success" && status !== "partial" && !url)) {
    if (status !== "failed") return ""; // no diagram and not failed → no card
    const reason = plotDiagram.reason ? escapeHtml(plotDiagram.reason) : null;
    return `<!-- ── Section 2a: MapCard (Phase 2 v0) ─────────────────────────── -->
<section class="section section-warning map-card map-card-failed" id="section-map" data-state="failed">
  <div class="section-hdr">
    <div class="section-icon"></div>
    <h2>Plot Map</h2>
    ${statusBadge("failed")}
  </div>
  <p class="section-lede"><strong>Map unavailable.</strong> The visual map of the target plot and its neighbours could not be generated. Boundary verification is still possible on Bhulekh.</p>
  ${reason ? `<p class="source-line">Reason: ${reason}</p>` : ""}
  <p>
    <a class="map-card-cta" href="https://bhulekh.ori.nic.in/RoRView.aspx" target="_blank" rel="noopener noreferrer">Verify on Bhulekh →</a>
  </p>
</section>`;
  }

  // Branch: success or partial — diagram present.
  if (!url) return "";

  const safeUrl = escapeAttr(url);
  const caption = buildCaption(input);
  const isPartial = status === "partial";

  return `<!-- ── Section 2a: MapCard (Phase 2 v0) ─────────────────────────── -->
<section class="section map-card" id="section-map" data-state="${status}" data-premium-anchor="map">
  <div class="section-hdr">
    <div class="section-icon"></div>
    <h2>Plot Map</h2>
    ${statusBadge(status as "success" | "partial")}
  </div>

  <div class="map-card-frame" data-premium-frame="map">
    <img class="map-card-img" src="${safeUrl}" alt="${escapeAttr(caption)} — cadastral plot map showing target plot and surrounding plots" loading="lazy" />
    <div class="map-card-layer-toggle" aria-label="Map layers (Phase 2 v1)">
      <span class="map-card-layer-btn is-active" data-layer="both" aria-pressed="true">Both</span>
      <span class="map-card-layer-btn" data-layer="satellite" aria-pressed="false">Satellite</span>
      <span class="map-card-layer-btn" data-layer="cadastral" aria-pressed="false">Cadastral</span>
    </div>
  </div>

  <p class="source-line map-card-caption">${caption}${isPartial ? " · some neighbour plots may be missing" : ""}</p>

  <div class="map-card-actions">
    <a class="map-card-cta" href="https://bhulekh.ori.nic.in/RoRView.aspx" target="_blank" rel="noopener noreferrer">Verify on Bhulekh →</a>
    <a class="map-card-link" href="${safeUrl}" target="_blank" rel="noopener noreferrer">Open diagram in new tab</a>
  </div>
</section>`;
}
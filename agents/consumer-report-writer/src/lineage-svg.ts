/**
 * SVG renderer for the A13 (ownership lineage) graph.
 *
 * Plan §4.1 V2: takes positioned nodes + edges from `layoutLineage`
 * and emits a self-contained SVG string with inline CSS.
 *
 * Safety: every label and value goes through escapeXml. Node ids
 * are sanitised to attribute-safe strings. No external CSS.
 */

import type { Layout } from "./lineage-layout";

const KIND_FILL: Record<"person" | "entity" | "unknown", string> = {
  person: "#eef2ff",
  entity: "#fff7ed",
  unknown: "#f5f5f5",
};

const KIND_STROKE: Record<"person" | "entity" | "unknown", string> = {
  person: "#4f46e5",
  entity: "#c2410c",
  unknown: "#9ca3af",
};

const RELATIONSHIP_STROKE: Record<string, string> = {
  owned_by: "#6b7280",
  sold_to: "#16a34a",
  mortgaged_to: "#dc2626",
  released_by: "#0ea5e9",
  inherited_by: "#7c3aed",
};

export function renderLineageSvg(layout: Layout, opts: { title?: string } = {}): string {
  if (layout.nodes.length === 0) return "";

  const css = `
    .lineage-svg { font: 12px/1.4 -apple-system, sans-serif; max-width: 100%; height: auto; }
    .lineage-svg .edge { fill: none; stroke-width: 1.5; opacity: 0.85; }
    .lineage-svg .edge.mortgaged_to { stroke-dasharray: 4 2; }
    .lineage-svg .edge.released_by { stroke-dasharray: 6 3; }
    .lineage-svg .node rect { stroke-width: 1.5; rx: 6; ry: 6; }
    .lineage-svg .node text { pointer-events: none; }
    .lineage-svg .node .label { font-weight: 600; fill: #1a1a1a; }
    .lineage-svg .node .kind { fill: #666; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .lineage-svg .edge-label { font-size: 10px; fill: #555; }
  `;

  const nodes = layout.nodes.map((n) => {
    const fill = KIND_FILL[n.kind];
    const stroke = KIND_STROKE[n.kind];
    const label = escapeXml(truncate(n.label, 24));
    return `<g class="node" data-id="${escapeXml(n.id)}" data-kind="${escapeXml(n.kind)}">
      <rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" fill="${fill}" stroke="${stroke}" />
      <text class="kind" x="${n.x + 8}" y="${n.y + 14}">${escapeXml(n.kind)}</text>
      <text class="label" x="${n.x + n.width / 2}" y="${n.y + n.height / 2 + 6}" text-anchor="middle">${label}</text>
    </g>`;
  }).join("");

  const edges = layout.edges.map((e) => {
    const stroke = RELATIONSHIP_STROKE[e.relationship] ?? "#6b7280";
    const cls = `edge ${e.relationship}`;
    // Arrowhead at target.
    const arrowId = `arrow-${e.relationship.replace(/[^a-z0-9]/g, "_")}`;
    return `<path class="${cls}" d="${e.path}" stroke="${stroke}" marker-end="url(#${arrowId})" />
      ${e.label ? `<text class="edge-label" x="${labelX(e.path)}" y="${labelY(e.path)}">${escapeXml(e.label)}</text>` : ""}`;
  }).join("");

  const defs = Object.entries(RELATIONSHIP_STROKE).map(([rel, color]) => {
    const id = `arrow-${rel.replace(/[^a-z0-9]/g, "_")}`;
    return `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="${color}" />
    </marker>`;
  }).join("");

  const title = opts.title ? `<title>${escapeXml(opts.title)}</title>` : "";

  return `<svg class="lineage-svg" viewBox="0 0 ${layout.width} ${layout.height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="lineage-svg-title">
    <style>${css}</style>
    <defs>${defs}</defs>
    ${title}
    <g class="edges">${edges}</g>
    <g class="nodes">${nodes}</g>
  </svg>`;
}

/** Timeline renderer — same data, vertical list with connector lines. */
export function renderLineageTimeline(layout: Layout): string {
  if (layout.nodes.length === 0) return "";
  const sortedByRank = [...layout.nodes].sort((a, b) => a.y - b.y || a.x - b.x);
  const items = sortedByRank.map((n) => `
    <li class="lineage-timeline__item" data-id="${escapeXml(n.id)}">
      <span class="lineage-timeline__kind">${escapeXml(n.kind)}</span>
      <strong class="lineage-timeline__name">${escapeXml(truncate(n.label, 32))}</strong>
    </li>
  `).join("");
  return `<ol class="lineage-timeline">${items}</ol>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

/** Approximate label midpoint from a cubic bezier path string. */
function labelX(path: string): number {
  const m = path.match(/M\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
  const end = path.match(/,\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/);
  if (!m || !end) return 0;
  return (parseFloat(m[1]!) + parseFloat(end[1]!)) / 2;
}
function labelY(path: string): number {
  const m = path.match(/M\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
  const end = path.match(/,\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*$/);
  if (!m || !end) return 0;
  return (parseFloat(m[2]!) + parseFloat(end[2]!)) / 2 - 4;
}
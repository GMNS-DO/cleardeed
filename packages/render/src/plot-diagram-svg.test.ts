/**
 * Plot Diagram SVG Renderer — unit tests
 *
 * Six tests, one per behavior called out in the brief:
 *   1. Target highlighting (target plot renders with highlight fill)
 *   2. Neighbor labels (neighbor plot numbers appear as <text>)
 *   3. Road rendering (roads render as polylines with light grey stroke)
 *   4. Empty neighbors (zero neighbors does not crash)
 *   5. Bounds calculation (viewBox auto-fit with 10% padding)
 *   6. A11y attributes (<title> and <desc> contain target plot number)
 *
 * Plus a determinism test and a contract-shape assertion to catch any
 * silent drift between Task 32's PlotDiagramResult and our render types.
 */

import { describe, it, expect } from "vitest";
import {
  renderPlotDiagramSvg,
  __testing,
  type PlotDiagramResult,
} from "./plot-diagram-svg.js";

const { padBounds } = __testing;

// ──────────────────────────────────────────────────────────────────────────
// Test fixtures
// ──────────────────────────────────────────────────────────────────────────

function baseDiagram(overrides: Partial<PlotDiagramResult> = {}): PlotDiagramResult {
  return {
    source: "bhunaksha:wfs:plot-diagram",
    status: "success",
    fetchedAt: "2026-06-18T00:00:00.000Z",
    target: {
      plotNo: "415",
      village: "Mendhasala",
      polygon: {
        type: "Polygon",
        coordinates: [
          [85.7000, 20.2720],
          [85.7010, 20.2720],
          [85.7010, 20.2730],
          [85.7000, 20.2730],
          [85.7000, 20.2720],
        ],
      },
      areaSqKm: 0.0001,
    },
    neighbors: [],
    roads: [],
    bounds: {
      minX: 85.7000,
      minY: 20.2720,
      maxX: 85.7010,
      maxY: 20.2730,
    },
    provenance: {
      source: "bhunaksha:wfs:plot-diagram",
      fetchedAt: "2026-06-18T00:00:00.000Z",
      parserVersion: "bhunaksha-plot-diagram/2026-06-18",
      layer: "khurda_bhubaneswar",
      roadLayerAvailable: false,
      counts: { neighborCandidates: 0, neighborSelected: 0, roadFeatures: 0 },
    },
    warnings: [],
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────

describe("renderPlotDiagramSvg", () => {
  it("highlights the target plot with the amber fill color", () => {
    const svg = renderPlotDiagramSvg(baseDiagram());
    // Target group should contain the highlight fill (#f59e0b).
    expect(svg).toMatch(/<g class="target"[^>]*>[\s\S]*?fill="#f59e0b"[\s\S]*?<\/g>/);
    // And the target stroke color.
    expect(svg).toMatch(/stroke="#b45309"/);
    // Target plot number label appears.
    expect(svg).toContain(">415<");
  });

  it("renders neighbor polygons with plot-number labels", () => {
    const diagram = baseDiagram({
      neighbors: [
        {
          plotNo: "416",
          village: "Mendhasala",
          tehsil: "Bhubaneswar",
          polygon: {
            type: "Polygon",
            coordinates: [
              [85.7010, 20.2720],
              [85.7020, 20.2720],
              [85.7020, 20.2730],
              [85.7010, 20.2730],
              [85.7010, 20.2720],
            ],
          },
          areaSqKm: 0.0001,
        },
        {
          plotNo: "417",
          village: "Mendhasala",
          tehsil: "Bhubaneswar",
          polygon: {
            type: "Polygon",
            coordinates: [
              [85.7000, 20.2730],
              [85.7010, 20.2730],
              [85.7010, 20.2740],
              [85.7000, 20.2740],
              [85.7000, 20.2730],
            ],
          },
          areaSqKm: 0.0001,
        },
      ],
      bounds: {
        minX: 85.7000,
        minY: 20.2720,
        maxX: 85.7020,
        maxY: 20.2740,
      },
    });

    const svg = renderPlotDiagramSvg(diagram);

    // Two neighbor polygons are drawn.
    const neighborGroup = svg.match(/<g class="neighbors"[^>]*>([\s\S]*?)<\/g>/);
    expect(neighborGroup).not.toBeNull();
    const groupBody = neighborGroup![1];
    expect((groupBody.match(/<polygon /g) ?? []).length).toBe(2);

    // Neighbor outline color appears.
    expect(svg).toMatch(/stroke="#6b7280"/);

    // Both neighbor labels are present.
    expect(svg).toContain(">416<");
    expect(svg).toContain(">417<");
  });

  it("renders roads as light grey polylines", () => {
    const diagram = baseDiagram({
      roads: [
        {
          name: "NH-16",
          roadClass: "national",
          path: [
            [85.6990, 20.2715],
            [85.6995, 20.2725],
            [85.7000, 20.2735],
          ],
        },
        {
          name: "Main Road",
          roadClass: "local",
          path: [
            [
              [85.7000, 20.2700],
              [85.7000, 20.2740],
            ],
            [
              [85.7000, 20.2740],
              [85.7010, 20.2740],
            ],
          ],
        },
      ],
    });

    const svg = renderPlotDiagramSvg(diagram);

    // Two road polylines (LineString produces 1, MultiLineString produces 2 = 3 total).
    const roadGroup = svg.match(/<g class="roads"[^>]*>([\s\S]*?)<\/g>/);
    expect(roadGroup).not.toBeNull();
    const polylines = (roadGroup![1].match(/<polyline /g) ?? []).length;
    expect(polylines).toBe(3);

    // Light grey stroke is applied.
    expect(svg).toMatch(/stroke="#cbd5e1"/);
  });

  it("renders gracefully when there are no neighbors (no crash)", () => {
    const diagram = baseDiagram({
      neighbors: [],
      bounds: {
        minX: 85.7000,
        minY: 20.2720,
        maxX: 85.7010,
        maxY: 20.2730,
      },
    });

    const svg = renderPlotDiagramSvg(diagram);

    // Still a valid SVG document.
    expect(svg).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect(svg).toMatch(/<svg /);
    expect(svg).toMatch(/<\/svg>$/);

    // Empty neighbor group is present but contains no polygons.
    const neighborGroup = svg.match(/<g class="neighbors"[^>]*>([\s\S]*?)<\/g>/);
    expect(neighborGroup).not.toBeNull();
    expect((neighborGroup![1].match(/<polygon /g) ?? []).length).toBe(0);

    // Target is still drawn.
    expect(svg).toContain(">415<");
  });

  it("computes bounds from the diagram and applies 10% padding", () => {
    // Use a wider input bounds and verify the viewBox is auto-fit.
    const diagram = baseDiagram({
      bounds: {
        minX: 100,
        minY: 200,
        maxX: 200,
        maxY: 300,
      },
    });

    const svg = renderPlotDiagramSvg(diagram, { width: 600, height: 480 });

    // ViewBox always 0..width, 0..height.
    expect(svg).toMatch(/viewBox="0 0 600 480"/);

    // Padding helper itself: 100% width span = 100, padding = 10 each side.
    const padded = padBounds(diagram.bounds!, 0.1);
    expect(padded.minX).toBeCloseTo(90, 6);
    expect(padded.maxX).toBeCloseTo(210, 6);
    expect(padded.minY).toBeCloseTo(190, 6);
    expect(padded.maxY).toBeCloseTo(310, 6);

    // Empty-diagram fallback works when bounds are null and no polygons.
    const empty = baseDiagram({ bounds: null, target: null, neighbors: [], roads: [] });
    const emptySvg = renderPlotDiagramSvg(empty);
    expect(emptySvg).toContain("Plot diagram unavailable");
  });

  it("includes a11y <title> and <desc> with the target plot number", () => {
    const diagram = baseDiagram({
      target: {
        plotNo: "415",
        village: "Mendhasala",
        polygon: {
          type: "Polygon",
          coordinates: [
            [85.7000, 20.2720],
            [85.7010, 20.2720],
            [85.7010, 20.2730],
            [85.7000, 20.2730],
            [85.7000, 20.2720],
          ],
        },
        areaSqKm: 0.0001,
      },
    });

    const svg = renderPlotDiagramSvg(diagram);

    // <title> contains the target plot number.
    expect(svg).toMatch(/<title[^>]*>Plot 415 — Mendhasala<\/title>/);
    // <desc> also references the target plot number.
    expect(svg).toMatch(/<desc[^>]*>Plot diagram for plot 415[\s\S]*?<\/desc>/);
    // role="img" + aria-labelledby binding.
    expect(svg).toMatch(/role="img"/);
    expect(svg).toMatch(/aria-labelledby="plot-diagram-title plot-diagram-desc"/);
  });

  it("is deterministic: same input produces identical bytes", () => {
    const diagram = baseDiagram();
    const a = renderPlotDiagramSvg(diagram);
    const b = renderPlotDiagramSvg(diagram);
    expect(a).toBe(b);
  });

  it("does not contain external font, image, or stylesheet references", () => {
    const diagram = baseDiagram({
      neighbors: [
        {
          plotNo: "416",
          village: "Mendhasala",
          tehsil: "Bhubaneswar",
          polygon: {
            type: "Polygon",
            coordinates: [
              [85.7010, 20.2720],
              [85.7020, 20.2720],
              [85.7020, 20.2730],
              [85.7010, 20.2730],
              [85.7010, 20.2720],
            ],
          },
          areaSqKm: 0.0001,
        },
      ],
      roads: [
        {
          name: "NH-16",
          path: [
            [85.6990, 20.2715],
            [85.7000, 20.2735],
          ],
        },
      ],
    });
    const svg = renderPlotDiagramSvg(diagram);
    expect(svg).not.toMatch(/<link /);
    expect(svg).not.toMatch(/<style /);
    expect(svg).not.toMatch(/<image /);
    expect(svg).not.toMatch(/@import /);
    expect(svg).not.toMatch(/@font-face/);
    expect(svg).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
  });

  it("XML-escapes user-supplied plot numbers and labels", () => {
    const diagram = baseDiagram({
      target: {
        plotNo: "<script>",
        village: "Mendhasala",
        polygon: {
          type: "Polygon",
          coordinates: [
            [85.7000, 20.2720],
            [85.7010, 20.2720],
            [85.7010, 20.2730],
            [85.7000, 20.2730],
            [85.7000, 20.2720],
          ],
        },
        areaSqKm: 0.0001,
      },
    });
    const svg = renderPlotDiagramSvg(diagram);
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Contract-shape drift guard
// ──────────────────────────────────────────────────────────────────────────
//
// If Task 32's PlotDiagramResult shape changes incompatibly, this test
// will fail with an assignment error at compile time, surfacing the
// drift at the next typecheck. Render types are intentionally structurally
// compatible (not nominally) with the source shape — see the top of
// plot-diagram-svg.ts for the contract note.

/* eslint-disable @typescript-eslint/no-unused-vars */
// Compile-time shape check (no runtime cost): if the source type's shape
// is incompatible with our PlotDiagramResult, the assignment below will fail.
import type { PlotDiagramResult as SourcePlotDiagramResult } from "../../fetchers/bhunaksha/src/plot-diagram.js";
const _contract: SourcePlotDiagramResult = {} as PlotDiagramResult;
/* eslint-enable @typescript-eslint/no-unused-vars */

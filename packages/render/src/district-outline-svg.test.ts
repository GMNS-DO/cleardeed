/**
 * renderDistrictOutlineSvg — pure-function tests.
 *
 * Pin the contract:
 *  - returns a self-contained SVG 1.1 string
 *  - draws the district outline + a gold target square at the centroid
 *  - includes a caption explaining the fallback ("approximate")
 *  - is deterministic (same input → same bytes)
 *  - is pure (no I/O, no Date, no Math.random)
 *  - escapes user-controlled text (plotNo, village, reason)
 *  - returns a placeholder if the boundary has no usable ring
 */

import { describe, it, expect } from "vitest";
import {
  renderDistrictOutlineSvg,
  type DistrictOutlineInput,
  __testing,
} from "./district-outline-svg";

// A tiny district-shaped ring around Bhubaneswar (just enough to
// make bounds sensible in the test). Real boundary has ~1900 vertices;
// tests use a 6-vertex minimal ring for speed and stability.
const TINY_BOUNDARY: DistrictOutlineInput["khordhaBoundary"] = {
  data: {
    type: "Feature",
    properties: { title: "Khordha" },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [85.70, 20.15],
          [85.95, 20.15],
          [85.95, 20.40],
          [85.85, 20.50],
          [85.70, 20.40],
          [85.70, 20.15],
        ],
      ],
    },
  },
};

const BASE_INPUT: DistrictOutlineInput = {
  khordhaBoundary: TINY_BOUNDARY,
  centroid: { lat: 20.30, lon: 85.82 },
  village: "Mendhasala",
  plotNo: "309",
  reason: "no_containing_polygon",
};

describe("renderDistrictOutlineSvg — output shape", () => {
  it("returns a self-contained SVG 1.1 string", () => {
    const svg = renderDistrictOutlineSvg(BASE_INPUT);
    expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('version="1.1"');
    expect(svg).toMatch(/<svg [^>]*>/);
    expect(svg).toContain("</svg>");
  });

  it("includes <title> and <desc> with target plot number", () => {
    const svg = renderDistrictOutlineSvg(BASE_INPUT);
    expect(svg).toContain("<title");
    expect(svg).toContain("Plot 309");
    expect(svg).toContain("<desc");
  });

  it("defaults to 600x480 viewBox/width/height", () => {
    const svg = renderDistrictOutlineSvg(BASE_INPUT);
    expect(svg).toMatch(/viewBox="0 0 600 480"/);
    expect(svg).toMatch(/width="600"/);
    expect(svg).toMatch(/height="480"/);
  });

  it("respects explicit width/height options", () => {
    const svg = renderDistrictOutlineSvg(BASE_INPUT, {
      width: 800,
      height: 600,
    });
    expect(svg).toMatch(/viewBox="0 0 800 600"/);
  });
});

describe("renderDistrictOutlineSvg — layer ordering", () => {
  it("draws the district outline (polygon) before the target square", () => {
    const svg = renderDistrictOutlineSvg(BASE_INPUT);
    const districtIdx = svg.indexOf('stroke="#94a3b8"');
    const targetIdx = svg.indexOf('stroke="#b45309"');
    expect(districtIdx).toBeGreaterThan(-1);
    expect(targetIdx).toBeGreaterThan(-1);
    // District outline is the bottom layer → appears first.
    expect(districtIdx).toBeLessThan(targetIdx);
  });

  it("uses slate-400 for the district stroke", () => {
    const svg = renderDistrictOutlineSvg(BASE_INPUT);
    expect(svg).toContain("#94a3b8");
  });

  it("uses amber-700 for the target stroke", () => {
    const svg = renderDistrictOutlineSvg(BASE_INPUT);
    expect(svg).toContain("#b45309");
  });

  it("renders the target square as a 5-point closed ring", () => {
    const svg = renderDistrictOutlineSvg(BASE_INPUT);
    // Find the polygon with amber stroke and verify it has 5 points
    const m = svg.match(/<polygon points="([^"]+)" fill="#f59e0b"/);
    expect(m).toBeTruthy();
    const points = m![1].split(" ");
    expect(points).toHaveLength(5);
    // First and last points are identical (closed ring).
    expect(points[0]).toBe(points[4]);
  });
});

describe("renderDistrictOutlineSvg — captions", () => {
  it("includes the approximate-location caption", () => {
    const svg = renderDistrictOutlineSvg(BASE_INPUT);
    expect(svg).toContain("Approximate location");
    expect(svg).toContain("plot boundary not available");
  });

  it("surfaces the reason in the desc", () => {
    const svg = renderDistrictOutlineSvg({
      ...BASE_INPUT,
      reason: "outside_returned_polygons",
    });
    expect(svg).toContain("outside_returned_polygons");
  });

  it("escapes XML in the reason", () => {
    const svg = renderDistrictOutlineSvg({
      ...BASE_INPUT,
      reason: "weird<>&\"reason",
    });
    expect(svg).toContain("&lt;");
    expect(svg).toContain("&amp;");
    expect(svg).not.toContain("weird<");
  });

  it("allows overriding title and desc", () => {
    const svg = renderDistrictOutlineSvg(BASE_INPUT, {
      title: "Custom title",
      desc: "Custom desc",
    });
    expect(svg).toContain("Custom title");
    expect(svg).toContain("Custom desc");
    expect(svg).not.toContain("Plot 309 — Mendhasala (approximate)");
  });
});

describe("renderDistrictOutlineSvg — bounds", () => {
  it("computes bounds from the district ring (not the GPS)", () => {
    // The GPS is at (20.30, 85.82) but the district spans (20.15–20.50, 85.70–85.95).
    // The renderer's bounds should encompass the whole district.
    const svg = renderDistrictOutlineSvg(BASE_INPUT);
    // All district points should be on-screen (within 0..600 x 0..480).
    const m = svg.match(/<polygon points="([^"]+)" fill="none" stroke="#94a3b8"/);
    expect(m).toBeTruthy();
    const points = m![1].split(" ").map((p) => p.split(",").map(Number));
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(600);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(480);
    }
  });
});

describe("renderDistrictOutlineSvg — determinism + purity", () => {
  it("returns identical output for identical input", () => {
    const a = renderDistrictOutlineSvg(BASE_INPUT);
    const b = renderDistrictOutlineSvg(BASE_INPUT);
    expect(a).toBe(b);
  });

  it("does not mutate the input", () => {
    const input: DistrictOutlineInput = JSON.parse(JSON.stringify(BASE_INPUT));
    const snapshot = JSON.stringify(input);
    renderDistrictOutlineSvg(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("does not include any Date/Math.random artefacts", () => {
    const svg = renderDistrictOutlineSvg(BASE_INPUT);
    // No ISO timestamps, no random IDs.
    expect(svg).not.toMatch(/202\d-/);
    expect(svg).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
  });
});

describe("renderDistrictOutlineSvg — empty boundary fallback", () => {
  it("returns a placeholder when boundary has no usable ring", () => {
    const svg = renderDistrictOutlineSvg({
      ...BASE_INPUT,
      khordhaBoundary: {
        data: {
          type: "Feature",
          properties: { title: "Khordha" },
          geometry: { type: "Polygon", coordinates: [[]] },
        },
      },
    });
    expect(svg).toContain("<svg");
    expect(svg).toContain("District outline unavailable");
  });

  it("returns a placeholder when boundary coordinates is undefined", () => {
    const svg = renderDistrictOutlineSvg({
      ...BASE_INPUT,
      khordhaBoundary: {
        data: {
          type: "Feature",
          properties: { title: "Khordha" },
          geometry: { type: "Polygon", coordinates: [] },
        },
      },
    });
    expect(svg).toContain("District outline unavailable");
  });
});

describe("renderDistrictOutlineSvg — internal helpers", () => {
  it("escapeXml escapes all XML special chars", () => {
    expect(__testing.escapeXml("a&b")).toBe("a&amp;b");
    expect(__testing.escapeXml("<x>")).toBe("&lt;x&gt;");
    expect(__testing.escapeXml('"x"')).toBe("&quot;x&quot;");
    expect(__testing.escapeXml("'x'")).toBe("&apos;x&apos;");
  });

  it("computeOutlineBounds returns null for empty rings", () => {
    expect(__testing.computeOutlineBounds([], [])).toBeNull();
  });

  it("padOutlineBounds adds the same fraction to all sides", () => {
    const padded = __testing.padOutlineBounds(
      { minX: 0, minY: 0, maxX: 100, maxY: 100 },
      0.1
    );
    expect(padded.minX).toBe(-10);
    expect(padded.maxX).toBe(110);
    expect(padded.minY).toBe(-10);
    expect(padded.maxY).toBe(110);
  });
});

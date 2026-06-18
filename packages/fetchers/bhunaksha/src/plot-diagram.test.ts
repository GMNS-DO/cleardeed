/**
 * Plot Diagram WFS Compose Fetcher — unit tests
 *
 * Uses a mocked globalThis.fetch so the test does not hit the live GeoServer.
 * WFS responses are inline fixtures shaped to match the real schema.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchPlotDiagram,
  PLOT_DIAGRAM_PARSER_VERSION,
  __testing,
  type PlotDiagramInput,
} from "./plot-diagram.js";

const { polygonsShareEdge, shoelaceAreaSqKm, computeBounds } = __testing;

// ────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ────────────────────────────────────────────────────────────────────────────

const TARGET_POLYGON = {
  type: "Polygon" as const,
  coordinates: [
    [
      [85.7000, 20.2720],
      [85.7010, 20.2720],
      [85.7010, 20.2730],
      [85.7000, 20.2730],
      [85.7000, 20.2720],
    ],
  ],
};

const NEIGHBOR_EAST = {
  type: "Feature",
  id: "khurda_bhubaneswar.1001",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [85.7010, 20.2720], // shares edge with target east side (85.7010, 20.2720-20.2730)
        [85.7020, 20.2720],
        [85.7020, 20.2730],
        [85.7010, 20.2730],
        [85.7010, 20.2720],
      ],
    ],
  },
  properties: {
    revenue_plot: "1001",
    revenue_village_name: "Mendhasala",
    tehsil_name: "Bhubaneswar",
  },
};

const NEIGHBOR_NORTH = {
  type: "Feature",
  id: "khurda_bhubaneswar.1002",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [85.7000, 20.2730], // shares edge with target north side (85.7000-85.7010, 20.2730)
        [85.7010, 20.2730],
        [85.7010, 20.2740],
        [85.7000, 20.2740],
        [85.7000, 20.2730],
      ],
    ],
  },
  properties: {
    revenue_plot: "1002",
    revenue_village_name: "Mendhasala",
    tehsil_name: "Bhubaneswar",
  },
};

const NEIGHBOR_FAR_AWAY = {
  type: "Feature",
  id: "khurda_bhubaneswar.9999",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [85.7500, 20.3000], // 5+ km away, but still inside the 0.003° buffer ~ No, this is outside
        [85.7510, 20.3000],
        [85.7510, 20.3010],
        [85.7500, 20.3010],
        [85.7500, 20.3000],
      ],
    ],
  },
  properties: {
    revenue_plot: "9999",
    revenue_village_name: "Other",
    tehsil_name: "Other",
  },
};

const TARGET_ITSELF = {
  type: "Feature",
  id: "khurda_bhubaneswar.1000",
  geometry: {
    type: "Polygon",
    coordinates: TARGET_POLYGON.coordinates,
  },
  properties: {
    revenue_plot: "415", // matches input.targetPlotNo
    revenue_village_name: "Mendhasala",
    tehsil_name: "Bhubaneswar",
  },
};

const ROAD_LINE = {
  type: "Feature",
  id: "roads.1",
  geometry: {
    type: "LineString",
    coordinates: [
      [85.6990, 20.2700],
      [85.7000, 20.2720],
      [85.7010, 20.2740],
    ],
  },
  properties: { name: "NH-16", road_class: "national_highway" },
};

function makeWFSResponse(features: unknown[]): string {
  return JSON.stringify({
    type: "FeatureCollection",
    features,
    totalFeatures: features.length,
    numberReturned: features.length,
    crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::4326" } },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Mock fetch router
// ────────────────────────────────────────────────────────────────────────────

interface MockRoute {
  match: (url: string) => boolean;
  response: () => Response | Promise<Response>;
}

let routes: MockRoute[] = [];

beforeEach(() => {
  routes = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL): Promise<Response> => {
      const url = typeof input === "string" ? input : input.toString();
      for (const r of routes) {
        if (r.match(url)) return r.response();
      }
      return new Response("not found", { status: 404 });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function routePlotLayer(features: unknown[]): void {
  routes.push({
    match: (url) => url.includes("TYPENAME=revenue:khurda_bhubaneswar"),
    response: () =>
      new Response(makeWFSResponse(features), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  });
}

function routeRoadLayer(features: unknown[] | null): void {
  routes.push({
    match: (url) => url.includes("TYPENAME=revenue:roads"),
    response: () => {
      if (features === null) {
        return new Response("layer not found", { status: 404 });
      }
      return new Response(makeWFSResponse(features), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });
}

const baseInput: PlotDiagramInput = {
  targetPolygon: TARGET_POLYGON,
  targetPlotNo: "415",
  targetVillage: "Mendhasala",
  centroid: { lat: 20.2725, lon: 85.7005 },
  layer: "khurda_bhubaneswar",
};

// ────────────────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────────────────

describe("fetchPlotDiagram", () => {
  it("returns a successful diagram with target + neighbors + bounds + provenance", async () => {
    routePlotLayer([TARGET_ITSELF, NEIGHBOR_EAST, NEIGHBOR_NORTH, NEIGHBOR_FAR_AWAY]);
    routeRoadLayer([ROAD_LINE]);

    const result = await fetchPlotDiagram(baseInput);

    expect(result.status).toBe("success");
    expect(result.target).not.toBeNull();
    expect(result.target?.plotNo).toBe("415");
    expect(result.target?.village).toBe("Mendhasala");
    expect(result.neighbors).toHaveLength(2);
    const neighborNos = result.neighbors.map((n) => n.plotNo).sort();
    expect(neighborNos).toEqual(["1001", "1002"]);
    // target itself is excluded by plot number match
    expect(result.neighbors.find((n) => n.plotNo === "415")).toBeUndefined();
    // far-away feature has no shared edge → excluded
    expect(result.neighbors.find((n) => n.plotNo === "9999")).toBeUndefined();
    expect(result.roads).toHaveLength(1);
    expect(result.roads[0]?.name).toBe("NH-16");
    expect(result.bounds).not.toBeNull();
    // bounds must contain both target and at least one neighbor's polygon
    expect(result.bounds!.minX).toBeLessThanOrEqual(85.7000);
    expect(result.bounds!.maxX).toBeGreaterThanOrEqual(85.7020);
    expect(result.bounds!.minY).toBeLessThanOrEqual(20.2720);
    expect(result.bounds!.maxY).toBeGreaterThanOrEqual(20.2740);
    expect(result.provenance.parserVersion).toBe(PLOT_DIAGRAM_PARSER_VERSION);
    expect(result.provenance.roadLayerAvailable).toBe(true);
    expect(result.provenance.counts.neighborSelected).toBe(2);
    expect(result.warnings).not.toContain("no_edge_sharing_neighbors_found");
  });

  it("returns empty neighbors array (never throws) when WFS returns 0 features", async () => {
    routePlotLayer([]);
    routeRoadLayer(null);

    const result = await fetchPlotDiagram(baseInput);

    expect(result.status).toBe("partial");
    expect(result.neighbors).toEqual([]);
    expect(result.target).not.toBeNull(); // target is preserved from input
    expect(result.roads).toEqual([]);
    expect(result.warnings).toContain("no_edge_sharing_neighbors_found");
    expect(result.warnings.some((w) => w.startsWith("road_layer_unavailable"))).toBe(true);
  });

  it("skips roads gracefully when road layer is absent (404)", async () => {
    routePlotLayer([NEIGHBOR_EAST]);
    routeRoadLayer(null);

    const result = await fetchPlotDiagram(baseInput);

    expect(result.status).toBe("success");
    expect(result.neighbors).toHaveLength(1);
    expect(result.roads).toEqual([]);
    expect(result.provenance.roadLayerAvailable).toBe(false);
    expect(result.warnings.some((w) => w.startsWith("road_layer_unavailable"))).toBe(true);
  });

  it("warns when fewer than 4 edge-sharing neighbors are found", async () => {
    routePlotLayer([NEIGHBOR_EAST]); // only 1 neighbor
    routeRoadLayer([ROAD_LINE]);

    const result = await fetchPlotDiagram(baseInput);

    expect(result.neighbors).toHaveLength(1);
    expect(result.warnings).toContain("only_1_neighbors_found");
  });

  it("caps neighbors at MAX_NEIGHBORS=8", async () => {
    // Build a target whose east edge is densely populated with vertices,
    // then build 10 narrow strips each sharing one distinct edge segment of
    // that east edge. The cap at 8 should kick in.
    const eastEdgeY = Array.from({ length: 11 }, (_, i) => 20.2700 + 0.0004 * i);
    const targetRing: number[][] = [];
    targetRing.push([85.7000, eastEdgeY[0]!]);
    // south edge (west → east)
    for (const y of eastEdgeY) targetRing.push([85.7010, y]);
    // north edge (east → west)
    for (let i = eastEdgeY.length - 1; i >= 0; i--) {
      targetRing.push([85.7000, eastEdgeY[i]!]);
    }
    targetRing.push([85.7000, eastEdgeY[0]!]); // close

    const longTarget = { type: "Polygon" as const, coordinates: [targetRing] };

    const many: unknown[] = [];
    for (let i = 0; i < 10; i++) {
      const y0 = eastEdgeY[i]!;
      const y1 = eastEdgeY[i + 1]!;
      many.push({
        type: "Feature",
        id: `n.${i}`,
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [85.7010, y0],
              [85.7010, y1],
              [85.7020, y1],
              [85.7020, y0],
              [85.7010, y0],
            ],
          ],
        },
        properties: { revenue_plot: `N${i}`, revenue_village_name: "V", tehsil_name: "T" },
      });
    }
    routePlotLayer(many);
    routeRoadLayer(null);

    const result = await fetchPlotDiagram({
      ...baseInput,
      targetPolygon: longTarget,
      targetPlotNo: "9999",
    });
    expect(result.neighbors).toHaveLength(8);
  });

  it("never throws on total WFS failure — returns failed status with empty diagram", async () => {
    routes.push({
      match: () => true,
      response: () => Promise.reject(new Error("network down")),
    });

    const result = await fetchPlotDiagram(baseInput);

    expect(result.status).toBe("failed");
    expect(result.target).toBeNull();
    expect(result.neighbors).toEqual([]);
    expect(result.roads).toEqual([]);
    expect(result.error).toContain("network down");
  });

  it("preserves all provenance fields including fetchedAt and parserVersion", async () => {
    routePlotLayer([]);
    routeRoadLayer(null);

    const before = new Date().toISOString();
    const result = await fetchPlotDiagram(baseInput);
    const after = new Date().toISOString();

    expect(result.fetchedAt >= before).toBe(true);
    expect(result.fetchedAt <= after).toBe(true);
    expect(result.provenance.source).toBe("bhunaksha:wfs:plot-diagram");
    expect(result.provenance.parserVersion).toMatch(/bhunaksha-plot-diagram\/\d{4}-\d{2}-\d{2}/);
    expect(result.provenance.layer).toBe("khurda_bhubaneswar");
    expect(result.provenance.roadLayerAttempted).toBe("roads");
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Pure helper tests
// ────────────────────────────────────────────────────────────────────────────

describe("polygonsShareEdge", () => {
  it("returns true when rings share 2+ vertices", () => {
    const a = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const b = [
      [1, 0],
      [2, 0],
      [2, 1],
      [1, 1],
      [1, 0],
    ];
    expect(polygonsShareEdge(a, b)).toBe(true);
  });

  it("returns false when rings only touch at one vertex (corner-touch only)", () => {
    const a = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const b = [
      [1, 1],
      [2, 1],
      [2, 2],
      [1, 2],
      [1, 1],
    ];
    expect(polygonsShareEdge(a, b)).toBe(false);
  });

  it("returns false for completely disjoint polygons", () => {
    const a = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const b = [
      [5, 5],
      [6, 5],
      [6, 6],
      [5, 6],
      [5, 5],
    ];
    expect(polygonsShareEdge(a, b)).toBe(false);
  });
});

describe("shoelaceAreaSqKm", () => {
  it("returns ~0 for a degenerate polygon", () => {
    expect(shoelaceAreaSqKm([[0, 0], [1, 0], [1, 0], [0, 0]])).toBe(0);
  });

  it("returns a positive area for a unit square at low latitude", () => {
    // 0.01° × 0.01° near equator ≈ 1.11 km × 1.11 km ≈ 1.23 km²
    const a = shoelaceAreaSqKm([
      [0, 0],
      [0.01, 0],
      [0.01, 0.01],
      [0, 0.01],
      [0, 0],
    ]);
    expect(a).toBeGreaterThan(1.0);
    expect(a).toBeLessThan(1.5);
  });
});

describe("computeBounds", () => {
  it("returns null for empty input", () => {
    expect(computeBounds([])).toBeNull();
  });

  it("computes a bounds that contains all input polygons", () => {
    const bounds = computeBounds([
      {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0],
          ],
        ],
      },
      {
        type: "Polygon",
        coordinates: [
          [
            [2, 2],
            [3, 2],
            [3, 3],
            [2, 3],
            [2, 2],
          ],
        ],
      },
    ]);
    expect(bounds).toEqual({ minX: 0, minY: 0, maxX: 3, maxY: 3 });
  });
});

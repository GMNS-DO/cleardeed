/**
 * Tests for apps/web/src/lib/plot-diagram-step.ts
 *
 * Phase 8 (Task 35). The plot diagram step wires four things together:
 *   1. WFS compose (fetchPlotDiagram)
 *   2. SVG render (renderPlotDiagramSvg)
 *   3. Supabase Storage upload (storePlotDiagram)
 *   4. Cache lookup + persist (plot-diagram-cache + reports.update)
 *
 * Each is mocked at module boundary so the tests are fast and don't
 * need network or Supabase. The tests cover the brief's required cases:
 *   - success path (full happy path)
 *   - failure path (any sub-step throws → status: "failed", report keeps going)
 *   - cache hit by reportId (no WFS call)
 *
 * Plus a few belt-and-braces cases: missing polygon → not_attempted;
 * storage upload throws → failed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchPlotDiagram: vi.fn(),
  renderPlotDiagramSvg: vi.fn(),
  renderDistrictOutlineSvg: vi.fn(),
  storePlotDiagram: vi.fn(),
  findCachedByReportId: vi.fn(),
  findCachedByGps: vi.fn(),
  // We capture the value the step writes back to the reports row so
  // we can assert the persistence shape without coupling to Supabase.
  persistedRows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@cleardeed/fetcher-bhunaksha", () => ({
  fetchPlotDiagram: mocks.fetchPlotDiagram,
}));

vi.mock("@cleardeed/render", () => ({
  renderPlotDiagramSvg: mocks.renderPlotDiagramSvg,
  renderDistrictOutlineSvg: mocks.renderDistrictOutlineSvg,
}));

vi.mock("./plot-diagram-storage", () => ({
  storePlotDiagram: mocks.storePlotDiagram,
}));

vi.mock("./plot-diagram-cache", () => ({
  buildPlotDiagramCacheKey: (gps: { lat: number; lon: number }, plotNo: string, village: string) =>
    `${gps.lat.toFixed(5)},${gps.lon.toFixed(5)}|${plotNo.trim().toLowerCase()}|${village.trim().toLowerCase()}`,
  findCachedPlotDiagramByReportId: mocks.findCachedByReportId,
  findCachedPlotDiagramByGps: mocks.findCachedByGps,
  PLOT_DIAGRAM_CACHE_WINDOW_MS: 7 * 24 * 60 * 60 * 1000,
}));

// Mock ./db with a tiny Supabase-shaped client that records the writes.
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getSupabaseServerClient: () => ({
      from: (table: string) => {
        if (table !== "reports") {
          throw new Error(`unexpected table: ${table}`);
        }
        return {
          update: (fields: Record<string, unknown>) => ({
            eq: (_col: string, _val: string) => {
              mocks.persistedRows.push(fields);
              return Promise.resolve({ error: null });
            },
          }),
          select: () => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        };
      },
    }),
  };
});

import { runPlotDiagramStep, buildPlotDiagramKey } from "./plot-diagram-step";

// ── Fixtures ──────────────────────────────────────────────────────────────

const VALID_INPUT = {
  reportId: "rep_abc",
  gps: { lat: 20.27269, lon: 85.70127 },
  village: "Mendhasala",
  plotNo: "415",
  targetPolygon: {
    type: "Polygon" as const,
    coordinates: [
      [
        [85.7010, 20.2724],
        [85.7015, 20.2724],
        [85.7015, 20.2729],
        [85.7010, 20.2729],
        [85.7010, 20.2724],
      ],
    ],
  },
  traceId: "t1",
};

const SUCCESS_DIAGRAM = {
  status: "success",
  target: {
    plotNo: "415",
    village: "Mendhasala",
    polygon: { type: "Polygon", coordinates: VALID_INPUT.targetPolygon.coordinates[0] },
    areaSqKm: 0.012,
  },
  neighbors: [],
  roads: [],
  bounds: { minX: 85.701, minY: 20.272, maxX: 85.702, maxY: 20.273 },
  provenance: {
    source: "wfs",
    fetchedAt: "2026-06-19T00:00:00Z",
    parserVersion: "v1",
    layer: "khurda_bhubaneswar",
    roadLayerAvailable: false,
  },
};

const SUCCESS_URL =
  "https://abc.supabase.co/storage/v1/object/public/plot-diagrams/reports/rep_abc/plot-diagram-20.27269%2C85.70127%7C415%7Cmendhasala.svg";

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  mocks.fetchPlotDiagram.mockReset();
  mocks.renderPlotDiagramSvg.mockReset();
  mocks.renderDistrictOutlineSvg.mockReset();
  mocks.storePlotDiagram.mockReset();
  mocks.findCachedByReportId.mockReset();
  mocks.findCachedByGps.mockReset();
  mocks.persistedRows.length = 0;
  // Cache empty by default — the success/failure paths skip the cache.
  mocks.findCachedByReportId.mockResolvedValue(null);
  mocks.findCachedByGps.mockResolvedValue(null);
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("runPlotDiagramStep — success path", () => {
  it("composes + renders + uploads + persists, returns success with the public URL", async () => {
    mocks.fetchPlotDiagram.mockResolvedValue(SUCCESS_DIAGRAM);
    mocks.renderPlotDiagramSvg.mockReturnValue(
      '<svg xmlns="http://www.w3.org/2000/svg"><title>Plot 415</title></svg>'
    );
    mocks.storePlotDiagram.mockResolvedValue({
      url: SUCCESS_URL,
      path: "reports/rep_abc/plot-diagram-20.27269,85.70127|415|mendhasala.svg",
    });

    const result = await runPlotDiagramStep(VALID_INPUT);

    expect(result.status).toBe("success");
    expect(result.url).toBe(SUCCESS_URL);
    expect(result.cacheHit).toBe(false);
    expect(result.rendered).toBe(true);
    expect(result.reason).toBeUndefined();

    // Sub-step call order: WFS compose first, then render with the result.
    expect(mocks.fetchPlotDiagram).toHaveBeenCalledTimes(1);
    expect(mocks.renderPlotDiagramSvg).toHaveBeenCalledTimes(1);
    expect(mocks.renderPlotDiagramSvg).toHaveBeenCalledWith(
      SUCCESS_DIAGRAM,
      expect.objectContaining({ title: expect.stringContaining("415") })
    );

    // Storage upload uses the deterministic storage key, SVG content, and
    // the reportId.
    expect(mocks.storePlotDiagram).toHaveBeenCalledTimes(1);
    const uploadCall = mocks.storePlotDiagram.mock.calls[0][0];
    expect(uploadCall.reportId).toBe(VALID_INPUT.reportId);
    expect(uploadCall.svg).toContain("<svg");
    expect(uploadCall.plotDiagramKey).toBe(
      buildPlotDiagramKey(VALID_INPUT.gps, VALID_INPUT.plotNo, VALID_INPUT.village)
    );

    // Persisted on the reports row: URL, status, renderedAt.
    expect(mocks.persistedRows.length).toBe(1);
    expect(mocks.persistedRows[0]).toEqual(
      expect.objectContaining({
        plot_diagram_url: SUCCESS_URL,
        plot_diagram_status: "success",
        plot_diagram_rendered_at: expect.any(String),
      })
    );
  });

  it("maps the WFS 'partial' status through to the step result and persistence", async () => {
    mocks.fetchPlotDiagram.mockResolvedValue({ ...SUCCESS_DIAGRAM, status: "partial" });
    mocks.renderPlotDiagramSvg.mockReturnValue("<svg/>");
    mocks.storePlotDiagram.mockResolvedValue({ url: SUCCESS_URL, path: "x" });

    const result = await runPlotDiagramStep(VALID_INPUT);

    expect(result.status).toBe("partial");
    expect(result.url).toBe(SUCCESS_URL);
    expect(mocks.persistedRows[0]?.plot_diagram_status).toBe("partial");
  });
});

describe("runPlotDiagramStep — failure path", () => {
  it("returns status: 'failed' and persists a failed row when WFS compose throws", async () => {
    mocks.fetchPlotDiagram.mockRejectedValue(new Error("wfs_503_unavailable"));

    const result = await runPlotDiagramStep(VALID_INPUT);

    expect(result.status).toBe("failed");
    expect(result.url).toBeNull();
    expect(result.reason).toBe("wfs_503_unavailable");
    expect(result.cacheHit).toBe(false);
    expect(result.rendered).toBe(false);
    // We did NOT call the renderer or the storage uploader because the
    // first sub-step blew up.
    expect(mocks.renderPlotDiagramSvg).not.toHaveBeenCalled();
    expect(mocks.storePlotDiagram).not.toHaveBeenCalled();
    // We DID persist a failed row so future reruns know to retry.
    expect(mocks.persistedRows[0]).toEqual(
      expect.objectContaining({
        plot_diagram_url: null,
        plot_diagram_status: "failed",
        plot_diagram_rendered_at: expect.any(String),
      })
    );
  });

  it("returns status: 'failed' when storage upload throws", async () => {
    mocks.fetchPlotDiagram.mockResolvedValue(SUCCESS_DIAGRAM);
    mocks.renderPlotDiagramSvg.mockReturnValue("<svg/>");
    mocks.storePlotDiagram.mockRejectedValue(new Error("storage_quota_exceeded"));

    const result = await runPlotDiagramStep(VALID_INPUT);

    expect(result.status).toBe("failed");
    expect(result.url).toBeNull();
    expect(result.reason).toBe("storage_quota_exceeded");
    expect(mocks.persistedRows[0]?.plot_diagram_status).toBe("failed");
  });

  it("returns status: 'not_attempted' when target polygon is empty", async () => {
    const result = await runPlotDiagramStep({
      ...VALID_INPUT,
      targetPolygon: { type: "Polygon", coordinates: [] },
    });

    expect(result.status).toBe("not_attempted");
    expect(result.url).toBeNull();
    expect(result.reason).toBe("no_target_polygon");
    // No cache lookup, no network call, no persistence.
    expect(mocks.findCachedByReportId).not.toHaveBeenCalled();
    expect(mocks.fetchPlotDiagram).not.toHaveBeenCalled();
    expect(mocks.persistedRows.length).toBe(0);
  });

  it("returns status: 'not_attempted' when plotNo is missing", async () => {
    const result = await runPlotDiagramStep({
      ...VALID_INPUT,
      plotNo: "",
    });

    expect(result.status).toBe("not_attempted");
    expect(result.reason).toBe("missing_identifier");
    expect(mocks.fetchPlotDiagram).not.toHaveBeenCalled();
  });
});

describe("runPlotDiagramStep — cache hit by reportId", () => {
  it("returns success with the cached URL and skips compose/render/upload", async () => {
    const cachedUrl = "https://abc.supabase.co/storage/v1/object/public/plot-diagrams/reports/rep_abc/plot-diagram-cached.svg";
    mocks.findCachedByReportId.mockResolvedValue({
      url: cachedUrl,
      status: "success",
      renderedAt: new Date(Date.now() - 60_000).toISOString(),
      reportId: VALID_INPUT.reportId,
    });

    const result = await runPlotDiagramStep(VALID_INPUT);

    expect(result.status).toBe("success");
    expect(result.url).toBe(cachedUrl);
    expect(result.cacheHit).toBe(true);
    expect(result.rendered).toBe(false);

    // The expensive compose + render + upload chain is fully skipped.
    expect(mocks.fetchPlotDiagram).not.toHaveBeenCalled();
    expect(mocks.renderPlotDiagramSvg).not.toHaveBeenCalled();
    expect(mocks.storePlotDiagram).not.toHaveBeenCalled();
    // No write needed — the row is already populated.
    expect(mocks.persistedRows.length).toBe(0);
  });

  it("falls through to render when only the secondary (gps+plot+village) cache matches", async () => {
    const cachedUrl = "https://abc.supabase.co/storage/v1/object/public/plot-diagrams/reports/rep_xyz/plot-diagram-other.svg";
    mocks.findCachedByReportId.mockResolvedValue(null);
    mocks.findCachedByGps.mockResolvedValue({
      url: cachedUrl,
      status: "success",
      renderedAt: new Date(Date.now() - 60_000).toISOString(),
      reportId: "rep_xyz",
    });

    const result = await runPlotDiagramStep(VALID_INPUT);

    expect(result.status).toBe("success");
    expect(result.url).toBe(cachedUrl);
    expect(result.cacheHit).toBe(true);
    expect(mocks.fetchPlotDiagram).not.toHaveBeenCalled();
    // We DO persist on the current report row so the next rerun hits the
    // primary (reportId) cache path.
    expect(mocks.persistedRows[0]?.plot_diagram_url).toBe(cachedUrl);
  });
});

describe("runPlotDiagramStep — approximate path (MapCard v1 fallback)", () => {
  const APPROX_INPUT = {
    reportId: "rep_approx",
    gps: { lat: 20.27, lon: 85.84 },
    village: "Somevillage",
    plotNo: "415",
    fallback: {
      reason: "no_containing_polygon",
      centroid: { lat: 20.27, lon: 85.84 },
    },
  };

  it("renders a district outline SVG, uploads, and surfaces the synthesized geo", async () => {
    mocks.renderDistrictOutlineSvg.mockReturnValue(
      '<svg xmlns="http://www.w3.org/2000/svg"><title>Approximate</title></svg>'
    );
    mocks.storePlotDiagram.mockResolvedValue({
      url: SUCCESS_URL,
      path: "reports/rep_approx/approximate/plot-diagram-20.27,85.84|415|somevillage.svg",
    });

    const result = await runPlotDiagramStep(APPROX_INPUT);

    expect(result.status).toBe("success");
    expect(result.approximate).toBe(true);
    expect(result.approximateReason).toBe("no_containing_polygon");
    expect(result.url).toBe(SUCCESS_URL);
    expect(result.rendered).toBe(true);
    // The synthesized polygon is the 60m square at the village GPS.
    expect(result.targetPolygon).toBeTruthy();
    expect(result.targetPolygon?.type).toBe("Polygon");
    expect(result.bounds).toBeTruthy();
    // The precise path was NOT used.
    expect(mocks.fetchPlotDiagram).not.toHaveBeenCalled();
    expect(mocks.renderPlotDiagramSvg).not.toHaveBeenCalled();
  });

  it("uses the caller's pre-synthesized payload when present (no re-synthesis)", async () => {
    mocks.renderDistrictOutlineSvg.mockReturnValue("<svg/>");
    mocks.storePlotDiagram.mockResolvedValue({ url: SUCCESS_URL, path: "x" });

    const synthesized = {
      polygon: { type: "Polygon" as const, coordinates: [[[85.84, 20.27]]] },
      targetPolygon: { type: "Polygon" as const, coordinates: [[85.84, 20.27]] },
      centroid: { lat: 20.27, lon: 85.84 },
      bounds: { minLat: 19.8, maxLat: 20.5, minLon: 85, maxLon: 86 },
      khordhaBoundary: { data: { type: "Feature" as const, properties: { title: "" }, geometry: { type: "Polygon" as const, coordinates: [[[85, 20]]] } } },
      mode: "approximate" as const,
      reason: "no_containing_polygon",
      plotNo: "415",
      village: "Somevillage",
    };

    const result = await runPlotDiagramStep({
      ...APPROX_INPUT,
      fallback: {
        reason: "no_containing_polygon",
        centroid: { lat: 20.27, lon: 85.84 },
        synthesized,
      },
    });

    expect(result.status).toBe("success");
    expect(result.targetPolygon).toEqual(synthesized.targetPolygon);
    expect(result.bounds).toEqual(synthesized.bounds);
  });

  it("returns status: 'failed' when the district-outline renderer throws", async () => {
    mocks.renderDistrictOutlineSvg.mockImplementation(() => {
      throw new Error("renderer_bug");
    });

    const result = await runPlotDiagramStep(APPROX_INPUT);

    expect(result.status).toBe("failed");
    expect(result.reason).toBe("renderer_bug");
    expect(result.approximate).toBe(true);
    expect(result.approximateReason).toBe("no_containing_polygon");
    expect(mocks.persistedRows[0]?.plot_diagram_status).toBe("failed");
  });

  it("re-resolves the geo payload on cache hits (no WFS call)", async () => {
    mocks.findCachedByReportId.mockResolvedValue({
      url: SUCCESS_URL,
      status: "success",
      renderedAt: new Date().toISOString(),
      reportId: "rep_approx",
    });

    const result = await runPlotDiagramStep(APPROX_INPUT);

    expect(result.status).toBe("success");
    expect(result.cacheHit).toBe(true);
    expect(result.approximate).toBe(true);
    expect(result.targetPolygon).toBeTruthy();
    expect(result.bounds).toBeTruthy();
    // No WFS, no renderer call.
    expect(mocks.fetchPlotDiagram).not.toHaveBeenCalled();
    expect(mocks.renderDistrictOutlineSvg).not.toHaveBeenCalled();
  });

  it("prefixes the storage key with 'approximate/' so precise and approximate entries never collide", async () => {
    mocks.renderDistrictOutlineSvg.mockReturnValue("<svg/>");
    mocks.storePlotDiagram.mockResolvedValue({ url: SUCCESS_URL, path: "x" });

    await runPlotDiagramStep(APPROX_INPUT);

    const uploadCall = mocks.storePlotDiagram.mock.calls[0][0];
    expect(uploadCall.plotDiagramKey).toMatch(/^approximate\//);
  });
});

describe("buildPlotDiagramKey", () => {
  it("is deterministic across calls with the same inputs", () => {
    const a = buildPlotDiagramKey(
      { lat: 20.27269, lon: 85.70127 },
      "415",
      "Mendhasala"
    );
    const b = buildPlotDiagramKey(
      { lat: 20.27269, lon: 85.70127 },
      "415",
      "Mendhasala"
    );
    expect(a).toBe(b);
  });

  it("lower-cases village + plot so the same plot in the same village reuses the storage path", () => {
    const a = buildPlotDiagramKey(
      { lat: 20.27269, lon: 85.70127 },
      "415",
      "Mendhasala"
    );
    const b = buildPlotDiagramKey(
      { lat: 20.27269, lon: 85.70127 },
      " 415 ",
      "mendhasala"
    );
    expect(a).toBe(b);
  });
});

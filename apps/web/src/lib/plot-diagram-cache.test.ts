/**
 * Tests for apps/web/src/lib/plot-diagram-cache.ts
 *
 * Phase 8 (Task 35). The cache layer is a thin Supabase lookup with a
 * 7-day window. We mock the Supabase client and exercise:
 *   - buildPlotDiagramCacheKey determinism
 *   - findCachedPlotDiagramByReportId: hit / miss / expired / failed / no-row
 *   - findCachedPlotDiagramByGps: hit / miss / no polygon in row / expired
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("./db", () => ({
  getSupabaseServerClient: () => ({ from: mocks.from }),
}));

import {
  buildPlotDiagramCacheKey,
  findCachedPlotDiagramByReportId,
  findCachedPlotDiagramByGps,
  PLOT_DIAGRAM_CACHE_WINDOW_MS,
} from "./plot-diagram-cache";

// ── Helpers ──────────────────────────────────────────────────────────────

function makeChain(rows: unknown[] | null) {
  // Build a chainable mock that the cache code can use. The cache code
  // makes a sequence of calls: from().select().eq().maybeSingle() or
  // from().select().not().gte().order().limit().
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () =>
          Promise.resolve({ data: rows?.[0] ?? null, error: null }),
      }),
      maybeSingle: () =>
        Promise.resolve({ data: rows?.[0] ?? null, error: null }),
      not: () => ({
        gte: () => ({
          order: () => ({
            limit: () =>
              Promise.resolve({ data: rows ?? [], error: null }),
          }),
        }),
      }),
    }),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  mocks.from.mockReset();
});

describe("buildPlotDiagramCacheKey", () => {
  it("rounds GPS to 5 decimals and lower-cases plot/village", () => {
    const a = buildPlotDiagramCacheKey(
      { lat: 20.272687654321, lon: 85.701271234567 },
      "415",
      "Mendhasala"
    );
    expect(a).toBe("20.27269,85.70127|415|mendhasala");
  });

  it("trims whitespace from plot and village", () => {
    const a = buildPlotDiagramCacheKey(
      { lat: 20.27269, lon: 85.70127 },
      "  415  ",
      "  Mendhasala  "
    );
    expect(a).toBe("20.27269,85.70127|415|mendhasala");
  });

  it("is deterministic across calls with the same inputs", () => {
    const a = buildPlotDiagramCacheKey({ lat: 20.27269, lon: 85.70127 }, "415", "Mendhasala");
    const b = buildPlotDiagramCacheKey({ lat: 20.27269, lon: 85.70127 }, "415", "Mendhasala");
    expect(a).toBe(b);
  });
});

describe("findCachedPlotDiagramByReportId", () => {
  it("returns null when reportId is empty", async () => {
    expect(await findCachedPlotDiagramByReportId("")).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns null when the row has no plot diagram", async () => {
    mocks.from.mockReturnValueOnce(
      makeChain([{ id: "rep_a", plot_diagram_url: null, plot_diagram_status: null, plot_diagram_rendered_at: null }])
    );

    expect(await findCachedPlotDiagramByReportId("rep_a")).toBeNull();
  });

  it("returns the cached row when fresh + success", async () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    mocks.from.mockReturnValueOnce(
      makeChain([
        {
          id: "rep_a",
          plot_diagram_url: "https://x.supabase.co/.../diagram.svg",
          plot_diagram_status: "success",
          plot_diagram_rendered_at: recent,
        },
      ])
    );

    const cached = await findCachedPlotDiagramByReportId("rep_a");
    expect(cached).toEqual({
      url: "https://x.supabase.co/.../diagram.svg",
      status: "success",
      renderedAt: recent,
      reportId: "rep_a",
    });
  });

  it("returns null when the cached row is older than 7 days", async () => {
    const stale = new Date(Date.now() - PLOT_DIAGRAM_CACHE_WINDOW_MS - 60_000).toISOString();
    mocks.from.mockReturnValueOnce(
      makeChain([
        {
          id: "rep_a",
          plot_diagram_url: "https://x/.../old.svg",
          plot_diagram_status: "success",
          plot_diagram_rendered_at: stale,
        },
      ])
    );

    expect(await findCachedPlotDiagramByReportId("rep_a")).toBeNull();
  });

  it("returns null when the cached row is in a failed state", async () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    mocks.from.mockReturnValueOnce(
      makeChain([
        {
          id: "rep_a",
          plot_diagram_url: null,
          plot_diagram_status: "failed",
          plot_diagram_rendered_at: recent,
        },
      ])
    );

    expect(await findCachedPlotDiagramByReportId("rep_a")).toBeNull();
  });
});

describe("findCachedPlotDiagramByGps", () => {
  it("returns null when plotNo or village is empty", async () => {
    expect(await findCachedPlotDiagramByGps({ lat: 20.27269, lon: 85.70127 }, "", "Mendhasala")).toBeNull();
    expect(await findCachedPlotDiagramByGps({ lat: 20.27269, lon: 85.70127 }, "415", "")).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns the first matching recent row (gps + plot# + village match)", async () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    const matchingRow = {
      id: "rep_xyz",
      plot_diagram_url: "https://x/.../cached.svg",
      plot_diagram_status: "success",
      plot_diagram_rendered_at: recent,
      plot_description: "Mendhasala|415",
      gps_lat: 20.27269,
      gps_lon: 85.70127,
    };
    mocks.from.mockReturnValueOnce(makeChain([matchingRow]));

    const cached = await findCachedPlotDiagramByGps(
      { lat: 20.27269, lon: 85.70127 },
      "415",
      "Mendhasala"
    );

    expect(cached).toEqual({
      url: "https://x/.../cached.svg",
      status: "success",
      renderedAt: recent,
      reportId: "rep_xyz",
    });
  });

  it("skips rows whose rounded GPS does not match", async () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    mocks.from.mockReturnValueOnce(
      makeChain([
        {
          id: "rep_xyz",
          plot_diagram_url: "https://x/.../other.svg",
          plot_diagram_status: "success",
          plot_diagram_rendered_at: recent,
          plot_description: "Mendhasala|415",
          gps_lat: 20.99999, // different GPS
          gps_lon: 85.99999,
        },
      ])
    );

    expect(
      await findCachedPlotDiagramByGps(
        { lat: 20.27269, lon: 85.70127 },
        "415",
        "Mendhasala"
      )
    ).toBeNull();
  });

  it("skips rows whose plot# or village does not match", async () => {
    const recent = new Date(Date.now() - 60_000).toISOString();
    mocks.from.mockReturnValueOnce(
      makeChain([
        {
          id: "rep_xyz",
          plot_diagram_url: "https://x/.../other.svg",
          plot_diagram_status: "success",
          plot_diagram_rendered_at: recent,
          plot_description: "Mendhasala|999", // different plot#
          gps_lat: 20.27269,
          gps_lon: 85.70127,
        },
      ])
    );

    expect(
      await findCachedPlotDiagramByGps(
        { lat: 20.27269, lon: 85.70127 },
        "415",
        "Mendhasala"
      )
    ).toBeNull();
  });
});

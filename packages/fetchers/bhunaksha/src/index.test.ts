import { describe, it, expect, beforeEach, vi } from "vitest";

let bhunakshaFetch: typeof import("./index").bhunakshaFetch;
let healthCheck: typeof import("./index").healthCheck;
let computePolygonAreaSqKm: typeof import("./index").computePolygonAreaSqKm;
const mockFetch = vi.fn();

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.stubGlobal("fetch", mockFetch);
  const mod = await import("./index");
  bhunakshaFetch = mod.bhunakshaFetch;
  healthCheck = mod.healthCheck;
  computePolygonAreaSqKm = mod.computePolygonAreaSqKm;
});

describe("bhunaksha fetcher", () => {
  describe("pointInPolygon", () => {
    it("returns success when point is inside square polygon", async () => {
      const wfsResponse = {
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            id: "f1",
            geometry: {
              type: "Polygon" as const,
              coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
            },
            properties: {
              revenue_plot: "123",
              revenue_village_name: "TestVillage",
              tehsil_name: "Bhubaneswar",
              revenue_village_code: "123456",
            },
          },
        ],
        totalFeatures: 1,
        numberReturned: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(wfsResponse),
      });

      const result = await bhunakshaFetch({ lat: 0.5, lon: 0.5 });
      expect(result.status).toBe("success");
      expect(result.data?.plotNo).toBe("123");
      expect(result.data?.village).toBe("TestVillage");
      expect(result.data?.areaUnit).toBe("sq_km");
    });

    it("computes area from polygon coordinates and keeps shape_area as raw degrees metadata", async () => {
      const coords = [[85.7, 20.27], [85.701, 20.27], [85.701, 20.271], [85.7, 20.271], [85.7, 20.27]];
      const wfsResponse = {
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            id: "area-test",
            geometry: {
              type: "Polygon" as const,
              coordinates: [coords],
            },
            properties: {
              revenue_plot: "area-plot",
              revenue_village_name: "Mendhasala",
              tehsil_name: "Bhubaneswar",
              shape_area: 999999,
            },
          },
        ],
        totalFeatures: 1,
        numberReturned: 1,
        crs: { type: "name", properties: { name: "urn:ogc:def:crs:EPSG::4326" } },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(wfsResponse),
      });

      const result = await bhunakshaFetch({ lat: 20.2705, lon: 85.7005 });
      const expectedSqKm = computePolygonAreaSqKm(coords);

      expect(result.status).toBe("success");
      expect(result.data?.area).toBeCloseTo(expectedSqKm, 8);
      expect(result.data?.area).not.toBe(999999);
      expect(result.data?.shapeAreaRaw).toBe(999999);
      expect(result.data?.shapeAreaUnit).toBe("degrees2");
      expect(result.data?.crs).toBe("urn:ogc:def:crs:EPSG::4326");
      expect(result.data?.featureId).toBe("area-test");
      expect(result.data?.layer).toBe("khurda_bhubaneswar");
      expect(result.data?.geometryHash).toMatch(/^[a-f0-9]{64}$/);
      expect(result.data?.areaComputation).toBe("turf_geodesic_area_v1");
    });

    it("returns partial when point is outside all returned polygons", async () => {
      const wfsResponse = {
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            id: "f1",
            geometry: {
              type: "Polygon" as const,
              coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
            },
            properties: {
              revenue_plot: "456",
              revenue_village_name: "FarVillage",
              tehsil_name: "Bhubaneswar",
              revenue_village_code: "654321",
            },
          },
        ],
        totalFeatures: 1,
        numberReturned: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(wfsResponse),
      });

      const result = await bhunakshaFetch({ lat: 50, lon: 50, searchRadius: 0.005 });
      expect(result.status).toBe("partial");
      expect(result.verification).toBe("manual_required");
      expect(result.statusReason).toBe("point_outside_returned_polygons");
      expect(result.data?.plotNo).toBe("");
      expect(result.data?.village).toBe("");
      expect(result.data?.polygon).toBeUndefined();
    });

    it("does not select a nearest polygon when the returned WFS candidate page is truncated", async () => {
      const wfsResponse = {
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            id: "far",
            geometry: {
              type: "Polygon" as const,
              coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
            },
            properties: {
              revenue_plot: "nearest-but-not-containing",
              revenue_village_name: "FarVillage",
              tehsil_name: "Bhubaneswar",
            },
          },
        ],
        totalFeatures: 999,
        numberReturned: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(wfsResponse),
      });

      const result = await bhunakshaFetch({ lat: 50, lon: 50, searchRadius: 0.005 });
      expect(result.status).toBe("partial");
      expect(result.statusReason).toBe("candidate_truncated_no_containing_polygon");
      expect(result.data?.plotNo).toBe("");
      expect(result.warnings?.some((warning) => warning.code === "candidate_truncated")).toBe(true);
    });

    it("returns partial when no features returned", async () => {
      const emptyResponse = {
        type: "FeatureCollection" as const,
        features: [],
        totalFeatures: 0,
        numberReturned: 0,
      };
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(emptyResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(emptyResponse),
        });

      const result = await bhunakshaFetch({ lat: 20.272688, lon: 85.701271 });
      expect(result.status).toBe("partial");
      expect(result.verification).toBe("manual_required");
      expect(result.data?.plotNo).toBe("");
      expect(result.statusReason).toBe("no_features_returned");
      expect(result.inputsTried).toHaveLength(2);
      expect(result.warnings?.some((warning) => warning.code === "empty_initial_bbox_retry")).toBe(true);
    });

    it("retries with a larger BBOX when the first response is empty", async () => {
      const expandedResponse = {
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            id: "expanded.1",
            geometry: {
              type: "Polygon" as const,
              coordinates: [[[85.69, 20.26], [85.71, 20.26], [85.71, 20.28], [85.69, 20.28], [85.69, 20.26]]],
            },
            properties: {
              revenue_plot: "789",
              revenue_village_name: "RetryVillage",
              tehsil_name: "Bhubaneswar",
              revenue_village_code: "987654",
            },
          },
        ],
        totalFeatures: 1,
        numberReturned: 1,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              type: "FeatureCollection" as const,
              features: [],
              totalFeatures: 0,
              numberReturned: 0,
            }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(expandedResponse),
        });

      const result = await bhunakshaFetch({ lat: 20.27, lon: 85.70, searchRadius: 0.005 });

      expect(result.status).toBe("success");
      expect(result.data?.plotNo).toBe("789");
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[0][0]).toContain("BBOX=85.6950,20.2650,85.7050,20.2750");
      expect(mockFetch.mock.calls[1][0]).toContain("BBOX=85.6800,20.2500,85.7200,20.2900");
      expect(result.inputsTried?.map((attempt) => attempt.label)).toEqual(["initial_bbox", "expanded_bbox"]);
    });

    it("selects the smallest polygon when multiple candidates contain the GPS point", async () => {
      const wfsResponse = {
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            id: "large",
            geometry: {
              type: "Polygon" as const,
              coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
            },
            properties: {
              revenue_plot: "large-plot",
              revenue_village_name: "LargeVillage",
              tehsil_name: "Bhubaneswar",
              revenue_village_code: "111111",
            },
          },
          {
            type: "Feature" as const,
            id: "small",
            geometry: {
              type: "Polygon" as const,
              coordinates: [[[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]]],
            },
            properties: {
              revenue_plot: "small-plot",
              revenue_village_name: "SmallVillage",
              tehsil_name: "Bhubaneswar",
              revenue_village_code: "222222",
            },
          },
        ],
        totalFeatures: 2,
        numberReturned: 2,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(wfsResponse),
      });

      const result = await bhunakshaFetch({ lat: 5, lon: 5 });

      expect(result.status).toBe("success");
      expect(result.data?.plotNo).toBe("small-plot");
      expect(result.warnings?.some((warning) => warning.code === "multiple_containing_polygons")).toBe(true);
    });
  });

  describe("error handling", () => {
    it("returns failed status on network error", async () => {
      mockFetch.mockRejectedValue(new Error("Connection refused"));

      const result = await bhunakshaFetch({ lat: 20.272688, lon: 85.701271 });
      expect(result.status).toBe("failed");
      expect(result.error).toContain("Connection refused");
    });

    it("returns failed status on HTTP error", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await bhunakshaFetch({ lat: 20.272688, lon: 85.701271 });
      expect(result.status).toBe("failed");
      expect(result.error).toContain("500");
    });
  });

  describe("custom layer", () => {
    it("uses custom layer in URL", async () => {
      const emptyResponse = {
        type: "FeatureCollection" as const,
        features: [],
        totalFeatures: 0,
        numberReturned: 0,
      };
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(emptyResponse),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(emptyResponse),
        });

      await bhunakshaFetch({ lat: 20.27, lon: 85.70, layer: "baleswar_baleswar" });
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("TYPENAME=revenue:baleswar_baleswar");
    });
  });

  describe("healthCheck", () => {
    it("returns true when GeoServer responds", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const result = await healthCheck();
      expect(result).toBe(true);
    });

    it("returns false on error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("timeout"));
      const result = await healthCheck();
      expect(result).toBe(false);
    });
  });

  describe("live-gated area regression", () => {
    it.skipIf(process.env.CLEARDEED_LIVE_BHUNAKSHA_AREA !== "1" || !process.env.CLEARDEED_LIVE_BHULEKH_AREA_ACRES)(
      "fetches live WFS, computes Turf area, and compares to an observed Bhulekh target plot area",
      async () => {
        vi.unstubAllGlobals();

        const lat = Number(process.env.CLEARDEED_LIVE_BHUNAKSHA_LAT ?? "20.272688");
        const lon = Number(process.env.CLEARDEED_LIVE_BHUNAKSHA_LON ?? "85.701271");
        const targetBhulekhAcres = Number(process.env.CLEARDEED_LIVE_BHULEKH_AREA_ACRES);
        expect(Number.isFinite(targetBhulekhAcres)).toBe(true);

        const result = await bhunakshaFetch({ lat, lon });
        expect(result.status).toBe("success");
        expect(result.data?.polygon?.coordinates?.[0]).toBeTruthy();

        const turfSqKm = computePolygonAreaSqKm(result.data!.polygon!.coordinates[0]);
        const turfAcres = turfSqKm * 247.10538146717;
        const discrepancyPct = Math.abs(turfAcres - targetBhulekhAcres) / targetBhulekhAcres * 100;

        expect(result.data?.areaUnit).toBe("sq_km");
        expect(result.data?.shapeAreaUnit).toBe("degrees2");
        expect(result.data?.area).toBeCloseTo(turfSqKm, 8);
        expect(result.data?.area).not.toBe(result.data?.shapeAreaRaw);
        expect(discrepancyPct).toBeLessThanOrEqual(5);
      }
    );
  });
});

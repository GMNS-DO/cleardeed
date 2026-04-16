import { describe, it, expect, beforeEach, vi } from "vitest";

let bhunakshaFetch: typeof import("./index").bhunakshaFetch;
let healthCheck: typeof import("./index").healthCheck;
const mockFetch = vi.fn();

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.stubGlobal("fetch", mockFetch);
  const mod = await import("./index");
  bhunakshaFetch = mod.bhunakshaFetch;
  healthCheck = mod.healthCheck;
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
    });

    it("returns partial when no features returned", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            type: "FeatureCollection" as const,
            features: [],
            totalFeatures: 0,
            numberReturned: 0,
          }),
      });

      const result = await bhunakshaFetch({ lat: 20.272688, lon: 85.701271 });
      expect(result.status).toBe("partial");
      expect(result.verification).toBe("manual_required");
      expect(result.data?.plotNo).toBe("");
    });
  });

  describe("error handling", () => {
    it("returns failed status on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const result = await bhunakshaFetch({ lat: 20.272688, lon: 85.701271 });
      expect(result.status).toBe("failed");
      expect(result.error).toContain("Connection refused");
    });

    it("returns failed status on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce({
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            type: "FeatureCollection" as const,
            features: [],
            totalFeatures: 0,
            numberReturned: 0,
          }),
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
});
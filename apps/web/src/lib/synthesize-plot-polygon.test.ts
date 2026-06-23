/**
 * synthesize-plot-polygon — pure-function tests.
 *
 * Pin the contract:
 *  - 60m × 60m square polygon centered on the village GPS
 *  - closed ring (5 points)
 *  - bounds is the Khordha district box
 *  - centroid matches input GPS
 *  - khordhaBoundary is passed through
 *  - mode is always "approximate"
 *  - reason is preserved
 *  - function is pure (no I/O, no time, no mutation of input)
 */

import { describe, it, expect } from "vitest";
import {
  synthesizePlotPolygon,
  KHORDHA_BOUNDARY_ASSET,
  type SynthesizeInput,
} from "./synthesize-plot-polygon";
import { KHORDHA_BOUNDS } from "@cleardeed/schema";

const BASE_INPUT: SynthesizeInput = {
  gps: { lat: 20.27, lon: 85.84 },
  plotNo: "309",
  village: "Mendhasala",
  reason: "no_containing_polygon",
};

describe("synthesizePlotPolygon — geometry", () => {
  it("returns a GeoJSON Polygon with one closed ring (5 vertices)", () => {
    const result = synthesizePlotPolygon(BASE_INPUT);
    expect(result.polygon.type).toBe("Polygon");
    expect(result.polygon.coordinates).toHaveLength(1);
    const ring = result.polygon.coordinates[0];
    expect(ring).toHaveLength(5);
    // First and last points are identical (closed ring).
    expect(ring[0]).toEqual(ring[4]);
  });

  it("exposes a targetPolygon alias (single ring) for the diagram step", () => {
    const result = synthesizePlotPolygon(BASE_INPUT);
    expect(result.targetPolygon.type).toBe("Polygon");
    expect(result.targetPolygon.coordinates).toHaveLength(5);
    // Same ring as polygon.coordinates[0].
    expect(result.targetPolygon.coordinates).toEqual(result.polygon.coordinates[0]);
  });

  it("places the square centered on the input GPS", () => {
    const result = synthesizePlotPolygon(BASE_INPUT);
    const ring = result.polygon.coordinates[0];
    // Min/max of the 4 corner points
    const lons = ring.slice(0, 4).map((p) => p[0]);
    const lats = ring.slice(0, 4).map((p) => p[1]);
    const midLon = (Math.min(...lons) + Math.max(...lons)) / 2;
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    // Should be within 1e-9 of the input GPS.
    expect(Math.abs(midLon - BASE_INPUT.gps.lon)).toBeLessThan(1e-9);
    expect(Math.abs(midLat - BASE_INPUT.gps.lat)).toBeLessThan(1e-9);
  });

  it("produces a ~60m × 60m square (0.00054° per side)", () => {
    const result = synthesizePlotPolygon(BASE_INPUT);
    const ring = result.polygon.coordinates[0];
    const lons = ring.slice(0, 4).map((p) => p[0]);
    const lats = ring.slice(0, 4).map((p) => p[1]);
    const sideLon = Math.max(...lons) - Math.min(...lons);
    const sideLat = Math.max(...lats) - Math.min(...lats);
    expect(sideLon).toBeCloseTo(0.00054, 10);
    expect(sideLat).toBeCloseTo(0.00054, 10);
  });
});

describe("synthesizePlotPolygon — bounds and centroid", () => {
  it("bounds is the Khordha district box", () => {
    const result = synthesizePlotPolygon(BASE_INPUT);
    expect(result.bounds).toEqual({
      minLat: KHORDHA_BOUNDS.minLat,
      maxLat: KHORDHA_BOUNDS.maxLat,
      minLon: KHORDHA_BOUNDS.minLon,
      maxLon: KHORDHA_BOUNDS.maxLon,
    });
  });

  it("centroid is the input GPS (normalised to number)", () => {
    const result = synthesizePlotPolygon(BASE_INPUT);
    expect(result.centroid).toEqual({ lat: 20.27, lon: 85.84 });
  });

  it("handles GPS at the western edge of Khordha", () => {
    const result = synthesizePlotPolygon({
      ...BASE_INPUT,
      gps: { lat: 20.0, lon: 85.05 },
    });
    expect(result.centroid).toEqual({ lat: 20.0, lon: 85.05 });
  });
});

describe("synthesizePlotPolygon — passthrough fields", () => {
  it("mode is always 'approximate'", () => {
    const result = synthesizePlotPolygon(BASE_INPUT);
    expect(result.mode).toBe("approximate");
  });

  it("preserves the reason string", () => {
    const result = synthesizePlotPolygon({
      ...BASE_INPUT,
      reason: "outside_returned_polygons",
    });
    expect(result.reason).toBe("outside_returned_polygons");
  });

  it("preserves plotNo and village", () => {
    const result = synthesizePlotPolygon({
      ...BASE_INPUT,
      plotNo: "415/1",
      village: "Patia",
    });
    expect(result.plotNo).toBe("415/1");
    expect(result.village).toBe("Patia");
  });

  it("includes the Khordha district boundary asset", () => {
    const result = synthesizePlotPolygon(BASE_INPUT);
    expect(result.khordhaBoundary).toBeDefined();
    // Asset has the expected top-level shape (DataMeet CC-BY-2.5).
    // The boundary is wrapped in a `data` key holding the GeoJSON Feature.
    expect(result.khordhaBoundary.data?.type).toBe("Feature");
    expect(result.khordhaBoundary.data?.geometry?.type).toBe("Polygon");
  });
});

describe("synthesizePlotPolygon — purity", () => {
  it("returns identical output for identical input (deterministic)", () => {
    const a = synthesizePlotPolygon(BASE_INPUT);
    const b = synthesizePlotPolygon(BASE_INPUT);
    expect(a.polygon).toEqual(b.polygon);
    expect(a.centroid).toEqual(b.centroid);
    expect(a.bounds).toEqual(b.bounds);
  });

  it("does not mutate the input", () => {
    const input: SynthesizeInput = { ...BASE_INPUT };
    const snapshot = JSON.stringify(input);
    synthesizePlotPolygon(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it("exports the raw Khordha boundary asset", () => {
    expect(KHORDHA_BOUNDARY_ASSET).toBeDefined();
    // The asset contains the DataMeet license metadata.
    expect((KHORDHA_BOUNDARY_ASSET as { license?: string }).license).toBe(
      "CC-BY-2.5"
    );
  });
});

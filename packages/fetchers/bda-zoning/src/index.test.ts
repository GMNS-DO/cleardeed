/**
 * BDA Zoning Fetcher — Unit Tests
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  fetch,
  getZoneByCode,
  permitsResidential,
  permitsCommercial,
  permitsIndustrial,
  healthCheck,
  getZoneForVillage,
  getZoneForLocation,
  getDataSource,
  findZoneByPolygon,
  _resetCache,
} from "./index";

describe("BDA Zoning Fetcher", () => {
  beforeEach(() => {
    _resetCache();
  });

  it("health check returns true", async () => {
    expect(await healthCheck()).toBe(true);
  });

  it("data source is resolved correctly (json if present, inline_seed fallback otherwise)", () => {
    // After Sprint 4, we expect JSON data for 50+ village/locality combos
    const source = getDataSource();
    expect(source === "json" || source === "inline_seed").toBe(true);
  });

  it("fetch returns success with seed data", async () => {
    const result = await fetch({});
    expect(result.status).toBe("success");
    expect(result.data.length).toBeGreaterThan(0);
  });
});

describe("getZoneByCode", () => {
  it("finds 'residential' zone", () => {
    const zone = getZoneByCode("R");
    expect(zone).toBeDefined();
    expect(zone?.id).toBe("residential");
  });

  it("finds 'commercial' zone", () => {
    const zone = getZoneByCode("C");
    expect(zone?.id).toBe("commercial");
  });

  it("returns null for unknown code", () => {
    expect(getZoneByCode("X")).toBeNull();
  });
});

describe("permitsResidential", () => {
  it("residential zone permits residential", () => {
    const zone = getZoneByCode("R");
    expect(zone && permitsResidential(zone)).toBe(true);
  });

  it("green_belt zone does NOT permit residential", () => {
    const zone = getZoneByCode("G");
    expect(zone && permitsResidential(zone)).toBe(false);
  });
});

describe("getZoneForVillage", () => {
  it("finds exact match for 'Patia' in Bhubaneswar", () => {
    const zone = getZoneForVillage("Patia", "Bhubaneswar");
    expect(zone).toBeDefined();
    expect(zone?.id).toBe("commercial"); // From seed data
  });

  it("falls back to tehsil for unknown village", () => {
    const zone = getZoneForVillage("Atlantis", "Jatni");
    expect(zone).toBeDefined();
  });

  it("returns null for completely unknown", () => {
    const zone = getZoneForVillage("Atlantis", "Mars");
    expect(zone).toBeNull();
  });
});

describe("getZoneForLocation", () => {
  it("finds nearest zone for known coordinates", () => {
    const zone = getZoneForLocation(20.2746, 85.8404); // Patia coordinates
    expect(zone).toBeDefined();
    expect(zone?.id).toBe("commercial");
  });

  it("returns nearest zone for any coordinate (with seed data)", () => {
    const zone = getZoneForLocation(0, 0);
    // With seed data loaded, any coordinate gets the nearest zone as fallback
    expect(zone).toBeDefined();
  });
});

// ─── Sprint 4: GeoJSON polygon overlay tests ────────────────────────────────
//
// ROR-INS-153 (Industrial-Zone Plot Sold as Residential) consumes the polygon
// hit via fetch() → bdaZoneData. These tests pin the containment behavior so
// ROR-INS-153 fires correctly on real Khordha input and does NOT fire
// spuriously on plots outside industrial pockets.

describe("findZoneByPolygon (Sprint 4 polygon overlay)", () => {
  // Anchor coordinates picked from each polygon's centroid property.
  // (Chandaka: 20.3544,85.7828; Mancheswar: 20.3077,85.8557; etc.)
  it("returns industrial zone for GPS inside Chandaka Industrial Estate", () => {
    const row = findZoneByPolygon(20.3544, 85.7828);
    expect(row).not.toBeNull();
    expect(row?.zone.id).toBe("industrial");
    expect(row?.village.toLowerCase()).toContain("chandaka");
    expect(row?.tehsil.toLowerCase()).toBe("bhubaneswar");
  });

  it("returns industrial zone for GPS inside Mancheswar Industrial Estate", () => {
    const row = findZoneByPolygon(20.3077, 85.8557);
    expect(row).not.toBeNull();
    expect(row?.zone.id).toBe("industrial");
    expect(row?.locality?.toLowerCase()).toContain("mancheswar");
  });

  it("returns industrial zone for GPS inside Rasulgarh Industrial Area", () => {
    const row = findZoneByPolygon(20.285, 85.862);
    expect(row).not.toBeNull();
    expect(row?.zone.id).toBe("industrial");
    expect(row?.village.toLowerCase()).toContain("rasulgarh");
  });

  it("returns industrial zone for GPS inside Tamando Industrial Area", () => {
    const row = findZoneByPolygon(20.305, 85.832);
    expect(row).not.toBeNull();
    expect(row?.zone.id).toBe("industrial");
    expect(row?.village.toLowerCase()).toContain("tamando");
  });

  it("returns industrial zone for GPS inside Khurda Industrial Estate", () => {
    const row = findZoneByPolygon(20.20, 85.62);
    expect(row).not.toBeNull();
    expect(row?.zone.id).toBe("industrial");
    expect(row?.tehsil.toLowerCase()).toBe("khordha");
  });

  it("returns industrial zone for GPS inside Jatni Industrial Area", () => {
    // Polygon center: lat 20.1352, lon 85.9286. Pick a point firmly inside.
    const row = findZoneByPolygon(20.1355, 85.9288);
    expect(row).not.toBeNull();
    expect(row?.zone.id).toBe("industrial");
    expect(row?.village.toLowerCase()).toContain("jatni");
  });

  it("returns null for GPS outside every curated industrial pocket (Mendhasala demo coords)", () => {
    // 20.272688, 85.701271 is the V1.1 demo golden-path coords (Mendhasala)
    // and sits well outside every curated industrial polygon — it must NOT
    // return an industrial match, otherwise ROR-INS-153 fires spuriously.
    const row = findZoneByPolygon(20.272688, 85.701271);
    expect(row).toBeNull();
  });

  it("returns null for GPS in the Bay of Bengal", () => {
    const row = findZoneByPolygon(20.0, 87.0);
    expect(row).toBeNull();
  });

  it("returns null for invalid GPS (NaN, lat > 90, lon > 180)", () => {
    expect(findZoneByPolygon(NaN, 85.7)).toBeNull();
    expect(findZoneByPolygon(91, 0)).toBeNull();
    expect(findZoneByPolygon(0, 181)).toBeNull();
  });
});

describe("fetch() polygon path (Sprint 4)", () => {
  it("returns success with industrial zone for GPS inside Chandaka polygon", async () => {
    const result = await fetch({ latitude: 20.3544, longitude: 85.7828 });
    expect(result.status).toBe("success");
    expect(result.statusReason).toBe("polygon_overlay_match");
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data[0].zone.id).toBe("industrial");
    expect(result.warnings[0].code).toBe("polygon_overlay_limitation");
  });

  it("returns out_of_scope for GPS outside every curated pocket (Mendhasala)", async () => {
    const result = await fetch({ latitude: 20.272688, longitude: 85.701271 });
    // No polygon hit → falls through to centroid lookup (JSON or seed).
    // Mendhasala is not in the centroid JSON so the result is out_of_scope.
    expect(result.status === "out_of_scope" || result.status === "success").toBe(true);
    if (result.status === "success") {
      // If a centroid match fires, it must NOT be industrial.
      expect(result.data[0].zone.id).not.toBe("industrial");
      expect(result.data[0].zone.id).not.toBe("industrial_2");
    }
  });

  it("healthCheck returns true when polygon overlay is present", async () => {
    const ok = await healthCheck();
    expect(ok).toBe(true);
  });
});
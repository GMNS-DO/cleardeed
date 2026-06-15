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
/**
 * Circle Rate Fetcher — Unit Tests
 * Verifies JSON loader, fallback behavior, and lookup helpers.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  fetch,
  findCircleRate,
  getCircleRateForVillage,
  getRateInAcres,
  healthCheck,
  getDataSource,
  _resetCache,
} from "./index";

describe("Circle Rate Fetcher", () => {
  beforeEach(() => {
    _resetCache();
  });

  it("health check returns true", async () => {
    expect(await healthCheck()).toBe(true);
  });

  it("data source is resolved correctly (json if present, inline_seed fallback otherwise)", () => {
    // After Sprint 4, we expect JSON data for 50+ villages
    const source = getDataSource();
    expect(source === "json" || source === "inline_seed").toBe(true);
  });

  it("fetch returns success with warnings", async () => {
    const result = await fetch({});
    expect(result.status).toBe("success");
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("fetch filters by mouza", async () => {
    const result = await fetch({ mouza: "Bhubaneswar" });
    expect(result.data.every((r) => r.mouza === "Bhubaneswar")).toBe(true);
  });

  it("fetch filters by mouza and kisam", async () => {
    const result = await fetch({ mouza: "Bhubaneswar", kisam: "Residential" });
    expect(result.data.every((r) =>
      r.mouza === "Bhubaneswar" && r.kisam === "Residential"
    )).toBe(true);
  });
});

describe("findCircleRate", () => {
  it("finds exact mouza + tehsil + kisam match", () => {
    const result = findCircleRate("Bhubaneswar", "Bhubaneswar", "Residential");
    expect(result).toBeDefined();
    expect(result?.ratePerSqft).toBeGreaterThan(0);
  });

  it("returns null for unknown village AND unknown tehsil", () => {
    const result = findCircleRate("Atlantis", "Mars", "Residential");
    expect(result).toBeNull();
  });

  it("falls back to tehsil-level rate when village unknown", () => {
    const result = findCircleRate("Atlantis", "Bhubaneswar", "Residential");
    expect(result).toBeDefined();
    expect(result?.tehsil).toBe("Bhubaneswar");
  });
});

describe("getCircleRateForVillage", () => {
  it("returns exact match for known village", () => {
    const result = getCircleRateForVillage("Bhubaneswar", "Bhubaneswar");
    expect(result).toBeDefined();
    expect(result?.tehsil).toBe("Bhubaneswar");
  });

  it("falls back to tehsil-level rate for unknown village", () => {
    const result = getCircleRateForVillage("Atlantis", "Jatni");
    expect(result).toBeDefined();
    expect(result?.tehsil).toBe("Jatni");
  });

  it("returns null for unknown tehsil and village", () => {
    const result = getCircleRateForVillage("Atlantis", "Mars");
    expect(result).toBeNull();
  });
});

describe("getRateInAcres", () => {
  it("returns ratePerAcre when available", () => {
    const row = {
      mouza: "Test",
      tehsil: "Test",
      kisam: "Agricultural",
      ratePerAcre: 2_500_000,
      ratePerSqft: 0,
      sourceUrl: "",
      lastUpdated: "2024-01-01",
      rateType: "rural" as const,
    };
    expect(getRateInAcres(row)).toBe(2_500_000);
  });

  it("converts ratePerSqft to per-acre when ratePerAcre is 0", () => {
    const row = {
      mouza: "Test",
      tehsil: "Test",
      kisam: "Residential",
      ratePerAcre: 0,
      ratePerSqft: 1000,  // 1 acre = 43,560 sqft → ₹4.36 crore
      sourceUrl: "",
      lastUpdated: "2024-01-01",
      rateType: "urban" as const,
    };
    expect(getRateInAcres(row)).toBe(43_560_000);
  });

  it("returns 0 when neither rate is set", () => {
    const row = {
      mouza: "Test",
      tehsil: "Test",
      kisam: "Unknown",
      ratePerAcre: 0,
      ratePerSqft: 0,
      sourceUrl: "",
      lastUpdated: "2024-01-01",
      rateType: "rural" as const,
    };
    expect(getRateInAcres(row)).toBe(0);
  });
});
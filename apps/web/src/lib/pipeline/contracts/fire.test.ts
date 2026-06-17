/**
 * Tests for the typed `isSourceFired` gate.
 *
 * This gate replaces the scattered `source.status === "success"` string
 * comparisons that the consumer-report-writer and output-auditor currently
 * use. Each test below corresponds to a real decision the report must
 * make: is a source's data trustworthy enough to surface as a fact?
 */
import { describe, it, expect } from "vitest";
import {
  isSourceFired,
  ALL_SOURCE_IDS,
  type FireResult,
} from "./fire";

describe("isSourceFired — public surface", () => {
  it("exports a function", () => {
    expect(typeof isSourceFired).toBe("function");
  });

  it("exposes the full list of 17 source ids", () => {
    expect(ALL_SOURCE_IDS.length).toBe(17);
    // Sanity: every known source id is included.
    const set = new Set(ALL_SOURCE_IDS);
    for (const id of [
      "nominatim",
      "bhunaksha",
      "bhulekh",
      "bhunaksha-plot-report",
      "ecourts",
      "rccms",
      "igr-ec",
      "igr-sro",
      "cersai",
      "circle-rate",
      "bda-zoning",
      "igr-bmv",
      "stamp-duty",
      "igr-daily-bulletin",
      "public-dashboard",
      "govt-fee",
      "igr-certified-copy",
    ]) {
      expect(set.has(id as any)).toBe(true);
    }
  });
});

describe("isSourceFired — gating semantics", () => {
  it("returns fired=false when status is not 'ok'", () => {
    const result: FireResult = isSourceFired("nominatim", {
      source: "nominatim",
      status: "source_down",
      data: { village: "Mendhasal" },
    });
    expect(result.fired).toBe(false);
    expect(result.reason).toMatch(/status/);
  });

  it("returns fired=false when status='ok' but data is missing", () => {
    const result = isSourceFired("nominatim", {
      source: "nominatim",
      status: "ok",
    });
    expect(result.fired).toBe(false);
  });

  it("returns fired=true for nominatim when status=ok and data has a village", () => {
    const result = isSourceFired("nominatim", {
      source: "nominatim",
      status: "ok",
      data: { village: "Mendhasal", district: "Khordha" },
    });
    expect(result.fired).toBe(true);
    if (result.fired) {
      expect(result.envelope.data.village).toBe("Mendhasal");
    }
  });

  it("returns fired=true for bhulekh when tenants are present", () => {
    const result = isSourceFired("bhulekh", {
      source: "bhulekh",
      status: "ok",
      data: {
        khataNo: "830",
        village: "Mendhasal",
        tenants: [
          { tenantName: "Rama", surveyNo: "309", area: 0.5, landClass: "Danda" },
        ],
      },
    });
    expect(result.fired).toBe(true);
    if (result.fired) {
      expect(result.envelope.data.tenants.length).toBe(1);
      expect(result.envelope.data.khataNo).toBe("830");
    }
  });

  it("returns fired=false for bhulekh when tenants is empty", () => {
    const result = isSourceFired("bhulekh", {
      source: "bhulekh",
      status: "ok",
      data: { khataNo: "830", village: "Mendhasal", tenants: [] },
    });
    expect(result.fired).toBe(false);
  });

  it("returns fired=true for rccms when case list is present (even empty list is a valid 'no data' result)", () => {
    const result = isSourceFired("rccms", {
      source: "rccms",
      status: "ok",
      data: { cases: [], total: 0 },
    });
    expect(result.fired).toBe(true);
  });

  it("returns fired=true for govt-fee with permanent typed cache", () => {
    const result = isSourceFired("govt-fee", {
      source: "govt-fee",
      status: "ok",
      data: {
        schedule: { deedType: "Sale" },
      },
    });
    expect(result.fired).toBe(true);
  });

  it("returns fired=false for unknown result shape (defensive)", () => {
    const result = isSourceFired("nominatim", null);
    expect(result.fired).toBe(false);
  });

  it("returns fired=false when the source id does not match the envelope's source field", () => {
    // Defensive: an envelope labelled "nominatim" with "ok" status but typed
    // for bhulekh (with tenants) must not silently pass. The gate checks the
    // source identity as part of the narrowing.
    const result = isSourceFired("nominatim", {
      source: "bhulekh",
      status: "ok",
      data: { tenants: [{ tenantName: "X" }] },
    });
    expect(result.fired).toBe(false);
  });
});

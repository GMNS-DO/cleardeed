/**
 * Task 0.1 — per-source inline snapshot canaries.
 *
 * One `it()` block per SourceId. Each block captures the exact
 * FireResult shape via `toMatchInlineSnapshot`. Drift in any single
 * source's envelope produces a localized, named test failure rather
 * than a single ambiguous diff.
 *
 * Why per-source and not `it.each`? The brief (finding I2) calls out
 * that a single `it.each` table masks which source drifted when the
 * snapshot breaks. Per-source blocks fix that.
 *
 * Each payload is a *minimum-valid* input: it passes the per-source
 * Zod contract AND the per-source liveness check in fire.ts, so the
 * snapshot captures the fired envelope (not a parse_error fallback).
 */
import { describe, it, expect } from "vitest";

import { isSourceFired, V11_DORMANT_MARKER } from "./fire";
import type { SourceId, FireResult } from "./fire";

const firedPayload: Record<SourceId, unknown> = {
  bhulekh: {
    plotNo: "415",
    khataNo: "830",
    village: "Mendhasala",
    tenants: [],
  },
  ecourts: { cases: [], total: 0 },
  rccms: { cases: [], total: 0 },
  "igr-ec": { ecAvailable: true, ecDocumentRef: "EC/2025/1234" },
  rera: { projectName: null, registrationNo: null },
  cersai: { charges: [] },
  "high-court": { cases: [] },
  drt: { cases: [] },
  bhunaksha: { plotNo: "128", village: "Mendhasala", tahasil: "Bhubaneswar" },
  nominatim: { displayName: "Mendhasala, Bhubaneswar, Khordha" },
  "bda-zoning": { rows: [] },
  "circle-rate": { rows: [] },
  "stamp-duty": {
    breakup: {
      stampDuty: 0,
      registrationFee: 0,
      totalPayable: 0,
      calculationBasis: "test",
      appliedMarketValue: 0,
      requestedMarketValue: 0,
      bmvFloorApplied: false,
    },
  },
  "igr-bmv": { rows: [] },
  "igr-daily-bulletin": { days: [], dateRange: { from: "2025-01-01", to: "2025-01-01" } },
  "public-dashboard": { pageUrl: "https://example.invalid/scanned-page", pageIsLive: true },
  "govt-fee": {
    schedule: {
      source: "https://example.invalid/schedule",
      lastUpdated: "2025-01-01",
      notes: "test",
      deedFees: [],
      encumbranceCertificate: {
        generalSearchFirstYearINR: 0,
        everySubsequentYearINR: 0,
        otherPropertyINR: 0,
        applicationFeeINR: 0,
        userChargesINR: 0,
        userChargesMaxINR: 0,
        notes: "test",
      },
      certifiedCopy: {
        searchPerPartyINR: 0,
        inspectionFeeINR: 0,
        copyingFeePerPageINR: 0,
        immediateDeliveryINR: 0,
        applicationFeeINR: 0,
        userChargesPerPageINR: 0,
        userChargesMaxINR: 0,
        notes: "test",
      },
      additionalPerPlotFees: {
        perPlotDemarcationFeeINR: 0,
        rorPostalDeliveryFeeINR: 0,
        perKhataRORUserFeeINR: 0,
      },
    },
    matchedDeedFee: null,
  },
  "igr-certified-copy": {
    pageUrl: "https://example.invalid/cc",
    pageIsLive: true,
    section57Note: "test",
    manualInstructions: { steps: [] },
  },
  "igr-sro": {
    district: "Khordha",
    sro: "Bhubaneswar",
    sroCode: "SRO-BBSR",
    address: "Bhubaneswar",
    contactUrl: "https://example.invalid/contact",
    ecUrl: "https://example.invalid/ec",
    operatingHours: "10-5",
    estimatedFee: "INR 100",
    expectedTime: "1 day",
  },
  larr: { notificationId: null, notificationDate: null },
  "bhunaksha-plot-report": { plotNo: "128" },
  eow: {
    matches: [],
    propertyCount: 0,
    arrestedPersonCount: 0,
    blacklistLastRefreshedAt: "2026-05-01",
  },
  "bhuvan-flood": {
    zone: null,
    floodFrequency: null,
    coordinates: { lat: 20.272688, lng: 85.701271 },
    assessedAt: "2026-05-01T00:00:00Z",
  },
};

describe("fire envelope shape — per-source snapshot canaries", () => {
  it("bhulekh envelope shape", () => {
    const result: FireResult = isSourceFired("bhulekh", {
      source: "bhulekh",
      status: "ok",
      data: firedPayload.bhulekh,
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "fired": true,
          "khataNo": "830",
          "plotNo": "415",
          "source": "bhulekh",
        },
        "fired": true,
      }
    `);
  });

  it("ecourts envelope shape", () => {
    const result: FireResult = isSourceFired("ecourts", {
      source: "ecourts",
      status: "ok",
      data: firedPayload.ecourts,
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "caseCount": 0,
          "fired": true,
          "source": "ecourts",
        },
        "fired": true,
      }
    `);
  });

  it("rccms envelope shape", () => {
    const result: FireResult = isSourceFired("rccms", {
      source: "rccms",
      status: "ok",
      data: firedPayload.rccms,
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "caseCount": 0,
          "fired": true,
          "source": "rccms",
        },
        "fired": true,
      }
    `);
  });

  it("igr-ec envelope shape", () => {
    const result: FireResult = isSourceFired("igr-ec", {
      source: "igr-ec",
      status: "ok",
      data: firedPayload["igr-ec"],
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "certifiedCopyAvailable": true,
          "ecReference": "EC/2025/1234",
          "fired": true,
          "source": "igr-ec",
        },
        "fired": true,
      }
    `);
  });

  it("rera envelope shape", () => {
    const result: FireResult = isSourceFired("rera", {
      source: "rera",
      status: "ok",
      data: firedPayload.rera,
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "fired": true,
          "projectName": null,
          "registrationNo": null,
          "source": "rera",
        },
        "fired": true,
      }
    `);
  });

  it("cersai envelope shape", () => {
    const result: FireResult = isSourceFired("cersai", {
      source: "cersai",
      status: "ok",
      data: firedPayload.cersai,
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "chargeCount": 0,
          "fired": true,
          "source": "cersai",
        },
        "fired": true,
      }
    `);
  });

  it("high-court envelope shape", () => {
    const result: FireResult = isSourceFired("high-court", {
      source: "high-court",
      status: "ok",
      data: firedPayload["high-court"],
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "caseCount": 0,
          "fired": true,
          "source": "high-court",
        },
        "fired": true,
      }
    `);
  });

  it("drt envelope shape", () => {
    const result: FireResult = isSourceFired("drt", {
      source: "drt",
      status: "ok",
      data: firedPayload.drt,
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "caseCount": 0,
          "fired": true,
          "source": "drt",
        },
        "fired": true,
      }
    `);
  });

  it("bhunaksha envelope shape", () => {
    const result: FireResult = isSourceFired("bhunaksha", {
      source: "bhunaksha",
      status: "ok",
      data: firedPayload.bhunaksha,
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "fired": true,
          "plotNo": "128",
          "source": "bhunaksha",
          "villageName": "Mendhasala",
        },
        "fired": true,
      }
    `);
  });

  it("nominatim envelope shape", () => {
    const result: FireResult = isSourceFired("nominatim", {
      source: "nominatim",
      status: "ok",
      data: firedPayload.nominatim,
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "fired": false,
        "reason": "no_data",
      }
    `);
  });

  it("bda-zoning envelope shape", () => {
    const result: FireResult = isSourceFired("bda-zoning", {
      source: "bda-zoning",
      status: "ok",
      data: firedPayload["bda-zoning"],
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "fired": false,
        "reason": "no_data",
      }
    `);
  });

  it("circle-rate envelope shape", () => {
    const result: FireResult = isSourceFired("circle-rate", {
      source: "circle-rate",
      status: "ok",
      data: firedPayload["circle-rate"],
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "fired": false,
        "reason": "no_data",
      }
    `);
  });

  it("stamp-duty envelope shape", () => {
    const result: FireResult = isSourceFired("stamp-duty", {
      source: "stamp-duty",
      status: "ok",
      data: firedPayload["stamp-duty"],
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "expectedAmount": 0,
          "fired": true,
          "ratePct": null,
          "source": "stamp-duty",
        },
        "fired": true,
      }
    `);
  });

  it("igr-bmv envelope shape", () => {
    const result: FireResult = isSourceFired("igr-bmv", {
      source: "igr-bmv",
      status: "ok",
      data: firedPayload["igr-bmv"],
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "fired": false,
        "reason": "no_data",
      }
    `);
  });

  it("igr-daily-bulletin envelope shape", () => {
    const result: FireResult = isSourceFired("igr-daily-bulletin", {
      source: "igr-daily-bulletin",
      status: "ok",
      data: firedPayload["igr-daily-bulletin"],
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "fired": false,
        "reason": "no_data",
      }
    `);
  });

  it("public-dashboard envelope shape", () => {
    const result: FireResult = isSourceFired("public-dashboard", {
      source: "public-dashboard",
      status: "ok",
      data: firedPayload["public-dashboard"],
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "fired": true,
          "scannedPageUrl": "https://example.invalid/scanned-page",
          "source": "public-dashboard",
        },
        "fired": true,
      }
    `);
  });

  it("govt-fee envelope shape", () => {
    const result: FireResult = isSourceFired("govt-fee", {
      source: "govt-fee",
      status: "ok",
      data: firedPayload["govt-fee"],
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "fired": false,
        "reason": "no_data",
      }
    `);
  });

  it("igr-certified-copy envelope shape", () => {
    const result: FireResult = isSourceFired("igr-certified-copy", {
      source: "igr-certified-copy",
      status: "ok",
      data: firedPayload["igr-certified-copy"],
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "certifiedCopyUrl": "https://example.invalid/cc",
          "fired": true,
          "source": "igr-certified-copy",
        },
        "fired": true,
      }
    `);
  });

  it("igr-sro envelope shape", () => {
    const result: FireResult = isSourceFired("igr-sro", {
      source: "igr-sro",
      status: "ok",
      data: firedPayload["igr-sro"],
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "fired": true,
          "source": "igr-sro",
          "sroAddress": "Bhubaneswar",
          "sroName": "Bhubaneswar",
        },
        "fired": true,
      }
    `);
  });

  it("larr envelope shape", () => {
    const result: FireResult = isSourceFired("larr", {
      source: "larr",
      status: "ok",
      data: firedPayload.larr,
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "fired": false,
        "reason": "skipped_dormant",
      }
    `);
  });

  it("bhunaksha-plot-report envelope shape", () => {
    const result: FireResult = isSourceFired("bhunaksha-plot-report", {
      source: "bhunaksha-plot-report",
      status: "ok",
      data: firedPayload["bhunaksha-plot-report"],
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "fired": true,
          "perimeterM": null,
          "plotAreaSqm": null,
          "source": "bhunaksha-plot-report",
        },
        "fired": true,
      }
    `);
  });

  it("skipped_dormant: dormant marker envelope", () => {
    // Sanity: per the brief, the dormant marker short-circuits to
    // { fired: false, reason: "skipped_dormant" } regardless of source.
    // This protects the V1.1 wire contract.
    const result: FireResult = isSourceFired("bhulekh", {
      source: V11_DORMANT_MARKER,
      dormant: true,
    });
    expect(result).toMatchInlineSnapshot(`
      {
        "fired": false,
        "reason": "skipped_dormant",
      }
    `);
  });
});
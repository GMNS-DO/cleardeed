/**
 * Per-source inline snapshots.
 *
 * Per the binding brief (Task 0.1): "Add one snapshot test per source that
 * captures the *current* envelope shape as a string literal." Each `it()` here
 * exercises one source and pins the envelope shape with `toMatchInlineSnapshot`.
 *
 * Why per-source and not one aggregate: a contract drift (e.g. someone changes
 * a per-source envelope field) should fail the *one* test for that source, not
 * the whole suite. Drift detection = one failing test = one source to fix.
 *
 * Fixtures below match the per-source Zod contract schemas exactly. If a
 * fixture drifts, parse_error is the result — that is itself a signal.
 *
 * Run with `npx vitest run apps/web/src/lib/pipeline/contracts/fire.snapshot.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { isSourceFired, V11_DORMANT_MARKER } from "./fire";
import type { FireResult } from "./fire";

// Build a contract envelope for `source` with status "ok" + given data. We use
// `as unknown as` because each contract has a discriminated `status` literal
// and TypeScript would otherwise demand strict per-status narrowing.
function envelope<T extends string>(
  source: T,
  data: unknown,
): Record<string, unknown> {
  return {
    source,
    status: "ok",
    data,
    fetchedAt: "2026-05-15T00:00:00Z",
    sourceUrl: "https://example.invalid",
    latencyMs: 100,
  };
}

describe("fire — per-source envelope shape snapshots", () => {
  // ── bhulekh ────────────────────────────────────────────────────────────────
  it("bhulekh envelope shape", () => {
    const result: FireResult = isSourceFired(
      "bhulekh",
      envelope("bhulekh", {
        plotNo: "309",
        khataNo: "830",
        village: "Mendhasal",
        tenants: [
          {
            surveyNo: "309",
            area: 10.5,
            unit: "acre",
            landClass: "ଦଣ୍ଡା",
            tenantName: "ରଖିତ ଅନାବାଦୀ",
          },
        ],
      }),
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "fired": true,
          "khataNo": "830",
          "plotNo": "309",
          "source": "bhulekh",
        },
        "fired": true,
      }
    `);
  });

  // ── ecourts ────────────────────────────────────────────────────────────────
  it("ecourts envelope shape", () => {
    const result = isSourceFired(
      "ecourts",
      envelope("ecourts", {
        cases: [
          {
            caseType: "civil",
            caseNo: "1",
            court: "Khurda",
            status: "pending",
            parties: [{ name: "A", role: "petitioner" }, { name: "B", role: "respondent" }],
          },
        ],
        total: 1,
      }),
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "caseCount": 1,
          "fired": true,
          "source": "ecourts",
        },
        "fired": true,
      }
    `);
  });

  // ── rccms ──────────────────────────────────────────────────────────────────
  it("rccms envelope shape", () => {
    const result = isSourceFired(
      "rccms",
      envelope("rccms", {
        cases: [
          { caseType: "revenue", caseNo: "1", court: "RCCMS Khurda", status: "pending" },
        ],
        total: 1,
      }),
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "caseCount": 1,
          "fired": true,
          "source": "rccms",
        },
        "fired": true,
      }
    `);
  });

  // ── igr-ec ─────────────────────────────────────────────────────────────────
  it("igr-ec envelope shape", () => {
    const result = isSourceFired(
      "igr-ec",
      envelope("igr-ec", {
        ecAvailable: true,
        ecDocumentRef: "EC-2024-001",
      }),
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "certifiedCopyAvailable": true,
          "ecReference": "EC-2024-001",
          "fired": true,
          "source": "igr-ec",
        },
        "fired": true,
      }
    `);
  });

  // ── bhunaksha ──────────────────────────────────────────────────────────────
  it("bhunaksha envelope shape", () => {
    const result = isSourceFired(
      "bhunaksha",
      envelope("bhunaksha", {
        plotNo: "128",
        village: "Mendhasal",
        tahasil: "Bhubaneswar",
      }),
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "fired": true,
          "plotNo": "128",
          "source": "bhunaksha",
          "villageName": "Mendhasal",
        },
        "fired": true,
      }
    `);
  });

  // ── nominatim ──────────────────────────────────────────────────────────────
  it("nominatim envelope shape", () => {
    const result = isSourceFired(
      "nominatim",
      envelope("nominatim", {
        displayName: "Mendhasal, Bhubaneswar, Khordha, Odisha",
        district: "Khordha",
        tahasil: "Bhubaneswar",
        village: "Mendhasal",
      }),
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "district": "Khordha",
          "fired": true,
          "source": "nominatim",
          "tahasil": "Bhubaneswar",
          "village": "Mendhasal",
        },
        "fired": true,
      }
    `);
  });

  // ── bda-zoning ─────────────────────────────────────────────────────────────
  it("bda-zoning envelope shape", () => {
    const result = isSourceFired(
      "bda-zoning",
      envelope("bda-zoning", {
        rows: [
          {
            tehsil: "Bhubaneswar",
            village: "Mendhasal",
            zone: {
              id: "residential",
              name: "Residential",
              description: "R",
              permittedUses: ["res"],
              restrictions: [],
              zoneCode: "R1",
            },
          },
        ],
      }),
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "fired": true,
          "inIndustrialZone": false,
          "source": "bda-zoning",
          "zone": "residential",
        },
        "fired": true,
      }
    `);
  });

  // ── circle-rate ────────────────────────────────────────────────────────────
  it("circle-rate envelope shape", () => {
    const result = isSourceFired(
      "circle-rate",
      envelope("circle-rate", {
        rows: [
          {
            mouza: "Mendhasal",
            tehsil: "Bhubaneswar",
            kisam: "agricultural",
            ratePerAcre: 5000000,
            ratePerSqft: 114,
            sourceUrl: "https://example.invalid/circle",
            lastUpdated: "2024-04-01",
            rateType: "urban",
          },
        ],
      }),
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "benchmarkPerAcre": 5000000,
          "fired": true,
          "source": "circle-rate",
          "sourceVintage": "2024-04-01",
        },
        "fired": true,
      }
    `);
  });

  // ── stamp-duty ─────────────────────────────────────────────────────────────
  it("stamp-duty envelope shape", () => {
    const result = isSourceFired(
      "stamp-duty",
      envelope("stamp-duty", {
        breakup: {
          appliedMarketValue: 1000000,
          requestedMarketValue: 1000000,
          bmvFloorApplied: false,
          stampDuty: 50000,
          registrationFee: 10000,
          totalPayable: 60000,
          calculationBasis: "market_value",
        },
      }),
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "expectedAmount": 60000,
          "fired": true,
          "ratePct": 5,
          "source": "stamp-duty",
        },
        "fired": true,
      }
    `);
  });

  // ── igr-bmv ────────────────────────────────────────────────────────────────
  it("igr-bmv envelope shape", () => {
    const result = isSourceFired(
      "igr-bmv",
      envelope("igr-bmv", {
        rows: [
          {
            mouza: "Mendhasal",
            tehsil: "Bhubaneswar",
            sro: "Khordha",
            kisam: "agricultural",
            ratePerAcre: 5000000,
            ratePerSqft: 114,
            ratePerDecimal: 12500,
            sourceUrl: "https://example.invalid/bmv",
            lastUpdated: "2024-04-01",
          },
        ],
      }),
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "fired": true,
          "guidelineValue": 5000000,
          "source": "igr-bmv",
          "villageName": "Mendhasal",
        },
        "fired": true,
      }
    `);
  });

  // ── cersai ─────────────────────────────────────────────────────────────────
  it("cersai envelope shape", () => {
    const result = isSourceFired(
      "cersai",
      envelope("cersai", {
        charges: [
          {
            chargeType: "mortgage",
            borrowerName: "A",
            propertyDesc: "Plot 309",
            securedCreditor: "SBI",
            chargeCreationDate: "2024-01-01",
            chargeAmount: "1000000",
            chargeStatus: "Active",
            caseRef: "C-1",
          },
        ],
        totalCharges: 1,
        activeCharges: 1,
      }),
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "chargeCount": 1,
          "fired": true,
          "source": "cersai",
        },
        "fired": true,
      }
    `);
  });

  // ── rera ───────────────────────────────────────────────────────────────────
  it("rera envelope shape (dormant placeholder)", () => {
    const result = isSourceFired("rera", { source: V11_DORMANT_MARKER, dormant: true });
    expect(result).toMatchInlineSnapshot(`
      {
        "fired": false,
        "reason": "skipped_dormant",
      }
    `);
  });

  // ── igr-daily-bulletin ─────────────────────────────────────────────────────
  it("igr-daily-bulletin envelope shape", () => {
    const result = isSourceFired(
      "igr-daily-bulletin",
      envelope("igr-daily-bulletin", {
        days: [
          {
            date: "2024-04-01",
            district: "Khordha",
            count: 12,
            considerationTotal: 50000000,
          },
        ],
        dateRange: { from: "2024-04-01", to: "2024-04-01" },
      }),
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "bulletinDate": "2024-04-01",
          "deedCount": 12,
          "fired": true,
          "source": "igr-daily-bulletin",
        },
        "fired": true,
      }
    `);
  });

  // ── public-dashboard ───────────────────────────────────────────────────────
  it("public-dashboard envelope shape", () => {
    const result = isSourceFired(
      "public-dashboard",
      envelope("public-dashboard", {
        pageUrl: "https://example.invalid/dashboard",
        pageIsLive: true,
        entries: [],
        notes: [],
      }),
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "fired": true,
          "scannedPageUrl": "https://example.invalid/dashboard",
          "source": "public-dashboard",
        },
        "fired": true,
      }
    `);
  });

  // ── govt-fee ───────────────────────────────────────────────────────────────
  it("govt-fee envelope shape (conversion unavailable from schema)", () => {
    // The GovtFee schema does not include a top-level `conversionFeeEstimate`,
    // nor a `conversionFeePerDecimal` field under `additionalPerPlotFees`.
    // Per the binding brief's wire contract, govt-fee fires only when the
    // conversion fee is recoverable from the data; the snapshot pins the
    // current "no_data" return value so future schema additions will surface
    // as a snapshot diff.
    const result = isSourceFired(
      "govt-fee",
      envelope("govt-fee", {
        matchedDeedFee: null,
        schedule: {
          source: "https://example.invalid/govt-fee",
          lastUpdated: "2024-04-01",
          notes: "Sample",
          deedFees: [
            {
              category: "sale",
              minStampINR: 100,
              stampPct: 5,
              registrationFeePct: 1,
              rorPostalFeeINR: 50,
              userFeeINR: 10,
              notes: "Standard",
            },
          ],
          encumbranceCertificate: {
            generalSearchFirstYearINR: 100,
            everySubsequentYearINR: 50,
            otherPropertyINR: 100,
            applicationFeeINR: 30,
            userChargesINR: 20,
            userChargesMaxINR: 200,
            notes: "EC",
          },
          certifiedCopy: {
            searchPerPartyINR: 30,
            inspectionFeeINR: 20,
            copyingFeePerPageINR: 5,
            immediateDeliveryINR: 100,
            applicationFeeINR: 30,
            userChargesPerPageINR: 5,
            userChargesMaxINR: 200,
            notes: "Copy",
          },
          additionalPerPlotFees: {
            perPlotDemarcationFeeINR: 500,
            rorPostalDeliveryFeeINR: 50,
            perKhataRORUserFeeINR: 30,
          },
        },
      }),
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "fired": false,
        "reason": "no_data",
      }
    `);
  });

  // ── igr-certified-copy ─────────────────────────────────────────────────────
  it("igr-certified-copy envelope shape", () => {
    const result = isSourceFired(
      "igr-certified-copy",
      envelope("igr-certified-copy", {
        pageUrl: "https://example.invalid/copy.pdf",
        pageIsLive: true,
        entries: [],
        section57Note: "Certified copy available",
        manualInstructions: { steps: ["Visit SRO"] },
      }),
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "certifiedCopyUrl": "https://example.invalid/copy.pdf",
          "fired": true,
          "source": "igr-certified-copy",
        },
        "fired": true,
      }
    `);
  });

  // ── igr-sro ────────────────────────────────────────────────────────────────
  it("igr-sro envelope shape", () => {
    const result = isSourceFired(
      "igr-sro",
      envelope("igr-sro", {
        district: "Khordha",
        sro: "Khordha",
        sroCode: "SRO-KHR-1",
        address: "SRO Office, Khordha",
        contactUrl: "https://example.invalid/sro",
        ecUrl: "https://example.invalid/ec",
        operatingHours: "10am-5pm",
        estimatedFee: "50 INR",
        expectedTime: "1 day",
      }),
    );
    expect(result).toMatchInlineSnapshot(`
      {
        "envelope": {
          "fired": true,
          "source": "igr-sro",
          "sroAddress": "SRO Office, Khordha",
          "sroName": "Khordha",
        },
        "fired": true,
      }
    `);
  });

  // ── larr ───────────────────────────────────────────────────────────────────
  it("larr envelope shape (dormant placeholder)", () => {
    const result = isSourceFired("larr", { source: V11_DORMANT_MARKER, dormant: true });
    expect(result).toMatchInlineSnapshot(`
      {
        "fired": false,
        "reason": "skipped_dormant",
      }
    `);
  });

  // ── bhunaksha-plot-report ──────────────────────────────────────────────────
  it("bhunaksha-plot-report envelope shape", () => {
    const result = isSourceFired(
      "bhunaksha-plot-report",
      envelope("bhunaksha-plot-report", {
        plotNo: "309",
        khatiyanNo: "830",
      }),
    );
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

  // ── high-court ─────────────────────────────────────────────────────────────
  it("high-court envelope shape (dormant placeholder)", () => {
    const result = isSourceFired("high-court", { source: V11_DORMANT_MARKER, dormant: true });
    expect(result).toMatchInlineSnapshot(`
      {
        "fired": false,
        "reason": "skipped_dormant",
      }
    `);
  });

  // ── drt ────────────────────────────────────────────────────────────────────
  it("drt envelope shape (dormant placeholder)", () => {
    const result = isSourceFired("drt", { source: V11_DORMANT_MARKER, dormant: true });
    expect(result).toMatchInlineSnapshot(`
      {
        "fired": false,
        "reason": "skipped_dormant",
      }
    `);
  });
});

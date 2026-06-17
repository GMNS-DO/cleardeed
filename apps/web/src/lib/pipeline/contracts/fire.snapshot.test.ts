/**
 * Snapshot test: captures the FireEnvelope shape per source for downstream drift
 * detection. Any change to the per-source liveness check should fail this test
 * intentionally so the team is forced to update the snapshot and verify the
 * downstream impact.
 */
import { describe, it, expect } from "vitest";
import { isSourceFired, ALL_SOURCE_IDS, type SourceId } from "./fire";

const firedEnvelopeFor = (source: SourceId) => {
  const data = minimalDataFor(source);
  return isSourceFired(source, { source, status: "ok", data });
};

const minimalDataFor = (source: SourceId): Record<string, unknown> => {
  switch (source) {
    case "nominatim":
      return { village: "Mendhasal" };
    case "bhunaksha":
      return { plotNo: "128" };
    case "bhulekh":
      return { tenants: [{ tenantName: "x" }] };
    case "bhunaksha-plot-report":
      return { plotNo: "128" };
    case "ecourts":
    case "rccms":
      return { cases: [] };
    case "igr-ec":
      return { sro: "Bhubaneswar" };
    case "igr-sro":
      return { sroName: "Bhubaneswar" };
    case "cersai":
      return { charges: [] };
    case "circle-rate":
      return { ratePerSqft: 4500 };
    case "bda-zoning":
      return { zone: "Residential" };
    case "igr-bmv":
      return { benchmarkValue: 5000 };
    case "stamp-duty":
      return { totalPayable: 100000 };
    case "igr-daily-bulletin":
      return { totalDeeds: 5 };
    case "public-dashboard":
      return { url: "https://example.invalid" };
    case "govt-fee":
      return { schedule: {} };
    case "igr-certified-copy":
      return { url: "https://example.invalid" };
    default: {
      const _exhaustive: never = source;
      return _exhaustive;
    }
  }
};

describe("fire envelope snapshot — one per source", () => {
  it("ALL_SOURCE_IDS has 17 entries", () => {
    expect(ALL_SOURCE_IDS.length).toBe(17);
  });

  it.each(ALL_SOURCE_IDS)("fires and exposes source=%s", (source) => {
    const result = firedEnvelopeFor(source);
    expect(result.fired).toBe(true);
    if (result.fired) {
      expect(result.source).toBe(source);
      expect(result.envelope.source).toBe(source);
      expect(typeof result.envelope.data).toBe("object");
    }
  });

  it("all sources produce non-empty FireResult snapshot keys", () => {
    const snapshot: Record<string, { fired: boolean; hasData: boolean; hasEnvelope: boolean }> = {};
    for (const source of ALL_SOURCE_IDS) {
      const result = firedEnvelopeFor(source);
      snapshot[source] = {
        fired: result.fired,
        hasData: !!(result.fired && result.envelope.data),
        hasEnvelope: result.fired,
      };
    }
    expect(snapshot).toMatchInlineSnapshot(`
      {
        "bda-zoning": {
          "fired": true,
          "hasData": true,
          "hasEnvelope": true,
        },
        "bhulekh": {
          "fired": true,
          "hasData": true,
          "hasEnvelope": true,
        },
        "bhunaksha": {
          "fired": true,
          "hasData": true,
          "hasEnvelope": true,
        },
        "bhunaksha-plot-report": {
          "fired": true,
          "hasData": true,
          "hasEnvelope": true,
        },
        "cersai": {
          "fired": true,
          "hasData": true,
          "hasEnvelope": true,
        },
        "circle-rate": {
          "fired": true,
          "hasData": true,
          "hasEnvelope": true,
        },
        "ecourts": {
          "fired": true,
          "hasData": true,
          "hasEnvelope": true,
        },
        "govt-fee": {
          "fired": true,
          "hasData": true,
          "hasEnvelope": true,
        },
        "igr-bmv": {
          "fired": true,
          "hasData": true,
          "hasEnvelope": true,
        },
        "igr-certified-copy": {
          "fired": true,
          "hasData": true,
          "hasEnvelope": true,
        },
        "igr-daily-bulletin": {
          "fired": true,
          "hasData": true,
          "hasEnvelope": true,
        },
        "igr-ec": {
          "fired": true,
          "hasData": true,
          "hasEnvelope": true,
        },
        "igr-sro": {
          "fired": true,
          "hasData": true,
          "hasEnvelope": true,
        },
        "nominatim": {
          "fired": true,
          "hasData": true,
          "hasEnvelope": true,
        },
        "public-dashboard": {
          "fired": true,
          "hasData": true,
          "hasEnvelope": true,
        },
        "rccms": {
          "fired": true,
          "hasData": true,
          "hasEnvelope": true,
        },
        "stamp-duty": {
          "fired": true,
          "hasData": true,
          "hasEnvelope": true,
        },
      }
    `);
  });
});
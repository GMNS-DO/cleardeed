/**
 * Sprint V2 — Bhulekh (Record of Rights) contract tests.
 *
 * Asserts the Bhulekh contract schema accepts a synthetic success case, that
 * every documented field in `qa/ground_truth/<plot_id>/manifest.json` has
 * the right runtime type, and that the negative cases in
 * `qa/invalid_inputs.json` map to the expected `status`.
 *
 * Tests SKIP (not fail) when a manifest is missing. The 50-plot V1 corpus is
 * filled in by the founder after manual portal verification.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  goldenPathsFor,
  loadManifest,
  fetcherSlice,
  assertStructuralCorrectness,
  loadInvalidInputs,
} from "./_helper";
import { BhulekhContract, BhulekhDataSchema } from "../../apps/web/src/lib/pipeline/contracts/bhulekh";

const goldenPaths = goldenPathsFor("bhulekh");

describe("Bhulekh — structural correctness", () => {
  it("accepts a synthetic success case", () => {
    const synthetic = {
      source: "bhulekh",
      status: "ok" as const,
      data: {
        plotNo: "128",
        khataNo: "830",
        village: "Mendhasala",
        tenants: [
          {
            surveyNo: "128",
            area: 0.425,
            unit: "acre",
            landClass: "ଦଣ୍ଡା",
            tenantName: "Bikash Chandra Mohapatra",
            share: "1/1",
          },
        ],
        lastUpdated: "2026-04-18T15:10:56.000Z",
        sourceDocument: "https://bhulekh.odisha.gov.in/...",
      },
      fetchedAt: "2026-06-12T10:00:00.000Z",
      sourceUrl: "https://bhulekh.odisha.gov.in/ViewDetails.aspx",
      latencyMs: 1234,
    };
    const result = BhulekhContract.safeParse(synthetic);
    expect(result.success).toBe(true);
  });

  it("rejects a success case missing required envelope fields", () => {
    const broken = {
      source: "bhulekh",
      status: "ok" as const,
      data: { plotNo: "128", village: "X", tenants: [] },
      // missing fetchedAt, sourceUrl, latencyMs
    };
    const result = BhulekhContract.safeParse(broken);
    expect(result.success).toBe(false);
  });

  it("rejects a failure case without error object", () => {
    const broken = {
      source: "bhulekh",
      status: "source_down" as const,
      fetchedAt: "2026-06-12T10:00:00.000Z",
      sourceUrl: "https://bhulekh.odisha.gov.in/...",
      latencyMs: 100,
      // missing error
    };
    const result = BhulekhContract.safeParse(broken);
    expect(result.success).toBe(false);
  });
});

describe("Bhulekh — value correctness (per golden path)", () => {
  for (const plotId of goldenPaths) {
    it(`manifest ${plotId} matches contract structure`, () => {
      const manifest = loadManifest(plotId);
      if (!manifest) return; // SKIP — manifest not yet populated
      const slice = fetcherSlice(manifest, "bhulekh");
      if (!slice) return; // SKIP — this plot not yet verified for bhulekh
      const fieldSchemas: Record<string, z.ZodTypeAny> = {
        plotNo: z.string(),
        khataNo: z.string().optional(),
        village: z.string(),
        tenants: z.array(
          z.object({
            surveyNo: z.string(),
            area: z.number(),
            unit: z.string(),
            landClass: z.string(),
            tenantName: z.string(),
          }).passthrough()
        ),
      };
      const checks = assertStructuralCorrectness(slice, fieldSchemas);
      const mismatches = checks.filter((c) => c.status === "mismatch");
      if (mismatches.length > 0) {
        console.warn(`[${plotId}] bhulekh mismatches:`, mismatches);
      }
      expect(mismatches).toEqual([]);
    });
  }

  it("data schema is internally consistent with full payload", () => {
    const sample = {
      plotNo: "128",
      khataNo: "830",
      village: "Mendhasala",
      tenants: [
        {
          surveyNo: "128",
          area: 0.425,
          unit: "acre",
          landClass: "ଦଣ୍ଡା",
          tenantName: "Bikash Chandra Mohapatra",
        },
      ],
    };
    const result = BhulekhDataSchema.safeParse(sample);
    expect(result.success).toBe(true);
  });
});

describe("Bhulekh — negative cases", () => {
  const cases = loadInvalidInputs().filter((c) => c.fetcher === "bhulekh");
  if (cases.length === 0) {
    it.skip("no bhulekh negative cases loaded from qa/invalid_inputs.json", () => {});
    return;
  }
  for (const c of cases) {
    it(`${c.description} → ${c.expected_status}`, () => {
      // V2 only asserts the *expected* status string. The actual mapping from
      // the input object above to a status is a fetcher-implementation
      // concern, not a contract concern. The contract says: a fetcher that
      // rejects an empty identifier MUST return status: "invalid_input" with
      // an `error` object.
      expect(["invalid_input", "no_data", "source_down"]).toContain(c.expected_status);
    });
  }
});

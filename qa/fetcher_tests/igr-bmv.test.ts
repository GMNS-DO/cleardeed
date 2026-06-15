/**
 * Sprint V5b — IGR BMV (Benchmark Valuation) contract tests.
 *
 * The live endpoint is `ViewFeeValue.aspx/GetMRVal` on igrodisha.gov.in.
 * The contract tests below exercise the synthetic envelope shape and the
 * `source_down` typed-degradation path. Live smoke is recorded separately
 * (see `packages/fetchers/igr-bmv/qa/igr-bmv.live.ts`).
 */
import { describe, it, expect } from "vitest";
import {
  goldenPathsFor,
  loadManifest,
  fetcherSlice,
  assertStructuralCorrectness,
  loadInvalidInputs,
} from "./_helper";
import { IgrBmvDataSchema, BMVRowSchema } from "../../packages/fetchers/igr-bmv/src/contract";

const goldenPaths = goldenPathsFor("igr-bmv");

describe("IGR BMV — structural correctness", () => {
  it("accepts a synthetic success case with multiple rows", () => {
    const synthetic = {
      source: "igr-bmv",
      status: "ok" as const,
      data: {
        rows: [
          {
            mouza: "Mendhasala",
            tehsil: "Bhubaneswar",
            sro: "Bhubaneswar",
            kisam: "Bari",
            ratePerAcre: 5000000,
            ratePerSqft: 1200,
            ratePerDecimal: 12000,
            sourceUrl: "https://igrodisha.gov.in/ViewFeeValue.aspx/GetMRVal",
            lastUpdated: "2026-06-15",
          },
        ],
      },
      fetchedAt: "2026-06-15T10:00:00.000Z",
      sourceUrl: "https://igrodisha.gov.in/ViewFeeValue.aspx/GetMRVal",
      latencyMs: 1500,
    };

    const result = IgrBmvDataSchema.safeParse(synthetic.data);
    expect(result.success).toBe(true);
  });

  it("accepts an empty rows array (source_down case)", () => {
    const empty = { rows: [] };
    const result = IgrBmvDataSchema.safeParse(empty);
    expect(result.success).toBe(true);
  });

  it("BMVRow schema rejects non-numeric rates", () => {
    const invalid = {
      mouza: "Mendhasala",
      tehsil: "Bhubaneswar",
      sro: "Bhubaneswar",
      kisam: "Bari",
      ratePerAcre: "five million", // string, not number
      ratePerSqft: 1200,
      ratePerDecimal: 12000,
      sourceUrl: "https://igrodisha.gov.in/ViewFeeValue.aspx/GetMRVal",
      lastUpdated: "2026-06-15",
    };
    const result = BMVRowSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("BMVRow schema rejects negative rates", () => {
    const invalid = {
      mouza: "Mendhasala",
      tehsil: "Bhubaneswar",
      sro: "Bhubaneswar",
      kisam: "Bari",
      ratePerAcre: -1, // negative
      ratePerSqft: 1200,
      ratePerDecimal: 12000,
      sourceUrl: "https://igrodisha.gov.in/ViewFeeValue.aspx/GetMRVal",
      lastUpdated: "2026-06-15",
    };
    const result = BMVRowSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("IGR BMV — ground-truth manifest slice", () => {
  const plotIdsWithSlice: string[] = [];
  for (const plotId of goldenPaths.slice(0, 5)) {
    const manifest = loadManifest(plotId);
    if (!manifest) continue;
    const slice = fetcherSlice(manifest, "igr-bmv" as any);
    if (!slice) continue;
    plotIdsWithSlice.push(plotId);
  }

  if (plotIdsWithSlice.length === 0) {
    it.skip("no V5b ground-truth manifest has an igr-bmv slice yet (founder pending — see CURRENT_FOCUS.md)", () => {});
  } else {
    for (const plotId of plotIdsWithSlice) {
      const manifest = loadManifest(plotId);
      const slice = fetcherSlice(manifest!, "igr-bmv" as any);
      it(`${plotId} manifest fields match the BMVRow shape`, () => {
        const checks = assertStructuralCorrectness(slice, {
          mouza: BMVRowSchema.shape.mouza,
          tehsil: BMVRowSchema.shape.tehsil,
          sro: BMVRowSchema.shape.sro,
          kisam: BMVRowSchema.shape.kisam,
          ratePerAcre: BMVRowSchema.shape.ratePerAcre,
          ratePerSqft: BMVRowSchema.shape.ratePerSqft,
          ratePerDecimal: BMVRowSchema.shape.ratePerDecimal,
          lastUpdated: BMVRowSchema.shape.lastUpdated,
        });
        const mismatches = checks.filter((c) => c.status === "mismatch");
        if (mismatches.length > 0) {
          console.warn(`[igr-bmv] ${plotId} manifest mismatches:`, mismatches);
        }
        expect(mismatches.length).toBe(0);
      });
    }
  }
});

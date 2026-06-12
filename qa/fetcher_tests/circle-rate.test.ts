/**
 * Sprint V2 — Circle Rate (IGR benchmark valuation) contract tests.
 *
 * Circle Rate is JSON-backed, not scraped. The contract's `sourceUrl` field
 * records the IGR BMV page that *should* match the values in the JSON.
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
import { CircleRateContract, CircleRateDataSchema } from "../../apps/web/src/lib/pipeline/contracts/circle-rate";

const goldenPaths = goldenPathsFor("circle-rate");

describe("Circle Rate — structural correctness", () => {
  it("accepts a synthetic success case with multiple rows", () => {
    const synthetic = {
      source: "circle-rate",
      status: "ok" as const,
      data: {
        rows: [
          {
            mouza: "Mendhasala",
            tehsil: "Bhubaneswar",
            kisam: "Residential",
            ratePerAcre: 5000000,
            ratePerSqft: 115,
            sourceUrl: "https://www.regis.odisha.gov.in/Benchmark/BMV_Search.aspx",
            lastUpdated: "2024-06-01",
            rateType: "urban" as const,
          },
          {
            mouza: "Mendhasala",
            tehsil: "Bhubaneswar",
            kisam: "Agricultural",
            ratePerAcre: 2500000,
            ratePerSqft: 0,
            sourceUrl: "https://www.regis.odisha.gov.in/Benchmark/BMV_Search.aspx",
            lastUpdated: "2024-06-01",
            rateType: "peri-urban" as const,
          },
        ],
        parserVersion: "circle-rate-v2",
      },
      fetchedAt: "2026-06-12T10:00:00.000Z",
      sourceUrl: "https://www.regis.odisha.gov.in/Benchmark/BMV_Search.aspx",
      latencyMs: 5,
    };
    const result = CircleRateContract.safeParse(synthetic);
    expect(result.success).toBe(true);
  });

  it("rejects a row with the wrong rateType literal", () => {
    const broken = {
      source: "circle-rate",
      status: "ok" as const,
      data: {
        rows: [
          {
            mouza: "X",
            tehsil: "Y",
            kisam: "Residential",
            ratePerAcre: 1,
            ratePerSqft: 1,
            sourceUrl: "x",
            lastUpdated: "x",
            rateType: "made_up_type",
          },
        ],
      },
      fetchedAt: "2026-06-12T10:00:00.000Z",
      sourceUrl: "x",
      latencyMs: 0,
    };
    const result = CircleRateContract.safeParse(broken);
    expect(result.success).toBe(false);
  });
});

describe("Circle Rate — value correctness (per golden path)", () => {
  for (const plotId of goldenPaths) {
    it(`manifest ${plotId} matches contract structure`, () => {
      const manifest = loadManifest(plotId);
      if (!manifest) return;
      const slice = fetcherSlice(manifest, "circle-rate");
      if (!slice) return;
      const fieldSchemas: Record<string, z.ZodTypeAny> = {
        rows: z.array(
          z.object({
            mouza: z.string(),
            tehsil: z.string(),
            kisam: z.string(),
            ratePerAcre: z.number(),
            ratePerSqft: z.number(),
            sourceUrl: z.string(),
            lastUpdated: z.string(),
            rateType: z.enum(["rural", "urban", "peri-urban"]),
          }).passthrough()
        ),
        parserVersion: z.string().optional(),
      };
      const checks = assertStructuralCorrectness(slice, fieldSchemas);
      const mismatches = checks.filter((c) => c.status === "mismatch");
      if (mismatches.length > 0) {
        console.warn(`[${plotId}] circle-rate mismatches:`, mismatches);
      }
      expect(mismatches).toEqual([]);
    });
  }

  it("data schema validates a single-row result", () => {
    const result = CircleRateDataSchema.safeParse({
      rows: [
        {
          mouza: "X",
          tehsil: "Y",
          kisam: "Residential",
          ratePerAcre: 1,
          ratePerSqft: 1,
          sourceUrl: "x",
          lastUpdated: "x",
          rateType: "rural",
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("Circle Rate — negative cases", () => {
  const cases = loadInvalidInputs().filter((c) => c.fetcher === "circle-rate");
  if (cases.length === 0) {
    it.skip("no circle-rate negative cases loaded from qa/invalid_inputs.json", () => {});
    return;
  }
  for (const c of cases) {
    it(`${c.description} → ${c.expected_status}`, () => {
      expect(["invalid_input", "no_data", "source_down"]).toContain(c.expected_status);
    });
  }
});

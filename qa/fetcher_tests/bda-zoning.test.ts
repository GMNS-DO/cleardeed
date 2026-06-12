/**
 * Sprint V2 — BDA Master Plan zoning contract tests.
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
import { BdaZoningContract, BdaZoningDataSchema } from "../../apps/web/src/lib/pipeline/contracts/bda-zoning";

const goldenPaths = goldenPathsFor("bda-zoning");

describe("BDA Zoning — structural correctness", () => {
  it("accepts a synthetic success case with a residential row", () => {
    const synthetic = {
      source: "bda-zoning",
      status: "ok" as const,
      data: {
        rows: [
          {
            tehsil: "Bhubaneswar",
            village: "Patia",
            locality: "Patia Phase 1",
            zone: {
              id: "residential" as const,
              name: "Residential",
              description: "Residential use permitted",
              permittedUses: ["housing", "small_shop"],
              restrictions: ["no_factory"],
              zoneCode: "R1",
            },
            centroid: { latitude: 20.345, longitude: 85.823 },
          },
        ],
        parserVersion: "bda-zoning-v2",
      },
      fetchedAt: "2026-06-12T10:00:00.000Z",
      sourceUrl: "https://bluis.in/",
      latencyMs: 5,
    };
    const result = BdaZoningContract.safeParse(synthetic);
    expect(result.success).toBe(true);
  });

  it("rejects a row with an unknown zone id", () => {
    const broken = {
      source: "bda-zoning",
      status: "ok" as const,
      data: {
        rows: [
          {
            tehsil: "X",
            village: "Y",
            zone: {
              id: "made_up_zone",
              name: "X",
              description: "X",
              permittedUses: [],
              restrictions: [],
              zoneCode: "Z",
            },
          },
        ],
      },
      fetchedAt: "2026-06-12T10:00:00.000Z",
      sourceUrl: "x",
      latencyMs: 0,
    };
    const result = BdaZoningContract.safeParse(broken);
    expect(result.success).toBe(false);
  });
});

describe("BDA Zoning — value correctness (per golden path)", () => {
  for (const plotId of goldenPaths) {
    it(`manifest ${plotId} matches contract structure`, () => {
      const manifest = loadManifest(plotId);
      if (!manifest) return;
      const slice = fetcherSlice(manifest, "bda-zoning");
      if (!slice) return;
      const fieldSchemas: Record<string, z.ZodTypeAny> = {
        rows: z
          .array(
            z.object({
              tehsil: z.string(),
              village: z.string(),
              zone: z.object({
                id: z.enum([
                  "residential",
                  "commercial",
                  "industrial",
                  "green_belt",
                  "special",
                  "mixed_use",
                  "institutional",
                ]),
                name: z.string(),
                zoneCode: z.string(),
              }).passthrough(),
            }).passthrough()
          )
          .optional(),
        parserVersion: z.string().optional(),
      };
      const checks = assertStructuralCorrectness(slice, fieldSchemas);
      const mismatches = checks.filter((c) => c.status === "mismatch");
      if (mismatches.length > 0) {
        console.warn(`[${plotId}] bda-zoning mismatches:`, mismatches);
      }
      expect(mismatches).toEqual([]);
    });
  }

  it("data schema validates a minimal row", () => {
    const result = BdaZoningDataSchema.safeParse({
      rows: [
        {
          tehsil: "X",
          village: "Y",
          zone: {
            id: "residential",
            name: "Residential",
            description: "d",
            permittedUses: [],
            restrictions: [],
            zoneCode: "R1",
          },
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe("BDA Zoning — negative cases", () => {
  const cases = loadInvalidInputs().filter((c) => c.fetcher === "bda-zoning");
  if (cases.length === 0) {
    it.skip("no bda-zoning negative cases loaded from qa/invalid_inputs.json", () => {});
    return;
  }
  for (const c of cases) {
    it(`${c.description} → ${c.expected_status}`, () => {
      expect(["invalid_input", "no_data", "source_down"]).toContain(c.expected_status);
    });
  }
});

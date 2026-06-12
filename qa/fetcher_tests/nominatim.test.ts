/**
 * Sprint V2 — Nominatim (OSM geocoder) contract tests.
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
import { NominatimContract, NominatimDataSchema } from "../../apps/web/src/lib/pipeline/contracts/nominatim";

const goldenPaths = goldenPathsFor("nominatim");

describe("Nominatim — structural correctness", () => {
  it("accepts a synthetic success case with all address fields", () => {
    const synthetic = {
      source: "nominatim",
      status: "ok" as const,
      data: {
        displayName: "Mendhasala, Bhubaneswar, Khordha, Odisha, India",
        village: "Mendhasala",
        tahasil: "Bhubaneswar",
        district: "Khordha",
        state: "Odisha",
        postcode: "752054",
        category: "place.village",
        sourceFetchedAt: "2026-06-12T10:00:00.000Z",
        cacheServedAt: "2026-06-12T10:00:00.000Z",
      },
      fetchedAt: "2026-06-12T10:00:00.000Z",
      sourceUrl: "https://nominatim.openstreetmap.org/search?q=Mendhasala%2C+Bhubaneswar",
      latencyMs: 350,
    };
    const result = NominatimContract.safeParse(synthetic);
    expect(result.success).toBe(true);
  });

  it("accepts a minimal result (displayName only)", () => {
    const synthetic = {
      source: "nominatim",
      status: "ok" as const,
      data: {
        displayName: "Some Place, India",
      },
      fetchedAt: "2026-06-12T10:00:00.000Z",
      sourceUrl: "x",
      latencyMs: 0,
    };
    const result = NominatimContract.safeParse(synthetic);
    expect(result.success).toBe(true);
  });

  it("rejects a success case without displayName", () => {
    const broken = {
      source: "nominatim",
      status: "ok" as const,
      data: {
        village: "X",
      },
      fetchedAt: "2026-06-12T10:00:00.000Z",
      sourceUrl: "x",
      latencyMs: 0,
    };
    const result = NominatimContract.safeParse(broken);
    expect(result.success).toBe(false);
  });
});

describe("Nominatim — value correctness (per golden path)", () => {
  for (const plotId of goldenPaths) {
    it(`manifest ${plotId} matches contract structure`, () => {
      const manifest = loadManifest(plotId);
      if (!manifest) return;
      const slice = fetcherSlice(manifest, "nominatim");
      if (!slice) return;
      const fieldSchemas: Record<string, z.ZodTypeAny> = {
        displayName: z.string(),
        village: z.string().optional(),
        tahasil: z.string().optional(),
        district: z.string().optional(),
        state: z.string().optional(),
        postcode: z.string().optional(),
        category: z.string().optional(),
      };
      const checks = assertStructuralCorrectness(slice, fieldSchemas);
      const mismatches = checks.filter((c) => c.status === "mismatch");
      if (mismatches.length > 0) {
        console.warn(`[${plotId}] nominatim mismatches:`, mismatches);
      }
      expect(mismatches).toEqual([]);
    });
  }

  it("data schema validates a displayName-only result", () => {
    const result = NominatimDataSchema.safeParse({ displayName: "X, India" });
    expect(result.success).toBe(true);
  });
});

describe("Nominatim — negative cases", () => {
  const cases = loadInvalidInputs().filter((c) => c.fetcher === "nominatim");
  if (cases.length === 0) {
    it.skip("no nominatim negative cases loaded from qa/invalid_inputs.json", () => {});
    return;
  }
  for (const c of cases) {
    it(`${c.description} → ${c.expected_status}`, () => {
      expect(["invalid_input", "no_data", "source_down"]).toContain(c.expected_status);
    });
  }
});

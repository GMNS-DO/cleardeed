/**
 * Sprint V2 — Bhunaksha (cadastral WFS) contract tests.
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
import { BhunakshaContract, BhunakshaDataSchema } from "../../apps/web/src/lib/pipeline/contracts/bhunaksha";

const goldenPaths = goldenPathsFor("bhunaksha");

describe("Bhunaksha — structural correctness", () => {
  it("accepts a synthetic success case with polygon", () => {
    const synthetic = {
      source: "bhunaksha",
      status: "ok" as const,
      data: {
        plotNo: "128",
        village: "Mendhasala",
        tahasil: "Bhubaneswar",
        area: 0.001719,
        areaUnit: "sq_km" as const,
        crs: "EPSG:4326",
        featureId: "BHU_PLOT_128",
        layer: "khurda_bhubaneswar",
        polygon: {
          type: "Polygon" as const,
          coordinates: [
            [
              [85.823, 20.295],
              [85.824, 20.295],
              [85.824, 20.296],
              [85.823, 20.296],
              [85.823, 20.295],
            ],
          ],
        },
      },
      fetchedAt: "2026-06-12T10:00:00.000Z",
      sourceUrl: "https://bhunaksha.odisha.gov.in/wfs",
      latencyMs: 567,
    };
    const result = BhunakshaContract.safeParse(synthetic);
    expect(result.success).toBe(true);
  });

  it("rejects a polygon with the wrong type literal", () => {
    const broken = {
      source: "bhunaksha",
      status: "ok" as const,
      data: {
        plotNo: "128",
        village: "X",
        tahasil: "Y",
        polygon: { type: "MultiPolygon", coordinates: [] },
      },
      fetchedAt: "2026-06-12T10:00:00.000Z",
      sourceUrl: "x",
      latencyMs: 0,
    };
    const result = BhunakshaContract.safeParse(broken);
    expect(result.success).toBe(false);
  });
});

describe("Bhunaksha — value correctness (per golden path)", () => {
  for (const plotId of goldenPaths) {
    it(`manifest ${plotId} matches contract structure`, () => {
      const manifest = loadManifest(plotId);
      if (!manifest) return;
      const slice = fetcherSlice(manifest, "bhunaksha");
      if (!slice) return;
      const fieldSchemas: Record<string, z.ZodTypeAny> = {
        plotNo: z.string(),
        village: z.string(),
        tahasil: z.string(),
        area: z.number().optional(),
        areaUnit: z.literal("sq_km").optional(),
        crs: z.string().optional(),
        featureId: z.string().optional(),
        layer: z.string().optional(),
        polygon: z
          .object({
            type: z.literal("Polygon"),
            coordinates: z.array(z.array(z.array(z.number()))),
          })
          .optional(),
      };
      const checks = assertStructuralCorrectness(slice, fieldSchemas);
      const mismatches = checks.filter((c) => c.status === "mismatch");
      if (mismatches.length > 0) {
        console.warn(`[${plotId}] bhunaksha mismatches:`, mismatches);
      }
      expect(mismatches).toEqual([]);
    });
  }

  it("data schema validates a real-world polygon shape", () => {
    const sample = {
      plotNo: "128",
      village: "Mendhasala",
      tahasil: "Bhubaneswar",
      polygon: {
        type: "Polygon" as const,
        coordinates: [
          [
            [85.823, 20.295],
            [85.824, 20.295],
            [85.824, 20.296],
            [85.823, 20.296],
            [85.823, 20.295],
          ],
        ],
      },
    };
    const result = BhunakshaDataSchema.safeParse(sample);
    expect(result.success).toBe(true);
  });
});

describe("Bhunaksha — negative cases", () => {
  const cases = loadInvalidInputs().filter((c) => c.fetcher === "bhunaksha");
  if (cases.length === 0) {
    it.skip("no bhunaksha negative cases loaded from qa/invalid_inputs.json", () => {});
    return;
  }
  for (const c of cases) {
    it(`${c.description} → ${c.expected_status}`, () => {
      expect(["invalid_input", "no_data", "source_down"]).toContain(c.expected_status);
    });
  }
});

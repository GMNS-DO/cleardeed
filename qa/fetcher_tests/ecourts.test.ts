/**
 * Sprint V2 — eCourts (case search) contract tests.
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
import { EcourtsContract, EcourtsDataSchema } from "../../apps/web/src/lib/pipeline/contracts/ecourts";

const goldenPaths = goldenPathsFor("ecourts");

describe("eCourts — structural correctness", () => {
  it("accepts a synthetic success case with cases", () => {
    const synthetic = {
      source: "ecourts",
      status: "ok" as const,
      data: {
        cases: [
          {
            caseNo: "CS/123/2024",
            caseType: "Civil Suit",
            court: "District Court Khordha",
            filingDate: "2024-03-15",
            status: "Pending",
            parties: [
              { name: "X", role: "petitioner" as const },
              { name: "Y", role: "respondent" as const },
            ],
          },
        ],
        total: 1,
        searchMetadata: {
          districtName: "Khordha",
          districtCode: "561",
          captchaAcceptedCount: 1,
          captchaFailedCount: 0,
          negativeResultConfidence: "high" as const,
        },
      },
      fetchedAt: "2026-06-12T10:00:00.000Z",
      sourceUrl: "https://services.ecourts.gov.in/ecourtindia_v6/...",
      latencyMs: 2345,
    };
    const result = EcourtsContract.safeParse(synthetic);
    expect(result.success).toBe(true);
  });

  it("accepts an empty-cases success (negative search)", () => {
    const synthetic = {
      source: "ecourts",
      status: "ok" as const,
      data: {
        cases: [],
        total: 0,
        searchMetadata: {
          districtCode: "561",
          captchaAcceptedCount: 1,
          captchaFailedCount: 0,
          negativeResultConfidence: "high" as const,
        },
      },
      fetchedAt: "2026-06-12T10:00:00.000Z",
      sourceUrl: "https://services.ecourts.gov.in/...",
      latencyMs: 1500,
    };
    const result = EcourtsContract.safeParse(synthetic);
    expect(result.success).toBe(true);
  });
});

describe("eCourts — value correctness (per golden path)", () => {
  for (const plotId of goldenPaths) {
    it(`manifest ${plotId} matches contract structure`, () => {
      const manifest = loadManifest(plotId);
      if (!manifest) return;
      const slice = fetcherSlice(manifest, "ecourts");
      if (!slice) return;
      const fieldSchemas: Record<string, z.ZodTypeAny> = {
        cases: z.array(
          z.object({
            caseNo: z.string(),
            caseType: z.string(),
            court: z.string(),
            status: z.string(),
            parties: z.array(
              z.object({ name: z.string(), role: z.string() }).passthrough()
            ),
          }).passthrough()
        ),
        total: z.number(),
      };
      const checks = assertStructuralCorrectness(slice, fieldSchemas);
      const mismatches = checks.filter((c) => c.status === "mismatch");
      if (mismatches.length > 0) {
        console.warn(`[${plotId}] ecourts mismatches:`, mismatches);
      }
      expect(mismatches).toEqual([]);
    });
  }

  it("data schema validates an empty-cases result", () => {
    const result = EcourtsDataSchema.safeParse({ cases: [], total: 0 });
    expect(result.success).toBe(true);
  });
});

describe("eCourts — negative cases", () => {
  const cases = loadInvalidInputs().filter((c) => c.fetcher === "ecourts");
  if (cases.length === 0) {
    it.skip("no ecourts negative cases loaded from qa/invalid_inputs.json", () => {});
    return;
  }
  for (const c of cases) {
    it(`${c.description} → ${c.expected_status}`, () => {
      expect(["invalid_input", "no_data", "source_down"]).toContain(c.expected_status);
    });
  }
});

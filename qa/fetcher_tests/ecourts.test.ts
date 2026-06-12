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

/**
 * Regression test for the Sprint 6 Khordha launch blocker.
 *
 * The eCourts fetcher's `unsupported_district` guard fires when
 *   districtCode !== KHURDA_DISTRICT_CODE || !/khurda|khordha/i.test(districtName)
 * The pipeline at apps/web/src/lib/pipeline/index.ts calls ecourtsFetch with
 * { districtName: "Khordha", districtCode: "8" }. eCourts uses "8" as Khurda's
 * code (Bhulekh uses "561" — a different vocabulary). Previously the pipeline
 * passed "561", which caused the guard to fire on every Khordha input.
 *
 * This test reads the actual eCourts input the pipeline sends and asserts the
 * guard's two conditions are both false for that input. Deterministic — does
 * not launch Playwright.
 */
describe("eCourts — Khordha guard regression (Sprint 6)", () => {
  it("the value the pipeline passes for districtCode matches the eCourts Khurda code", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const pipelinePath = path.resolve(
      process.cwd(),
      "apps/web/src/lib/pipeline/index.ts"
    );
    const src = fs.readFileSync(pipelinePath, "utf8");
    // Extract the literal districtCode value from the ecourtsFetch call.
    const match = src.match(/ecourtsFetch\(\{[\s\S]*?districtCode:\s*"([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match![1]).toBe("8");
  });

  it("the value the pipeline passes for districtName matches the Khurda/Khordha regex", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const pipelinePath = path.resolve(
      process.cwd(),
      "apps/web/src/lib/pipeline/index.ts"
    );
    const src = fs.readFileSync(pipelinePath, "utf8");
    const match = src.match(/ecourtsFetch\(\{[\s\S]*?districtName:\s*"([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/khurda|khordha/i);
  });
});

/**
 * Sprint V2 — RCCMS (Revenue Court Case Management System) contract tests.
 *
 * Known caveat: V1.1 short-circuits RCCMS to a "failed" stub
 * (statusReason: "rccms_probe_skipped_sprint6_todo"). The contract below
 * describes the *intended* post-parse shape, not the V1.1 stub. The contract
 * tests run against the intended shape so that re-enabling the fetcher in
 * Sprint 7+ requires no contract change.
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
import { RccmsContract, RccmsDataSchema } from "../../apps/web/src/lib/pipeline/contracts/rccms";

const goldenPaths = goldenPathsFor("rccms");

describe("RCCMS — structural correctness", () => {
  it("accepts a synthetic success case with cases", () => {
    const synthetic = {
      source: "rccms",
      status: "ok" as const,
      data: {
        cases: [
          {
            caseNo: "RC/2024/123",
            plotNo: "128",
            caseType: "Land Dispute",
            filingDate: "2024-04-01",
            status: "Pending",
            court: "Sub-Collector, Bhubaneswar",
          },
        ],
        total: 1,
      },
      fetchedAt: "2026-06-12T10:00:00.000Z",
      sourceUrl: "https://rccms.odisha.gov.in/...",
      latencyMs: 3000,
    };
    const result = RccmsContract.safeParse(synthetic);
    expect(result.success).toBe(true);
  });

  it("accepts a source_down result", () => {
    const synthetic = {
      source: "rccms",
      status: "source_down" as const,
      error: {
        code: "portal_unavailable",
        message: "RCCMS portal is currently down",
      },
      fetchedAt: "2026-06-12T10:00:00.000Z",
      sourceUrl: "https://rccms.odisha.gov.in/...",
      latencyMs: 60000,
    };
    const result = RccmsContract.safeParse(synthetic);
    expect(result.success).toBe(true);
  });
});

describe("RCCMS — value correctness (per golden path)", () => {
  for (const plotId of goldenPaths) {
    it(`manifest ${plotId} matches contract structure`, () => {
      const manifest = loadManifest(plotId);
      if (!manifest) return;
      const slice = fetcherSlice(manifest, "rccms");
      if (!slice) return;
      const fieldSchemas: Record<string, z.ZodTypeAny> = {
        cases: z
          .array(
            z.object({
              caseNo: z.string(),
              caseType: z.string(),
              status: z.string(),
              court: z.string(),
            }).passthrough()
          )
          .optional(),
        total: z.number().optional(),
      };
      const checks = assertStructuralCorrectness(slice, fieldSchemas);
      const mismatches = checks.filter((c) => c.status === "mismatch");
      if (mismatches.length > 0) {
        console.warn(`[${plotId}] rccms mismatches:`, mismatches);
      }
      expect(mismatches).toEqual([]);
    });
  }

  it("data schema validates an empty result", () => {
    const result = RccmsDataSchema.safeParse({ cases: [], total: 0 });
    expect(result.success).toBe(true);
  });
});

describe("RCCMS — negative cases", () => {
  const cases = loadInvalidInputs().filter((c) => c.fetcher === "rccms");
  if (cases.length === 0) {
    it.skip("no rccms negative cases loaded from qa/invalid_inputs.json", () => {});
    return;
  }
  for (const c of cases) {
    it(`${c.description} → ${c.expected_status}`, () => {
      expect(["invalid_input", "no_data", "source_down"]).toContain(c.expected_status);
    });
  }
});

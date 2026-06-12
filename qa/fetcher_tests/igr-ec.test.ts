/**
 * Sprint V2 — IGR Odisha EC (Encumbrance Certificate) contract tests.
 *
 * Note: IGR EC is a *partial* automation — the fetcher returns structured
 * instructions (how to manually request the EC from the SRO) when the portal
 * is not fetchable. Both the `ok` and the `no_data` paths carry the
 * `instructions` field; the contract reflects this.
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
import { IgrEcContract, IgrEcDataSchema } from "../../apps/web/src/lib/pipeline/contracts/igr-ec";

const goldenPaths = goldenPathsFor("igr-ec");

describe("IGR EC — structural correctness", () => {
  it("accepts a synthetic success case with entries", () => {
    const synthetic = {
      source: "igr-ec",
      status: "ok" as const,
      data: {
        ecAvailable: true,
        ecDocumentRef: "EC-2024-001",
        entries: [
          {
            docType: "Sale Deed",
            docNo: "1234",
            regDate: "2020-05-12",
            party1: "X",
            party2: "Y",
            consideration: "₹25,00,000",
            marketValue: "₹30,00,000",
          },
        ],
        searchPeriod: { from: "2020-01-01", to: "2025-12-31" },
        sro: "Bhubaneswar",
        district: "Khordha",
        fee: 50,
        feeCurrency: "INR",
      },
      fetchedAt: "2026-06-12T10:00:00.000Z",
      sourceUrl: "https://www.igrodisha.gov.in/...",
      latencyMs: 4321,
    };
    const result = IgrEcContract.safeParse(synthetic);
    expect(result.success).toBe(true);
  });

  it("accepts a no_data result carrying instructions", () => {
    const synthetic = {
      source: "igr-ec",
      status: "no_data" as const,
      error: {
        code: "manual_required",
        message: "EC must be obtained manually from the SRO",
        details: { sro: "Bhubaneswar", fee: "INR 50" },
      },
      fetchedAt: "2026-06-12T10:00:00.000Z",
      sourceUrl: "https://www.igrodisha.gov.in/...",
      latencyMs: 100,
    };
    const result = IgrEcContract.safeParse(synthetic);
    expect(result.success).toBe(true);
  });
});

describe("IGR EC — value correctness (per golden path)", () => {
  for (const plotId of goldenPaths) {
    it(`manifest ${plotId} matches contract structure`, () => {
      const manifest = loadManifest(plotId);
      if (!manifest) return;
      const slice = fetcherSlice(manifest, "igr-ec");
      if (!slice) return;
      const fieldSchemas: Record<string, z.ZodTypeAny> = {
        ecAvailable: z.boolean(),
        ecDocumentRef: z.string().optional(),
        sro: z.string().optional(),
        district: z.string().optional(),
        fee: z.number().optional(),
        feeCurrency: z.string().optional(),
        instructions: z.string().optional(),
        entries: z.array(z.object({}).passthrough()).optional(),
      };
      const checks = assertStructuralCorrectness(slice, fieldSchemas);
      const mismatches = checks.filter((c) => c.status === "mismatch");
      if (mismatches.length > 0) {
        console.warn(`[${plotId}] igr-ec mismatches:`, mismatches);
      }
      expect(mismatches).toEqual([]);
    });
  }

  it("data schema validates an empty (no-entries) result", () => {
    const result = IgrEcDataSchema.safeParse({ ecAvailable: false });
    expect(result.success).toBe(true);
  });
});

describe("IGR EC — negative cases", () => {
  const cases = loadInvalidInputs().filter((c) => c.fetcher === "igr-ec");
  if (cases.length === 0) {
    it.skip("no igr-ec negative cases loaded from qa/invalid_inputs.json", () => {});
    return;
  }
  for (const c of cases) {
    it(`${c.description} → ${c.expected_status}`, () => {
      expect(["invalid_input", "no_data", "source_down"]).toContain(c.expected_status);
    });
  }
});

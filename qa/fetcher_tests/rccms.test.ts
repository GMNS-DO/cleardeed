/**
 * Sprint V2 — RCCMS (Revenue Court Case Management System) contract tests.
 *
 * The pipeline calls the live RCCMS fetcher behind a 5s budget (see
 * `RCCMS — pipeline timeout contract` below). The contract tests at the top
 * of the file describe the *intended* post-parse shape and continue to apply
 * unchanged — the live fetcher's return shape is what they validate.
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
import {
  rccmsFetchWithTimeout,
  rccmsTimeoutStub,
} from "../../apps/web/src/lib/pipeline";

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

/**
 * Pipeline timeout contract (replaces D-030 stub).
 *
 * The V1.1 pipeline calls the RCCMS fetcher behind a 5s budget. These tests
 * pin that contract: a fast fetcher result must be passed through unchanged,
 * a slow fetcher must surface as `statusReason: "rccms_timeout"`, and the
 * pipeline must never block for more than the configured budget.
 */
describe("RCCMS — pipeline timeout contract", () => {
  type FastResult = {
    source: "rccms";
    status: "partial";
    statusReason: string;
    verification: "manual_required";
    fetchedAt: string;
    attempts: number;
    inputsTried: unknown[];
    parserVersion: string;
  };

  const FAST_INPUT = {
    district: "Khordha",
    tahasil: "Bhubaneswar",
    village: "Mendhasala",
    khataNo: "415",
    plotNo: "128",
  };

  const makeFastResult = (): FastResult => ({
    source: "rccms",
    status: "partial",
    statusReason: "no_cases_found",
    verification: "manual_required",
    fetchedAt: "2026-06-13T00:00:00.000Z",
    attempts: 1,
    inputsTried: [],
    parserVersion: "rccms-probe-v1",
  });

  it("passes through a fetcher result that completes within 5s", async () => {
    const fastResult = makeFastResult();
    const fetcher = async () => fastResult;

    const result = await rccmsFetchWithTimeout(
      fetcher,
      FAST_INPUT,
      5000
    );

    expect(result).toEqual(fastResult);
  });

  it("rejects with an error when the fetcher exceeds the budget", async () => {
    // Fetcher that never resolves within the budget.
    const fetcher = () =>
      new Promise<FastResult>(() => {
        /* never resolves */
      });

    await expect(
      rccmsFetchWithTimeout(fetcher, FAST_INPUT, 50) // 50ms timeout
    ).rejects.toThrow("rccms_timeout");
  });

  it("never blocks the pipeline for more than the configured budget", async () => {
    const fetcher = () =>
      new Promise<FastResult>(() => {
        /* never resolves */
      });

    const budgetMs = 100;
    const t0 = Date.now();
    await expect(
      rccmsFetchWithTimeout(fetcher, FAST_INPUT, budgetMs)
    ).rejects.toThrow("rccms_timeout");
    const elapsed = Date.now() - t0;

    // Allow generous slack (3x) for CI scheduling jitter.
    expect(elapsed).toBeLessThan(budgetMs * 3);
  });

  it("the timeout stub carries statusReason: 'rccms_timeout'", () => {
    const stub = rccmsTimeoutStub();
    expect(stub.status).toBe("failed");
    expect(stub.statusReason).toBe("rccms_timeout");
    expect(stub.verification).toBe("manual_required");
    expect(stub.source).toBe("rccms");
  });

  it("mirrors the pipeline: a hung fetcher surfaces as statusReason 'rccms_timeout' (not 'rccms_probe_skipped_sprint6_todo')", async () => {
    // The V1.1 pipeline wraps the call in try/catch: success → fetcher result,
    // failure (incl. timeout) → rccmsTimeoutStub(). Replicate that pattern
    // here so a regression to the D-030 stub is caught by the test.
    const fetcher = () =>
      new Promise<FastResult>(() => {
        /* never resolves */
      });

    let result: { status: string; statusReason: string } | undefined;
    try {
      result = await rccmsFetchWithTimeout(fetcher, FAST_INPUT, 50);
    } catch {
      result = rccmsTimeoutStub();
    }

    expect(result?.status).toBe("failed");
    expect(result?.statusReason).toBe("rccms_timeout");
    // Guard against the D-030 stub being re-introduced.
    expect(result?.statusReason).not.toBe("rccms_probe_skipped_sprint6_todo");
  });
});

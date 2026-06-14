/**
 * Sprint V2 — Circle Rate (IGR benchmark valuation) fetcher contract.
 *
 * Circle Rate is a JSON-backed local lookup keyed on (mouza, tehsil, kisam).
 * Source URL is the IGR BMV page, but the data is loaded from a local file
 * (or the inline seed fallback). The contract payload is an array of rows.
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase } from "./types";
import type { CircleRateResult } from "@cleardeed/schema";

const CircleRateRow = z.object({
  mouza: z.string(),
  tehsil: z.string(),
  kisam: z.string(),
  ratePerAcre: z.number(),
  ratePerSqft: z.number(),
  sourceUrl: z.string(),
  lastUpdated: z.string(),
  rateType: z.enum(["rural", "urban", "peri-urban"]),
});

export const CircleRateDataSchema = z.object({
  rows: z.array(CircleRateRow),
  parserVersion: z.string().optional(),
});
export type CircleRateData = z.infer<typeof CircleRateDataSchema>;

export const CircleRateContract = z.discriminatedUnion("status", [
  ContractEnvelopeBase.extend({
    source: z.literal("circle-rate"),
    status: z.literal("ok"),
    data: CircleRateDataSchema,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("circle-rate"),
    status: z.literal("no_data"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("circle-rate"),
    status: z.literal("source_down"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("circle-rate"),
    status: z.literal("invalid_input"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("circle-rate"),
    status: z.literal("parse_error"),
    error: ContractError,
  }),
]);
export type CircleRateContract = z.infer<typeof CircleRateContract>;

/** Re-export the existing fetcher result type so schema and type stay in sync. */
export type { CircleRateResult };

// ─── Adapter ──────────────────────────────────────────────────────────────────

// Circle Rate is a JSON-backed local lookup. The fetcher's native return is
// `status: "success"` with a `data: CircleRateRow[]` array (possibly empty).
// An empty array means "no matching mouza in the local lookup" — that's a
// buyer-meaningful "no data" outcome, not a system failure.
import { ContractStatus } from "./types";

function buildError(code: string, message: string, details?: Record<string, string>) {
  return { code, message, ...(details ? { details } : {}) } satisfies z.infer<typeof ContractError>;
}

export function mapCircleRateToContract(
  result: CircleRateResult,
  fetchedAt: string,
): CircleRateContract {
  const latencyMs =
    (result as unknown as { latencyMs?: number }).latencyMs ??
    (result.inputsTried?.length ? result.inputsTried.length * 1000 : 0);

  if (result.status === "success") {
    const rows = result.data ?? [];
    if (rows.length > 0) {
      return {
        status: "ok",
        source: "circle-rate",
        data: {
          rows,
          parserVersion: result.parserVersion,
        },
        fetchedAt,
        sourceUrl: "https://igrodisha.gov.in/BenchmarkValue.jsp",
        latencyMs,
      };
    }
    // No matching mouza/kisam combination found — neutral, not a failure.
    return {
      status: "no_data",
      source: "circle-rate",
      error: buildError(
        "no_matching_rate",
        result.statusReason ?? "No circle rate row matched the supplied (mouza, tehsil, kisam).",
      ),
      fetchedAt,
      sourceUrl: "https://igrodisha.gov.in/BenchmarkValue.jsp",
      latencyMs,
    };
  }

  // Anything other than `success` is a typed failure.
  const status: ContractStatus = "source_down";
  return {
    status,
    source: "circle-rate",
    error: buildError(
      status,
      result.statusReason ?? "Circle rate lookup failed",
    ),
    fetchedAt,
    sourceUrl: "https://igrodisha.gov.in/BenchmarkValue.jsp",
    latencyMs,
  };
}

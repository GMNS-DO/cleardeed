/**
 * Sprint V5b — IGR BMV (Benchmark Valuation) fetcher contract.
 *
 * The live endpoint is `ViewFeeValue.aspx/GetMRVal` on igrodisha.gov.in.
 * Returns the official circle rate for a (district, SRO, mouza, kisam) tuple.
 *
 * Adapter logic:
 *   - status "success" with rows[]              → contract "ok"
 *   - status "partial" with empty rows          → contract "no_data" (live 200 but empty)
 *   - status "failed" / "not_covered" / others  → contract "source_down"
 *   - missing sro/village                       → contract "invalid_input"
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase, ContractStatus } from "./types";
import type { IgrBmvResult } from "../../../../packages/fetchers/igr-bmv/src/contract";

const BMVRow = z.object({
  mouza: z.string(),
  tehsil: z.string(),
  sro: z.string(),
  kisam: z.string(),
  ratePerAcre: z.number(),
  ratePerSqft: z.number(),
  ratePerDecimal: z.number(),
  sourceUrl: z.string(),
  lastUpdated: z.string(),
});

export const IgrBmvDataSchema = z.object({
  rows: z.array(BMVRow),
});
export type IgrBmvData = z.infer<typeof IgrBmvDataSchema>;

export const IgrBmvContract = z.discriminatedUnion("status", [
  ContractEnvelopeBase.extend({
    source: z.literal("igr-bmv"),
    status: z.literal("ok"),
    data: IgrBmvDataSchema,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("igr-bmv"),
    status: z.literal("no_data"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("igr-bmv"),
    status: z.literal("source_down"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("igr-bmv"),
    status: z.literal("invalid_input"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("igr-bmv"),
    status: z.literal("parse_error"),
    error: ContractError,
  }),
]);
export type IgrBmvContract = z.infer<typeof IgrBmvContract>;

export type { IgrBmvResult };

// ─── Adapter ──────────────────────────────────────────────────────────────────

function buildError(code: string, message: string, details?: Record<string, string>) {
  return { code, message, ...(details ? { details } : {}) } satisfies z.infer<typeof ContractError>;
}

export function mapIgrBmvToContract(
  result: IgrBmvResult,
  fetchedAt: string
): IgrBmvContract {
  const latencyMs = result.attempts ? result.attempts * 1000 : 0;
  const sourceUrl = "https://igrodisha.gov.in/ViewFeeValue.aspx/GetMRVal";

  if (result.statusReason === "missing_input") {
    return {
      status: "invalid_input",
      source: "igr-bmv",
      error: buildError("missing_input", result.error ?? "sro and village are required"),
      fetchedAt,
      sourceUrl,
      latencyMs,
    };
  }

  if (result.status === "success") {
    const rows = result.data?.rows ?? [];
    if (rows.length > 0) {
      return {
        status: "ok",
        source: "igr-bmv",
        data: { rows },
        fetchedAt,
        sourceUrl,
        latencyMs,
      };
    }
    return {
      status: "no_data",
      source: "igr-bmv",
      error: buildError("no_matching_rate", "Live BMV endpoint returned no rows for the supplied tuple."),
      fetchedAt,
      sourceUrl,
      latencyMs,
    };
  }

  // partial with empty rows → no_data
  if (result.status === "partial" && (result.data?.rows?.length ?? 0) === 0) {
    return {
      status: "no_data",
      source: "igr-bmv",
      error: buildError(
        "live_response_unparseable",
        result.statusReason ?? "Live BMV endpoint returned a 200 but no parseable rows."
      ),
      fetchedAt,
      sourceUrl,
      latencyMs,
    };
  }

  const status: ContractStatus = "source_down";
  return {
    status,
    source: "igr-bmv",
    error: buildError(status, result.statusReason ?? "IGR BMV endpoint unreachable."),
    fetchedAt,
    sourceUrl,
    latencyMs,
  };
}

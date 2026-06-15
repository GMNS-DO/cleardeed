/**
 * Sprint V5b — Stamp Duty fetcher contract.
 *
 * The live endpoint is `StampDutyCalc.aspx/GetDoMRVal` on igrodisha.gov.in.
 * Given a (district, deed type, market value) tuple, it returns the
 * government-expected stamp duty + registration fee + total payable. The
 * report uses this to cross-check the seller's quoted price: if the buyer
 * agrees to a price below the government-expected stamp duty minimum (the
 * BMV), the report flags it as a sub-card under Section 5.
 *
 * Adapter logic:
 *   - status "success" / "partial" with breakup       → contract "ok"
 *     (partial indicates local fallback was used; data is still valid)
 *   - status "failed" with "missing_input" reason    → contract "invalid_input"
 *   - status "failed" / "not_covered" / others        → contract "source_down"
 *   - 200 OK with unparseable body                    → contract "parse_error"
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase, ContractStatus } from "./types";
import type { StampDutyResult } from "../../../../packages/fetchers/stamp-duty/src/contract";

const StampDutyBreakup = z.object({
  stampDuty: z.number().nonnegative(),
  registrationFee: z.number().nonnegative(),
  cess: z.number().nonnegative().optional(),
  surcharge: z.number().nonnegative().optional(),
  totalPayable: z.number().nonnegative(),
  calculationBasis: z.string(),
  appliedMarketValue: z.number().nonnegative(),
  requestedMarketValue: z.number().nonnegative(),
  bmvFloorApplied: z.boolean(),
});

export const StampDutyDataSchema = z.object({
  breakup: StampDutyBreakup,
});
export type StampDutyData = z.infer<typeof StampDutyDataSchema>;

export const StampDutyContract = z.discriminatedUnion("status", [
  ContractEnvelopeBase.extend({
    source: z.literal("stamp-duty"),
    status: z.literal("ok"),
    data: StampDutyDataSchema,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("stamp-duty"),
    status: z.literal("source_down"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("stamp-duty"),
    status: z.literal("invalid_input"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("stamp-duty"),
    status: z.literal("parse_error"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("stamp-duty"),
    status: z.literal("no_data"),
    error: ContractError,
  }),
]);
export type StampDutyContract = z.infer<typeof StampDutyContract>;

export type { StampDutyResult };

// ─── Adapter ──────────────────────────────────────────────────────────────────

function buildError(code: string, message: string, details?: Record<string, string>) {
  return { code, message, ...(details ? { details } : {}) } satisfies z.infer<typeof ContractError>;
}

export function mapStampDutyToContract(
  result: StampDutyResult,
  fetchedAt: string
): StampDutyContract {
  const latencyMs = result.attempts ? result.attempts * 1000 : 0;
  const sourceUrl = "https://igrodisha.gov.in/StampDutyCalc.aspx/GetDoMRVal";

  if (result.statusReason === "missing_input") {
    return {
      status: "invalid_input",
      source: "stamp-duty",
      error: buildError(
        "missing_input",
        result.error ?? "sro and a positive marketValue are required"
      ),
      fetchedAt,
      sourceUrl,
      latencyMs,
    };
  }

  // success or partial-with-breakup → ok. The local fallback is a legitimate
  // "verified" outcome because the schedule is authoritative for 2024-25.
  if (
    (result.status === "success" || result.status === "partial") &&
    result.data?.breakup
  ) {
    return {
      status: "ok",
      source: "stamp-duty",
      data: { breakup: result.data.breakup },
      fetchedAt,
      sourceUrl,
      latencyMs,
    };
  }

  // 200 OK with unparseable body → parse_error
  if (result.statusReason === "live_response_unparseable") {
    return {
      status: "parse_error",
      source: "stamp-duty",
      error: buildError(
        "live_response_unparseable",
        result.statusReason ?? "Live stamp-duty endpoint returned a 200 but no parseable breakup."
      ),
      fetchedAt,
      sourceUrl,
      latencyMs,
    };
  }

  const status: ContractStatus = "source_down";
  return {
    status,
    source: "stamp-duty",
    error: buildError(status, result.statusReason ?? "Stamp-duty endpoint unreachable."),
    fetchedAt,
    sourceUrl,
    latencyMs,
  };
}

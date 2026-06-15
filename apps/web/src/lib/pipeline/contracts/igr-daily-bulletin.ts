/**
 * Sprint V5b — IGR Daily Bulletin fetcher contract.
 *
 * The live endpoint is `ORServiceNew.aspx/GetDataFromDB` on igrodisha.gov.in.
 * It returns registration activity (deed counts, consideration totals) for a
 * date range. The buyer's report uses this as a velocity signal: "X deeds
 * registered in Khordha in the last N days."
 *
 * Adapter logic:
 *   - status "success" with non-empty days[]   → contract "ok"
 *   - status "success" with empty days[]        → contract "no_data"
 *     (live OK, but no activity in range — neutral, not a failure)
 *   - status "partial" with empty days[]        → contract "no_data"
 *   - status "failed" / "not_covered" / others  → contract "source_down"
 *   - missing input                             → contract "invalid_input"
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase, ContractStatus } from "./types";
import type { IgrDailyBulletinResult } from "../../../../packages/fetchers/igr-daily-bulletin/src/contract";

const DailyBulletinDay = z.object({
  date: z.string(),
  district: z.string(),
  sro: z.string().optional(),
  deedType: z.string().optional(),
  count: z.number().int().nonnegative(),
  considerationTotal: z.number().nonnegative(),
});

export const IgrDailyBulletinDataSchema = z.object({
  days: z.array(DailyBulletinDay),
  dateRange: z.object({
    from: z.string(),
    to: z.string(),
  }),
  district: z.string().optional(),
  summary: z
    .object({
      totalDeeds: z.number().int().nonnegative().optional(),
      totalConsideration: z.number().nonnegative().optional(),
      avgDeedsPerDay: z.number().nonnegative().optional(),
    })
    .optional(),
});
export type IgrDailyBulletinData = z.infer<typeof IgrDailyBulletinDataSchema>;

export const IgrDailyBulletinContract = z.discriminatedUnion("status", [
  ContractEnvelopeBase.extend({
    source: z.literal("igr-daily-bulletin"),
    status: z.literal("ok"),
    data: IgrDailyBulletinDataSchema,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("igr-daily-bulletin"),
    status: z.literal("no_data"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("igr-daily-bulletin"),
    status: z.literal("source_down"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("igr-daily-bulletin"),
    status: z.literal("invalid_input"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("igr-daily-bulletin"),
    status: z.literal("parse_error"),
    error: ContractError,
  }),
]);
export type IgrDailyBulletinContract = z.infer<typeof IgrDailyBulletinContract>;

export type { IgrDailyBulletinResult };

// ─── Adapter ──────────────────────────────────────────────────────────────────

function buildError(code: string, message: string, details?: Record<string, string>) {
  return { code, message, ...(details ? { details } : {}) } satisfies z.infer<typeof ContractError>;
}

export function mapIgrDailyBulletinToContract(
  result: IgrDailyBulletinResult,
  fetchedAt: string
): IgrDailyBulletinContract {
  const latencyMs = result.attempts ? result.attempts * 1000 : 0;
  const sourceUrl = "https://igrodisha.gov.in/ORServiceNew.aspx/GetDataFromDB";

  // success path
  if (result.status === "success" && result.data && result.data.days.length > 0) {
    return {
      status: "ok",
      source: "igr-daily-bulletin",
      data: result.data,
      fetchedAt,
      sourceUrl,
      latencyMs,
    };
  }

  // success or partial with empty days → no_data
  if (
    (result.status === "success" || result.status === "partial") &&
    (result.data?.days.length ?? 0) === 0
  ) {
    return {
      status: "no_data",
      source: "igr-daily-bulletin",
      error: buildError(
        "no_activity_in_range",
        result.statusReason ?? "Live endpoint returned no deeds for the requested date range."
      ),
      fetchedAt,
      sourceUrl,
      latencyMs,
    };
  }

  // missing input
  if (result.statusReason === "missing_input") {
    return {
      status: "invalid_input",
      source: "igr-daily-bulletin",
      error: buildError("missing_input", result.error ?? "district is required"),
      fetchedAt,
      sourceUrl,
      latencyMs,
    };
  }

  // 200 OK with unparseable body
  if (result.statusReason === "live_response_unparseable") {
    return {
      status: "parse_error",
      source: "igr-daily-bulletin",
      error: buildError(
        "live_response_unparseable",
        result.statusReason ?? "Live daily-bulletin endpoint returned a 200 but no parseable rows."
      ),
      fetchedAt,
      sourceUrl,
      latencyMs,
    };
  }

  const status: ContractStatus = "source_down";
  return {
    status,
    source: "igr-daily-bulletin",
    error: buildError(status, result.statusReason ?? "IGR daily-bulletin endpoint unreachable."),
    fetchedAt,
    sourceUrl,
    latencyMs,
  };
}

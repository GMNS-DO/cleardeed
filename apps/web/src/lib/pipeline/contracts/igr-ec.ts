/**
 * Sprint V2 — IGR Odisha EC (Encumbrance Certificate) fetcher contract.
 *
 * The IGR EC fetcher primarily returns *instructions* (the EC must be
 * obtained manually from the SRO for a fee), not a structured payload. The
 * V1 contract treats this as `no_data` (correct in the buyer sense — the
 * report can't display an EC) and surfaces the structured `instructions` text
 * alongside. V2 keeps the same shape: an `ok` result carries the entries;
 * anything else is a structured error.
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase } from "./types";
import type { IGRECResult } from "@cleardeed/schema";

const EncumbranceEntry = z.object({
  docType: z.string().optional(),
  docNo: z.string().optional(),
  regDate: z.string().optional(),
  party1: z.string().optional(),
  party2: z.string().optional(),
  propertyDesc: z.string().optional(),
  consideration: z.string().optional(),
  marketValue: z.string().optional(),
});

export const IgrEcDataSchema = z.object({
  ecAvailable: z.boolean(),
  ecDocumentRef: z.string().optional(),
  entries: z.array(EncumbranceEntry).optional(),
  searchPeriod: z
    .object({ from: z.string(), to: z.string() })
    .optional(),
  sro: z.string().optional(),
  district: z.string().optional(),
  fee: z.number().optional(),
  feeCurrency: z.string().optional(),
  instructions: z.string().optional(),
});
export type IgrEcData = z.infer<typeof IgrEcDataSchema>;

export const IgrEcContract = z.discriminatedUnion("status", [
  ContractEnvelopeBase.extend({
    source: z.literal("igr-ec"),
    status: z.literal("ok"),
    data: IgrEcDataSchema,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("igr-ec"),
    status: z.literal("no_data"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("igr-ec"),
    status: z.literal("source_down"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("igr-ec"),
    status: z.literal("invalid_input"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("igr-ec"),
    status: z.literal("parse_error"),
    error: ContractError,
  }),
]);
export type IgrEcContract = z.infer<typeof IgrEcContract>;

/** Re-export the existing fetcher result type so schema and type stay in sync. */
export type { IGRECResult };

// ─── Adapter ──────────────────────────────────────────────────────────────────

function buildError(code: string, message: string, details?: Record<string, string>) {
  return { code, message, ...(details ? { details } : {}) } satisfies z.infer<typeof ContractError>;
}

const NO_DATA_CODES = [
  "no_ec_found", "not_digitized", "no_encumbrance",
  "portal_no_records",
];
const SOURCE_DOWN_CODES = [
  "portal_error", "fetch_failed", "network_error",
  "portal_unreachable", "sro_required",
];
const INVALID_INPUT_CODES = [
  "invalid_input", "unsupported_district", "unsupported_sro",
  "village_not_in_khordha",
];
const PARSE_ERROR_CODES = [
  "parse", "html_parse", "unexpected",
];

function classifyIgrEcFailure(statusReason: string | undefined): z.infer<typeof ContractStatus> {
  const lower = (statusReason ?? "").toLowerCase();
  if (NO_DATA_CODES.some((c) => lower.includes(c))) return "no_data";
  if (PARSE_ERROR_CODES.some((c) => lower.includes(c))) return "parse_error";
  if (INVALID_INPUT_CODES.some((c) => lower.includes(c))) return "invalid_input";
  if (SOURCE_DOWN_CODES.some((c) => lower.includes(c))) return "source_down";
  return "source_down";
}

export function mapIgrEcToContract(
  result: IGRECResult,
  fetchedAt: string,
): IgrEcContract {
  const latencyMs =
    (result as unknown as { latencyMs?: number }).latencyMs ??
    (result.inputsTried?.length ? result.inputsTried.length * 1000 : 0);

  // IGR EC is primarily a "manual instructions" deliverable in V1 — the
  // fetcher surfaces `data.instructions` (a structured how-to) and
  // `data.ecAvailable` (whether the SRO-issued EC exists at all). Both
  // paths are treated as `ok` because the report renders them as
  // structured buyer-facing copy, not as a typed failure.
  if (result.status === "success" && result.data) {
    const d = result.data;
    return {
      status: "ok",
      source: "igr-ec",
      data: {
        ecAvailable: d.ecAvailable,
        ecDocumentRef: d.ecDocumentRef,
        entries: d.entries,
        searchPeriod: d.searchPeriod,
        sro: d.sro,
        district: d.district,
        fee: d.fee,
        feeCurrency: d.feeCurrency,
        instructions: d.instructions,
      },
      fetchedAt,
      sourceUrl: "https://igrodisha.gov.in/",
      latencyMs,
    };
  }

  // `partial` with no data is still a buyer-visible negative result — the
  // fetcher returned instructions but no EC, so surface as `no_data`.
  if (result.status === "partial" && !result.data) {
    return {
      status: "no_data",
      source: "igr-ec",
      error: buildError(
        "no_ec_found",
        result.statusReason ?? "No EC available for this property — verify at the SRO.",
      ),
      fetchedAt,
      sourceUrl: "https://igrodisha.gov.in/",
      latencyMs,
    };
  }

  // Everything else: map by statusReason vocabulary.
  const status = classifyIgrEcFailure(result.statusReason);
  return {
    status,
    source: "igr-ec",
    error: buildError(
      status,
      result.statusReason ?? result.error ?? "IGR EC lookup failed",
    ),
    fetchedAt,
    sourceUrl: "https://igrodisha.gov.in/",
    latencyMs,
  };
}

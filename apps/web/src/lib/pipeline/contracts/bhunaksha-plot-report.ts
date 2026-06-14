/**
 * Sprint V2 — Bhunaksha Plot Report (plotreportOR.jsp) fetcher contract.
 *
 * Returns the per-plot Plot Report as a sibling document to the Bhulekh ROR
 * — same underlying revenue record, published as a separate run. The contract
 * is the post-parse deliverable: a typed payload of khatiyan no, owner block,
 * three-column area (acres / decimal / hectare), cadastral map image (base64),
 * and map scale.
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase } from "./types";
import type { BhunakshaPlotReportResult } from "@cleardeed/schema";

/**
 * Three-column area block. Acres/Decimal/Hectare are not always present on
 * every plot — the portal renders only the columns that have values.
 */
const PlotReportArea = z.object({
  acres: z.number().nullable().optional(),
  decimal: z.number().nullable().optional(),
  hectare: z.number().nullable().optional(),
});

/**
 * Owner block. Name/father/caste/address are split on Odia separators
 * (SWA:, JAA:, BAA:) by the live parser; each piece is independently nullable
 * because the portal does not always render all four.
 */
const PlotReportOwner = z.object({
  name: z.string().nullable().optional(),
  father: z.string().nullable().optional(),
  caste: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
});

export const BhunakshaPlotReportDataSchema = z.object({
  plotNo: z.string(),
  khatiyanNo: z.string().nullable().optional(),
  thana: z.string().nullable().optional(),
  thanaNo: z.string().nullable().optional(),
  mouza: z.string().nullable().optional(),
  tehsil: z.string().nullable().optional(),
  tehsilNo: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  area: PlotReportArea.optional(),
  owner: PlotReportOwner.nullable().optional(),
  mapImageBase64: z.string().nullable().optional(),
  mapScale: z.string().nullable().optional(),
  gisCode: z.string().optional(),
  sourceUrl: z.string().optional(),
  rawArtifactHash: z.string().optional(),
});
export type BhunakshaPlotReportData = z.infer<typeof BhunakshaPlotReportDataSchema>;

export const BhunakshaPlotReportContract = z.discriminatedUnion("status", [
  ContractEnvelopeBase.extend({
    source: z.literal("bhunaksha_plot_report"),
    status: z.literal("ok"),
    data: BhunakshaPlotReportDataSchema,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bhunaksha_plot_report"),
    status: z.literal("no_data"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bhunaksha_plot_report"),
    status: z.literal("source_down"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bhunaksha_plot_report"),
    status: z.literal("invalid_input"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bhunaksha_plot_report"),
    status: z.literal("parse_error"),
    error: ContractError,
  }),
]);
export type BhunakshaPlotReportContract = z.infer<typeof BhunakshaPlotReportContract>;

/** Re-export the existing fetcher result type so schema and contract stay in sync. */
export type { BhunakshaPlotReportResult };

// ─── Adapter ──────────────────────────────────────────────────────────────────

// The fetcher is unique in that it has a `partial` status with *no data*
// (when the giscode resolves but the portal returns no parsed fields). That
// is meaningfully different from `success` (any field present) — the report
// renders the latter as a real Plot Report and the former as
// "verify at Tehsil". We preserve that distinction by mapping to the typed
// `ok` / `no_data` vocabulary.
import { ContractStatus } from "./types";

function buildError(code: string, message: string, details?: Record<string, string>) {
  return { code, message, ...(details ? { details } : {}) } satisfies z.infer<typeof ContractError>;
}

const NO_DATA_CODES = [
  "no_parsed_fields", "missing_plot_no", "missing_village_or_tahasil",
  "giscode_not_in_lookup", "empty_result",
];
const SOURCE_DOWN_CODES = [
  "http_probe_failed", "run_failed", "playwright", "chromium",
  "timeout", "portal_unreachable",
];
const INVALID_INPUT_CODES = [
  "invalid_input", "invalid_village", "invalid_tahasil",
];
const PARSE_ERROR_CODES = [
  "parse", "html_parse", "unexpected",
];

function classifyBhunakshaPlotReportFailure(
  statusReason: string | undefined,
): ContractStatus {
  const lower = (statusReason ?? "").toLowerCase();
  if (NO_DATA_CODES.some((c) => lower.includes(c))) return "no_data";
  if (PARSE_ERROR_CODES.some((c) => lower.includes(c))) return "parse_error";
  if (INVALID_INPUT_CODES.some((c) => lower.includes(c))) return "invalid_input";
  if (SOURCE_DOWN_CODES.some((c) => lower.includes(c))) return "source_down";
  return "source_down";
}

export function mapBhunakshaPlotReportToContract(
  result: BhunakshaPlotReportResult,
  fetchedAt: string,
): BhunakshaPlotReportContract {
  const latencyMs =
    (result as unknown as { latencyMs?: number }).latencyMs ??
    (result.inputsTried?.length ? result.inputsTried.length * 1000 : 0);

  if (result.status === "success" && result.data) {
    const d = result.data;
    return {
      status: "ok",
      source: "bhunaksha_plot_report",
      data: {
        plotNo: d.plotNo,
        khatiyanNo: d.khatiyanNo,
        thana: d.thana,
        thanaNo: d.thanaNo,
        mouza: d.mouza,
        tehsil: d.tehsil,
        tehsilNo: d.tehsilNo,
        district: d.district,
        area: d.area,
        owner: d.owner,
        mapImageBase64: d.mapImageBase64,
        mapScale: d.mapScale,
        gisCode: d.gisCode,
        sourceUrl: d.sourceUrl,
        rawArtifactHash: d.rawArtifactHash,
      },
      fetchedAt,
      sourceUrl: d.sourceUrl ?? "https://bhunaksha.odisha.gov.in/plotreportOR.jsp",
      latencyMs,
    };
  }

  // `partial` with no data, or `success` with no data — same buyer outcome
  // ("the plot report has nothing to show"). Surface as `no_data`.
  if (result.status === "partial" || (result.status === "success" && !result.data)) {
    return {
      status: "no_data",
      source: "bhunaksha_plot_report",
      error: buildError(
        "no_parsed_fields",
        result.statusReason ?? "Bhunaksha Plot Report returned no parsed fields — verify at the Tehsil.",
      ),
      fetchedAt,
      sourceUrl: result.data?.sourceUrl ?? "https://bhunaksha.odisha.gov.in/plotreportOR.jsp",
      latencyMs,
    };
  }

  const status = classifyBhunakshaPlotReportFailure(result.statusReason);
  return {
    status,
    source: "bhunaksha_plot_report",
    error: buildError(
      status,
      result.statusReason ?? "Bhunaksha Plot Report lookup failed",
    ),
    fetchedAt,
    sourceUrl: result.data?.sourceUrl ?? "https://bhunaksha.odisha.gov.in/plotreportOR.jsp",
    latencyMs,
  };
}

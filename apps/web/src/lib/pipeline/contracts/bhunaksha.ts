/**
 * Sprint V2 — Bhunaksha (plot polygon / WFS) fetcher contract.
 *
 * Bhunaksha returns the cadastral polygon for a plot plus a few metadata
 * fields. The contract is the post-parse deliverable; the live fetcher's
 * internal `PlotPolygon` type is reused for the `polygon` field.
 *
 * The `mapBhunakshaToContract` adapter at the bottom of this file translates
 * the fetcher's internal status vocabulary (`success | partial | failed`) into
 * the contract vocabulary (`ok | no_data | source_down | invalid_input |
 * parse_error`). A `partial` result maps to `ok` with a warning embedded in the
 * envelope so the buyer still sees the polygon, but Section 1 (the plot) can
 * surface a data-quality watch-out.
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase, type ContractStatus } from "./types";
import type { BhunakshaResult } from "@cleardeed/schema";

const PlotPolygon = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.array(z.number()))),
});

const BhunakshaWarning = z.object({
  code: z.string(),
  message: z.string(),
});

export const BhunakshaDataSchema = z.object({
  plotNo: z.string(),
  village: z.string(),
  tahasil: z.string(),
  area: z.number().optional(),
  areaUnit: z.literal("sq_km").optional(),
  shapeAreaRaw: z.number().optional(),
  shapeAreaUnit: z.literal("degrees2").optional(),
  crs: z.string().optional(),
  featureId: z.string().optional(),
  layer: z.string().optional(),
  geometryHash: z.string().optional(),
  areaComputation: z.string().optional(),
  polygon: PlotPolygon.optional(),
  classification: z.string().optional(),
  sourceDocument: z.string().optional(),
});
export type BhunakshaData = z.infer<typeof BhunakshaDataSchema>;

/**
 * The `ok` branch carries optional `warnings` for partial fetches — Section 1
 * (the plot) can surface a watch-out without dropping the polygon entirely.
 * The other four status branches share the base envelope.
 */
export const BhunakshaContract = z.discriminatedUnion("status", [
  ContractEnvelopeBase.extend({
    source: z.literal("bhunaksha"),
    status: z.literal("ok"),
    data: BhunakshaDataSchema,
    warnings: z.array(BhunakshaWarning).optional(),
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bhunaksha"),
    status: z.literal("no_data"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bhunaksha"),
    status: z.literal("source_down"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bhunaksha"),
    status: z.literal("invalid_input"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bhunaksha"),
    status: z.literal("parse_error"),
    error: ContractError,
  }),
]);
export type BhunakshaContract = z.infer<typeof BhunakshaContract>;

/** Re-export the existing fetcher result type so schema and type stay in sync. */
export type { BhunakshaResult };

// ─── Adapter ──────────────────────────────────────────────────────────────────

function buildError(code: string, message: string, details?: Record<string, string>) {
  return { code, message, ...(details ? { details } : {}) } satisfies z.infer<typeof ContractError>;
}

const PARSE_ERROR_CODES = [
  "parse", "wfs_response", "wfs_response_validation_failed", "invalid_shape", "json",
];
const INVALID_INPUT_CODES = [
  "plot_not_found", "plot_number", "village_not_in_layer", "user_should_recheck_gps",
  "not_in_layer", "outside",
];

function classifyFailure(statusReason: string | undefined): ContractStatus {
  const lower = (statusReason ?? "").toLowerCase();
  if (PARSE_ERROR_CODES.some((c) => lower.includes(c))) return "parse_error";
  if (INVALID_INPUT_CODES.some((c) => lower.includes(c))) return "invalid_input";
  return "source_down";
}

export function mapBhunakshaToContract(
  result: BhunakshaResult,
  fetchedAt: string,
): BhunakshaContract {
  const latencyMs =
    (result as unknown as { latencyMs?: number }).latencyMs ??
    (result.inputsTried?.length ? result.inputsTried.length * 1000 : 0);

  if (result.status === "success" || result.status === "partial") {
    const data = result.data ?? {
      plotNo: "",
      village: "",
      tahasil: "",
    };
    const warnings =
      result.status === "partial" || (result.warnings?.length ?? 0) > 0
        ? (result.warnings ?? []).map((w) => ({
            code: w.code ?? result.statusReason ?? "partial_data",
            message: w.message,
          }))
        : undefined;
    return {
      status: "ok",
      source: "bhunaksha",
      data: {
        plotNo: data.plotNo,
        village: data.village,
        tahasil: data.tahasil,
        area: data.area,
        areaUnit: data.areaUnit,
        shapeAreaRaw: data.shapeAreaRaw,
        shapeAreaUnit: data.shapeAreaUnit,
        crs: data.crs,
        featureId: data.featureId,
        layer: data.layer,
        geometryHash: data.geometryHash,
        areaComputation: data.areaComputation,
        polygon: data.polygon,
        classification: data.classification,
        sourceDocument: data.sourceDocument,
      },
      ...(warnings ? { warnings } : {}),
      fetchedAt,
      sourceUrl: data.sourceDocument ?? "https://mapserver.odisha4kgeo.in/geoserver/revenue/wfs",
      latencyMs,
    };
  }

  const status: ContractStatus = classifyFailure(result.statusReason);

  return {
    status,
    source: "bhunaksha",
    error: buildError(
      result.statusReason ?? status,
      result.error ?? result.statusReason ?? "Bhunaksha lookup failed",
    ),
    fetchedAt,
    sourceUrl: result.data?.sourceDocument ?? "https://mapserver.odisha4kgeo.in/geoserver/revenue/wfs",
    latencyMs,
  };
}


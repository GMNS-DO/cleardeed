/**
 * Sprint V2 — Nominatim (OSM geocoder) fetcher contract.
 *
 * Nominatim is used as a village-centroid resolver before Bhunaksha WFS
 * queries. The contract payload is the structured `displayName` plus the
 * address components used downstream.
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase } from "./types";
import type { NominatimResult } from "@cleardeed/schema";

export const NominatimDataSchema = z.object({
  displayName: z.string(),
  village: z.string().optional(),
  tahasil: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  category: z.string().optional(),
  sourceFetchedAt: z.string().datetime().optional(),
  cacheServedAt: z.string().datetime().optional(),
});
export type NominatimData = z.infer<typeof NominatimDataSchema>;

export const NominatimContract = z.discriminatedUnion("status", [
  ContractEnvelopeBase.extend({
    source: z.literal("nominatim"),
    status: z.literal("ok"),
    data: NominatimDataSchema,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("nominatim"),
    status: z.literal("no_data"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("nominatim"),
    status: z.literal("source_down"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("nominatim"),
    status: z.literal("invalid_input"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("nominatim"),
    status: z.literal("parse_error"),
    error: ContractError,
  }),
]);
export type NominatimContract = z.infer<typeof NominatimContract>;

/** Re-export the existing fetcher result type so schema and type stay in sync. */
export type { NominatimResult };

// ─── Adapter ──────────────────────────────────────────────────────────────────

// Nominatim is the geocoder. The fetcher's native return is
// `status: "success" | "failed" | "partial"` with a `displayName` in `data`.
// The contract treats a successful resolution (any data) as `ok`. The
// reverse (no data, or upstream returned nothing for the GPS) is `no_data`.
// Network/parse errors map to `source_down` / `parse_error`.
import { ContractStatus } from "./types";

function buildError(code: string, message: string, details?: Record<string, string>) {
  return { code, message, ...(details ? { details } : {}) } satisfies z.infer<typeof ContractError>;
}

const NO_DATA_CODES = [
  "no_display_name", "no_data", "empty_result",
];
const SOURCE_DOWN_CODES = [
  "nominatim_", "fetch_failed", "network_error",
  "portal_unreachable", "rate_limited", "http_5xx", "http_4xx",
];
const PARSE_ERROR_CODES = [
  "parse", "html_parse", "json_parse", "unexpected",
];

function classifyNominatimFailure(statusReason: string | undefined): ContractStatus {
  const lower = (statusReason ?? "").toLowerCase();
  if (NO_DATA_CODES.some((c) => lower.includes(c))) return "no_data";
  if (PARSE_ERROR_CODES.some((c) => lower.includes(c))) return "parse_error";
  if (SOURCE_DOWN_CODES.some((c) => lower.includes(c))) return "source_down";
  return "source_down";
}

export function mapNominatimToContract(
  result: NominatimResult,
  fetchedAt: string,
): NominatimContract {
  const latencyMs =
    (result as unknown as { latencyMs?: number }).latencyMs ??
    (result.inputsTried?.length ? result.inputsTried.length * 1000 : 0);

  if (result.status === "success" && result.data?.displayName) {
    const d = result.data;
    return {
      status: "ok",
      source: "nominatim",
      data: {
        displayName: d.displayName,
        village: d.village,
        tahasil: d.tahasil,
        district: d.district,
        state: d.state,
        postcode: d.postcode,
        category: d.category,
        sourceFetchedAt: d.sourceFetchedAt,
        cacheServedAt: d.cacheServedAt,
      },
      fetchedAt,
      sourceUrl: "https://nominatim.openstreetmap.org/",
      latencyMs,
    };
  }

  // `partial` with a displayName is still a usable result — degrade to `ok`.
  if (result.status === "partial" && result.data?.displayName) {
    return {
      status: "ok",
      source: "nominatim",
      data: {
        displayName: result.data.displayName,
        village: result.data.village,
        tahasil: result.data.tahasil,
        district: result.data.district,
        state: result.data.state,
        postcode: result.data.postcode,
        category: result.data.category,
        sourceFetchedAt: result.data.sourceFetchedAt,
        cacheServedAt: result.data.cacheServedAt,
      },
      fetchedAt,
      sourceUrl: "https://nominatim.openstreetmap.org/",
      latencyMs,
    };
  }

  const status = classifyNominatimFailure(result.statusReason);
  return {
    status,
    source: "nominatim",
    error: buildError(
      status,
      result.statusReason ?? result.error ?? "Nominatim geocode failed",
    ),
    fetchedAt,
    sourceUrl: "https://nominatim.openstreetmap.org/",
    latencyMs,
  };
}

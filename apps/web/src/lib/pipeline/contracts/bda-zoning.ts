/**
 * Sprint V2 — BDA Master Plan zoning fetcher contract.
 *
 * BDA zoning is a JSON-backed local lookup keyed on (village, tehsil). The
 * contract payload is an array of zone rows. The data file
 * `data/bda_zones.json` is produced by `scripts/probe/bluis-scraper.ts`;
 * an inline 10-row seed is the fallback.
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase } from "./types";
import type { BdaZoneResult } from "@cleardeed/schema";

const ZoneId = z.enum([
  "residential",
  "commercial",
  "industrial",
  "green_belt",
  "special",
  "mixed_use",
  "institutional",
]);

const Zone = z.object({
  id: ZoneId,
  name: z.string(),
  description: z.string(),
  permittedUses: z.array(z.string()),
  restrictions: z.array(z.string()),
  zoneCode: z.string(),
});

const BdaZoneRow = z.object({
  tehsil: z.string(),
  village: z.string(),
  locality: z.string().optional(),
  zone: Zone,
  centroid: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
});

export const BdaZoningDataSchema = z.object({
  rows: z.array(BdaZoneRow),
  parserVersion: z.string().optional(),
});
export type BdaZoningData = z.infer<typeof BdaZoningDataSchema>;

export const BdaZoningContract = z.discriminatedUnion("status", [
  ContractEnvelopeBase.extend({
    source: z.literal("bda-zoning"),
    status: z.literal("ok"),
    data: BdaZoningDataSchema,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bda-zoning"),
    status: z.literal("no_data"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bda-zoning"),
    status: z.literal("source_down"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bda-zoning"),
    status: z.literal("invalid_input"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("bda-zoning"),
    status: z.literal("parse_error"),
    error: ContractError,
  }),
  // Plot is outside the BDA planning area (e.g., a village not in BDA's
  // Master Plan jurisdiction). Neutral outcome — not a failure.
  ContractEnvelopeBase.extend({
    source: z.literal("bda-zoning"),
    status: z.literal("out_of_scope"),
  }),
]);
export type BdaZoningContract = z.infer<typeof BdaZoningContract>;

/** Re-export the existing fetcher result type so schema and type stay in sync. */
export type { BdaZoneResult };

// ─── Adapter ──────────────────────────────────────────────────────────────────

// BDA Zoning is a JSON-backed local lookup with three possible outcomes:
//   - `status: "success"`     + non-empty `data` → `ok` (zone classified)
//   - `status: "out_of_scope"`                   → `out_of_scope` (village
//                                                  outside BDA's Master Plan
//                                                  planning area; neutral
//                                                  outcome, not a failure)
//   - `status: "success"`     + empty `data`     → `no_data` (village in
//                                                  scope but no row found)
// Anything else: `source_down`.
import { ContractStatus } from "./types";

function buildError(code: string, message: string, details?: Record<string, string>) {
  return { code, message, ...(details ? { details } : {}) } satisfies z.infer<typeof ContractError>;
}

export function mapBdaZoningToContract(
  result: BdaZoneResult,
  fetchedAt: string,
): BdaZoningContract {
  const latencyMs =
    (result as unknown as { latencyMs?: number }).latencyMs ??
    (result.inputsTried?.length ? result.inputsTried.length * 1000 : 0);

  if (result.status === "out_of_scope") {
    return {
      status: "out_of_scope",
      source: "bda-zoning",
      fetchedAt,
      sourceUrl: "https://bmc.gov.in/zone-info",
      latencyMs,
    };
  }

  if (result.status === "success") {
    const rows = result.data ?? [];
    if (rows.length > 0) {
      return {
        status: "ok",
        source: "bda-zoning",
        data: {
          rows,
          parserVersion: result.parserVersion,
        },
        fetchedAt,
        sourceUrl: "https://bmc.gov.in/zone-info",
        latencyMs,
      };
    }
    return {
      status: "no_data",
      source: "bda-zoning",
      error: buildError(
        "no_matching_zone",
        result.statusReason ?? "No BDA zone row matched the supplied (village, tehsil).",
      ),
      fetchedAt,
      sourceUrl: "https://bmc.gov.in/zone-info",
      latencyMs,
    };
  }

  const status: ContractStatus = "source_down";
  return {
    status,
    source: "bda-zoning",
    error: buildError(
      status,
      result.statusReason ?? "BDA zoning lookup failed",
    ),
    fetchedAt,
    sourceUrl: "https://bmc.gov.in/zone-info",
    latencyMs,
  };
}

/**
 * Sprint V5a — IGR Odisha SRO (Sub-Registrar Office) fetcher contract.
 *
 * The SRO fetcher is a pure data lookup (no network call). It maps tahasil →
 * SRO with contact details, EC portal URL, and operational metadata.
 *
 * Contract shape:
 *   - status: "ok" if SRO found, "no_data" if not found, "unavailable" on error
 *   - data: SRO metadata (sro, sroCode, address, contactUrl, etc.)
 */
import { z } from "zod";
import { ContractError, ContractEnvelopeBase } from "./types";

export const IgrSroDataSchema = z.object({
  district: z.string(),
  sro: z.string(),
  sroCode: z.string(),
  address: z.string(),
  contactUrl: z.string().url(),
  ecUrl: z.string().url(),
  operatingHours: z.string(),
  estimatedFee: z.string(),
  expectedTime: z.string(),
  matchedTahasilPattern: z.string().optional(),
});
export type IgrSroData = z.infer<typeof IgrSroDataSchema>;

export const IgrSroContract = z.discriminatedUnion("status", [
  ContractEnvelopeBase.extend({
    source: z.literal("igr-sro"),
    status: z.literal("ok"),
    data: IgrSroDataSchema,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("igr-sro"),
    status: z.literal("no_data"),
    error: ContractError,
  }),
  ContractEnvelopeBase.extend({
    source: z.literal("igr-sro"),
    status: z.literal("unavailable"),
    error: ContractError,
  }),
]);
export type IgrSroContract = z.infer<typeof IgrSroContract>;

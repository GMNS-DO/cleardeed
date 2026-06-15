/**
 * Sprint V5c — IGR Certified Copy (Phase 1: index-card only) fetcher contract.
 *
 * Book 1/2 of the IGR register is open to any person. It returns an index
 * entry (deed number, registration date, parties, property description,
 * consideration, market value, stamp duty) but NOT the full PDF. Book 4
 * (sale deeds, gift deeds, partition, release) is restricted to executant,
 * claimant, agent, or legal representative per Section 57 of the
 * Registration Act, 1908 — a third-party buyer cannot pull a Book 4
 * certified copy without cooperation from the seller (notarised POA,
 * death certificate, etc.).
 *
 * Phase 1 (this fetcher) ships with typed-degradation only. The full
 * end-to-end captcha + login flow for the index-card is the same
 * architecture as `igr-ec` and is parked behind D-035/D-037. Phase 2
 * (parked) would add the live captcha dispatch.
 *
 * What the fetcher does today:
 *   1. Probes the IGR certified-copy page (HTTP 200 + page shell).
 *   2. Returns a typed `not_covered` envelope with the verified-live URL
 *      and a manual-instructions fallback (D-037 pattern).
 *   3. The renderer (Section 2 "Previous sale deed (open index entry)"
 *      sub-card) shows the buyer how to look this up themselves.
 *
 * Endpoint (probed):
 *   GET https://igrodisha.gov.in/CertifiedCopy.aspx
 */

import { z } from "zod";

export const IndexEntrySchema = z.object({
  deedNo: z.string(),
  regDate: z.string(),
  party1: z.string(),
  party2: z.string(),
  propertyDesc: z.string().optional(),
  consideration: z.number().nonnegative().optional(),
  marketValue: z.number().nonnegative().optional(),
  stampDuty: z.number().nonnegative().optional(),
});
export type IndexEntry = z.infer<typeof IndexEntrySchema>;

export const CertifiedCopyDataSchema = z.object({
  pageUrl: z.string().url(),
  pageIsLive: z.boolean(),
  /** Empty in V5c Phase 1; reserved for Phase 2 (live parsing). */
  entries: z.array(IndexEntrySchema).default([]),
  section57Note: z.string(),
  manualInstructions: z.object({
    steps: z.array(z.string()),
    contactSRO: z.string().optional(),
    estimatedFeeINR: z.number().nonnegative().optional(),
    expectedTime: z.string().optional(),
  }),
});
export type CertifiedCopyData = z.infer<typeof CertifiedCopyDataSchema>;

export const CertifiedCopyResultSchema = z.object({
  source: z.literal("igr-certified-copy"),
  status: z.enum(["success", "partial", "failed", "not_covered"]),
  statusReason: z.string(),
  verification: z.enum(["verified", "manual_required", "not_applicable"]),
  fetchedAt: z.string().datetime(),
  attempts: z.number().int().nonnegative().optional(),
  inputsTried: z
    .array(
      z.object({
        label: z.string(),
        input: z.record(z.unknown()),
      })
    )
    .optional(),
  parserVersion: z.string(),
  data: CertifiedCopyDataSchema.optional(),
  warnings: z
    .array(
      z.object({
        code: z.string(),
        message: z.string(),
      })
    )
    .optional(),
  error: z.string().optional(),
});
export type CertifiedCopyResult = z.infer<typeof CertifiedCopyResultSchema>;

/**
 * Sprint V5c — IGR Public Dashboard fetcher contract.
 *
 * The IGR Odisha public dashboard is server-rendered ASP.NET WebForms
 * (`PublicDashboard.aspx`, `DeedWiseStatus.aspx`, `ORServiceNew.aspx`).
 * The page exposes district-level deed registration statistics via filter
 * dropdowns (From Date, To Date, District, SRO, Year, Month, Week) and
 * server-side postback — there is no public JSON/WebMethod endpoint.
 *
 * Per CLAUDE.md §3 rule 7 ("Automate everything. No concierge model"), the
 * fetcher probes the page (HTTP 200 + page shell) and returns a typed
 * `not_covered` envelope with the verified-live URL. The renderer (Section 6
 * "Official activity" sub-card) shows the live link and a fallback note.
 * Page scraping is explicitly out of scope for V5c — see D-046.
 *
 * Phase 2 (parked): if IGR ever exposes a JSON API, swap the typed
 * degradation for live parsing. The contract schema is forward-compatible.
 */

import { z } from "zod";

export const DashboardEntrySchema = z.object({
  district: z.string(),
  sro: z.string().optional(),
  deedType: z.string().optional(),
  totalDeeds: z.number().int().nonnegative().optional(),
  totalConsideration: z.number().nonnegative().optional(),
  period: z
    .object({
      from: z.string(),
      to: z.string(),
    })
    .optional(),
});
export type DashboardEntry = z.infer<typeof DashboardEntrySchema>;

export const PublicDashboardDataSchema = z.object({
  pageUrl: z.string().url(),
  pageIsLive: z.boolean(),
  districtFilter: z.string().optional(),
  sroFilter: z.string().optional(),
  periodFilter: z
    .object({
      from: z.string(),
      to: z.string(),
    })
    .optional(),
  /** Empty in V5c; reserved for Phase 2 (live JSON API). */
  entries: z.array(DashboardEntrySchema).default([]),
  /** The page is server-rendered; we don't parse its tables. */
  notes: z.array(z.string()).default([]),
});
export type PublicDashboardData = z.infer<typeof PublicDashboardDataSchema>;

export const PublicDashboardResultSchema = z.object({
  source: z.literal("public-dashboard"),
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
  data: PublicDashboardDataSchema.optional(),
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
export type PublicDashboardResult = z.infer<typeof PublicDashboardResultSchema>;

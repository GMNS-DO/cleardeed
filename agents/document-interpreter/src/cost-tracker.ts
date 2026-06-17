/**
 * Cost tracker for A12 — Document Interpreter.
 *
 * Plan §3.2: pre-flight gate + post-call record. Per-report ceiling is
 * $0.15 (hard). Org-level monthly cap is $500. We track both. When
 * either is exceeded, pre-flight refuses the call.
 *
 * Pricing (from plan §3.2):
 *   Sonnet 4.5: input $3/M, output $15/M, cache read $0.30/M, cache write +25%
 *   Haiku 4.5:  input $0.80/M, output $4/M, cache read $0.08/M, cache write +25%
 *
 * V1 uses a Supabase backend (table report_ai_costs). The interface
 * here is storage-agnostic — tests inject a noop store.
 */

import type { DocType } from "./schema";

const SONNET_INPUT_PER_M = 3.0;
const SONNET_OUTPUT_PER_M = 15.0;
const SONNET_CACHE_READ_PER_M = 0.3;
const SONNET_CACHE_WRITE_MULTIPLIER = 1.25;

const HAIKU_INPUT_PER_M = 0.8;
const HAIKU_OUTPUT_PER_M = 4.0;
const HAIKU_CACHE_READ_PER_M = 0.08;
const HAIKU_CACHE_WRITE_MULTIPLIER = 1.25;

export const PER_REPORT_CEILING_CENTS = 15; // $0.15
export const ORG_MONTHLY_CAP_CENTS = 50000; // $500

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export type CostEstimate = {
  model: string;
  totalCents: number;
  withinReportBudget: boolean;
  withinOrgBudget: boolean;
};

/** Choose model for a given doc type. Plan §3.1: Sonnet for IGR EC, Haiku for Bhulekh back. */
export function modelForDocType(docType: DocType): "claude-sonnet-4-5" | "claude-haiku-4-5" {
  return docType === "igr_ec" ? "claude-sonnet-4-5" : "claude-haiku-4-5";
}

export function estimateCost(model: string, usage: Usage): number {
  const isSonnet = model.startsWith("claude-sonnet");
  const inputRate = isSonnet ? SONNET_INPUT_PER_M : HAIKU_INPUT_PER_M;
  const outputRate = isSonnet ? SONNET_OUTPUT_PER_M : HAIKU_OUTPUT_PER_M;
  const cacheReadRate = isSonnet ? SONNET_CACHE_READ_PER_M : HAIKU_CACHE_READ_PER_M;
  const cacheWriteMult = isSonnet ? SONNET_CACHE_WRITE_MULTIPLIER : HAIKU_CACHE_WRITE_MULTIPLIER;

  const inputUsd = (usage.inputTokens * inputRate) / 1_000_000;
  const outputUsd = (usage.outputTokens * outputRate) / 1_000_000;
  const cacheReadUsd = (usage.cacheReadTokens * cacheReadRate) / 1_000_000;
  // Cache write: 25% premium on input rate.
  const cacheWriteUsd = (usage.cacheWriteTokens * inputRate * cacheWriteMult) / 1_000_000;
  const totalUsd = inputUsd + outputUsd + cacheReadUsd + cacheWriteUsd;
  return Math.round(totalUsd * 100); // cents
}

export type CostStore = {
  spentOnReportCents(reportId: string): Promise<number>;
  spentOnOrgCentsThisMonth(orgId: string | null): Promise<number>;
  isUnlocked(reportId: string, docType: DocType): Promise<boolean>;
  recordCost(record: {
    reportId: string;
    orgId: string | null;
    docType: DocType;
    model: string;
    costCents: number;
    durationMs: number;
    usage: Usage;
  }): Promise<void>;
};

const noopStore: CostStore = {
  spentOnReportCents: async () => 0,
  spentOnOrgCentsThisMonth: async () => 0,
  isUnlocked: async () => true,
  recordCost: async () => {},
};

export function makeCostStore(_opts: { supabase?: unknown; orgId: string | null }): CostStore {
  // V1 stub: in production this is a Supabase client. Tests pass the
  // noopStore. The real implementation lives in apps/web layer.
  return noopStore;
}

export async function preflight(
  store: CostStore,
  reportId: string,
  orgId: string | null,
  docType: DocType,
  estimatedCents: number,
): Promise<{ ok: boolean; reason?: string }> {
  // Payment gate: the upsell is a hard requirement for any LLM call.
  // Without an unlock, no token is burned. This is the cost-tracker
  // version of the upsell gate — the renderer separately shows
  // AIDocUpsellGate, but this is what actually stops the call.
  const unlocked = await store.isUnlocked(reportId, docType);
  if (!unlocked) {
    return { ok: false, reason: "ai_not_purchased" };
  }
  const reportSpent = await store.spentOnReportCents(reportId);
  if (reportSpent + estimatedCents > PER_REPORT_CEILING_CENTS) {
    return {
      ok: false,
      reason: `report_exceeds_ceiling:${reportSpent}+${estimatedCents}>${PER_REPORT_CEILING_CENTS}`,
    };
  }
  const orgSpent = await store.spentOnOrgCentsThisMonth(orgId);
  if (orgSpent + estimatedCents > ORG_MONTHLY_CAP_CENTS) {
    return { ok: false, reason: `org_exceeds_monthly_cap` };
  }
  return { ok: true };
}

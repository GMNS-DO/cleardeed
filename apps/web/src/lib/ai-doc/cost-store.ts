/**
 * Supabase-backed CostStore for the Document Interpreter.
 *
 * Replaces the package's noop stub (`agents/document-interpreter/src/cost-tracker.ts:makeCostStore`)
 * when called from the Next.js app. Two stores to keep:
 *   - spentOnReportCents / spentOnOrgCentsThisMonth (plan §3.2) — backed by `report_ai_costs`
 *   - isUnlocked — backed by `report_ai_unlocks` (new in P2 V1)
 *
 * The renderer (AIDocSummaryCard) shows the upsell gate when the SSE
 * returns `warnings: ["ai_not_purchased"]`, which is what preflight
 * returns when this store reports `isUnlocked() = false`.
 *
 * Plan §3.2: per-report P2 ceiling is $0.15. Org cap is $500/month.
 */

import { supabaseAdmin } from "@/lib/db";
import type { CostStore, Usage } from "@cleardeed/document-interpreter/cost-tracker";
import type { DocType } from "@cleardeed/document-interpreter/schema";

export function makeSupabaseCostStore(): CostStore {
  return {
    async spentOnReportCents(reportId) {
      try {
        const { data, error } = await supabaseAdmin()
          .from("report_ai_costs")
          .select("cost_usd_cents")
          .eq("report_id", reportId);
        if (error || !data) return 0;
        return data.reduce((sum, r) => sum + (r.cost_usd_cents ?? 0), 0);
      } catch {
        return 0;
      }
    },

    async spentOnOrgCentsThisMonth(orgId) {
      if (!orgId) return 0;
      try {
        const startOfMonth = new Date();
        startOfMonth.setUTCDate(1);
        startOfMonth.setUTCHours(0, 0, 0, 0);
        const { data, error } = await supabaseAdmin()
          .from("report_ai_costs")
          .select("cost_usd_cents")
          .eq("org_id", orgId)
          .gte("created_at", startOfMonth.toISOString());
        if (error || !data) return 0;
        return data.reduce((sum, r) => sum + (r.cost_usd_cents ?? 0), 0);
      } catch {
        return 0;
      }
    },

    async isUnlocked(reportId, docType: DocType) {
      try {
        const { data, error } = await supabaseAdmin()
          .from("report_ai_unlocks")
          .select("report_id")
          .eq("report_id", reportId)
          .eq("doc_type", docType)
          .maybeSingle();
        if (error) {
          // Conservative: deny on error so we don't burn tokens on a
          // not-paid report. The renderer will show the upsell.
          console.warn("[/lib/ai-doc/cost-store] isUnlocked query failed:", error);
          return false;
        }
        return data !== null;
      } catch {
        return false;
      }
    },

    async recordCost(record) {
      try {
        const usage: Usage = {
          inputTokens: record.usage?.inputTokens ?? 0,
          outputTokens: record.usage?.outputTokens ?? 0,
          cacheReadTokens: record.usage?.cacheReadTokens ?? 0,
          cacheWriteTokens: record.usage?.cacheWriteTokens ?? 0,
        };
        await supabaseAdmin().from("report_ai_costs").insert({
          report_id: record.reportId,
          org_id: record.orgId,
          doc_type: record.docType,
          model: record.model,
          cost_usd_cents: record.costCents,
          duration_ms: record.durationMs,
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
          cache_read_tokens: usage.cacheReadTokens,
          cache_write_tokens: usage.cacheWriteTokens,
        });
      } catch (err) {
        console.warn("[/lib/ai-doc/cost-store] recordCost failed:", err);
      }
    },
  };
}

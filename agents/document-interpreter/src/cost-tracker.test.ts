/**
 * Tests for cost-tracker.ts. Plan §3.2.
 */

import { describe, it, expect } from "vitest";
import {
  estimateCost,
  modelForDocType,
  preflight,
  PER_REPORT_CEILING_CENTS,
  ORG_MONTHLY_CAP_CENTS,
  type CostStore,
} from "./cost-tracker";

describe("cost-tracker.ts", () => {
  describe("modelForDocType", () => {
    it("returns Sonnet for igr_ec (plan §3.1)", () => {
      expect(modelForDocType("igr_ec")).toBe("claude-sonnet-4-5");
    });

    it("returns Haiku for bhulekh_back (plan §3.1)", () => {
      expect(modelForDocType("bhulekh_back")).toBe("claude-haiku-4-5");
    });
  });

  describe("estimateCost (plan §3.2)", () => {
    it("Sonnet cache-hit call (12k cached + 1k fresh + 800 out) ≈ $0.019", () => {
      const cents = estimateCost("claude-sonnet-4-5", {
        inputTokens: 1000,
        outputTokens: 800,
        cacheReadTokens: 12_000,
        cacheWriteTokens: 0,
      });
      // 1000 * 3 / 1e6 = 0.003, 800 * 15 / 1e6 = 0.012, 12000 * 0.30 / 1e6 = 0.0036
      // Total = 0.0186 → 2 cents (rounded)
      expect(cents).toBe(2);
    });

    it("Sonnet first call (no cache) (12k write + 1k fresh + 800 out) ≈ $0.027", () => {
      const cents = estimateCost("claude-sonnet-4-5", {
        inputTokens: 1000,
        outputTokens: 800,
        cacheReadTokens: 0,
        cacheWriteTokens: 12_000,
      });
      // 1000 * 3 / 1e6 = 0.003, 800 * 15 / 1e6 = 0.012, 12000 * 3 * 1.25 / 1e6 = 0.045
      // Total = 0.06 → 6 cents
      expect(cents).toBe(6);
    });

    it("Haiku cache-hit call (1.6k cached + 400 out) ≈ $0.0005", () => {
      const cents = estimateCost("claude-haiku-4-5", {
        inputTokens: 0,
        outputTokens: 400,
        cacheReadTokens: 1_600,
        cacheWriteTokens: 0,
      });
      // 0 input, 400 * 4 / 1e6 = 0.0016, 1600 * 0.08 / 1e6 = 0.000128
      // Total = 0.001728 → 0 cents (rounded)
      expect(cents).toBe(0);
    });

    it("Haiku first call (1.6k write + 400 out) ≈ $0.0024", () => {
      const cents = estimateCost("claude-haiku-4-5", {
        inputTokens: 0,
        outputTokens: 400,
        cacheReadTokens: 0,
        cacheWriteTokens: 1_600,
      });
      // 0 input, 400 * 4 / 1e6 = 0.0016, 1600 * 0.8 * 1.25 / 1e6 = 0.0016
      // Total = 0.0032 → 0 cents (rounded)
      expect(cents).toBe(0);
    });

    it("zero usage → zero cost", () => {
      const cents = estimateCost("claude-sonnet-4-5", {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });
      expect(cents).toBe(0);
    });
  });

  describe("preflight (plan §3.2)", () => {
    const makeStore = (
      reportSpent: number,
      orgSpent: number,
      unlocked = true,
    ): CostStore => ({
      spentOnReportCents: async () => reportSpent,
      spentOnOrgCentsThisMonth: async () => orgSpent,
      isUnlocked: async () => unlocked,
      recordCost: async () => {},
    });

    it("passes when within both budgets", async () => {
      const store = makeStore(0, 0);
      const r = await preflight(store, "report-1", "org-1", "igr_ec", 5);
      expect(r.ok).toBe(true);
    });

    it("rejects when per-report ceiling would be exceeded", async () => {
      const store = makeStore(PER_REPORT_CEILING_CENTS - 5, 0);
      const r = await preflight(store, "report-1", "org-1", "igr_ec", 10);
      expect(r.ok).toBe(false);
      expect(r.reason).toContain("report_exceeds_ceiling");
    });

    it("rejects when org monthly cap would be exceeded", async () => {
      const store = makeStore(0, ORG_MONTHLY_CAP_CENTS - 5);
      const r = await preflight(store, "report-1", "org-1", "igr_ec", 10);
      expect(r.ok).toBe(false);
      expect(r.reason).toContain("org_exceeds_monthly_cap");
    });

    it("passes exactly at the per-report ceiling", async () => {
      const store = makeStore(PER_REPORT_CEILING_CENTS, 0);
      const r = await preflight(store, "report-1", "org-1", "igr_ec", 0);
      expect(r.ok).toBe(true);
    });

    it("passes exactly at the org-monthly cap", async () => {
      const store = makeStore(0, ORG_MONTHLY_CAP_CENTS);
      const r = await preflight(store, "report-1", "org-1", "igr_ec", 0);
      expect(r.ok).toBe(true);
    });

    it("rejects when the report+docType is not unlocked", async () => {
      const store = makeStore(0, 0, false);
      const r = await preflight(store, "report-1", "org-1", "igr_ec", 5);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("ai_not_purchased");
    });

    it("unlock check fires before budget checks (payment is a hard gate)", async () => {
      // Both unlock=false AND over budget — we expect ai_not_purchased
      // because the order is unlock-first, budget-second.
      const store = makeStore(PER_REPORT_CEILING_CENTS + 1, ORG_MONTHLY_CAP_CENTS + 1, false);
      const r = await preflight(store, "report-1", "org-1", "igr_ec", 5);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("ai_not_purchased");
    });
  });
});

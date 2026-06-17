/**
 * Unit tests for the Supabase-backed CostStore.
 *
 * The store is a thin wrapper around four Supabase queries. We
 * exercise the contract — what each method returns for given query
 * results — by mocking @/lib/db. Real Supabase behaviour (RLS,
 * replication lag) is out of scope here; we trust the SQL in
 * infra/supabase/migrations/018.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const chain = {
  select: vi.fn(),
  eq: vi.fn(),
  gte: vi.fn(),
  maybeSingle: vi.fn(),
  insert: vi.fn(),
};

chain.select = vi.fn(() => chain);
chain.eq = vi.fn(() => chain);
chain.gte = vi.fn(() => chain);
chain.maybeSingle = vi.fn();
chain.insert = vi.fn(() => chain);

const fromMock = vi.fn(() => chain);
vi.mock("@/lib/db", () => ({
  supabaseAdmin: () => ({ from: fromMock }),
}));

import { makeSupabaseCostStore } from "./cost-store";

beforeEach(() => {
  vi.clearAllMocks();
  // Re-establish the chain after clearAllMocks
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.gte = vi.fn(() => chain);
  chain.maybeSingle = vi.fn();
  chain.insert = vi.fn(() => chain);
  fromMock.mockReturnValue(chain);
});

describe("makeSupabaseCostStore — payment gate (plan §3.1)", () => {
  it("isUnlocked returns true when a row exists for (report, docType)", async () => {
    chain.maybeSingle.mockResolvedValueOnce({ data: { report_id: "r1" }, error: null });
    const store = makeSupabaseCostStore();
    const ok = await store.isUnlocked("r1", "igr_ec");
    expect(ok).toBe(true);
    expect(fromMock).toHaveBeenCalledWith("report_ai_unlocks");
  });

  it("isUnlocked returns false when no row exists (the default before payment)", async () => {
    chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    const store = makeSupabaseCostStore();
    const ok = await store.isUnlocked("r1", "igr_ec");
    expect(ok).toBe(false);
  });

  it("isUnlocked returns false on query error (conservative — no tokens burned)", async () => {
    chain.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "rls" } });
    const store = makeSupabaseCostStore();
    const ok = await store.isUnlocked("r1", "igr_ec");
    expect(ok).toBe(false);
  });
});

describe("makeSupabaseCostStore — cost ceiling (plan §3.2)", () => {
  it("spentOnReportCents sums the cost rows for a report", async () => {
    // Final call (no .maybeSingle) — the chain resolves to {data, error}
    chain.select.mockReturnValueOnce({
      eq: vi.fn(() => ({
        // .eq is the last call; the promise resolves here
        then: (resolve: any) => resolve({ data: [{ cost_usd_cents: 5 }, { cost_usd_cents: 7 }], error: null }),
      })),
    });
    const store = makeSupabaseCostStore();
    const total = await store.spentOnReportCents("r1");
    expect(total).toBe(12);
  });

  it("spentOnOrgCentsThisMonth returns 0 when orgId is null", async () => {
    const store = makeSupabaseCostStore();
    const total = await store.spentOnOrgCentsThisMonth(null);
    expect(total).toBe(0);
  });

  it("recordCost inserts a row into report_ai_costs with token breakdown", async () => {
    const store = makeSupabaseCostStore();
    await store.recordCost({
      reportId: "r1",
      orgId: null,
      docType: "igr_ec",
      model: "claude-sonnet-4-5",
      costCents: 4,
      durationMs: 1234,
      usage: {
        inputTokens: 1000,
        outputTokens: 200,
        cacheReadTokens: 800,
        cacheWriteTokens: 0,
      },
    });
    expect(fromMock).toHaveBeenCalledWith("report_ai_costs");
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        report_id: "r1",
        doc_type: "igr_ec",
        model: "claude-sonnet-4-5",
        duration_ms: 1234,
        cost_usd_cents: 4,
        input_tokens: 1000,
        output_tokens: 200,
        cache_read_tokens: 800,
      })
    );
  });
});

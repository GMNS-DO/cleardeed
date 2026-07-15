import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "./route";

const mockUpsertChain = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockNot = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockLimit = vi.fn();

const supabase = {
  from: vi.fn((table: string) => {
    if (table === "reports") {
      // Chain: select().not().gte().lte().limit()
      const lte = vi.fn(() => ({ data: [], error: null }));
      const gte = vi.fn(() => ({ lte }));
      const not = vi.fn(() => ({ gte }));
      const select = vi.fn(() => ({ not }));
      return { select };
    }
    if (table === "survey_sends") {
      const insert = vi.fn(() => ({ error: null }));
      const eq2 = vi.fn(() => ({ maybeSingle: vi.fn(() => ({ data: null, error: null })) }));
      const eq1 = vi.fn(() => ({ eq: eq2 }));
      const select = vi.fn(() => ({ eq: eq1 }));
      return { select, insert };
    }
    return {};
  }),
};

vi.mock("@/lib/db", () => ({ supabaseAdmin: () => supabase }));

describe("/api/internal/survey/dispatch", () => {
  beforeEach(() => {
    process.env.INTERNAL_CRON_SECRET = "test-secret";
    supabase.from.mockClear();
  });

  it("401 when no secret header", async () => {
    const req = new Request("http://localhost/api/internal/survey/dispatch", { method: "POST" });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("500 when INTERNAL_CRON_SECRET is unset", async () => {
    const prev = process.env.INTERNAL_CRON_SECRET;
    delete process.env.INTERNAL_CRON_SECRET;
    const req = new Request("http://localhost/api/internal/survey/dispatch", {
      method: "POST",
      headers: { "x-cron-secret": "anything" },
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(500);
    process.env.INTERNAL_CRON_SECRET = prev;
  });

  it("passes through with valid secret and returns summary", async () => {
    const req = new Request("http://localhost/api/internal/survey/dispatch", {
      method: "POST",
      headers: { "x-cron-secret": "test-secret" },
      body: "{}",
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dispatched).toBe(0);
    expect(body.skipped).toBe(0);
    expect(body.days).toEqual([30, 90, 180, 365]);
  });
});

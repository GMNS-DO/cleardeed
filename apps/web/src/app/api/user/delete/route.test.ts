/**
 * Tests for /api/user/delete — DPDP Act Section 12 deletion endpoint.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";

/**
 * Mutable global chain. Tests can replace `chainResponses` to simulate
 * different supabase query results. Each entry is consumed in order, then
 * the chain returns a default empty result.
 */
let chainResponses: Array<{ data?: unknown; error?: unknown; count?: number }> = [];

function makeChain() {
  const chain: Record<string, unknown> = {};
  const methods = ["from", "select", "eq", "in", "is", "update", "not", "or"];
  for (const m of methods) {
    chain[m] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => void) => {
    const next = chainResponses.shift() ?? { data: [], error: null };
    resolve(next);
  };
  return chain;
}

vi.mock("@/lib/db", () => ({
  supabaseAdmin: () => makeChain(),
}));

vi.mock("@/lib/track", () => ({
  trackEvent: vi.fn(),
}));

import { trackEvent } from "@/lib/track";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/user/delete", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/user/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainResponses = [];
  });

  it("rejects request without phone", async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/phone is required/i);
  });

  it("rejects phone with invalid format", async () => {
    const res = await POST(makeRequest({ phone: "abc" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/phone format/i);
  });

  it("accepts valid phone and returns ok with retention policy", async () => {
    // Lead lookup → no leads, all updates return no error
    chainResponses = [
      { data: [], error: null }, // lead lookup
      { data: [], error: null }, // feedback count
    ];
    const res = await POST(makeRequest({ phone: "+91 98765 43210" }));
    if (res.status !== 200) {
      const errBody = await res.json();
      throw new Error(`Expected 200, got ${res.status}: ${JSON.stringify(errBody)}`);
    }
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.deletedCounts).toBeDefined();
    expect(body.retentionPolicy).toMatch(/30 days/);
  });

  it("emits user_deletion_request funnel event", async () => {
    chainResponses = [{ data: [], error: null }];
    await POST(makeRequest({ phone: "+91 98765 43210" }));
    expect(trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "user_deletion_request",
      })
    );
  });

  it("accepts long reason without erroring", async () => {
    chainResponses = [
      { data: [], error: null },
      { data: [], error: null },
    ];
    const longReason = "x".repeat(500);
    const res = await POST(makeRequest({ phone: "+91 98765 43210", reason: longReason }));
    expect(res.status).toBe(200);
  });

  it("returns 500 when lead lookup fails", async () => {
    chainResponses = [{ data: null, error: { message: "connection lost" } }];
    const res = await POST(makeRequest({ phone: "+91 98765 43210" }));
    expect(res.status).toBe(500);
  });
});

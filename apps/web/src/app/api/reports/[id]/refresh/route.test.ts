/**
 * Integration test for POST /api/reports/:id/refresh — Sprint 5's
 * pay-to-refresh endpoint.
 *
 * Verifies:
 * - 500 when Razorpay credentials are not configured
 * - 404 when the report does not exist
 * - 409 when the report is still valid (no refresh needed)
 * - 200 with { orderId, amount: 29900, ... } when a Razorpay order is created
 *   and the report is genuinely expired
 *
 * The Supabase admin client is mocked so the test does not require a real DB.
 * The Razorpay HTTPS call is mocked via global.fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const getReportMock = vi.fn();
const supabaseUpsertMock = vi.fn();
const getAuthUserMock = vi.fn();

vi.mock("../../../../../lib/db", () => ({
  // The route imports { supabaseAdmin, getReport, isReportExpired } from "@/lib/db".
  // We mock getReport and isReportExpired; the supabase admin client is mocked
  // separately for the upsert call.
  getReport: (...args: unknown[]) => getReportMock(...args),
  isReportExpired: (report: { expires_at: string | null; revoked_at: string | null }) => {
    if (report.revoked_at) return true;
    if (!report.expires_at) return false;
    return new Date(report.expires_at).getTime() <= Date.now();
  },
  supabaseAdmin: () => ({
    from: () => ({
      upsert: supabaseUpsertMock,
    }),
  }),
}));

// T-013: hard auth gate. Default to "authenticated buyer". Tests for the
// 401 path override this mock to return null.
vi.mock("../../../../../lib/auth-helpers", () => ({
  getAuthUser: () => getAuthUserMock(),
}));

import { POST } from "./route";

const originalEnv = { ...process.env };
const originalFetch = global.fetch;

describe("POST /api/reports/:id/refresh", () => {
  beforeEach(() => {
    getReportMock.mockReset();
    supabaseUpsertMock.mockReset();
    supabaseUpsertMock.mockResolvedValue({ error: null });
    getAuthUserMock.mockReset();
    getAuthUserMock.mockResolvedValue({ id: "user-test", phone: "+919876543210" });
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "rzp_test_secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it("returns 401 when not authenticated (T-013 hard auth gate)", async () => {
    getAuthUserMock.mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/reports/rep_1/refresh", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "rep_1" }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("login_required");
    expect(body.next).toContain("/login?next=");
  });

  it("returns 500 when Razorpay credentials are not configured", async () => {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

    const req = new NextRequest("http://localhost/api/reports/rep_1/refresh", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "rep_1" }) });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toMatch(/RAZORPAY/i);
  });

  it("returns 404 when the report does not exist", async () => {
    getReportMock.mockResolvedValue({ report: null });
    const req = new NextRequest("http://localhost/api/reports/rep_missing/refresh", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "rep_missing" }) });
    expect(res.status).toBe(404);
  });

  it("returns 409 when the report is still valid (no refresh needed)", async () => {
    const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    // The route passes the report object to isReportExpired(), which reads
    // .expires_at (snake_case) per the production DbReport type. We match
    // that contract here so the test exercises the real check.
    getReportMock.mockResolvedValue({
      report: { id: "rep_fresh", userId: "user-test", expires_at: future, revoked_at: null, html: "<p>x</p>", status: "complete" },
    });

    const req = new NextRequest("http://localhost/api/reports/rep_fresh/refresh", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "rep_fresh" }) });
    expect(res.status).toBe(409);
  });

  it("creates a Razorpay order for ₹299 and stores a refresh session when the report is expired", async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    getReportMock.mockResolvedValue({
      report: { id: "rep_expired", userId: "user-test", expires_at: past, revoked_at: null, html: "<p>x</p>", status: "complete" },
    });

    // Mock the Razorpay order creation.
    let razorpayCallSeen: { url: string; body: Record<string, unknown> } | null = null;
    global.fetch = vi.fn(async (url, init) => {
      const u = String(url);
      if (u.includes("api.razorpay.com/v1/orders")) {
        razorpayCallSeen = {
          url: u,
          body: JSON.parse(String(init?.body ?? "{}")),
        };
        return new Response(
          JSON.stringify({ id: "order_xyz123", amount: 29900, currency: "INR", status: "created" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    const req = new NextRequest("http://localhost/api/reports/rep_expired/refresh", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "rep_expired" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.orderId).toBe("order_xyz123");
    expect(body.amount).toBe(29900);
    expect(body.currency).toBe("INR");
    expect(body.reportId).toBe("rep_expired");

    // Razorpay was called with the right shape.
    expect(razorpayCallSeen).not.toBeNull();
    expect(razorpayCallSeen!.url).toBe("https://api.razorpay.com/v1/orders");
    expect(razorpayCallSeen!.body.amount).toBe(29900);
    expect(razorpayCallSeen!.body.currency).toBe("INR");
    expect(razorpayCallSeen!.body.notes).toEqual({ kind: "refresh", reportId: "rep_expired" });

    // The session was stored in checkout_sessions tagged as kind: "refresh".
    expect(supabaseUpsertMock).toHaveBeenCalledTimes(1);
    const stored = supabaseUpsertMock.mock.calls[0][0];
    expect(stored.session_data).toEqual({ kind: "refresh", reportId: "rep_expired", auth_uid: "user-test" });
    expect(stored.expires_at).toBeTruthy();
  });
});

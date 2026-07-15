/**
 * Tests for POST /api/checkout — guarantee consent + lawyer_id fields.
 *
 * Verifies:
 * - guaranteed tier without guaranteeAccepted returns 400
 * - guaranteed tier with guaranteeAccepted=true stores session
 * - standard tier without guaranteeAccepted succeeds
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

// Mock auth
vi.mock("@/lib/auth-helpers", () => ({
  getAuthUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));

// Mock DB
vi.mock("@/lib/db", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    }),
  }),
}));

// Mock track
vi.mock("@/lib/track", () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

function buildBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    orderId: `test-order-${Math.floor(Math.random() * 1000000)}`,
    tehsil: "Bhubaneswar",
    tehsilValue: "Bhubaneswar",
    village: "Test Village",
    villageCode: "1234",
    searchMode: "plot",
    identifier: "123/1",
    tier: "standard",
    ...overrides,
  };
}

async function callCheckout(body: Record<string, unknown>) {
  const req = new NextRequest("http://localhost/api/checkout", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
  const res = await POST(req);
  const json = await res.json();
  return { status: res.status, body: json };
}

describe("POST /api/checkout — guarantee consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when tier is guaranteed but guaranteeAccepted is missing", async () => {
    const { status, body } = await callCheckout({
      orderId: `order-missing-consent-${Date.now()}`,
      tehsil: "Bhubaneswar",
      tehsilValue: "Bhubaneswar",
      village: "Test Village",
      villageCode: "1234",
      searchMode: "plot",
      identifier: "123/1",
      tier: "guaranteed",
      // guaranteeAccepted is undefined
    });
    expect(status).toBe(400);
    expect(body.error).toBe("guarantee_consent_required");
    expect(body.message).toMatch(/guarantee terms/);
  });

  it("returns 400 when tier is guaranteed but guaranteeAccepted is false", async () => {
    const { status, body } = await callCheckout({
      orderId: `order-false-consent-${Date.now()}`,
      tehsil: "Bhubaneswar",
      tehsilValue: "Bhubaneswar",
      village: "Test Village",
      villageCode: "1234",
      searchMode: "plot",
      identifier: "123/1",
      tier: "guaranteed",
      guaranteeAccepted: false,
    });
    expect(status).toBe(400);
    expect(body.error).toBe("guarantee_consent_required");
  });

  it("stores session successfully when tier is guaranteed and guaranteeAccepted is true", async () => {
    const { status, body } = await callCheckout({
      orderId: `order-guarantee-${Date.now()}`,
      tehsil: "Bhubaneswar",
      tehsilValue: "Bhubaneswar",
      village: "Test Village",
      villageCode: "1234",
      searchMode: "plot",
      identifier: "123/1",
      tier: "guaranteed",
      guaranteeAccepted: true,
      lawyerId: null,
    });
    expect(status).toBe(200);
    expect(body.stored).toBe(true);
  });

  it("stores session with lawyerId when provided", async () => {
    const { status, body } = await callCheckout({
      orderId: `order-lawyer-${Date.now()}`,
      tehsil: "Bhubaneswar",
      tehsilValue: "Bhubaneswar",
      village: "Test Village",
      villageCode: "1234",
      searchMode: "plot",
      identifier: "123/1",
      tier: "guaranteed",
      guaranteeAccepted: true,
      lawyerId: "some-lawyer-uuid",
    });
    expect(status).toBe(200);
    expect(body.stored).toBe(true);
  });

  it("succeeds for standard tier without guaranteeAccepted", async () => {
    const { status, body } = await callCheckout({
      orderId: `order-standard-${Date.now()}`,
      tehsil: "Bhubaneswar",
      tehsilValue: "Bhubaneswar",
      village: "Test Village",
      villageCode: "1234",
      searchMode: "plot",
      identifier: "123/1",
      tier: "standard",
    });
    expect(status).toBe(200);
    expect(body.stored).toBe(true);
  });

  it("succeeds for verified tier without guaranteeAccepted", async () => {
    const { status, body } = await callCheckout({
      orderId: `order-verified-${Date.now()}`,
      tehsil: "Bhubaneswar",
      tehsilValue: "Bhubaneswar",
      village: "Test Village",
      villageCode: "1234",
      searchMode: "plot",
      identifier: "123/1",
      tier: "verified",
    });
    expect(status).toBe(200);
    expect(body.stored).toBe(true);
  });
});

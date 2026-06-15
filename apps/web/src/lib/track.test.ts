/**
 * Tests for the conversion-funnel tracking helper.
 *
 * Verifies that trackEvent():
 * - Inserts a row with event_name, report_id (or null), and event_data
 * - Swallows Supabase errors (must never throw into the calling route)
 * - Passes a JSONB object into event_data, not a string
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase admin client module before importing track
const insertMock = vi.fn();
vi.mock("./db", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      insert: insertMock,
    }),
  }),
}));

import { trackEvent } from "./track";
import { trackError } from "./track";

describe("trackEvent", () => {
  beforeEach(() => {
    insertMock.mockReset();
  });

  it("writes a row for landing_view with report_id = null", async () => {
    insertMock.mockResolvedValue({ error: null });
    await trackEvent({ eventName: "landing_view" });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith({
      report_id: null,
      event_name: "landing_view",
      event_data: {},
    });
  });

  it("writes a row for payment_success with the report_id and metadata", async () => {
    insertMock.mockResolvedValue({ error: null });
    await trackEvent({
      eventName: "payment_success",
      reportId: "abc-123",
      metadata: { orderId: "ord_xyz", fastPath: true },
    });
    expect(insertMock).toHaveBeenCalledWith({
      report_id: "abc-123",
      event_name: "payment_success",
      event_data: { orderId: "ord_xyz", fastPath: true },
    });
  });

  it("uses null report_id when none is provided", async () => {
    insertMock.mockResolvedValue({ error: null });
    await trackEvent({ eventName: "checkout_open", metadata: { orderId: "ord_1" } });
    const call = insertMock.mock.calls[0][0];
    expect(call.report_id).toBeNull();
    expect(call.event_name).toBe("checkout_open");
    expect(call.event_data).toEqual({ orderId: "ord_1" });
  });

  it("swallows Supabase errors without throwing", async () => {
    insertMock.mockResolvedValue({ error: { message: "table not found" } });
    // Should not throw — the user flow must not break if tracking fails.
    await expect(trackEvent({ eventName: "preview_view" })).resolves.toBeUndefined();
  });

  it("swallows thrown exceptions from the Supabase client", async () => {
    insertMock.mockRejectedValue(new Error("network down"));
    await expect(trackEvent({ eventName: "feedback_submitted", reportId: "r-1" })).resolves.toBeUndefined();
  });
});

describe("trackError", () => {
  beforeEach(() => {
    insertMock.mockReset();
  });

  it("writes error_caught event with name, message, route, reportId, ts", async () => {
    insertMock.mockResolvedValue({ error: null });
    const err = new TypeError("captcha solver exhausted");
    await trackError(err, { route: "/api/report/create", reportId: "r-99" });

    expect(insertMock).toHaveBeenCalledTimes(1);
    const call = insertMock.mock.calls[0][0];
    expect(call.event_name).toBe("error_caught");
    expect(call.report_id).toBe("r-99");
    expect(call.event_data.name).toBe("TypeError");
    expect(call.event_data.message).toBe("captcha solver exhausted");
    expect(call.event_data.route).toBe("/api/report/create");
    expect(call.event_data.ts).toBeTruthy();
    expect(typeof call.event_data.stack).toBe("string");
  });

  it("handles non-Error throws (string, undefined, plain object)", async () => {
    insertMock.mockResolvedValue({ error: null });
    await trackError("plain string error", { route: "/api/checkout" });
    const call = insertMock.mock.calls[0][0];
    expect(call.event_name).toBe("error_caught");
    expect(call.event_data.name).toBe("UnknownError");
    expect(call.event_data.message).toBe("plain string error");
  });

  it("includes extra metadata fields", async () => {
    insertMock.mockResolvedValue({ error: null });
    await trackError(new Error("x"), { route: "/api/order", extra: { fetcher: "bhulekh", status: 502 } });
    const call = insertMock.mock.calls[0][0];
    expect(call.event_data.fetcher).toBe("bhulekh");
    expect(call.event_data.status).toBe(502);
  });

  it("truncates the stack to 10 frames", async () => {
    insertMock.mockResolvedValue({ error: null });
    const lines: string[] = [];
    for (let i = 0; i < 50; i++) lines.push(`    at frame ${i}`);
    const err = new Error("deep stack");
    err.stack = `Error: deep stack\n${lines.join("\n")}`;
    await trackError(err, { route: "/api/x" });
    const call = insertMock.mock.calls[0][0];
    const stackLines = (call.event_data.stack as string).split("\n");
    // Stack is truncated to 10 frames; we take lines[0..10] = 10 lines.
    expect(stackLines.length).toBe(10);
  });

  it("swallows Supabase errors without throwing", async () => {
    insertMock.mockResolvedValue({ error: { message: "table not found" } });
    await expect(trackError(new Error("captcha_solver_exhausted"), { route: "/api/y" })).resolves.toBeUndefined();
  });
});

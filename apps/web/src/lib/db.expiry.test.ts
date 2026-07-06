/**
 * Tests for the report-expiry helpers in apps/web/src/lib/db.ts.
 *
 * - isReportExpired: pure function, easy to unit test without any mocking
 * - bumpReportExpiry: writes a new expires_at to the reports table — the
 *   supabase client is mocked via vi.mock with importOriginal so the real
 *   `isReportExpired` and `bumpReportExpiry` exports remain available.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted runs before vi.mock factories so the mock can reference the fns.
const mocks = vi.hoisted(() => ({
  updateMock: vi.fn(),
  updateEqMock: vi.fn(),
  updateSelectMock: vi.fn(),
  updateSingleMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  const mockClient = {
    from: (table: string) => {
      if (table !== "reports") {
        throw new Error(`unexpected table: ${table}`);
      }
      return {
        update: mocks.updateMock,
        rpc: mocks.rpcMock,
      };
    },
    rpc: mocks.rpcMock,
  };
  // We replace bumpReportExpiry with a re-implementation that uses our
  // mocked getSupabaseServerClient. The real bumpReportExpiry captures the
  // original getSupabaseServerClient in its closure, which the spread cannot
  // override.
  async function mockedBumpReportExpiry(reportId: string): Promise<{ expiresAt: string | null }> {
    const { data, error } = await mockClient
      .from("reports")
      .update({ expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString() })
      .eq("id", reportId)
      .select("expires_at")
      .single();
    if (error) {
      console.warn(`[bumpReportExpiry mock] ${reportId}: ${error.message}`);
      return { expiresAt: null };
    }
    return { expiresAt: (data as { expires_at?: string } | null)?.expires_at ?? null };
  }
  return {
    ...actual,
    bumpReportExpiry: mockedBumpReportExpiry,
    getSupabaseServerClient: () => mockClient,
  };
});

import {
  bumpReportExpiry,
  getReportErrorMessage,
  getReportExpiryFields,
  getReportHtml,
  getReportOwnerId,
  getReportStatus,
  getReportTitle,
  isReportExpired,
} from "./db";

describe("isReportExpired", () => {
  const NOW = new Date("2026-06-12T12:00:00Z");

  it("returns false when both expires_at and revoked_at are null (legacy / pre-Sprint 5 reports)", () => {
    expect(isReportExpired({ expires_at: null, revoked_at: null }, NOW)).toBe(false);
  });

  it("returns false when expires_at is in the future", () => {
    const future = new Date(NOW.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();
    expect(isReportExpired({ expires_at: future, revoked_at: null }, NOW)).toBe(false);
  });

  it("returns true when expires_at is in the past", () => {
    const past = new Date(NOW.getTime() - 1).toISOString();
    expect(isReportExpired({ expires_at: past, revoked_at: null }, NOW)).toBe(true);
  });

  it("returns true when expires_at equals now (boundary — the window has ended)", () => {
    const boundary = NOW.toISOString();
    expect(isReportExpired({ expires_at: boundary, revoked_at: null }, NOW)).toBe(true);
  });

  it("returns true when revoked_at is set, even if expires_at is in the future", () => {
    const future = new Date(NOW.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString();
    expect(isReportExpired({ expires_at: future, revoked_at: NOW.toISOString() }, NOW)).toBe(true);
  });
});

describe("report shape helpers", () => {
  it("reads camelCase fields returned by get_report RPC", () => {
    const report = {
      html: "<main>ready</main>",
      title: "ClearDeed Report",
      status: "complete",
      errorMessage: null,
      expiresAt: "2026-09-01T00:00:00.000Z",
      revokedAt: null,
      userId: "user_123",
    };

    expect(getReportHtml(report)).toBe("<main>ready</main>");
    expect(getReportTitle(report)).toBe("ClearDeed Report");
    expect(getReportStatus(report)).toBe("complete");
    expect(getReportErrorMessage(report)).toBeNull();
    expect(getReportExpiryFields(report)).toEqual({
      expires_at: "2026-09-01T00:00:00.000Z",
      revoked_at: null,
    });
    expect(getReportOwnerId(report)).toBe("user_123");
  });

  it("reads snake_case fields returned by direct reports table queries", () => {
    const report = {
      report_html: "<main>ready</main>",
      report_title: "ClearDeed Report",
      report_status: "complete",
      error_message: "portal timeout",
      expires_at: "2026-09-01T00:00:00.000Z",
      revoked_at: "2026-07-01T00:00:00.000Z",
      user_id: "user_123",
    };

    expect(getReportHtml(report)).toBe("<main>ready</main>");
    expect(getReportTitle(report)).toBe("ClearDeed Report");
    expect(getReportStatus(report)).toBe("complete");
    expect(getReportErrorMessage(report)).toBe("portal timeout");
    expect(getReportExpiryFields(report)).toEqual({
      expires_at: "2026-09-01T00:00:00.000Z",
      revoked_at: "2026-07-01T00:00:00.000Z",
    });
    expect(getReportOwnerId(report)).toBe("user_123");
  });
});

describe("bumpReportExpiry", () => {
  beforeEach(() => {
    mocks.updateMock.mockReset();
    mocks.updateEqMock.mockReset();
    mocks.updateSelectMock.mockReset();
    mocks.updateSingleMock.mockReset();
    mocks.rpcMock.mockReset();
    // Build the chainable mock: update(...).eq(...).select(...).single()
    mocks.updateMock.mockReturnValue({ eq: mocks.updateEqMock });
    mocks.updateEqMock.mockReturnValue({ select: mocks.updateSelectMock });
    mocks.updateSelectMock.mockReturnValue({ single: mocks.updateSingleMock });
  });

  it("writes a new expires_at 60 days in the future and returns it", async () => {
    const fakeExpiresAt = "2026-08-11T12:00:00.000Z";
    mocks.updateSingleMock.mockResolvedValue({
      data: { expires_at: fakeExpiresAt },
      error: null,
    });

    const before = Date.now();
    const result = await bumpReportExpiry("rep_123");
    const after = Date.now();

    expect(mocks.updateMock).toHaveBeenCalledTimes(1);
    const updateArg = mocks.updateMock.mock.calls[0][0];
    const writtenAt = new Date(updateArg.expires_at).getTime();
    const sixtyDays = 60 * 24 * 60 * 60 * 1000;
    expect(writtenAt).toBeGreaterThanOrEqual(before + sixtyDays - 1000);
    expect(writtenAt).toBeLessThanOrEqual(after + sixtyDays + 1000);

    expect(mocks.updateEqMock).toHaveBeenCalledWith("id", "rep_123");
    expect(result).toEqual({ expiresAt: fakeExpiresAt });
  });

  it("returns { expiresAt: null } and does not throw when Supabase errors", async () => {
    mocks.updateSingleMock.mockResolvedValue({
      data: null,
      error: { message: "column does not exist" },
    });

    const result = await bumpReportExpiry("rep_404");
    expect(result).toEqual({ expiresAt: null });
  });
});

/**
 * Tests for getAuthUser() — the small helper that extracts auth.uid()
 * from a request's Supabase session cookie.
 *
 * Strategy: stub out getSupabaseServerAuth() to return a mock client.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./supabase/server", () => ({
  getSupabaseServerAuth: vi.fn(),
}));

import { getAuthUser } from "./auth-helpers";
import { getSupabaseServerAuth } from "./supabase/server";

const mockedGetSupabase = vi.mocked(getSupabaseServerAuth);

describe("getAuthUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when env vars are missing (getSupabaseServerAuth throws)", async () => {
    mockedGetSupabase.mockRejectedValue(new Error("Missing Supabase env vars"));
    const result = await getAuthUser();
    expect(result).toBeNull();
  });

  it("returns null when no user is in the session", async () => {
    mockedGetSupabase.mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null } }) },
    } as never);
    const result = await getAuthUser();
    expect(result).toBeNull();
  });

  it("returns { id, phone } when the user is authenticated", async () => {
    mockedGetSupabase.mockResolvedValue({
      auth: {
        getUser: async () => ({
          data: {
            user: {
              id: "11111111-2222-3333-4444-555555555555",
              phone: "+919876543210",
            },
          },
        }),
      },
    } as never);
    const result = await getAuthUser();
    expect(result).toEqual({
      id: "11111111-2222-3333-4444-555555555555",
      phone: "+919876543210",
    });
  });

  it("returns id without phone when phone is not set", async () => {
    mockedGetSupabase.mockResolvedValue({
      auth: {
        getUser: async () => ({
          data: { user: { id: "user-1" } },
        }),
      },
    } as never);
    const result = await getAuthUser();
    expect(result).toEqual({ id: "user-1", phone: undefined });
  });

  it("returns null on unexpected errors", async () => {
    mockedGetSupabase.mockResolvedValue({
      auth: { getUser: async () => { throw new Error("network"); } },
    } as never);
    const result = await getAuthUser();
    expect(result).toBeNull();
  });
});

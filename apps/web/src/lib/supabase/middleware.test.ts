/**
 * Tests for updateSession() — the Supabase session-refresh helper used by
 * the Next.js middleware.
 *
 * Strategy: stub out @supabase/ssr's createServerClient and verify the helper
 * delegates correctly, propagates the user, and returns the cookies set on
 * the request.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

import { createServerClient } from "@supabase/ssr";
import { updateSession, buildLoginRedirect } from "./middleware";

const mockedCreateServerClient = vi.mocked(createServerClient);

describe("updateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
  });

  it("returns null user when env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const request = new NextRequest("https://example.com/anything");
    const result = await updateSession(request);
    expect(result.user).toBeNull();
    expect(result.supabase).toBeNull();
    expect(result.response).toBeDefined();
  });

  it("returns the user when the session is valid", async () => {
    mockedCreateServerClient.mockReturnValue({
      auth: {
        getUser: async () => ({
          data: { user: { id: "user-1" } },
        }),
      },
    } as never);

    const request = new NextRequest("https://example.com/dashboard");
    const result = await updateSession(request);
    expect(result.user).toEqual({ id: "user-1" });
    expect(mockedCreateServerClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "test-anon-key",
      expect.objectContaining({ cookies: expect.any(Object) })
    );
  });

  it("returns null user when there is no session", async () => {
    mockedCreateServerClient.mockReturnValue({
      auth: {
        getUser: async () => ({ data: { user: null } }),
      },
    } as never);
    const request = new NextRequest("https://example.com/dashboard");
    const result = await updateSession(request);
    expect(result.user).toBeNull();
  });
});

describe("buildLoginRedirect", () => {
  it("redirects to /login?next=<path>", () => {
    const request = new NextRequest("https://example.com/checkout/abc");
    const res = buildLoginRedirect(request);
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/login?next=");
    expect(decodeURIComponent(location ?? "")).toContain("/checkout/abc");
  });

  it("preserves search params in next", () => {
    const request = new NextRequest("https://example.com/checkout?x=1&y=2");
    const res = buildLoginRedirect(request);
    const location = res.headers.get("location") ?? "";
    expect(decodeURIComponent(location)).toContain("/checkout?x=1&y=2");
  });
});
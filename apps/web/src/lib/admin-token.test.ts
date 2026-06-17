/**
 * Tests for the admin-token helper.
 */
import { describe, it, expect, afterEach } from "vitest";
import { assertAdminToken } from "./admin-token";

function makeReq(headers: Record<string, string>): Parameters<typeof assertAdminToken>[0] {
  // Minimal mock — the helper only reads `headers.get`.
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as Parameters<typeof assertAdminToken>[0];
}

describe("assertAdminToken", () => {
  const prevToken = process.env.REPORT_CREATE_TOKEN;
  const prevAdmin = process.env.ADMIN_VIEW_TOKEN;

  afterEach(() => {
    if (prevToken === undefined) delete process.env.REPORT_CREATE_TOKEN;
    else process.env.REPORT_CREATE_TOKEN = prevToken;
    if (prevAdmin === undefined) delete process.env.ADMIN_VIEW_TOKEN;
    else process.env.ADMIN_VIEW_TOKEN = prevAdmin;
  });

  it("returns true when no token is configured (concierge launch)", () => {
    delete process.env.REPORT_CREATE_TOKEN;
    delete process.env.ADMIN_VIEW_TOKEN;
    expect(assertAdminToken(makeReq({}))).toBe(true);
  });

  it("returns true with matching x-cleardeed-admin-token header", () => {
    process.env.ADMIN_VIEW_TOKEN = "secret123";
    delete process.env.REPORT_CREATE_TOKEN;
    expect(
      assertAdminToken(makeReq({ "x-cleardeed-admin-token": "secret123" })),
    ).toBe(true);
  });

  it("returns true with matching Authorization Bearer", () => {
    process.env.ADMIN_VIEW_TOKEN = "secret123";
    delete process.env.REPORT_CREATE_TOKEN;
    expect(
      assertAdminToken(
        makeReq({ authorization: "Bearer secret123" }),
      ),
    ).toBe(true);
  });

  it("returns false when token is wrong", () => {
    process.env.ADMIN_VIEW_TOKEN = "secret123";
    delete process.env.REPORT_CREATE_TOKEN;
    expect(
      assertAdminToken(
        makeReq({ "x-cleardeed-admin-token": "wrong" }),
      ),
    ).toBe(false);
  });

  it("returns false when no token is supplied", () => {
    process.env.ADMIN_VIEW_TOKEN = "secret123";
    delete process.env.REPORT_CREATE_TOKEN;
    expect(assertAdminToken(makeReq({}))).toBe(false);
  });

  it("REPORT_CREATE_TOKEN takes precedence over ADMIN_VIEW_TOKEN", () => {
    process.env.ADMIN_VIEW_TOKEN = "old";
    process.env.REPORT_CREATE_TOKEN = "new";
    expect(
      assertAdminToken(makeReq({ "x-cleardeed-admin-token": "new" })),
    ).toBe(true);
    expect(
      assertAdminToken(makeReq({ "x-cleardeed-admin-token": "old" })),
    ).toBe(false);
  });
});

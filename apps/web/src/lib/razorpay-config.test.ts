/**
 * Tests for the Razorpay safety guard.
 *
 * These tests pin the safety contract: a live key in development must be
 * rejected, a test key in development must be accepted, and any missing
 * key must be rejected with an actionable message.
 *
 * The tests do not touch the real Razorpay API. They manipulate
 * process.env directly.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  assertRazorpaySafe,
  classifyRazorpayKey,
  getRazorpayKeys,
} from "./razorpay-config";

const originalEnv = { ...process.env };

beforeEach(() => {
  // Snapshot the env, then strip Razorpay vars so each test sets its own.
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
  delete process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
});

afterEach(() => {
  // Restore the original env. Important: vitest shares process.env across
  // test files in the same worker, so a leak here would affect other tests.
  for (const k of Object.keys(process.env)) {
    if (!(k in originalEnv)) delete process.env[k];
  }
  Object.assign(process.env, originalEnv);
});

describe("classifyRazorpayKey", () => {
  it("returns 'test' for rzp_test_ prefix", () => {
    expect(classifyRazorpayKey("rzp_test_abc123")).toBe("test");
  });

  it("returns 'live' for rzp_live_ prefix", () => {
    expect(classifyRazorpayKey("rzp_live_abc123")).toBe("live");
  });

  it("returns 'unconfigured' for null", () => {
    expect(classifyRazorpayKey(null)).toBe("unconfigured");
  });

  it("returns 'unconfigured' for undefined", () => {
    expect(classifyRazorpayKey(undefined)).toBe("unconfigured");
  });

  it("returns 'unconfigured' for empty string", () => {
    expect(classifyRazorpayKey("")).toBe("unconfigured");
  });

  it("treats unknown prefixes as live (conservative)", () => {
    // If we don't recognize the prefix, the safe default is to assume
    // it's live and refuse it. This is the "fail closed" decision.
    expect(classifyRazorpayKey("rzp_unknown_xyz")).toBe("live");
  });
});

describe("getRazorpayKeys", () => {
  it("returns null when neither key is set", () => {
    expect(getRazorpayKeys()).toBeNull();
  });

  it("returns null when only keyId is set", () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
    expect(getRazorpayKeys()).toBeNull();
  });

  it("returns null when only keySecret is set", () => {
    process.env.RAZORPAY_KEY_SECRET = "secret123";
    expect(getRazorpayKeys()).toBeNull();
  });

  it("returns the pair when both are set on the server-side vars", () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
    process.env.RAZORPAY_KEY_SECRET = "secret123";
    expect(getRazorpayKeys()).toEqual({
      keyId: "rzp_test_abc",
      keySecret: "secret123",
    });
  });

  it("falls back to NEXT_PUBLIC_RAZORPAY_KEY_ID when RAZORPAY_KEY_ID is unset", () => {
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_pubkey";
    process.env.RAZORPAY_KEY_SECRET = "secret123";
    expect(getRazorpayKeys()).toEqual({
      keyId: "rzp_test_pubkey",
      keySecret: "secret123",
    });
  });

  it("prefers RAZORPAY_KEY_ID over the NEXT_PUBLIC_ variant", () => {
    process.env.RAZORPAY_KEY_ID = "rzp_test_server";
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "rzp_test_client";
    process.env.RAZORPAY_KEY_SECRET = "secret123";
    const keys = getRazorpayKeys();
    expect(keys?.keyId).toBe("rzp_test_server");
  });
});

describe("assertRazorpaySafe", () => {
  it("throws with actionable message when keys are missing", () => {
    expect(() => assertRazorpaySafe()).toThrow(/Razorpay not configured/);
  });

  it("returns 'test' when test key is set in development", () => {
    process.env.NODE_ENV = "development";
    process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
    process.env.RAZORPAY_KEY_SECRET = "secret123";
    expect(assertRazorpaySafe()).toBe("test");
  });

  it("returns 'live' when live key is set in production", () => {
    process.env.NODE_ENV = "production";
    process.env.RAZORPAY_KEY_ID = "rzp_live_abc";
    process.env.RAZORPAY_KEY_SECRET = "secret123";
    expect(assertRazorpaySafe()).toBe("live");
  });

  it("REFUSES a live key in development (the safety net)", () => {
    process.env.NODE_ENV = "development";
    process.env.RAZORPAY_KEY_ID = "rzp_live_accidental";
    process.env.RAZORPAY_KEY_SECRET = "secret123";
    expect(() => assertRazorpaySafe()).toThrow(/Refusing to use a LIVE Razorpay key/);
    expect(() => assertRazorpaySafe()).toThrow(/rzp_test_/);
  });

  it("REFUSES a live key in test mode", () => {
    process.env.NODE_ENV = "test";
    process.env.RAZORPAY_KEY_ID = "rzp_live_accidental";
    process.env.RAZORPAY_KEY_SECRET = "secret123";
    expect(() => assertRazorpaySafe()).toThrow(/Refusing to use a LIVE Razorpay key/);
  });

  it("returns 'test' when test key is set in production (no constraint violation)", () => {
    // A test key works in production too — the constraint is only on
    // live keys in non-production. This is intentional: it lets you
    // run a staging environment with test keys.
    process.env.NODE_ENV = "production";
    process.env.RAZORPAY_KEY_ID = "rzp_test_abc";
    process.env.RAZORPAY_KEY_SECRET = "secret123";
    expect(assertRazorpaySafe()).toBe("test");
  });

  it("REFUSES an unknown-prefix key in development (conservative)", () => {
    process.env.NODE_ENV = "development";
    process.env.RAZORPAY_KEY_ID = "rzp_unknown_xyz";
    process.env.RAZORPAY_KEY_SECRET = "secret123";
    expect(() => assertRazorpaySafe()).toThrow(/Refusing to use a LIVE Razorpay key/);
  });
});

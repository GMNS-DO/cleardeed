/**
 * Tests for the in-memory token-bucket rate limiter (A.4.2).
 *
 * Verifies:
 * - First request within capacity is allowed
 * - Capacity-th request is allowed
 * - Capacity+1 request is rejected with retryAfter
 * - After waiting, tokens refill
 * - Per-IP and per-route isolation
 * - getClientIp extracts from x-forwarded-for and x-real-ip
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkRateLimit, getClientIp } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request within capacity", () => {
    const r = checkRateLimit({ ip: "1.1.1.1", route: "preview", capacity: 5, refillPerSec: 1 });
    expect(r.limited).toBe(false);
    expect(r.remaining).toBe(4);
  });

  it("allows requests up to capacity", () => {
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit({ ip: "2.2.2.2", route: "preview", capacity: 5, refillPerSec: 1 });
      expect(r.limited, `request ${i + 1} should not be limited`).toBe(false);
    }
  });

  it("rejects the request that exceeds capacity", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit({ ip: "3.3.3.3", route: "preview", capacity: 5, refillPerSec: 1 });
    }
    const r = checkRateLimit({ ip: "3.3.3.3", route: "preview", capacity: 5, refillPerSec: 1 });
    expect(r.limited).toBe(true);
    expect(r.retryAfter).toBeGreaterThan(0);
  });

  it("refills tokens after waiting", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
    for (let i = 0; i < 5; i++) {
      checkRateLimit({ ip: "4.4.4.4", route: "preview", capacity: 5, refillPerSec: 1 });
    }
    expect(checkRateLimit({ ip: "4.4.4.4", route: "preview", capacity: 5, refillPerSec: 1 }).limited).toBe(true);

    // 2 seconds later → 2 tokens refilled at 1/sec
    vi.setSystemTime(new Date("2026-06-15T10:00:02Z"));
    const r = checkRateLimit({ ip: "4.4.4.4", route: "preview", capacity: 5, refillPerSec: 1 });
    expect(r.limited).toBe(false);
    expect(r.remaining).toBe(1);
  });

  it("isolates buckets per IP and route", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit({ ip: "5.5.5.5", route: "preview", capacity: 5, refillPerSec: 1 });
    }
    expect(checkRateLimit({ ip: "5.5.5.5", route: "preview", capacity: 5, refillPerSec: 1 }).limited).toBe(true);
    // Different IP — should not be limited
    expect(checkRateLimit({ ip: "6.6.6.6", route: "preview", capacity: 5, refillPerSec: 1 }).limited).toBe(false);
    // Same IP, different route — should not be limited
    expect(checkRateLimit({ ip: "5.5.5.5", route: "checkout", capacity: 5, refillPerSec: 1 }).limited).toBe(false);
  });

  it("caps refill at capacity (no overflow)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));
    checkRateLimit({ ip: "7.7.7.7", route: "preview", capacity: 3, refillPerSec: 10 });
    // 60 seconds of waiting = 600 tokens at 10/sec, but capped at 3
    vi.setSystemTime(new Date("2026-06-15T10:01:00Z"));
    const r1 = checkRateLimit({ ip: "7.7.7.7", route: "preview", capacity: 3, refillPerSec: 10 });
    expect(r1.limited).toBe(false);
    expect(r1.remaining).toBe(2);
  });
});

describe("getClientIp", () => {
  it("returns first IP from x-forwarded-for", () => {
    const h = new Headers({ "x-forwarded-for": "10.0.0.1, 192.168.1.1, 10.0.0.2" });
    expect(getClientIp(h)).toBe("10.0.0.1");
  });

  it("returns x-real-ip when x-forwarded-for is missing", () => {
    const h = new Headers({ "x-real-ip": "203.0.113.5" });
    expect(getClientIp(h)).toBe("203.0.113.5");
  });

  it("returns 'unknown' when no IP headers are present", () => {
    const h = new Headers();
    expect(getClientIp(h)).toBe("unknown");
  });
});

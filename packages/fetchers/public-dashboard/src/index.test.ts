/**
 * Tests for public-dashboard fetcher.
 *
 * These tests do not hit the live page. They exercise the contract envelope,
 * the cache, and the typed-degradation paths.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { publicDashboardFetch, healthCheck, _resetCache } from "./index.js";
import { PublicDashboardResultSchema } from "./contract.js";

describe("public-dashboard fetcher", () => {
  beforeEach(() => {
    _resetCache();
  });

  it("returns not_covered when skipLive is true", async () => {
    const result = await publicDashboardFetch({ skipLive: true });
    expect(result.status).toBe("not_covered");
    expect(result.data?.pageIsLive).toBe(false);
    expect(result.data?.entries).toEqual([]);
  });

  it("includes correct source literal and parser version", async () => {
    const result = await publicDashboardFetch({ skipLive: true });
    expect(result.source).toBe("public-dashboard");
    expect(result.parserVersion).toBe("public-dashboard-v1");
  });

  it("includes ISO fetchedAt timestamp", async () => {
    const result = await publicDashboardFetch({ skipLive: true });
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("result envelope validates against the Zod schema", async () => {
    const result = await publicDashboardFetch({ skipLive: true });
    const parsed = PublicDashboardResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("data shape matches the contract (pageUrl, pageIsLive, entries)", async () => {
    const result = await publicDashboardFetch({ skipLive: true });
    expect(result.data?.pageUrl).toContain("igrodisha.gov.in");
    expect(typeof result.data?.pageIsLive).toBe("boolean");
    expect(Array.isArray(result.data?.entries)).toBe(true);
  });

  it("includes a note about server-rendered page (no JSON API)", async () => {
    const result = await publicDashboardFetch({ skipLive: true });
    expect(result.data?.notes.some((n) => /server-rendered/i.test(n))).toBe(
      true
    );
  });
});

describe("public-dashboard healthCheck", () => {
  it("returns a boolean (true or false, never throws)", async () => {
    const healthy = await healthCheck();
    expect(typeof healthy).toBe("boolean");
  });
});

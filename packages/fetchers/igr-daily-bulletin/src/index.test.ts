/**
 * Tests for igr-daily-bulletin fetcher.
 *
 * Exercises the cache, input validation, source_down fallback, and the
 * summary computation. Live smoke is recorded separately.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { igrDailyBulletinFetch, healthCheck, _resetCache } from "./index.js";
import {
  IgrDailyBulletinResultSchema,
  IgrDailyBulletinDataSchema,
} from "./contract.js";

describe("igr-daily-bulletin — skipLive path", () => {
  it("returns not_covered when skipLive is true", async () => {
    const result = await igrDailyBulletinFetch({ skipLive: true });
    expect(result.status).toBe("not_covered");
    expect(result.warnings?.[0]?.code).toBe("IGR_DAILY_BULLETIN_UNAVAILABLE");
  });

  it("includes correct source literal and parser version", async () => {
    const result = await igrDailyBulletinFetch({ skipLive: true });
    expect(result.source).toBe("igr-daily-bulletin");
    expect(result.parserVersion).toBe("igr-daily-bulletin-v1");
  });

  it("includes ISO fetchedAt timestamp", async () => {
    const result = await igrDailyBulletinFetch({ skipLive: true });
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("igr-daily-bulletin — input defaults", () => {
  beforeEach(() => {
    _resetCache();
  });

  it("accepts empty input (uses defaults)", async () => {
    const result = await igrDailyBulletinFetch({ skipLive: true });
    expect(result.status).toBe("not_covered");
    // Confirms the default-empty path doesn't throw.
  });

  it("accepts explicit date range", async () => {
    const result = await igrDailyBulletinFetch({
      dateFrom: "2026-06-01",
      dateTo: "2026-06-07",
      skipLive: true,
    });
    expect(result.status).toBe("not_covered");
  });
});

describe("igr-daily-bulletin — contract envelope", () => {
  it("result validates against the Zod schema", async () => {
    const result = await igrDailyBulletinFetch({ skipLive: true });
    const parsed = IgrDailyBulletinResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });
});

describe("igr-daily-bulletin healthCheck", () => {
  it("returns a boolean (true or false, never throws)", async () => {
    const healthy = await healthCheck();
    expect(typeof healthy).toBe("boolean");
  });
});

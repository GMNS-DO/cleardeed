/**
 * Tests for igr-bmv fetcher.
 *
 * These tests do not hit the live endpoint (it requires network + IGR uptime).
 * They exercise the contract envelope, the cache, the input-validation path,
 * and the source_down fallback shape. The live smoke is recorded separately
 * (qa/smoke/igr-bmv.live.ts).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { igrBmvFetch, healthCheck, _resetCache } from "./index.js";
import { IgrBmvResultSchema, IgrBmvDataSchema } from "./contract.js";

describe("igr-bmv fetcher", () => {
  beforeEach(() => {
    _resetCache();
  });

  it("returns failed when sro is missing", async () => {
    const result = await igrBmvFetch({ sro: "", village: "Mendhasala" });
    expect(result.status).toBe("failed");
    expect(result.statusReason).toBe("missing_input");
    expect(result.data?.rows).toEqual([]);
  });

  it("returns failed when village is missing", async () => {
    const result = await igrBmvFetch({ sro: "Bhubaneswar", village: "" });
    expect(result.status).toBe("failed");
  });

  it("returns not_covered when skipLive is true", async () => {
    const result = await igrBmvFetch({
      sro: "Bhubaneswar",
      village: "Mendhasala",
      skipLive: true,
    });
    expect(result.status).toBe("not_covered");
    expect(result.data?.rows).toEqual([]);
    expect(result.warnings?.[0]?.code).toBe("IGR_BMV_UNAVAILABLE");
  });

  it("includes correct source literal and parser version", async () => {
    const result = await igrBmvFetch({
      sro: "Bhubaneswar",
      village: "Mendhasala",
      skipLive: true,
    });
    expect(result.source).toBe("igr-bmv");
    expect(result.parserVersion).toBe("igr-bmv-v1");
  });

  it("includes ISO fetchedAt timestamp", async () => {
    const result = await igrBmvFetch({
      sro: "Bhubaneswar",
      village: "Mendhasala",
      skipLive: true,
    });
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("result envelope validates against the Zod schema", async () => {
    const result = await igrBmvFetch({
      sro: "Bhubaneswar",
      village: "Mendhasala",
      skipLive: true,
    });
    const parsed = IgrBmvResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("data shape matches the contract (rows array)", async () => {
    const result = await igrBmvFetch({
      sro: "Bhubaneswar",
      village: "Mendhasala",
      skipLive: true,
    });
    const dataParsed = IgrBmvDataSchema.safeParse(result.data);
    expect(dataParsed.success).toBe(true);
  });
});

describe("igr-bmv healthCheck", () => {
  it("returns a boolean (true or false, never throws)", async () => {
    const healthy = await healthCheck();
    expect(typeof healthy).toBe("boolean");
  });
});

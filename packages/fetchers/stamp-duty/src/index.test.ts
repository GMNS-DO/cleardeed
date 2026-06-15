/**
 * Tests for stamp-duty fetcher.
 *
 * Exercises the local fallback (deterministic) and the input-validation paths.
 * The live endpoint path is recorded in the live smoke test, not here, so
 * this suite is hermetic.
 */

import { describe, it, expect } from "vitest";
import { stampDutyFetch, healthCheck } from "./index.js";
import { StampDutyResultSchema, StampDutyDataSchema } from "./contract.js";

describe("stamp-duty fetcher — input validation", () => {
  it("returns failed when sro is missing", async () => {
    const result = await stampDutyFetch({ sro: "", marketValue: 5_000_000 });
    expect(result.status).toBe("failed");
    expect(result.statusReason).toBe("missing_input");
  });

  it("returns failed when marketValue is zero or negative", async () => {
    const result = await stampDutyFetch({ sro: "Bhubaneswar", marketValue: 0 });
    expect(result.status).toBe("failed");
  });

  it("returns failed when marketValue is NaN", async () => {
    const result = await stampDutyFetch({ sro: "Bhubaneswar", marketValue: NaN });
    expect(result.status).toBe("failed");
  });
});

describe("stamp-duty fetcher — local fallback (skipLive)", () => {
  it("computes Sale deed stamp duty = 5% of market value + 1% reg + 2% cess", async () => {
    const result = await stampDutyFetch({
      sro: "Bhubaneswar",
      marketValue: 5_000_000,
      skipLive: true,
    });
    expect(result.status).toBe("partial");
    expect(result.data?.breakup.stampDuty).toBe(250_000); // 5%
    expect(result.data?.breakup.registrationFee).toBe(50_000); // 1%
    expect(result.data?.breakup.cess).toBe(5_000); // 2% of stamp duty
    expect(result.data?.breakup.totalPayable).toBe(305_000);
    expect(result.data?.breakup.bmvFloorApplied).toBe(false);
  });

  it("bumps market value to BMV floor when override is higher", async () => {
    const result = await stampDutyFetch({
      sro: "Bhubaneswar",
      marketValue: 1_000_000,
      bmvFloorOverride: 5_000_000,
      skipLive: true,
    });
    expect(result.data?.breakup.appliedMarketValue).toBe(5_000_000);
    expect(result.data?.breakup.bmvFloorApplied).toBe(true);
    expect(result.data?.breakup.stampDuty).toBe(250_000);
  });

  it("computes Gift deed the same as Sale (5% + 1% + 2%)", async () => {
    const result = await stampDutyFetch({
      sro: "Bhubaneswar",
      marketValue: 2_000_000,
      deedType: "Gift",
      skipLive: true,
    });
    expect(result.data?.breakup.stampDuty).toBe(100_000);
    expect(result.data?.breakup.registrationFee).toBe(20_000);
  });

  it("caps Mortgage stamp duty at ₹25,000", async () => {
    const result = await stampDutyFetch({
      sro: "Bhubaneswar",
      marketValue: 100_000_000, // 10 crore — would be 100k at 0.1%
      deedType: "Mortgage",
      skipLive: true,
    });
    expect(result.data?.breakup.stampDuty).toBe(25_000);
  });

  it("handles Partition as a nominal ₹100 fee", async () => {
    const result = await stampDutyFetch({
      sro: "Bhubaneswar",
      marketValue: 5_000_000,
      deedType: "Partition",
      skipLive: true,
    });
    expect(result.data?.breakup.stampDuty).toBe(100);
  });

  it("emits a LOCAL_FALLBACK_USED warning on skipLive", async () => {
    const result = await stampDutyFetch({
      sro: "Bhubaneswar",
      marketValue: 1_000_000,
      skipLive: true,
    });
    expect(result.warnings?.[0]?.code).toBe("LOCAL_FALLBACK_USED");
  });
});

describe("stamp-duty fetcher — contract envelope", () => {
  it("result validates against the Zod schema", async () => {
    const result = await stampDutyFetch({
      sro: "Bhubaneswar",
      marketValue: 5_000_000,
      skipLive: true,
    });
    const parsed = StampDutyResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("data validates against StampDutyDataSchema", async () => {
    const result = await stampDutyFetch({
      sro: "Bhubaneswar",
      marketValue: 5_000_000,
      skipLive: true,
    });
    const dataParsed = StampDutyDataSchema.safeParse(result.data);
    expect(dataParsed.success).toBe(true);
  });

  it("source literal is 'stamp-duty' and parser version is set", async () => {
    const result = await stampDutyFetch({
      sro: "Bhubaneswar",
      marketValue: 5_000_000,
      skipLive: true,
    });
    expect(result.source).toBe("stamp-duty");
    expect(result.parserVersion).toBe("stamp-duty-v1");
  });
});

describe("stamp-duty healthCheck", () => {
  it("returns a boolean (true or false, never throws)", async () => {
    const healthy = await healthCheck();
    expect(typeof healthy).toBe("boolean");
  });
});

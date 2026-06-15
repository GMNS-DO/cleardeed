/**
 * Tests for govt-fee fetcher.
 *
 * The fetcher loads a permanent JSON seed (no network). Tests exercise
 * the seed load, the match-by-category path, the not-found path, and the
 * stale-check warning.
 */

import { describe, it, expect } from "vitest";
import { govtFeeFetch, healthCheck } from "./index.js";
import { GovtFeeResultSchema } from "./contract.js";

describe("govt-fee fetcher", () => {
  it("returns not_covered when skipLive is true", async () => {
    const result = await govtFeeFetch({ skipLive: true });
    expect(result.status).toBe("not_covered");
    expect(result.warnings?.[0]?.code).toBe("GOVT_FEE_SKIPPED");
  });

  it("loads the seed and returns the full schedule on a real call", async () => {
    const result = await govtFeeFetch({ deedCategory: "Sale" });
    expect(result.status).toBe("success");
    expect(result.data?.schedule.deedFees.length).toBeGreaterThan(5);
    expect(result.data?.schedule.encumbranceCertificate.generalSearchFirstYearINR).toBe(25);
    expect(result.data?.schedule.certifiedCopy.copyingFeePerPageINR).toBe(3);
  });

  it("matches the requested deed category exactly", async () => {
    const result = await govtFeeFetch({ deedCategory: "Sale" });
    expect(result.data?.matchedDeedFee?.category).toBe("Sale");
    expect(result.data?.matchedDeedFee?.stampPct).toBe(5.0);
  });

  it("matches case-insensitively", async () => {
    const result = await govtFeeFetch({ deedCategory: "sale" });
    expect(result.data?.matchedDeedFee?.category).toBe("Sale");
  });

  it("returns null matchedDeedFee + warning when category not found", async () => {
    const result = await govtFeeFetch({ deedCategory: "Bogus Deed Type" });
    expect(result.data?.matchedDeedFee).toBeNull();
    expect(result.warnings?.some((w) => w.code === "DEED_CATEGORY_NOT_FOUND")).toBe(true);
  });

  it("matches Gift Immovable Property", async () => {
    const result = await govtFeeFetch({ deedCategory: "Gift Immovable Property" });
    expect(result.data?.matchedDeedFee?.stampPct).toBe(5.0);
  });

  it("matches Mortgage with Possession vs without", async () => {
    const a = await govtFeeFetch({ deedCategory: "Mortgage with Possession" });
    const b = await govtFeeFetch({ deedCategory: "Mortgage without Possession" });
    expect(a.data?.matchedDeedFee?.stampPct).toBe(5.0);
    expect(b.data?.matchedDeedFee?.stampPct).toBe(2.0);
  });

  it("includes correct source literal and parser version", async () => {
    const result = await govtFeeFetch({});
    expect(result.source).toBe("govt-fee");
    expect(result.parserVersion).toBe("govt-fee-v1");
  });

  it("result envelope validates against the Zod schema", async () => {
    const result = await govtFeeFetch({});
    const parsed = GovtFeeResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });
});

describe("govt-fee healthCheck", () => {
  it("returns true when the seed loads", async () => {
    const healthy = await healthCheck();
    expect(healthy).toBe(true);
  });
});

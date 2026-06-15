/**
 * Tests for igr-certified-copy fetcher.
 *
 * The fetcher ships as typed-degradation only (Phase 1, D-037/D-046).
 * Tests exercise the contract envelope, the manual-instructions fallback,
 * the §57 transparency note, and the cache (none, since no live data).
 */

import { describe, it, expect } from "vitest";
import { igrCertifiedCopyFetch, healthCheck } from "./index.js";
import { CertifiedCopyResultSchema } from "./contract.js";

describe("igr-certified-copy fetcher (Phase 1: index-card only)", () => {
  it("returns not_covered when skipLive is true", async () => {
    const result = await igrCertifiedCopyFetch({ skipLive: true });
    expect(result.status).toBe("not_covered");
    expect(result.data?.pageIsLive).toBe(false);
    expect(result.data?.entries).toEqual([]);
  });

  it("includes correct source literal and parser version", async () => {
    const result = await igrCertifiedCopyFetch({ skipLive: true });
    expect(result.source).toBe("igr-certified-copy");
    expect(result.parserVersion).toBe("igr-certified-copy-v1");
  });

  it("includes a §57 transparency note", async () => {
    const result = await igrCertifiedCopyFetch({ skipLive: true });
    expect(result.data?.section57Note).toContain("Section 57");
    expect(result.data?.section57Note).toContain("Book 4");
  });

  it("includes manual-instructions fallback (D-037 pattern)", async () => {
    const result = await igrCertifiedCopyFetch({ skipLive: true });
    expect(result.data?.manualInstructions.steps.length).toBeGreaterThanOrEqual(3);
    expect(result.data?.manualInstructions.estimatedFeeINR).toBeGreaterThan(0);
  });

  it("result envelope validates against the Zod schema", async () => {
    const result = await igrCertifiedCopyFetch({ skipLive: true });
    const parsed = CertifiedCopyResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
  });

  it("includes ISO fetchedAt timestamp", async () => {
    const result = await igrCertifiedCopyFetch({ skipLive: true });
    expect(result.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("igr-certified-copy healthCheck", () => {
  it("returns a boolean (true or false, never throws)", async () => {
    const healthy = await healthCheck();
    expect(typeof healthy).toBe("boolean");
  });
});

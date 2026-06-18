/**
 * qa/fetcher_tests/ecourts-via-apify.test.ts
 *
 * Task 1.2 — Layer 1: integrate eCourts via the Apify parseforge actor.
 *
 * The eCourtsIndia.com V6 portal (services.ecourts.gov.in/ecourtindia_v6) is
 * effectively dead — captcha + WAF + name-variant heuristics make the
 * in-house Playwright/OCR path slow and brittle. We pivot to the
 * `parseforge/court-records-ecourt-india-scraper` Apify actor.
 *
 * This test file has two parts:
 *
 *   1. Bar 1/2/3 contract test — runs against the live Apify actor.
 *      `describe.skipIf(!process.env.APIFY_TOKEN)` so the test is skipped in
 *      CI where we cannot hit a paid actor. With APIFY_TOKEN present and
 *      ground-truth plot ids, it MUST pass.
 *
 *   2. Honest-degradation test — NEVER skipped. Confirms that when
 *      APIFY_TOKEN is not set, `fetchEcourtsViaApify()` returns
 *      `{ status: "manual_required", data: { cases: [] }, error: "APIFY_TOKEN not set" }`
 *      and `isSourceFired("ecourts", result)` is `false`.
 */
import { describe, it, expect } from "vitest";
import { fetchEcourtsViaApify } from "../../packages/fetchers/ecourts/src/via-apify";
import { runBar1Bar2Bar3 } from "../../apps/web/src/lib/pipeline/contracts/contract-test-factory";
import { isSourceFired } from "../../apps/web/src/lib/pipeline/contracts/fire";

const HAS_TOKEN = Boolean(process.env.APIFY_TOKEN);

// ─── Part 1: Bar 1/2/3 — runs only when APIFY_TOKEN is set ────────────────────

describe.skipIf(!HAS_TOKEN)("ecourts via Apify (live actor)", () => {
  it(
    "passes Bar 1/2/3 on assigned ground-truth plots",
    async () => {
      const fetcher = (plotId: string) =>
        fetchEcourtsViaApify({ partyName: plotId, courtComplex: "Khurda" });
      const result = await runBar1Bar2Bar3(
        "ecourts",
        ["Mohapatra", "Patra", "Sahoo", "Mishra", "BROKEN-PLOT"],
        fetcher
      );
      expect(result.bar1).toBe("pass");
      expect(result.bar2).toBe("pass");
      expect(result.bar3).toBe("pass");
    },
    120_000
  );
});

// ─── Part 2: Honest-degradation — always runs ─────────────────────────────────

describe("ecourts via Apify (honest degradation when token absent)", () => {
  it("returns manual_required with empty cases and isSourceFired=false when APIFY_TOKEN is unset", async () => {
    // Save and clear APIFY_TOKEN for the duration of this test, regardless of
    // environment state, so the assertion is deterministic.
    const prevToken = process.env.APIFY_TOKEN;
    delete process.env.APIFY_TOKEN;

    try {
      const result = await fetchEcourtsViaApify({ partyName: "Mohapatra" });

      expect(result.status).toBe("manual_required");
      expect(result.data.cases).toEqual([]);
      expect(result.error).toMatch(/APIFY_TOKEN not set/);

      const fired = isSourceFired("ecourts", result as unknown as Parameters<typeof isSourceFired>[1]);
      expect(fired.fired).toBe(false);
    } finally {
      if (prevToken !== undefined) process.env.APIFY_TOKEN = prevToken;
    }
  });
});

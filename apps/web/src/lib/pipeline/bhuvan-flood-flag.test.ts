/**
 * PI-1 T3 — Bhuvan feature-flag invariant test.
 *
 * Proves:
 *   1. The pipeline skips the live WMS probe when CLEARDEED_BHUVAN_DISABLED=1
 *      and emits a deterministic `not_covered` SourceResult with a
 *      `bhuvan_feature_flag_disabled` warning.
 *   2. The pipeline invokes the live fetcher when the flag is absent, so
 *      NRSC licensing gates stay forward-compatible.
 *   3. The rest of the pipeline is unaffected by the feature flag — the other
 *      source summaries still resolve (no regression).
 *
 * This test exercises the real V1.1 orchestrator path (Step 1b.2 in
 * apps/web/src/lib/pipeline/index.ts), not a stub, so it will break if the
 * kill-switch is removed or the Bhuvan inputs change shape.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { generateReportV11 } from "@/lib/pipeline";

// ── Mocks ──────────────────────────────────────────────────────────────────────
// Bhulekh: lightweight mock returning a successful RoR for plot 415 in
// Gothapada. The pipeline builds on Bhulekh output — we keep it minimal
// but shape-compatible so `generateReportV11` can resolve village GPS for
// Step 1b.2.
vi.mock("@cleardeed/fetcher-bhulekh", () => ({
  fetch: vi.fn().mockResolvedValue({
    source: "bhulekh",
    status: "success",
    verification: "verified",
    fetchedAt: new Date().toISOString(),
    attempts: 0,
    retryAttempts: [],
    inputsTried: [],
    parserVersion: "bhulekh-v2",
    data: {
      khatiyanNo: "830",
      village: "Gothapada",
      tahasil: "Kakatpur",
      tenants: [
        {
          tenantName: "Rakhit Anabadi",
          fatherHusbandName: "Bauribandhu",
          plotNo: "415",
          area: 10.5,
          kisamOdia: "ଦଣ୍ଡା",
          kisamEnglish: "irrigated",
        },
      ],
      plotLines: [{ plotNo: "415", area: 10.5, kisam: "ଦଣ୍ଡା" }],
    },
  }),
  healthCheck: vi.fn().mockResolvedValue(true),
}));

// Bhunaksha + nominatim: not strictly needed since Bhulekh supplies
// village GPS, but the orchestrator may still try them. Return quick OKs.
vi.mock("@cleardeed/fetcher-bhunaksha", () => ({
  fetch: vi.fn().mockResolvedValue({
    source: "bhunaksha",
    status: "success",
    verification: "verified",
    fetchedAt: new Date().toISOString(),
    attempts: 0,
    retryAttempts: [],
    inputsTried: [],
    parserVersion: "bhunaksha-v1",
    data: null,
  }),
  healthCheck: vi.fn().mockResolvedValue(true),
}));

vi.mock("@cleardeed/fetcher-nominatim", () => ({
  fetch: vi.fn().mockResolvedValue({
    source: "nominatim",
    status: "success",
    verification: "verified",
    fetchedAt: new Date().toISOString(),
    attempts: 0,
    retryAttempts: [],
    inputsTried: [],
    parserVersion: "nominatim-v1",
    data: { lat: 20.272688, lon: 85.701271 },
  }),
  nominatimReverseFetch: vi.fn(),
  nominatimSearchFetch: vi.fn(),
  healthCheck: vi.fn().mockResolvedValue(true),
}));

// Bhuvan is the system under test — spy on it so we can assert invocation
// counts without making a live WMS call.
const mockBhuvanFetch = vi.fn();
vi.mock("@cleardeed/fetcher-bhuvan-flood", () => ({
  fetch: (...args: unknown[]) => mockBhuvanFetch(...args),
  healthCheck: vi.fn().mockResolvedValue(true),
}));

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("PI-1 T3 — Bhuvan feature-flag quarantine", () => {
  afterEach(() => {
    mockBhuvanFetch.mockClear();
    delete process.env.CLEARDEED_BHUVAN_DISABLED;
  });

  describe("when CLEARDEED_BHUVAN_DISABLED=1", () => {
    it("returns a deterministic not_covered result without calling the live fetcher", async () => {
      process.env.CLEARDEED_BHUVAN_DISABLED = "1";

      const result = await generateReportV11({
        reportId: "test-bhuvan-flag-1",
        tehsil: "Kakatpur",
        tehsilValue: "02",
        village: "Gothapada",
        villageCode: "004",
        searchMode: "Plot",
        identifier: "415",
        claimedOwnerName: "Test Owner",
      });

      // The kill-switch must short-circuit — fetcher never invoked.
      expect(mockBhuvanFetch).not.toHaveBeenCalled();

      // Source summary surfaces the quarantine.
      expect(result.sourceSummary.bhuvanFlood).toBeDefined();
      expect(result.sourceSummary.bhuvanFlood).toMatch(/not_covered|feature.flag.disabled|disabled/i);

      // Other sources still resolve — no regression in the pipeline.
      expect(result.sourceSummary.bhulekh).toBeDefined();
    });
  });

  describe("when CLEARDEED_BHUVAN_DISABLED is absent", () => {
    it("invokes the live fetcher once and records the fetcher's own license posture", async () => {
      mockBhuvanFetch.mockResolvedValueOnce({
        source: "bhuvan-flood",
        status: "partial",
        verification: "manual_required",
        statusReason: "LayerNotQueryable",
        fetchedAt: new Date().toISOString(),
        attempts: 0,
        retryAttempts: [],
        inputsTried: [{ label: "bhuvan_wms_get_feature_info", input: { lat: 20.272688, lon: 85.701271 } }],
        parserVersion: "bhuvan-flood-v1",
        data: {
          floodFrequency: "unknown",
          layersProbed: ["or_cyclone"],
          getFeatureInfoBlocked: true,
          tileBytes: 0,
          dataSource: "bhuvan-ras2.nrsc.gov.in",
        },
        warnings: [{ code: "bhuvan_license_planning_only", message: "planning-only" }],
      });

      const result = await generateReportV11({
        reportId: "test-bhuvan-flag-2",
        tehsil: "Kakatpur",
        tehsilValue: "02",
        village: "Gothapada",
        villageCode: "004",
        searchMode: "Plot",
        identifier: "415",
        claimedOwnerName: "Test Owner",
      });

      // The fetcher is invoked — the kill-switch is only one branch.
      expect(mockBhuvanFetch).toHaveBeenCalledTimes(1);
      expect(mockBhuvanFetch).toHaveBeenCalledWith(
        expect.objectContaining({ lat: expect.any(Number), lon: expect.any(Number) })
      );

      // The fetcher's own license posture is surfaced in the summary.
      expect(result.sourceSummary.bhuvanFlood).toBeDefined();
      expect(result.sourceSummary.bhuvanFlood).toMatch(/partial|LayerNotQueryable|planning.only/i);
    });
  });
});

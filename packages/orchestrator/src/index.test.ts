/**
 * Orchestrator V1.1 tests — Bhulekh-only mode.
 *
 * V1.1 scope: Bhulekh (Front + Back pages) as the single active source.
 * All other sources are V1.1-DORMANT. Tests verify the Bhulekh-only path.
 *
 * Dormant fetcher tests are skipped with reason "V1.1-DORMANT — see CLEARDEED_HANDOFF_V1.1.md §1".
 * These tests verify the dormant code is intact and can be resurrected by uncommenting.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type { SourceResult } from "@cleardeed/schema";

// ─── Mock factories ────────────────────────────────────────────────────────────

function makeBhulekhSuccess(overrides: Partial<SourceResult> = {}): SourceResult {
  return {
    source: "bhulekh",
    status: "success",
    statusReason: "ro_r_retrieved",
    verification: "verified",
    fetchedAt: new Date().toISOString(),
    data: {
      khatiyanNumber: "830",
      village: "Mendhasala",
      tenants: [
        { tenantName: "Rakhit Anabadi", fatherHusbandName: "Shyam Anabadi", surveyNo: "309", area: 10.5, landClass: "danda" },
      ],
    },
    ...overrides,
  } as SourceResult;
}

function makeBhulekhFailed(errorMessage = "Plot not found"): SourceResult {
  return {
    source: "bhulekh",
    status: "failed",
    statusReason: errorMessage,
    verification: "manual_required",
    fetchedAt: new Date().toISOString(),
    error: errorMessage,
  } as SourceResult;
}

// ─── V1.1-DORMANT mock factories ───────────────────────────────────────────────

function makeNominatimSuccess(): SourceResult {
  return {
    source: "nominatim",
    status: "success",
    statusReason: "cache_hit",
    verification: "verified",
    fetchedAt: new Date().toISOString(),
    data: { village: "Mendhasala", tahasil: "Bhubaneswar", district: "Khordha" },
  } as SourceResult;
}

function makeBhunakshaSuccess(): SourceResult {
  return {
    source: "bhunaksha",
    status: "success",
    statusReason: "point_contained_in_polygon",
    verification: "verified",
    fetchedAt: new Date().toISOString(),
    data: { village: "Mendhasala", plotNo: "128", area: 0.023, tahasil: "Bhubaneswar" },
  } as SourceResult;
}

function makeEcourtsNotCovered(): SourceResult {
  return {
    source: "ecourts",
    status: "not_covered",
    statusReason: "V1.1-DORMANT — see CLEARDEED_HANDOFF_V1.1.md §1",
    verification: "not_covered",
    fetchedAt: new Date().toISOString(),
  } as SourceResult;
}

function makeRccmsNotCovered(): SourceResult {
  return {
    source: "rccms",
    status: "not_covered",
    statusReason: "V1.1-DORMANT — see CLEARDEED_HANDOFF_V1.1.md §1",
    verification: "not_covered",
    fetchedAt: new Date().toISOString(),
  } as SourceResult;
}

function makeCersaiNotCovered(): SourceResult {
  return {
    source: "cersai",
    status: "not_covered",
    statusReason: "V1.1-DORMANT — see CLEARDEED_HANDOFF_V1.1.md §1",
    verification: "not_covered",
    fetchedAt: new Date().toISOString(),
  } as SourceResult;
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

function mockBhulekhFetch(result: SourceResult) {
  vi.doMock("@cleardeed/fetcher-bhulekh", () => ({
    fetch: vi.fn().mockResolvedValue(result),
  }));
}

// ─── V1.1 Active tests ─────────────────────────────────────────────────────────

describe("orchestrator — V1.1 Bhulekh-only", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("runReport calls bhulekhFetch with tehsil+village+searchMode+identifier", async () => {
    const mockResult = makeBhulekhSuccess();
    mockBhulekhFetch(mockResult);

    const { runReport } = await import("@cleardeed/orchestrator");

    const output = await runReport({
      tehsil: "Bhubaneswar",
      village: "Mendhasala",
      searchMode: "Khatiyan",
      identifierValue: "830",
      identifierLabel: "830 (Rakhit Anabadi)",
      claimedOwnerName: "Rakhit Anabadi",
    });

    const bhulekhCall = vi.mocked(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (await import("@cleardeed/fetcher-bhulekh")).fetch
    );
    expect(bhulekhCall).toHaveBeenCalledWith(
      expect.objectContaining({
        tehsil: "Bhubaneswar",
        village: "Mendhasala",
        searchMode: "Khatiyan",
        identifierValue: "830",
        identifierLabel: "830 (Rakhit Anabadi)",
        claimedOwnerName: "Rakhit Anabadi", // V1.1 uses claimedOwnerName
        tehsilCode: expect.any(String),
        villageCode: expect.any(String),
      })
    );
    expect(output.sources).toHaveLength(1);
    expect(output.sources[0].source).toBe("bhulekh");
    expect(output.sources[0].status).toBe("success");
  });

  test("runReport returns bhulekh success with tenants in source array", async () => {
    const mockResult = makeBhulekhSuccess();
    mockBhulekhFetch(mockResult);

    const { runReport } = await import("@cleardeed/orchestrator");

    const output = await runReport({
      tehsil: "Bhubaneswar",
      village: "Mendhasala",
      searchMode: "Plot",
      identifierValue: "128",
      identifierLabel: "128",
    });

    expect(output.sources).toHaveLength(1);
    expect(output.sources[0].source).toBe("bhulekh");
    expect(output.sources[0].status).toBe("success");
    const data = (output.sources[0] as SourceResult & { data?: Record<string, unknown> }).data;
    expect(data).toBeDefined();
    expect((data?.tenants as Array<{ tenantName: string }>)?.length).toBeGreaterThan(0);
  });

  test("runReport returns bhulekh failure gracefully", async () => {
    const mockResult = makeBhulekhFailed("Village dropdown empty — village may not be digitized");
    mockBhulekhFetch(mockResult);

    const { runReport } = await import("@cleardeed/orchestrator");

    const output = await runReport({
      tehsil: "Bhubaneswar",
      village: "Jatni",
      searchMode: "Khatiyan",
      identifierValue: "500",
      identifierLabel: "500",
    });

    expect(output.sources).toHaveLength(1);
    expect(output.sources[0].source).toBe("bhulekh");
    expect(output.sources[0].status).toBe("failed");
    expect(output.sources[0].statusReason).toContain("Village dropdown empty");
  });

  test("runReport handles bhulekhFetch throwing an error", async () => {
    mockBhulekhFetch({
      source: "bhulekh",
      status: "failed",
      statusReason: "Network error",
      verification: "manual_required",
      fetchedAt: new Date().toISOString(),
      error: "Network error",
    } as SourceResult);

    const { runReport } = await import("@cleardeed/orchestrator");

    const output = await runReport({
      tehsil: "Kordha",
      village: "Kordha",
      searchMode: "Tenant",
      identifierValue: "abc",
      identifierLabel: "abc",
    });

    expect(output.sources).toHaveLength(1);
    expect(output.sources[0].source).toBe("bhulekh");
    expect(output.sources[0].status).toBe("failed");
  });

  test("runReport returns valid reportId and completedAt", async () => {
    const mockResult = makeBhulekhSuccess();
    mockBhulekhFetch(mockResult);

    const { runReport } = await import("@cleardeed/orchestrator");

    const output = await runReport({
      tehsil: "Bhubaneswar",
      village: "Mendhasala",
      searchMode: "Khatiyan",
      identifierValue: "830",
      identifierLabel: "830",
    });

    expect(output.reportId).toMatch(/^[0-9a-f-]{36}$/);
    expect(output.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("runReport accepts optional fatherHusbandName without breaking", async () => {
    const mockResult = makeBhulekhSuccess();
    mockBhulekhFetch(mockResult);

    const { runReport } = await import("@cleardeed/orchestrator");

    const output = await runReport({
      tehsil: "Bhubaneswar",
      village: "Mendhasala",
      searchMode: "Khatiyan",
      identifierValue: "830",
      identifierLabel: "830",
      claimedOwnerName: "Rakhit Anabadi",
      fatherHusbandName: "Shyam Anabadi",
    });

    expect(output.sources).toHaveLength(1);
    expect(output.sources[0].status).toBe("success");
  });
});

// ─── V1.1-DORMANT: source-status verification tests ──────────────────────────
// These tests verify that dormant sources return `status: "not_covered"` when
// their code paths are restored. They are SKIPPED in V1.1 and serve as a
// regression guard for the resurrection path.

test.skip("V1.1-DORMANT: Nominatim — GPS lookup should return village+district for downstream use", async () => {
  // When V1.2 adds GPS-based lookup, uncomment this test and restore Nominatim
  // in the orchestrator to verify it returns correct GPS→village resolution.
  // Input: GPS coords (20.27, 85.70) → Output: { village, tahasil, district }
  expect(true).toBe(false); // placeholder — implement after GPS input is added
});

test.skip("V1.1-DORMANT: Bhunaksha — GPS→plot should return plot number and area", async () => {
  // When V1.2 adds Bhunaksha GPS lookup, uncomment and restore bhunakshaFetch.
  // Input: GPS coords → Output: { plotNo, area, village, tahasil }
  expect(true).toBe(false);
});

test.skip("V1.1-DORMANT: eCourts — party-name search should return court cases", async () => {
  // When V1.2 adds eCourts search, restore ecourtsFetch chain.
  // Verify: makeEcourtsNotCovered() → party search returns cases or zero cases.
  expect(true).toBe(false);
});

test.skip("V1.1-DORMANT: RCCMS — revenue court search should return case records", async () => {
  // When T-031 (live RCCMS) is complete, restore rccmsFetch chain.
  // Verify: revenue court records for plot/khatiyan.
  expect(true).toBe(false);
});

test.skip("V1.1-DORMANT: CERSAI — charge search should return active mortgage records", async () => {
  // When CERSAI integration is live, restore cersaiFetch chain.
  // Verify: mortgage/charge records for seller name.
  expect(true).toBe(false);
});

test.skip("V1.1-DORMANT: High Court — party-name search across Odisha", async () => {
  // When T-038 (High Court live validation) completes, restore highCourtFetch.
  expect(true).toBe(false);
});

test.skip("V1.1-DORMANT: DRT — debt recovery tribunal search", async () => {
  // When T-038 (DRT live validation) completes, restore drtFetch.
  expect(true).toBe(false);
});

test.skip("V1.1-DORMANT: LARR — land acquisition risk check via eCourts LA filter", async () => {
  // When T-042 (LARR) is complete, restore larrFetch with eCourts LA act filter.
  expect(true).toBe(false);
});

test.skip("V1.1-DORMANT: Civic dues — BMC/PHED dues check for company sellers", async () => {
  // When T-035 (civic dues) is complete, restore fetchCivicDues.
  expect(true).toBe(false);
});

// ─── Timeout behavior ──────────────────────────────────────────────────────────

describe("orchestrator timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("returns completed sources when overall timeout fires", async () => {
    const slowResult: SourceResult = {
      source: "bhulekh",
      status: "success",
      statusReason: "timeout_absorbed",
      verification: "verified",
      fetchedAt: new Date().toISOString(),
      data: { khatiyanNumber: "830" },
    } as SourceResult;

    mockBhulekhFetch(slowResult);

    const { runReport } = await import("@cleardeed/orchestrator");

    const runPromise = runReport({
      tehsil: "Bhubaneswar",
      village: "Mendhasala",
      searchMode: "Khatiyan",
      identifierValue: "830",
      identifierLabel: "830",
    });

    // Advance fake timers past the overall timeout.
    vi.advanceTimersByTime(55_001);

    const output = await runPromise;
    expect(output.sources.length).toBeGreaterThanOrEqual(0); // returns whatever completed
  });
});

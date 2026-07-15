/**
 * Focused test for the Bhulekh graceful-degradation path in generateReportV11.
 *
 * Bhulekh is the only FATAL source: when it fails to return usable owner/plot
 * records, or when the orchestrator itself throws, the pipeline must resolve to
 * a typed `{ degraded: true, reason, stage: "bhulekh", reportId }` outcome
 * instead of throwing (which previously 500'd the whole report route).
 *
 * We mock `@cleardeed/orchestrator` so `runReport` returns a non-success
 * Bhulekh source. The degraded branch returns EARLY — right after runReport —
 * so none of the downstream heavy fetchers or the (unrelated, pre-existing)
 * `bhunakshaPlotReport` runtime bug is reached.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the orchestrator BEFORE importing the module under test.
const runReportMock = vi.fn();
vi.mock("@cleardeed/orchestrator", () => ({
  runReport: (...args: unknown[]) => runReportMock(...args),
}));

const baseInput = {
  reportId: "test-report-id",
  tehsil: "Bhubaneswar",
  tehsilValue: "2",
  village: "Mendhasala",
  villageCode: "105",
  searchMode: "Plot" as const,
  identifier: "415",
};

describe("generateReportV11 — Bhulekh graceful degradation", () => {
  beforeEach(() => {
    runReportMock.mockReset();
  });

  it("returns a degraded outcome (not a throw) when Bhulekh status is not success", async () => {
    runReportMock.mockResolvedValue({
      reportId: baseInput.reportId,
      sources: [
        {
          source: "bhulekh",
          status: "failed",
          statusReason: "VILLAGE_DROPDOWN_EMPTY",
          fetchedAt: new Date().toISOString(),
          verification: "manual_required",
        },
      ],
      validationFindings: [],
    });

    const { generateReportV11 } = await import("./index");
    const result = await generateReportV11(baseInput);

    expect("degraded" in result).toBe(true);
    if ("degraded" in result) {
      expect(result.degraded).toBe(true);
      expect(result.stage).toBe("bhulekh");
      expect(result.reportId).toBe(baseInput.reportId);
      expect(result.reason).toContain("VILLAGE_DROPDOWN_EMPTY");
    }
  });

  it("returns a degraded outcome (not a throw) when Bhulekh succeeds but has no tenants", async () => {
    runReportMock.mockResolvedValue({
      reportId: baseInput.reportId,
      sources: [
        {
          source: "bhulekh",
          status: "success",
          statusReason: "ok",
          fetchedAt: new Date().toISOString(),
          verification: "verified",
          data: { khataNo: "94", village: "Mendhasala", tenants: [] },
        },
      ],
      validationFindings: [],
    });

    const { generateReportV11 } = await import("./index");
    const result = await generateReportV11(baseInput);

    expect("degraded" in result).toBe(true);
    if ("degraded" in result) {
      expect(result.stage).toBe("bhulekh");
      expect(result.reason).toContain("usable owner/plot records");
    }
  });

  it("returns a degraded outcome (not a throw) when the orchestrator itself throws", async () => {
    runReportMock.mockRejectedValue(new Error("ASP.NET session bootstrap failed"));

    const { generateReportV11 } = await import("./index");
    const result = await generateReportV11(baseInput);

    expect("degraded" in result).toBe(true);
    if ("degraded" in result) {
      expect(result.stage).toBe("bhulekh");
      expect(result.reason).toContain("ASP.NET session bootstrap failed");
    }
  });
});

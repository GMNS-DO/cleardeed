/**
 * Tests for the per-source contract test factory.
 *
 * The factory exercises all 3 bars (parity, fresh plots, failure honesty)
 * against a fetcher and produces a typed verdict. The plan's pseudocode
 * passed a string status into `isSourceFired`; the real function takes a
 * (source, result) pair. The mocks below build the right contract envelope
 * shape so the real `isSourceFired` can fire / fail as the test expects.
 */
import { describe, it, expect, vi } from "vitest";
import { runBar1Bar2Bar3 } from "./contract-test-factory";

/**
 * Build a Bhulekh contract envelope that passes the contract gate.
 * plotNo must be present (Bhulekh's liveness check requires it).
 */
function okBhulekh(plotNo: string) {
  return {
    source: "bhulekh" as const,
    status: "ok" as const,
    data: {
      plotNo,
      khataNo: "830",
      village: "Mendhasal",
      tenants: [],
    },
    fetchedAt: new Date().toISOString(),
    sourceUrl: "https://bhulekh.ori.nic.in/RoRView.aspx",
    latencyMs: 100,
  };
}

/** Build a non-ok Bhulekh envelope (one of the 5 contract failure statuses). */
function failBhulekh(status: "no_data" | "source_down" | "invalid_input" | "parse_error") {
  return {
    source: "bhulekh" as const,
    status,
    error: { code: status, message: `${status} error` },
    fetchedAt: new Date().toISOString(),
    sourceUrl: "https://bhulekh.ori.nic.in/RoRView.aspx",
    latencyMs: 0,
  };
}

describe("runBar1Bar2Bar3", () => {
  it("passes bar1 and bar2 when fetcher returns fired=true on every plot", async () => {
    const fetcher = vi.fn().mockImplementation((plotId: string) => Promise.resolve(okBhulekh(plotId)));
    const result = await runBar1Bar2Bar3("bhulekh", ["P001", "P002", "P003", "P004"], fetcher);
    expect(result.bar1).toBe("pass");
    expect(result.bar2).toBe("pass");
    // bar3 is the honesty check — with only 4 plotIds, plotIds[4] is undefined
    // so bar3 is skipped.
    expect(result.bar3).toBe("skipped");
  });

  it("fails bar1 when fetcher returns no_data (honest, but not fired)", async () => {
    const fetcher = vi.fn().mockResolvedValue(failBhulekh("no_data"));
    const result = await runBar1Bar2Bar3("bhulekh", ["P001"], fetcher);
    expect(result.bar1).toBe("fail");
  });

  it("passes bar3 when the known-broken plot returns an honest failure (not fired=true)", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(okBhulekh("P001"))
      .mockResolvedValueOnce(okBhulekh("P002"))
      .mockResolvedValueOnce(okBhulekh("P003"))
      .mockResolvedValueOnce(okBhulekh("P004"))
      .mockResolvedValueOnce(failBhulekh("no_data"));
    const result = await runBar1Bar2Bar3(
      "bhulekh",
      ["P001", "P002", "P003", "P004", "BROKEN"],
      fetcher,
    );
    expect(result.bar1).toBe("pass");
    expect(result.bar2).toBe("pass");
    expect(result.bar3).toBe("pass");
  });

  it("fails bar3 when the broken plot is silently fired=true (dishonest success)", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(okBhulekh("P001"))
      .mockResolvedValueOnce(okBhulekh("P002"))
      .mockResolvedValueOnce(okBhulekh("P003"))
      .mockResolvedValueOnce(okBhulekh("P004"))
      // The fetcher lies on the known-broken plot — returns fired=true.
      .mockResolvedValueOnce(okBhulekh("BROKEN"));
    const result = await runBar1Bar2Bar3(
      "bhulekh",
      ["P001", "P002", "P003", "P004", "BROKEN"],
      fetcher,
    );
    expect(result.bar3).toBe("fail");
  });
});

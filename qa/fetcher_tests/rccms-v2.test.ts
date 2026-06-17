/**
 * qa/fetcher_tests/rccms-v2.test.ts
 *
 * Task 1.1 — Pivot RCCMS to ccms.nic.in v2.0.
 *
 * The live portal (ccms.nic.in) is reachable and /searchCases.html exists
 * (curl-verified 2026-06-17). Whether the fetcher can actually clear the
 * captcha depends on the ONNX model (Task 0.3) — there is no production
 * corpus yet, so solveCaptcha falls back to ddddocr which may not solve
 * this portal's captcha. The test therefore requires *live* data (per the
 * contract-test-factory's Bar 1/2/3 contract) but accepts an honest
 * non-fire (source_down / parse_error / no_data / invalid_input) on
 * known-broken plots.
 *
 * If ccms.nic.in is unreachable in this environment, the test stays RED.
 * Do not chase a green bar by mocking fetch.
 */
import { describe, it, expect } from "vitest";
import { fetchCcmsNic } from "../../packages/fetchers/rccms/src/v2-ccms-nic";
import { runBar1Bar2Bar3 } from "../../apps/web/src/lib/pipeline/contracts/contract-test-factory";

describe("rccms v2 (ccms.nic.in)", () => {
  it(
    "passes Bar 1/2/3 on assigned ground-truth plots",
    async () => {
      const fetcher = (plotId: string) =>
        fetchCcmsNic({
          district: "Khordha",
          tahasil: "Bhubaneswar",
          village: "Mendhasala",
          partyName: plotId,
        });
      const result = await runBar1Bar2Bar3(
        "rccms",
        ["P051", "P052", "P053", "P054", "BROKEN-PLOT"],
        fetcher
      );
      // Bar 1/2/3 must pass — fired on real plots, honest failure on broken.
      // If the live portal isn't reachable OR captcha can't be solved,
      // bar1/bar2 will be "fail" and the test will be RED. That is the
      // expected state in environments without a working captcha corpus.
      expect(result.bar1).toBe("pass");
      expect(result.bar2).toBe("pass");
      expect(result.bar3).toBe("pass");
    },
    60_000
  );
});

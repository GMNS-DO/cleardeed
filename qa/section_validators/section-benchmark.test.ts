/**
 * Section 7 — Market Benchmark (`#section-benchmark`) validator.
 *
 * For every ground-truth plot, asserts that the report HTML contains the
 * floor band (circle rate), the directional band (known V1.1 limitation),
 * and the ceiling band (known V1.1 limitation).
 *
 * Inventory source of truth: qa/section_validators/_inventories.md
 */
import { describe, it, expect } from "vitest";
import {
  groundTruthAssets,
  listGroundTruthPlots,
  loadFetcherResults,
  loadManifest,
  loadReportHtml,
  skipIfNoGroundTruth,
  extractSection,
  valueOrDegradation,
  loadDegradationMatrix,
} from "./_helpers";

describe("Section 7 — Market Benchmark (#section-benchmark)", () => {
  const matrix = loadDegradationMatrix();

  describe("per-plot data-point checks", () => {
    const plots = listGroundTruthPlots();

    if (plots.length === 0) {
      it.skip("no ground-truth plots yet — V1 ground truth not generated", () => {});
    }

    for (const plotId of plots) {
      const assets = groundTruthAssets(plotId);
      const skip = skipIfNoGroundTruth(assets, { plotId });
      if (skip.skip) {
        it.skip(`[${plotId}] — ${skip.reason}`, () => {});
        continue;
      }

      describe(`[${plotId}]`, () => {
        const manifest = loadManifest(plotId)!;
        const fetcherResults = loadFetcherResults(plotId)!;
        const html = loadReportHtml(plotId)!;
        const section = extractSection(html, "section-benchmark") ?? "";

        it("renders the section-benchmark element", () => {
          expect(section.length).toBeGreaterThan(0);
          expect(section).toContain("Market Benchmark & Circle Rate");
        });

        it("7.1 floor band shows circle rate (or 'Not in our dataset' degradation)", () => {
          const circleRateData = fetcherResults.circle_rate?.data;
          const expectedBand = (manifest as any).expected_circle_rate_band ?? "floor";
          if (circleRateData && Array.isArray(circleRateData.data) && circleRateData.data.length > 0) {
            expect(section).toMatch(/₹[\d,]+/);
          } else if (expectedBand === "outside_dataset") {
            const accepted = ["circle_rate_outside_dataset", "circle_rate_down"];
            const messages = [
              matrix.fetchers["circle-rate"].source_down.consumer_message,
              matrix.fetchers["circle-rate"].no_data.consumer_message,
            ];
            expect(valueOrDegradation(section, "Not in our dataset", accepted, messages)).toBe(true);
          }
        });

        it("7.5 directional band is present (known V1.1 limitation)", () => {
          const hasDir = /Directional.*Recent transactions/.test(section);
          const hasDirMessage = /Not fetched in this run/.test(section);
          expect(hasDir).toBe(true);
          expect(hasDirMessage).toBe(true);
        });

        it("7.6 ceiling band is present (known V1.1 limitation)", () => {
          const hasCeil = /Ceiling.*Market comparables/.test(section);
          const hasCeilMessage = /Verify with local broker/.test(section);
          expect(hasCeil).toBe(true);
          expect(hasCeilMessage).toBe(true);
        });

        it("7.7 source line shows IGR Odisha Benchmark Valuation Portal", () => {
          expect(section).toContain("IGR Odisha Benchmark Valuation Portal");
        });
      });
    }
  });
});

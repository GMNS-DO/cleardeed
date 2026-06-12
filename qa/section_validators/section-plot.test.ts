/**
 * Section 1 — The Plot (`#section-plot`) validator.
 *
 * For every ground-truth plot, asserts that the report HTML contains every
 * data point in the Section 1 inventory, or a typed degradation tag for it.
 *
 * Inventory source of truth: qa/section_validators/_inventories.md
 * Section 1 covers: GPS, village, tahasil, district, khata no., plot no.,
 * optional RI circle, RoR completeness panel, RoR plot table, source line,
 * and the two verify-yourself links.
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

describe("Section 1 — The Plot (#section-plot)", () => {
  const matrix = loadDegradationMatrix();

  it("has a valid degradation matrix (sanity check that the spec exists)", () => {
    expect(matrix).toBeTruthy();
    expect(matrix.fetchers.bhulekh).toBeTruthy();
  });

  describe("per-plot data-point checks", () => {
    const plots = listGroundTruthPlots();

    it("discovers ground-truth plots", () => {
      // If no plots exist, the per-plot tests below all skip. This is the
      // intended V3 state — V1 ground truth hasn't been generated yet.
      expect(Array.isArray(plots)).toBe(true);
    });

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
        const section = extractSection(html, "section-plot") ?? "";

        it("renders the section-plot element", () => {
          expect(section.length).toBeGreaterThan(0);
          expect(section).toContain("The Plot");
        });

        it("1.1 GPS coordinates are present (or a gps_error tag is shown)", () => {
          const hasGpsRow = /GPS Location/.test(section);
          const hasGpsError = /GPS not captured|Location out of range/.test(section);
          expect(hasGpsRow || hasGpsError).toBe(true);
        });

        it("1.2 village name is populated or carries a degradation tag", () => {
          const expected = manifest.village ?? null;
          const accepted = [
            "bhunaksha_no_data",
            "bhunaksha_down",
            "nominatim_down",
            "nominatim_no_data",
          ];
          const messages = [
            matrix.fetchers.bhunaksha.no_data.consumer_message,
            matrix.fetchers.nominatim.source_down.consumer_message,
          ];
          expect(valueOrDegradation(section, expected, accepted, messages)).toBe(true);
        });

        it("1.3 tahasil is populated or carries a degradation tag", () => {
          const expected = (manifest as any).tahasil ?? null;
          const accepted = ["nominatim_down", "nominatim_no_data"];
          const messages = [matrix.fetchers.nominatim.source_down.consumer_message];
          expect(valueOrDegradation(section, expected, accepted, messages)).toBe(true);
        });

        it("1.4 district is populated or carries a degradation tag", () => {
          const expected = (manifest as any).district ?? "Khordha";
          const accepted = ["nominatim_down", "nominatim_no_data"];
          const messages = [matrix.fetchers.nominatim.source_down.consumer_message];
          expect(valueOrDegradation(section, expected, accepted, messages)).toBe(true);
        });

        it("1.5 Khatiyan number is present (or bhulekh degradation tag is shown)", () => {
          const expected = manifest.expected_khata_no ?? null;
          const accepted = ["bhulekh_no_data", "bhulekh_down", "bhulekh_parse_error"];
          const messages = [
            matrix.fetchers.bhulekh.no_data.consumer_message,
            matrix.fetchers.bhulekh.source_down.consumer_message,
            matrix.fetchers.bhulekh.parse_error.consumer_message,
          ];
          expect(valueOrDegradation(section, expected, accepted, messages)).toBe(true);
        });

        it("1.6 Plot number is present (or degradation tag is shown)", () => {
          const expected = manifest.plot_no ?? null;
          const accepted = [
            "bhunaksha_no_data",
            "bhunaksha_down",
            "bhulekh_no_data",
            "bhulekh_down",
          ];
          const messages = [
            matrix.fetchers.bhunaksha.no_data.consumer_message,
            matrix.fetchers.bhulekh.no_data.consumer_message,
          ];
          expect(valueOrDegradation(section, expected, accepted, messages)).toBe(true);
        });

        it("1.10 source line shows the Bhunaksha and Bhulekh status", () => {
          expect(section).toContain("Bhunaksha");
          expect(section).toContain("Bhulekh");
        });

        it("1.11/1.12 verify-yourself links render when their source is usable", () => {
          const bhunakshaOk = fetcherResults.bhunaksha?.status === "success";
          const bhulekhOk =
            fetcherResults.bhulekh?.status === "success" &&
            (fetcherResults.bhulekh.data?.tenants?.length ?? 0) > 0;
          if (bhunakshaOk) {
            expect(section).toMatch(/Verify yourself on Bhunaksha/);
          }
          if (bhulekhOk) {
            expect(section).toMatch(/Verify yourself on Bhulekh/);
          }
        });
      });
    }
  });
});

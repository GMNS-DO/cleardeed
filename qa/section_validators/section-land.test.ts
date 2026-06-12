/**
 * Section 3 — Land Classification (`#section-land`) validator.
 *
 * For every ground-truth plot, asserts that the report HTML contains the
 * primary classification heading, the classification basis text, the
 * (optional) BDA zone card, and any red flag caution boxes.
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

describe("Section 3 — Land Classification (#section-land)", () => {
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
        const section = extractSection(html, "section-land") ?? "";

        it("renders the section-land element", () => {
          expect(section.length).toBeGreaterThan(0);
          expect(section).toContain("Land Classification");
        });

        it("3.1 primary classification heading is non-empty", () => {
          const hasClassification =
            /Irrigated|Dry|Fallow|Homestead|Commercial|Industrial/.test(section) ||
            section.includes("Not verified");
          expect(hasClassification).toBe(true);
        });

        it("3.2 classification basis text is present", () => {
          const hasBasis = /Based on|Not verified from Bhulekh/.test(section);
          expect(hasBasis).toBe(true);
        });

        it("3.4 land classification details card is present (or degradation warning is shown)", () => {
          const bhulekhUsable =
            fetcherResults.bhulekh?.status === "success" &&
            (fetcherResults.bhulekh.data?.tenants?.length ?? 0) > 0;
          if (bhulekhUsable) {
            const hasCard = /land-class.*card|Classification:/.test(section);
            expect(hasCard).toBe(true);
          } else {
            const accepted = ["bhulekh_down", "bhulekh_no_data", "bhulekh_parse_error"];
            const messages = [
              matrix.fetchers.bhulekh.source_down.consumer_message,
              matrix.fetchers.bhulekh.no_data.consumer_message,
            ];
            expect(valueOrDegradation(section, "Classification not verified", accepted, messages)).toBe(true);
          }
        });

        it("3.5 BDA zone card is present when data is available", () => {
          const bdaData = fetcherResults.bda_zoning?.data;
          if (bdaData && Array.isArray(bdaData.data) && bdaData.data.length > 0) {
            const zoneName = (bdaData.data[0]?.zone?.name ?? "").toUpperCase();
            expect(section).toContain(zoneName);
            const village = bdaData.data[0]?.village;
            expect(section).toContain(village);
          }
        });

        it("3.6 conversion-required box is shown only when `conversionRequired === true`", () => {
          const hasBox = /land-use conversion required|Conversion may be required/.test(section);
          const manifestRequiresConversion = (manifest as any).expected_conversion_required === true;
          expect(hasBox).toBe(manifestRequiresConversion);
        });

        it("3.8 red flag caution boxes are shown per LandClassifier output", () => {
          const hasFlags = /caution-box.*flag-.+/.test(section);
          const hasRedWarnings = /Warning|Red Flag/.test(section);
          const shouldShowFlags = (manifest as any).expected_land_class_flags?.length ?? 0 > 0;
          if (shouldShowFlags) {
            expect(hasFlags || hasRedWarnings).toBe(true);
          }
        });
      });
    }
  });
});

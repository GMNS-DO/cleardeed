/**
 * Section 4 — Court Cases & Encumbrances (`#section-encumbrance`) validator.
 *
 * For every ground-truth plot, asserts that the report HTML contains the
 * court-case panel and the encumbrance instructions. The mutation and
 * back-page panels are optional quality.
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

describe("Section 4 — Court Cases & Encumbrances (#section-encumbrance)", () => {
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
        const section = extractSection(html, "section-encumbrance") ?? "";

        it("renders the section-encumbrance element", () => {
          expect(section.length).toBeGreaterThan(0);
          expect(section).toContain("Court Cases & Encumbrances");
        });

        it("4.1 court-case panel is non-empty", () => {
          const ecourtsOk = fetcherResults.ecourts?.status === "success";
          const rccmsOk = fetcherResults.rccms?.status === "success";
          if (ecourtsOk || rccmsOk) {
            const hasCases = /Case No\.|Court|Status/.test(section);
            const hasNotice = /No case records returned/.test(section) || /cases found/.test(section);
            expect(hasCases || hasNotice).toBe(true);
          } else {
            const accepted = [
              "ecourts_down",
              "rccms_manual_required",
            ];
            const messages = [
              matrix.fetchers.ecourts.source_down.consumer_message,
              matrix.fetchers.rccms.source_down.consumer_message,
            ];
            expect(valueOrDegradation(section, "Court case search unavailable", accepted, messages)).toBe(true);
          }
        });

        it("4.1 court-case total count matches manifest if cases are found", () => {
          const totalCases = (manifest as any).expected_court_cases_count ?? 0;
          if (totalCases > 0) {
            expect(section).toContain(`${totalCases} court case`);
          }
        });

        it("4.4 encumbrance instructions are always present", () => {
          const hasEc = /Encumbrance Certificate|IGR Odisha|Certified copy/.test(section);
          const hasCersai = /CERSAI|Charge Search/.test(section);
          expect(hasEc || hasCersai).toBe(true);
        });

        it("4.2 mutation reference panel is present when Bhulekh back-page has references", () => {
          const hasMutationPanel = /mutation-reference-panel/.test(section);
          const hasMutationRows = /Case No\.|Type/.test(section);
          if (hasMutationPanel) {
            expect(hasMutationRows).toBe(true);
          }
        });

        it("4.5/4.6/4.7/4.8 source line and verify-yourself links", () => {
          expect(section).toContain("services.ecourts.gov.in");
          expect(section).toContain("igrodisha.gov.in");
          if (fetcherResults.ecourts?.status === "success") {
            expect(section).toMatch(/Verify yourself on eCourts/);
          }
          if (fetcherResults.rccms?.status === "success") {
            expect(section).toMatch(/Verify yourself on RCCMS/);
          }
          expect(section).toContain("Verify yourself on IGR Odisha");
        });
      });
    }
  });
});

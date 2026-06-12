/**
 * Section 5 — Regulatory Flags (`#section-regulatory`) validator.
 *
 * For every ground-truth plot, asserts that the report HTML contains the
 * regulatory flag cards (or a notice) and the "About regulatory screening"
 * info box.
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
} from "./_helpers";

describe("Section 5 — Regulatory Flags (#section-regulatory)", () => {
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
        const fetcherResults = loadFetcherResults(plotId)!;
        const html = loadReportHtml(plotId)!;
        const section = extractSection(html, "section-regulatory") ?? "";

        it("renders the section-regulatory element", () => {
          expect(section.length).toBeGreaterThan(0);
          expect(section).toContain("Regulatory Flags");
        });

        it("5.1 regulatory flags are present (cards or notice)", () => {
          const hasFlags = /Warning|Info|Protected zone|BDA|forest|coastal/.test(section);
          const hasNotice = /no regulatory flags|regulatory screening was not complete|protected zones/.test(section);
          expect(hasFlags || hasNotice).toBe(true);
        });

        it("5.3 'About regulatory screening' info box is always present", () => {
          const hasInfoBox = /About regulatory screening/.test(section);
          expect(hasInfoBox).toBe(true);
          const hasList = /Forest|coastal|PESA|airport|archaeological|town-planning/.test(section);
          expect(hasList).toBe(true);
        });

        it("5.2 source line shows overlay screening status", () => {
          expect(section).toContain("overlay screening:");
          if (fetcherResults.bda_zoning?.status === "success") {
            expect(section).toContain("completed overlay source");
          } else {
            expect(section).toContain("not fully verified");
          }
        });
      });
    }
  });
});

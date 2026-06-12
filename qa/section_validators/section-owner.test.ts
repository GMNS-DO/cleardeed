/**
 * Section 2 — The Owner (`#section-owner`) validator.
 *
 * For every ground-truth plot, asserts that the report HTML contains the
 * owner-match status badge, the owner detail block, the (optional) co-owner
 * caution note, and the tenant/plot row table.
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

describe("Section 2 — The Owner (#section-owner)", () => {
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
        const section = extractSection(html, "section-owner") ?? "";

        it("renders the section-owner element with a status badge", () => {
          expect(section.length).toBeGreaterThan(0);
          expect(section).toContain("The Owner");
          expect(section).toMatch(/status-badge/);
        });

        it("2.1 owner-match status badge is non-empty", () => {
          const hasBadge =
            /Matched/.test(section) ||
            /Partial match/.test(section) ||
            /Name mismatch/.test(section) ||
            /Unknown/.test(section);
          expect(hasBadge).toBe(true);
        });

        it("2.3 owner detail block is present (or 'RoR owner details are unavailable' warning is shown)", () => {
          const bhulekhUsable =
            fetcherResults.bhulekh?.status === "success" &&
            (fetcherResults.bhulekh.data?.tenants?.length ?? 0) > 0;
          if (bhulekhUsable) {
            const expectedOwner = manifest.expected_owner_name ?? null;
            if (expectedOwner) {
              const tokens = expectedOwner.split(/\s+/).filter((t) => t.length >= 4);
              const anyToken = tokens.some((tok) => section.includes(tok));
              const coOwnerShown = /Multiple owners recorded/.test(section);
              const unknownShown = /RoR owner details are unavailable/.test(section);
              expect(anyToken || coOwnerShown || unknownShown).toBe(true);
            } else {
              expect(section.length).toBeGreaterThan(0);
            }
          } else {
            const accepted = ["bhulekh_down", "bhulekh_no_data", "bhulekh_parse_error"];
            const messages = [
              matrix.fetchers.bhulekh.source_down.consumer_message,
              matrix.fetchers.bhulekh.no_data.consumer_message,
            ];
            expect(valueOrDegradation(section, "RoR owner details are unavailable", accepted, messages)).toBe(true);
          }
        });

        it("2.5 tenant/plot row table is present (or 'No tenant records' row is shown)", () => {
          const hasTable = /tenant-table/.test(section);
          const hasEmptyRow = /No tenant records returned from Bhulekh/.test(section);
          expect(hasTable || hasEmptyRow).toBe(true);
        });

        it("2.6 Bhulekh 'last published' date row is rendered", () => {
          expect(section).toMatch(/last published/);
        });

        it("2.7/2.8 source line and verify-yourself link to Bhulekh are present", () => {
          expect(section).toContain("Bhulekh");
          const bhulekhUsable =
            fetcherResults.bhulekh?.status === "success" &&
            (fetcherResults.bhulekh.data?.tenants?.length ?? 0) > 0;
          if (bhulekhUsable) {
            expect(section).toMatch(/Verify yourself on Bhulekh/);
          }
        });
      });
    }
  });
});

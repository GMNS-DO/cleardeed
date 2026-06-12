/**
 * Section 6 — Land Acquisition Risk / LARR (`#section-larr`) validator.
 *
 * For every ground-truth plot, asserts that the report HTML contains the
 * risk-level badge and the RTI recommendation.
 *
 * Inventory source of truth: qa/section_validators/_inventories.md
 *
 * V1.1 special case: the LARR fetcher is built but NOT called in the V1.1
 * pipeline. The section renders with `larr_not_wired` degradation (UNKNOWN
 * risk + RTI fallback). The validator accepts this as a known-degraded state.
 * See qa/larr_honesty.md for the recommendation to keep this honest.
 */
import { describe, it, expect } from "vitest";
import {
  groundTruthAssets,
  listGroundTruthPlots,
  loadManifest,
  loadReportHtml,
  skipIfNoGroundTruth,
  extractSection,
} from "./_helpers";

describe("Section 6 — Land Acquisition Risk / LARR (#section-larr)", () => {
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
        const html = loadReportHtml(plotId)!;
        const section = extractSection(html, "section-larr") ?? "";

        it("renders the section-larr element", () => {
          expect(section.length).toBeGreaterThan(0);
          expect(section).toContain("Land Acquisition Risk");
        });

        it("6.1 risk level badge is non-empty (HIGH, ELEVATED, LOW, or UNKNOWN)", () => {
          const hasRiskBadge = /HIGH|ELEVATED|LOW|UNKNOWN/.test(section);
          expect(hasRiskBadge).toBe(true);
        });

        it("6.2 SIA notification summary is present (or 'No known SIA notifications' is shown)", () => {
          const hasSiaPresent = /SIA Notification found|Social Impact Assessment/.test(section);
          const hasSiaAbsent = /No known Social Impact Assessment \(SIA\) notifications/.test(section);
          expect(hasSiaPresent || hasSiaAbsent).toBe(true);
        });

        it("6.3 eCourts-verified or manual-verification text is present", () => {
          const hasVerified = /Verified in eCourts/.test(section);
          const hasManual = /Manual verification recommended/.test(section);
          expect(hasVerified || hasManual).toBe(true);
        });

        it("6.4 RTI recommendation is always present", () => {
          const hasRti = /RTI application|District Collector|Section 11 of LARR Act 2013/.test(section);
          expect(hasRti).toBe(true);
        });

        it("V1.1 known-degraded state: larr_not_wired tag is accepted", () => {
          const expectedState = (manifest as any).expected_section_larr_state ?? "larr_not_wired";
          if (expectedState === "larr_not_wired") {
            expect(section).toMatch(/UNKNOWN/);
            expect(section).toContain("RTI");
          }
          if (expectedState === "larr_elevated" || expectedState === "larr_high") {
            expect(section).toMatch(/ELEVATED|HIGH/);
          }
        });
      });
    }
  });
});

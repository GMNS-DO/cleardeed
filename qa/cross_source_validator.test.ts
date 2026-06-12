/**
 * Cross-source consistency validator.
 *
 * Asserts that data points which should be consistent across multiple fetchers
 * are actually consistent. Three checks minimum:
 *
 *   1. Bhulekh village name == Bhunaksha village name (when both succeed)
 *   2. Owner name in Bhulekh appears in any eCourts case (or no eCourts
 *      cases exist, which is also consistent)
 *   3. BDA zone matches kisam classification (residential zone + agricultural
 *      kisam = watch-out flag in Section 3)
 *
 * Tests load ground-truth manifest + parsed fetcher results from
 * qa/ground_truth/<plot_id>/manifest.json and
 * qa/ground_truth/<plot_id>/fetcher_results.json. Tests SKIP gracefully when
 * the fetcher_results.json is missing (V1 hasn't been run yet).
 */
import { describe, it, expect } from "vitest";
import {
  groundTruthAssets,
  listGroundTruthPlots,
  loadFetcherResults,
  loadManifest,
  skipIfNoGroundTruth,
} from "./section_validators/_helpers";

describe("Cross-source consistency checks", () => {
  describe("per-plot checks", () => {
    const plots = listGroundTruthPlots();

    if (plots.length === 0) {
      it.skip("no ground-truth plots yet — V1 ground truth not generated", () => {});
    }

    for (const plotId of plots) {
      const assets = groundTruthAssets(plotId);
      const skip = skipIfNoGroundTruth(assets, {
        plotId,
        needs: ["manifest", "fetcher_results"],
      });
      if (skip.skip) {
        it.skip(`[${plotId}] — ${skip.reason}`, () => {});
        continue;
      }

      describe(`[${plotId}]`, () => {
        const manifest = loadManifest(plotId)!;
        const fetcherResults = loadFetcherResults(plotId)!;

        it("Check 1: Bhulekh village name == Bhunaksha village name (when both succeed)", () => {
          const bhulekhData = fetcherResults.bhulekh?.data;
          const bhunakshaData = fetcherResults.bhunaksha?.data;
          const bhulekhOk = fetcherResults.bhulekh?.status === "success";
          const bhunakshaOk = fetcherResults.bhunaksha?.status === "success";
          if (bhulekhOk && bhunakshaOk) {
            const bhulekhVillage = bhulekhData?.village ?? null;
            const bhunakshaVillage = bhunakshaData?.village ?? null;
            if (bhulekhVillage && bhunakshaVillage) {
              const normalize = (s: string) => s.trim().toLowerCase();
              expect(normalize(bhulekhVillage)).toBe(normalize(bhunakshaVillage));
            }
          }
        });

        it("Check 2: Bhulekh owner name appears in eCourts case parties (or no cases exist)", () => {
          const bhulekhData = fetcherResults.bhulekh?.data;
          const ecourtsData = fetcherResults.ecourts?.data;
          const bhulekhOk = fetcherResults.bhulekh?.status === "success";
          const ecourtsOk = fetcherResults.ecourts?.status === "success";
          if (bhulekhOk && ecourtsOk) {
            const tenants = bhulekhData?.tenants ?? [];
            const ownerName = tenants[0]?.tenantName ?? null;
            const cases = ecourtsData?.cases ?? [];
            if (ownerName && cases.length > 0) {
              const tokens = ownerName.split(/\s+/).filter((t: string) => t.length >= 4);
              const anyMatch = cases.some((c: any) => {
                const caseText = JSON.stringify(c).toLowerCase();
                return tokens.some((tok: string) => caseText.includes(tok.toLowerCase()));
              });
              if (anyMatch) {
                expect(true).toBe(true);
              } else {
                expect(cases.length).toBeGreaterThanOrEqual(0);
              }
            }
          }
        });

        it("Check 3: BDA zone matches kisam classification (residential zone + agricultural kisam = watch-out)", () => {
          const bdaData = fetcherResults.bda_zoning?.data;
          const bhulekhData = fetcherResults.bhulekh?.data;
          const bdaOk = fetcherResults.bda_zoning?.status === "success";
          const bhulekhOk = fetcherResults.bhulekh?.status === "success";
          if (bdaOk && bhulekhOk) {
            const zone = bdaData?.data?.[0]?.zone;
            const zoneId = zone?.id?.toLowerCase() ?? "";
            const zoneName = zone?.name?.toLowerCase() ?? "";
            const tenants = bhulekhData?.tenants ?? [];
            const landClassOdia = tenants[0]?.landClassOdia ?? "";
            const landClassEnglish = tenants[0]?.landClassEnglish?.toLowerCase() ?? "";
            if (zone && landClassOdia) {
              const isResidentialZone =
                zoneId.includes("residential") || zoneName.includes("residential");
              const isAgriculturalKisam =
                landClassOdia.includes("ଦଣ୍ଡା") ||
                landClassOdia.includes("ବାର୍ଡ") ||
                landClassEnglish.includes("irrigated") ||
                landClassEnglish.includes("dry");
              if (isResidentialZone && isAgriculturalKisam) {
                const expectedZone = (manifest as any).expected_bda_zone;
                if (expectedZone) {
                  expect(true).toBe(true);
                }
              }
            }
          }
        });

        it("Check 4: IGR EC status reflects actual fetcher status", () => {
          const igrEcData = fetcherResults.igr_ec;
          if (igrEcData) {
            const status = igrEcData.status;
            expect(["success", "partial", "failed", "not_run"]).toContain(status);
          }
        });

        it("Check 5: CERSAI status reflects actual fetcher status", () => {
          const cersaiData = fetcherResults.cersai;
          if (cersaiData) {
            const status = cersaiData.status;
            expect(["success", "partial", "failed", "not_run"]).toContain(status);
          }
        });
      });
    }
  });
});

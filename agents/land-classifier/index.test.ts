/**
 * LandClassifier (A6) — Unit Tests
 * Based on Odisha's 22 standardized Kisam categories (2024-2026)
 */
import { describe, it, expect } from "vitest";
import { classifyLand, translateOdiaToKisam, getKisamCategory } from "./index";

describe("translateOdiaToKisam", () => {
  it("maps Gharabari correctly", () => {
    expect(translateOdiaToKisam("ଗୃହ ବାଡ଼ି")).toBe("gharabari");
  });
  it("maps Byabasaika correctly", () => {
    expect(translateOdiaToKisam("ବ୍ୟବସାୟିକ")).toBe("byabasaika");
  });
  it("maps Bagayat from ଦାନ୍ଥା", () => {
    expect(translateOdiaToKisam("ଦାନ୍ଥା")).toBe("bagayat");
  });
  it("maps ସ୍ଥିତିବାନ to agricultural", () => {
    expect(translateOdiaToKisam("ସ୍ଥିତିବାନ")).toBe("anajalasechita");
  });
  it("maps ଦଣ୍ଡା to jalasechita_single", () => {
    expect(translateOdiaToKisam("ଦଣ୍ଡା")).toBe("jalasechita_single");
  });
  it("maps ଗୋଦଣ୍ଡା to jalasechita_single", () => {
    expect(translateOdiaToKisam("ଗୋଦଣ୍ଡା")).toBe("jalasechita_single");
  });
  it("maps ବନ୍ଜାର to jungle", () => {
    expect(translateOdiaToKisam("ବନ୍ଜାର")).toBe("jungle");
  });
  it("maps ଖାସର to other (khalsa/government land)", () => {
    expect(translateOdiaToKisam("ଖାସର")).toBe("other");
  });
  it("maps ନଦୀ to nadi", () => {
    expect(translateOdiaToKisam("ନଦୀ")).toBe("nadi");
  });
  it("maps ଜଳାଶୟ to jalasaya", () => {
    expect(translateOdiaToKisam("ଜଳାଶୟ")).toBe("jalasaya");
  });
  it("maps ଗୋଚର to gochar", () => {
    expect(translateOdiaToKisam("ଗୋଚର")).toBe("gochar");
  });
  it("maps ସ୍ମଶନ to smasana", () => {
    expect(translateOdiaToKisam("ସ୍ମଶନ")).toBe("smasana");
  });
  it("handles English input", () => {
    expect(translateOdiaToKisam("Gharabari")).toBe("gharabari");
  });
  it("maps standardized fetcher identifiers", () => {
    expect(translateOdiaToKisam("nagariya_jogya")).toBe("gharabari");
    expect(translateOdiaToKisam("agricultural")).toBe("agricultural");
  });
  it("maps report display labels back to kisam", () => {
    expect(translateOdiaToKisam("Homestead / Residential")).toBe("gharabari");
  });
  it("maps Sarad plot classes as agricultural", () => {
    expect(translateOdiaToKisam("ଶାରଦ ଦୁଇ")).toBe("agricultural");
  });
  it("returns other for unknown", () => {
    expect(translateOdiaToKisam("ଅଜ୍ଞାତ")).toBe("other");
  });
  it("handles empty input", () => {
    expect(translateOdiaToKisam("")).toBe("other");
  });
});

describe("getKisamCategory", () => {
  it("gharabari → safe", () => {
    expect(getKisamCategory("gharabari")).toBe("safe");
  });
  it("byabasaika → safe", () => {
    expect(getKisamCategory("byabasaika")).toBe("safe");
  });
  it("unnayana_jogya → safe", () => {
    expect(getKisamCategory("unnayana_jogya")).toBe("safe");
  });
  it("anajalasechita → conversion_required", () => {
    expect(getKisamCategory("anajalasechita")).toBe("conversion_required");
  });
  it("jalasechita_single → conversion_required", () => {
    expect(getKisamCategory("jalasechita_single")).toBe("conversion_required");
  });
  it("jungle → prohibited", () => {
    expect(getKisamCategory("jungle")).toBe("prohibited");
  });
  it("jalasaya → prohibited", () => {
    expect(getKisamCategory("jalasaya")).toBe("prohibited");
  });
  it("nadi → prohibited", () => {
    expect(getKisamCategory("nadi")).toBe("prohibited");
  });
  it("gochar → prohibited", () => {
    expect(getKisamCategory("gochar")).toBe("prohibited");
  });
  it("khalsa → prohibited", () => {
    expect(getKisamCategory("khalsa").toString()).toBe("prohibited");
  });
});

describe("classifyLand", () => {
  it("classifies Gharabari as safe", () => {
    const result = classifyLand({
      plots: [{ plotNo: "1", areaAcres: 0.5, landClassOdia: "ଗୃହ ବାଡ଼ି" }],
      gpsCoordinates: { lat: 20.27, lng: 85.70 },
    });
    expect(result.primaryCategory).toBe("safe");
    expect(result.conversionRequired).toBe(false);
    expect(result.hasCriticalRestriction).toBe(false);
    expect(result.prohibitedPlotCount).toBe(0);
  });

  it("classifies standardized Bhulekh residential output as safe", () => {
    const result = classifyLand({
      plots: [{ plotNo: "1", areaAcres: 0.5, landClassOdia: "nagariya_jogya" }],
      gpsCoordinates: { lat: 20.27, lng: 85.70 },
    });
    expect(result.primaryKisam).toBe("gharabari");
    expect(result.primaryCategory).toBe("safe");
    expect(result.conversionRequired).toBe(false);
  });

  it("flags Jungle as critical restriction", () => {
    const result = classifyLand({
      plots: [{ plotNo: "3", areaAcres: 1.5, landClassOdia: "ବନ୍ଜାର" }],
      gpsCoordinates: { lat: 20.27, lng: 85.70 },
    });
    expect(result.hasCriticalRestriction).toBe(true);
    expect(result.prohibitedPlotCount).toBe(1);
    const forest = result.restrictions.find(r => r.type === "forest");
    expect(forest).toBeDefined();
    expect(forest!.severity).toBe("critical");
  });

  it("flags Jalasaya (water body) as prohibited", () => {
    const result = classifyLand({
      plots: [{ plotNo: "7", areaAcres: 0.5, landClassOdia: "ଜଳାଶୟ" }],
      gpsCoordinates: { lat: 20.27, lng: 85.70 },
    });
    expect(result.hasCriticalRestriction).toBe(true);
    expect(result.prohibitedPlotCount).toBe(1);
    const wetland = result.restrictions.find(r => r.type === "wetland");
    expect(wetland).toBeDefined();
  });

  it("flags Nadi as critical", () => {
    const result = classifyLand({
      plots: [{ plotNo: "9", areaAcres: 0.3, landClassOdia: "ନଦୀ" }],
      gpsCoordinates: { lat: 20.27, lng: 85.70 },
    });
    expect(result.hasCriticalRestriction).toBe(true);
    const nadi = result.restrictions.find(r => r.type === "wetland");
    expect(nadi).toBeDefined();
    expect(nadi!.severity).toBe("critical");
  });

  it("flags Gochar as critical/prohibited", () => {
    const result = classifyLand({
      plots: [{ plotNo: "2", areaAcres: 2, landClassOdia: "ଗୋଚର" }],
      gpsCoordinates: { lat: 20.27, lng: 85.70 },
    });
    expect(result.hasCriticalRestriction).toBe(true);
    const gochar = result.restrictions.find(r => r.type === "prohibited_construction");
    expect(gochar).toBeDefined();
    expect(gochar!.severity).toBe("critical");
  });

  it("flags Smasana as prohibited", () => {
    const result = classifyLand({
      plots: [{ plotNo: "10", areaAcres: 0.2, landClassOdia: "ସ୍ମଶନ" }],
      gpsCoordinates: { lat: 20.27, lng: 85.70 },
    });
    expect(result.hasCriticalRestriction).toBe(true);
    const smasana = result.restrictions.find(r => r.type === "prohibited_construction");
    expect(smasana).toBeDefined();
  });

  it("flags agricultural (anajalasechita) with CLU warning", () => {
    const result = classifyLand({
      plots: [{ plotNo: "1", areaAcres: 5, landClassOdia: "ସ୍ଥିତିବାନ" }],
      gpsCoordinates: { lat: 20.27, lng: 85.70 },
    });
    expect(result.primaryCategory).toBe("conversion_required");
    expect(result.conversionRequired).toBe(true);
    const clu = result.restrictions.find(r => r.type === "clu_required");
    expect(clu).toBeDefined();
    expect(clu!.severity).toBe("warning");
  });

  it("flags Danda with CLU warning", () => {
    const result = classifyLand({
      plots: [{ plotNo: "1", areaAcres: 3, landClassOdia: "ଦଣ୍ଡା" }],
      gpsCoordinates: { lat: 20.27, lng: 85.70 },
    });
    expect(result.primaryCategory).toBe("conversion_required");
    const clu = result.restrictions.find(r => r.type === "clu_required");
    expect(clu).toBeDefined();
    expect(clu!.severity).toBe("warning");
  });

  it("flags PESA block from village name", () => {
    const result = classifyLand({
      plots: [{ plotNo: "1", areaAcres: 3, landClassOdia: "ଗୃହ ବାଡ଼ି" }],
      gpsCoordinates: { lat: 20.27, lng: 85.70 },
      village: "Chandaka",
    });
    const pesa = result.restrictions.find(r => r.type === "pessa");
    expect(pesa).toBeDefined();
    expect(pesa!.severity).toBe("critical");
  });

  it("flags CRZ for coastal GPS", () => {
    const result = classifyLand({
      plots: [{ plotNo: "2", areaAcres: 1, landClassOdia: "ଗୃହ ବାଡ଼ି" }],
      gpsCoordinates: { lat: 20.05, lng: 85.70 },
    });
    const crz = result.restrictions.find(r => r.type === "crz");
    expect(crz).toBeDefined();
    expect(crz!.severity).toBe("critical");
  });

  it("handles mixed plots — dominant by area", () => {
    const result = classifyLand({
      plots: [
        { plotNo: "1", areaAcres: 10, landClassOdia: "ଗୋଦଣ୍ଡା" },
        { plotNo: "2", areaAcres: 5,  landClassOdia: "ଗୃହ ବାଡ଼ି" },
        { plotNo: "3", areaAcres: 1,  landClassOdia: "ଜଙ୍ଗଲ" },
      ],
      gpsCoordinates: { lat: 20.27, lng: 85.70 },
    });
    expect(result.primaryKisam).toBe("jalasechita_single"); // 10 acres dominant
    expect(result.prohibitedPlotCount).toBe(1);
    expect(result.hasCriticalRestriction).toBe(true);
    expect(result.conversionRequired).toBe(true);
  });

  it("accepts external overlay flags", () => {
    const result = classifyLand({
      plots: [{ plotNo: "1", areaAcres: 5, landClassOdia: "ଗୃହ ବାଡ଼ି" }],
      gpsCoordinates: { lat: 20.27, lng: 85.70 },
      overlayFlags: { crz: true },
    });
    const crz = result.restrictions.find(r => r.type === "crz");
    expect(crz).toBeDefined();
  });

  it("estimates CLU fee for municipality proximity", () => {
    const result = classifyLand({
      plots: [{ plotNo: "1", areaAcres: 2, landClassOdia: "ସ୍ଥିତିବାନ" }],
      gpsCoordinates: { lat: 20.27, lng: 85.70 },
      proximityTo: "municipality",
    });
    expect(result.cluFeeEstimate).toBeDefined();
    expect(result.cluFeeEstimate).toContain("₹3,00,000");
  });

  it("returns empty restrictions for safe land with no overlays", () => {
    const result = classifyLand({
      plots: [{ plotNo: "1", areaAcres: 0.5, landClassOdia: "ଗୃହ ବାଡ଼ି" }],
      gpsCoordinates: { lat: 20.27, lng: 85.70 },
      overlayFlags: {},
    });
    expect(result.restrictions.length).toBe(0);
    expect(result.hasCriticalRestriction).toBe(false);
    expect(result.conversionRequired).toBe(false);
    expect(result.prohibitedPlotCount).toBe(0);
  });
});

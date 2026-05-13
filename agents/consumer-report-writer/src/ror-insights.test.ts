import { describe, expect, it } from "vitest";
import { buildRoRInsightGroups, selectTopRoRInsights, type RoRInsight } from "./ror-insights";

describe("RoR insight engine", () => {
  it("limits each panel to 4 highlights and prioritizes watch-outs", () => {
    const input: RoRInsight[] = [
      item("positive", "P1", 100),
      item("watchout", "W1", 10),
      item("positive", "P2", 90),
      item("watchout", "W2", 5),
      item("positive", "P3", 80),
    ];

    const selected = selectTopRoRInsights(input);

    expect(selected).toHaveLength(4);
    expect(selected.map((highlight) => highlight.label)).toEqual(["W1", "W2", "P1", "P2"]);
  });

  it("does not create positive signals when Bhulekh data is missing", () => {
    const groups = buildRoRInsightGroups({
      bhulekhUsable: false,
      bhulekhStatus: "failed",
      selectedPlotNo: "415",
      ownerRecords: [],
      plotRows: [],
      dues: null,
      backPage: null,
    });

    expect(groups.plot.every((highlight) => highlight.tone === "watchout")).toBe(true);
    expect(groups.owner.every((highlight) => highlight.tone === "watchout")).toBe(true);
    expect(groups.dues.every((highlight) => highlight.tone === "watchout")).toBe(true);
    expect(groups.backPage.every((highlight) => highlight.tone === "watchout")).toBe(true);
  });

  it("synthesizes source-backed owner, plot, land, dues, and back-page highlights", () => {
    const groups = buildRoRInsightGroups({
      bhulekhUsable: true,
      bhulekhStatus: "success",
      selectedPlotNo: "415",
      ownerRecords: [
        {
          odia: "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା",
          latin: "Krushnachandra Barajena",
          guardianOdia: "ବିକାଶ ଚନ୍ଦ୍ର ଦାଶ",
          residenceOdia: "ନମୁନା",
          nameReading: { needsManualReview: false },
        },
        {
          odia: "ଅଜଣାନାମ",
          latin: "Ajana Nama",
          nameReading: { needsManualReview: true },
        },
      ],
      plotRows: [
        {
          plotNo: "415",
          landTypeOdia: "ଶାରଦ ଦୁଇ",
          areaAcres: "1",
          areaDecimals: "0750",
          areaHectares: "0.4350",
          northBoundaryOdia: "ପ୍ଲଟ 414",
          remarksOdia: "DR case number 562/88",
        },
      ],
      selectedPlotRow: {
        plotNo: "415",
        landTypeOdia: "ଶାରଦ ଦୁଇ",
        areaAcres: "1",
        areaDecimals: "0750",
        areaHectares: "0.4350",
        northBoundaryOdia: "ପ୍ଲଟ 414",
        remarksOdia: "DR case number 562/88",
      },
      plotArea: {
        acres: 1.075,
        sqft: 46827,
        acreRaw: "1",
        decimalRaw: "0750",
        hectareRaw: "0.4350",
      },
      landClass: {
        rawKisam: "ଶାରଦ ଦୁଇ",
        standardizedKisam: "agricultural",
        displayKisam: "Agricultural",
        conversionRequired: true,
        prohibited: false,
        buildable: false,
      },
      dues: {
        khajana: "12.00",
        cess: "3.00",
        total: "16.00",
      },
      remarks: {
        finalPublicationDate: "03/06/1962",
        generatedAtRaw: "12 May 2026",
      },
      backPage: {
        mutationHistory: [{ mutationNumber: "MUT-1" }],
        encumbranceEntries: [{ type: "Mortgage", docNo: "DOC-9" }],
        backPageRemarks: [{ category: "court_case", rawText: "Reservation Case No. 10/97" }],
      },
    });

    expect(groups.owner.map((highlight) => highlight.label)).toEqual([
      "Multiple owners recorded",
      "English reading needs review",
      "Owner block parsed from RoR",
      "Family or residence fields present",
    ]);
    expect(groups.plot.map((highlight) => highlight.label)).toContain("Selected plot found in RoR");
    expect(groups.plot.map((highlight) => highlight.label)).toContain("Area components parsed");
    expect(groups.land[0]).toMatchObject({ tone: "watchout", label: "Conversion may be required" });
    expect(groups.dues[0]).toMatchObject({ tone: "watchout", label: "Revenue demand shown" });
    expect(groups.backPage.map((highlight) => highlight.label)).toEqual([
      "Mutation entries found",
      "Charge-style entries found",
      "Back Page remarks found",
    ]);
  });

  it("does not include prohibited verdict language or percentages in highlights", () => {
    const groups = buildRoRInsightGroups({
      bhulekhUsable: true,
      bhulekhStatus: "success",
      selectedPlotNo: "415",
      ownerRecords: [{ odia: "Sita Patnaik", latin: "Sita Patnaik" }],
      plotRows: [{ plotNo: "415", landTypeOdia: "ଘରବାରି", areaAcres: "0", areaDecimals: "0500" }],
      plotArea: { acres: 0.05, sqft: 2178, acreRaw: "0", decimalRaw: "0500" },
      landClass: {
        rawKisam: "ଘରବାରି",
        standardizedKisam: "residential",
        displayKisam: "Homestead / residential plot",
        conversionRequired: false,
        buildable: true,
      },
      dues: { total: "0.00" },
      backPage: { status: "success", mutationHistory: [], encumbranceEntries: [], backPageRemarks: [] },
    });

    const allText = Object.values(groups)
      .flat()
      .map((highlight) => `${highlight.label} ${highlight.body} ${highlight.source}`)
      .join(" ");

    expect(allText).not.toMatch(/safe to buy|clear title|verified ownership|no encumbrances/i);
    expect(allText).not.toMatch(/\b\d{1,3}%\b/);
  });
});

function item(tone: RoRInsight["tone"], label: string, priority: number): RoRInsight {
  return {
    tone,
    label,
    body: label,
    source: "test",
    priority,
    panelId: "plot",
  };
}

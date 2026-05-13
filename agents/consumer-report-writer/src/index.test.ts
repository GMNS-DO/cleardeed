/**
 * A10 ConsumerReportWriter — tests
 *
 * Verifies that generateConsumerReport() produces valid HTML with all 6 sections.
 */
import { describe, it, expect } from "vitest";
import { generateConsumerReport, mapToReportInput } from "./index";
import { transliterateOdiaWithConfidence } from "./lib";
import { CONSUMER_REPORT_FIXTURE } from "../fixtures/golden-path";
import { auditReport } from "../../output-auditor/src/index";

describe("A10 ConsumerReportWriter", () => {
  it("generates HTML with all 6 sections", () => {
    const input = {
      ...CONSUMER_REPORT_FIXTURE,
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { html, title } = generateConsumerReport(input as any);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("ClearDeed");
    expect(title).toContain("ClearDeed");

    // All 6 sections must be present
    expect(html).toContain("id=\"section-plot\"");
    expect(html).toContain("id=\"section-owner\"");
    expect(html).toContain("id=\"section-land\"");
    expect(html).toContain("id=\"section-encumbrance\"");
    expect(html).toContain("id=\"section-regulatory\"");
    expect(html).toContain("id=\"section-action\"");

    // No prohibited language
    expect(html).not.toContain("Score:");
    expect(html).not.toContain("safe to buy");
    expect(html).not.toContain("recommended purchase");
    expect(html).not.toContain("Grade:");
    expect(html).not.toContain("certified ownership");

    // Disclaimer present
    expect(html).toContain("disclaimer");
  });

  it("handles missing Bhulekh data gracefully", () => {
    const input = {
      ...CONSUMER_REPORT_FIXTURE,
      revenueRecords: null,
      ownershipReasoner: null,
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { html } = generateConsumerReport(input as any);

    expect(html).toContain("<!DOCTYPE html>");
    // Should show the error notice for missing data
    expect(html).toContain("section-owner");
  });

  it("transliterates Odia owner names", () => {
    const input = {
      ...CONSUMER_REPORT_FIXTURE,
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { html } = generateConsumerReport(input as any);

    // Should contain transliterated name (English only, no Odia badge in tenant table)
    expect(html).toContain("Barajena");
    expect(html).toContain("Krushnachandra");
    // Name reading quality badge removed from tenant table — names shown directly in English
  });

  it("scores Odia name readings by source quality", () => {
    const exact = transliterateOdiaWithConfidence("କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା");
    expect(exact.english).toBe("Krushnachandra Barajena");
    expect(exact.quality).toBe("verified_exact");
    expect(exact.needsManualReview).toBe(false);

    const allTokens = transliterateOdiaWithConfidence("ବିକାଶ ଚନ୍ଦ୍ର ଦାଶ");
    expect(allTokens.english).toBe("Bikash Chandra Dash");
    expect(allTokens.quality).toBe("lexicon_all_tokens");
    expect(allTokens.needsManualReview).toBe(false);

    const machine = transliterateOdiaWithConfidence("ଅଜଣାନାମ");
    expect(machine.english).toMatch(/[A-Za-z]/);
    expect(machine.quality).toBe("machine_reading");
    expect(machine.needsManualReview).toBe(true);
  });

  it("normalizes eCourts caseNo and court fields into the report", () => {
    const reportInput = mapToReportInput(
      {
        reportId: "CLD-COURT-001",
        completedAt: "2026-04-20T10:30:00.000Z",
        validationFindings: [],
        sources: [
          {
            source: "ecourts",
            status: "success",
            verification: "verified",
            fetchedAt: "2026-04-20T10:30:00.000Z",
            data: {
              total: 1,
              cases: [
                {
                  caseNo: "CS/12/2024",
                  caseType: "Civil Suit",
                  court: "Civil Judge Senior Division, Bhubaneswar",
                  filingDate: "2024-01-12",
                  status: "Pending",
                },
              ],
            },
          },
        ] as any,
      },
      {
        gps: { lat: 20.272688, lon: 85.701271 },
        claimedOwnerName: "Sita Patnaik",
        disclaimerText: CONSUMER_REPORT_FIXTURE.disclaimerText,
      }
    );

    const { html } = generateConsumerReport(reportInput as any);

    expect(html).toContain("CS/12/2024");
    expect(html).toContain("Civil Judge Senior Division, Bhubaneswar");
  });

  it("passes through Bhulekh mutation references and renders them only as RoR anchors", () => {
    const reportInput = mapToReportInput(
      {
        reportId: "CLD-MUT-001",
        completedAt: "2026-04-20T10:30:00.000Z",
        validationFindings: [],
        sources: [
          {
            source: "bhulekh",
            status: "success",
            verification: "verified",
            fetchedAt: "2026-04-20T10:30:00.000Z",
            data: {
              khataNo: "830",
              village: "Sample Village",
              tenants: [
                {
                  tenantName: "Sita Patnaik",
                  surveyNo: "128",
                  area: 1,
                  unit: "acre",
                  landClass: "ଘରବାରି",
                },
              ],
              mutationReferences: [
                {
                  caseType: "D. Reservation Case",
                  caseNo: "10/97",
                  orderDate: "14.03.2000",
                  plotNo: "3",
                  sourceField: "specialRemarksRawOdia",
                  rawText: "D. Reservation Case No. 10/97 order dated 14.03.2000",
                },
                {
                  caseNo: "562/88",
                  plotNo: "128",
                  sourceField: "plotRemarks",
                  rawText: "DR case number 562/88",
                },
              ],
            },
          },
        ] as any,
      },
      {
        gps: { lat: 20.272688, lon: 85.701271 },
        claimedOwnerName: "Sita Patnaik",
        disclaimerText: CONSUMER_REPORT_FIXTURE.disclaimerText,
      }
    );

    expect(reportInput.revenueRecords.mutationReferences).toEqual([
      expect.objectContaining({
        caseType: "D. Reservation Case",
        caseNo: "10/97",
        orderDate: "14.03.2000",
        plotNo: "3",
      }),
      expect.objectContaining({
        caseNo: "562/88",
        plotNo: "128",
        sourceField: "plotRemarks",
      }),
    ]);

    const { html } = generateConsumerReport(reportInput as any);

    expect(html).toContain("Bhulekh RoR remark/case anchors");
    expect(html).toContain("10/97");
    expect(html).toContain("D. Reservation Case");
    expect(html).toContain("14.03.2000");
    expect(html).toContain("Bhulekh RoR special remarks");
    expect(html).toContain("562/88");
    expect(html).toContain("Bhulekh RoR plot remarks");
    expect(html).toContain("manual follow-up only");
    expect(html).toContain("not verified ownership history or a confirmed mutation timeline");
    expect(html).not.toContain("previous owner");
  });

  it("renders a complete RoR audit with dues, source metadata, full plot table, and back-page entries", () => {
    const input = {
      ...CONSUMER_REPORT_FIXTURE,
      revenueRecords: {
        ...CONSUMER_REPORT_FIXTURE.revenueRecords,
        khataNo: "94",
        sourceMeta: {
          fetchedAt: "2026-05-13T09:00:00.000Z",
          rawArtifactRef: "sha256:test-ror",
        },
        screenshots: {
          frontPage: "iVBORw0KGgo=",
          backPage: "iVBORw0KGgo=",
          capturedAt: "2026-05-13T09:00:00.000Z",
        },
        dues: {
          khajana: "12.00",
          cess: "3.00",
          otherCess: "1.00",
          jalkar: null,
          total: "16.00",
        },
        remarks: {
          finalPublicationDate: "03/06/1962",
          revenueAssessmentDate: "01/01/2024",
          generatedAtRaw: "12 May 2026",
          specialRemarksRawOdia: "Reservation Case No. 10/97",
          progressiveRentRawOdia: "ନମୁନା",
        },
        ownerBlocks: [
          {
            tenantNameOdia: "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା",
            guardianNameOdia: "ବିକାଶ ଚନ୍ଦ୍ର ଦାଶ",
            casteOdia: "ନମୁନା ଜାତି",
            residenceOdia: "ନମୁନା ଗାଁ",
          },
          {
            tenantNameOdia: "ସୀତା ପଟ୍ଟନାୟକ",
            guardianNameOdia: "ରାମ ପଟ୍ଟନାୟକ",
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
            southBoundaryOdia: "ରାସ୍ତା",
            eastBoundaryOdia: "ପ୍ଲଟ 416",
            westBoundaryOdia: "ନାଳ",
            remarksOdia: "DR case number 562/88",
          },
          {
            plotNo: "416",
            landTypeOdia: "ଘରବାରି",
            areaAcres: "0",
            areaDecimals: "0500",
            areaHectares: "0.0200",
            remarksOdia: null,
          },
        ],
        backPage: {
          status: "success",
          mutationHistory: [
            { mutationNumber: "MUT-1", mutationDate: "01/01/2020", plotNo: "415", fromKhatiyan: "90", toKhatiyan: "94" },
          ],
          encumbranceEntries: [
            { type: "Mortgage", partyName: "Sample Bank", docNo: "DOC-9", date: "02/02/2021", amount: "100000" },
          ],
          backPageRemarks: [
            { category: "court_case", extractedCaseNo: "10/97", rawText: "Reservation Case No. 10/97" },
          ],
        },
        tenants: [
          {
            ...CONSUMER_REPORT_FIXTURE.revenueRecords.tenants[0],
            surveyNo: "415",
            landClassOdia: "ଶାରଦ ଦୁଇ",
            landClassEnglish: "Agricultural",
            landClass: "agricultural",
            area: 1.075,
            areaAcresRaw: "1",
            areaDecimalsRaw: "0750",
            areaHectaresRaw: "0.4350",
          },
        ],
      },
      sourceStatus: {
        bhunaksha: "success",
        bhulekh: "success",
        ecourts: "not_run",
        rccms: "not_run",
      },
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };

    const { html } = generateConsumerReport(input as any);

    // New risk-intelligence format: insight-first, no audit artifacts, English land class
    expect(html).not.toContain("Complete RoR audit");
    expect(html).not.toContain("RoR dues and revenue demand");
    expect(html).not.toContain("Khajana / rent");
    expect(html).not.toContain("sha256:test-ror");
    expect(html).not.toContain("Revenue assessment date");
    expect(html).not.toContain("Special remarks");
    expect(html).not.toContain("Progressive rent remarks");
    expect(html).not.toContain("Raw artifact");
    expect(html).not.toContain("Generated/current RoR timestamp");
    expect(html).not.toContain("Final publication date");

    // Positive signals and watch-out insights
    expect(html).toContain("View Bhulekh source screenshots");
    expect(html).toContain("Watch-out");
    expect(html).toContain("Positive signal");
    expect(html).toContain("Multiple owners recorded");
    expect(html).toContain("Mutation entries found");
    expect(html).toContain("Encumbrance-style entries");
    expect(html).toContain("Khatiyan");
    expect(html).toContain("Recorded owners");

    // English-only tenant table (no Odia columns in main body)
    expect(html).toContain("Guardian/Father");
    // Odia appears only inside collapsible "View original" toggles (not in main body rows)
    expect(html).toContain("View original name in Odia script");
    // No audit artifacts or parsing metadata visible
    expect(html).not.toContain("parsing status");
    expect(html).not.toContain("mutation number extracted");
    expect(html).not.toContain("case type parsed");

    const audit = auditReport(html);
    expect(audit.passed).toBe(true);
  });

  it("does not treat RCCMS placeholder partial results as usable", () => {
    const reportInput = mapToReportInput(
      {
        reportId: "CLD-RCCMS-001",
        completedAt: "2026-04-20T10:30:00.000Z",
        validationFindings: [],
        sources: [
          {
            source: "ecourts",
            status: "success",
            verification: "verified",
            fetchedAt: "2026-04-20T10:30:00.000Z",
            data: { total: 0, cases: [] },
          },
          {
            source: "rccms",
            status: "partial",
            verification: "manual_required",
            fetchedAt: "2026-04-20T10:30:00.000Z",
            data: { total: 0, cases: [] },
            error: "Not implemented. RCCMS fetcher is a placeholder.",
          },
        ] as any,
      },
      {
        gps: { lat: 20.272688, lon: 85.701271 },
        claimedOwnerName: "Sita Patnaik",
        disclaimerText: CONSUMER_REPORT_FIXTURE.disclaimerText,
      }
    );

    const { html } = generateConsumerReport(reportInput as any);

    expect(reportInput.courtCases.sources.rccms).toBe("manual_required");
    expect(html).toContain("case search is not complete");
    expect(html).toContain("RCCMS: manual_required");
    expect(html).not.toContain("No active civil or criminal court cases were found");
  });

  it("does not render zero-case clean copy when eCourts lacks accepted-captcha metadata", () => {
    const reportInput = mapToReportInput(
      {
        reportId: "CLD-COURT-META-001",
        completedAt: "2026-04-20T10:30:00.000Z",
        validationFindings: [],
        sources: [
          {
            source: "ecourts",
            status: "success",
            verification: "verified",
            fetchedAt: "2026-04-20T10:30:00.000Z",
            data: { total: 0, cases: [] },
          },
          {
            source: "rccms",
            status: "success",
            verification: "verified",
            fetchedAt: "2026-04-20T10:30:00.000Z",
            data: { total: 0, cases: [] },
          },
        ] as any,
      },
      {
        gps: { lat: 20.272688, lon: 85.701271 },
        claimedOwnerName: "Sita Patnaik",
        disclaimerText: CONSUMER_REPORT_FIXTURE.disclaimerText,
      }
    );

    const { html } = generateConsumerReport(reportInput as any);

    expect(html).toContain("accepted-captcha negative-result metadata");
    expect(html).toContain("eCourts captcha acceptance is required");
    expect(html).not.toContain("No active civil or criminal court cases were found");
    expect(html).not.toContain("No case records were returned in this source-scoped eCourts/RCCMS search");
  });

  it("renders source-scoped zero-case copy only when eCourts accepted captcha metadata is present", () => {
    const reportInput = mapToReportInput(
      {
        reportId: "CLD-COURT-META-002",
        completedAt: "2026-04-20T10:30:00.000Z",
        validationFindings: [],
        sources: [
          {
            source: "ecourts",
            status: "success",
            verification: "verified",
            fetchedAt: "2026-04-20T10:30:00.000Z",
            data: {
              total: 0,
              cases: [],
              searchMetadata: {
                captchaAcceptedCount: 1,
                captchaFailedCount: 0,
                attempts: [{ complexName: "Bhubaneswar", outcome: "no_records" }],
              },
            },
          },
          {
            source: "rccms",
            status: "success",
            verification: "verified",
            fetchedAt: "2026-04-20T10:30:00.000Z",
            data: { total: 0, cases: [] },
          },
        ] as any,
      },
      {
        gps: { lat: 20.272688, lon: 85.701271 },
        claimedOwnerName: "Sita Patnaik",
        disclaimerText: CONSUMER_REPORT_FIXTURE.disclaimerText,
      }
    );

    const { html } = generateConsumerReport(reportInput as any);

    expect(html).toContain("No case records were returned in this source-scoped eCourts/RCCMS search");
    expect(html).toContain("not a full court-clearance finding");
    expect(html).toContain("eCourts recorded accepted captcha metadata");
    expect(html).not.toContain("No active civil or criminal court cases were found");
  });

  it("uses Bhunaksha/WFS plot as the target plot instead of the first Bhulekh row", () => {
    const reportInput = mapToReportInput(
      {
        reportId: "CLD-PLOT-001",
        completedAt: "2026-04-20T10:30:00.000Z",
        validationFindings: [
          {
            dimension: "plotNo",
            severity: "warning",
            source: "orchestrator",
            description: "Target WFS plot \"128\" was not found among Bhulekh tenant or plot survey rows (309).",
          },
        ],
        sources: [
          {
            source: "bhunaksha",
            status: "success",
            verification: "verified",
            fetchedAt: "2026-04-20T10:30:00.000Z",
            data: {
              plotNo: "128",
              village: "Mendhasala",
              tahasil: "Bhubaneswar",
              area: 0.024,
            },
          },
          {
            source: "bhulekh",
            status: "success",
            verification: "verified",
            fetchedAt: "2026-04-20T10:30:00.000Z",
            data: {
              khataNo: "830",
              village: "Mendhasala",
              tenants: [
                {
                  tenantName: "Sita Patnaik",
                  surveyNo: "309",
                  area: 1,
                  unit: "acre",
                  landClass: "ଘରବାରି",
                },
              ],
            },
          },
        ] as any,
      },
      {
        gps: { lat: 20.272688, lon: 85.701271 },
        claimedOwnerName: "Sita Patnaik",
        disclaimerText: CONSUMER_REPORT_FIXTURE.disclaimerText,
      }
    );

    const { html, title } = generateConsumerReport(reportInput as any);

    expect(title).toContain("Plot 128");
    expect(html).toContain('<tr><td class="key">Plot Number</td><td class="mono">128</td></tr>');
    expect(html).toContain("The revenue map and Bhulekh show different plot numbers");
    expect(html).toContain("Not verified");
  });

  it("does not invent Khordha district or Bhubaneswar SRO when location sources omit them", () => {
    const reportInput = mapToReportInput(
      {
        reportId: "CLD-LOC-001",
        completedAt: "2026-04-20T10:30:00.000Z",
        validationFindings: [],
        sources: [
          {
            source: "bhunaksha",
            status: "success",
            verification: "verified",
            fetchedAt: "2026-04-20T10:30:00.000Z",
            data: {
              plotNo: "128",
              village: "Mendhasala",
              tahasil: null,
              area: 0.024,
            },
          },
          {
            source: "ecourts",
            status: "success",
            verification: "verified",
            fetchedAt: "2026-04-20T10:30:00.000Z",
            data: {
              total: 0,
              cases: [],
            },
          },
          {
            source: "rccms",
            status: "success",
            verification: "verified",
            fetchedAt: "2026-04-20T10:30:00.000Z",
            data: {
              total: 0,
              cases: [],
            },
          },
        ] as any,
      },
      {
        gps: { lat: 20.272688, lon: 85.701271 },
        claimedOwnerName: "Sita Patnaik",
        disclaimerText: CONSUMER_REPORT_FIXTURE.disclaimerText,
      }
    );

    const { html } = generateConsumerReport(reportInput as any);

    expect(reportInput.geoFetch.district).toBeNull();
    expect(reportInput.registryLinks.params.district).toBe("Not verified");
    expect(reportInput.registryLinks.params.sro).toBe("Not verified");
    expect(html).toContain("District: Not verified, Odisha");
    expect(html).toContain("confirm the correct district/SRO");
    expect(html).not.toContain("District: Not verified, SRO: Not verified");
    expect(html).not.toContain("District: Khordha");
    expect(html).not.toContain("SRO: Bhubaneswar");
  });

  it("does not use tahasil as a verified SRO for EC instructions", () => {
    const reportInput = mapToReportInput(
      {
        reportId: "CLD-SRO-001",
        completedAt: "2026-04-20T10:30:00.000Z",
        validationFindings: [],
        sources: [
          {
            source: "bhunaksha",
            status: "success",
            verification: "verified",
            fetchedAt: "2026-04-20T10:30:00.000Z",
            data: {
              plotNo: "128",
              village: "Mendhasala",
              tahasil: "Bhubaneswar",
              district: "Khordha",
              area: 0.024,
            },
          },
        ] as any,
      },
      {
        gps: { lat: 20.272688, lon: 85.701271 },
        claimedOwnerName: "Sita Patnaik",
        disclaimerText: CONSUMER_REPORT_FIXTURE.disclaimerText,
      }
    );

    const { html } = generateConsumerReport(reportInput as any);

    expect(reportInput.registryLinks.params.sro).toBe("Not verified");
    expect(html).toContain("confirm the correct district/SRO");
    expect(html).not.toContain("SRO: Bhubaneswar");
  });

  it("renders A6 restrictions and explicit unknown conversion copy", () => {
    const input = {
      ...CONSUMER_REPORT_FIXTURE,
      landClassifier: {
        primaryKisam: "jungle",
        classificationExplanation: "Forest or jungle land",
        conversionRequired: null,
        restrictions: [
          {
            type: "forest",
            severity: "critical",
            description: "Construction is restricted on notified forest land.",
            action: "Obtain Forest Department clearance before any transaction.",
          },
        ],
      },
      sourceStatus: {
        bhunaksha: "success",
        bhulekh: "success",
        ecourts: "not_run",
        rccms: "not_run",
      },
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };

    const { html } = generateConsumerReport(input as any);

    expect(html).toContain("Conversion requirement not verified");
    expect(html).toContain("Forest");
    expect(html).toContain("Construction is restricted on notified forest land.");
    expect(html).toContain("Obtain Forest Department clearance");
  });

  it("does not claim land-use conversion has not been done from classification alone", () => {
    const input = {
      ...CONSUMER_REPORT_FIXTURE,
      landClassifier: {
        currentClassification: "Agricultural",
        conversionRequired: true,
        restrictions: [],
        redFlags: [],
      },
      sourceStatus: {
        bhunaksha: "success",
        bhulekh: "success",
        ecourts: "not_run",
        rccms: "not_run",
      },
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };

    const { html } = generateConsumerReport(input as any);

    expect(html).toContain("Land-use conversion may be required and was not verified online");
    expect(html).not.toContain("Land use conversion has not been done");
  });

  it("gates placeholder A8 empty flags and renders real flag severity copy", () => {
    const placeholderInput = {
      ...CONSUMER_REPORT_FIXTURE,
      regulatoryScreener: {
        flags: [],
        plotConfirmedInRegulatedZone: false,
        overlaySource: "Bhunaksha GeoServer WFS (mapserver.odisha4kgeo.in)",
        confidence: 0.5,
        confidenceBasis:
          "No immediate regulatory flags detected. Full overlay screening requires ORSAC KML data integration.",
      },
      landClassifier: {
        ...CONSUMER_REPORT_FIXTURE.landClassifier,
        redFlags: [],
      },
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };

    const { html: placeholderHtml } = generateConsumerReport(placeholderInput as any);
    expect(placeholderHtml).toContain("Regulatory overlay screening was not complete");
    expect(placeholderHtml).toContain("Regulatory overlay screening incomplete");
    expect(placeholderHtml).not.toContain("No immediate regulatory flags were found");
    expect(placeholderHtml).not.toContain("No immediate flags in checked overlays");

    const highConfidenceWithoutLayers = {
      ...placeholderInput,
      regulatoryScreener: {
        flags: [],
        plotConfirmedInRegulatedZone: false,
        overlaySource: "District overlay source",
        confidence: 0.95,
        confidenceBasis: "No overlay conflict returned.",
      },
    };

    const { html: noLayerHtml } = generateConsumerReport(highConfidenceWithoutLayers as any);
    expect(noLayerHtml).toContain("Regulatory overlay screening was not complete");
    expect(noLayerHtml).toContain("Regulatory overlay screening incomplete");
    expect(noLayerHtml).not.toContain("No immediate regulatory flags were found");
    expect(noLayerHtml).not.toContain("No immediate flags in checked overlays");

    const flaggedInput = {
      ...CONSUMER_REPORT_FIXTURE,
      regulatoryScreener: {
        flags: [
          {
            flag: "PESA Zone",
            severity: "high",
            description: "Tribal land transfer restrictions may apply.",
            recommendedAction: "Obtain Gram Sabha and Collector approvals.",
          },
        ],
        plotConfirmedInRegulatedZone: true,
        confidence: 0.9,
        confidenceBasis: "Overlay matched a regulated zone.",
      },
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };

    const { html: flaggedHtml } = generateConsumerReport(flaggedInput as any);
    expect(flaggedHtml).toContain("[Warning] PESA Zone");
    expect(flaggedHtml).toContain("Tribal land transfer restrictions may apply.");
    expect(flaggedHtml).toContain("Obtain Gram Sabha and Collector approvals.");
  });

  it("marks land-class summary as unresolved when conversion requirement is unknown", () => {
    const input = {
      ...CONSUMER_REPORT_FIXTURE,
      landClassifier: {
        ...CONSUMER_REPORT_FIXTURE.landClassifier,
        conversionRequired: null,
        redFlags: [],
      },
      sourceStatus: {
        bhunaksha: "success",
        bhulekh: "success",
        ecourts: "success",
        rccms: "success",
      },
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };

    const { html } = generateConsumerReport(input as any);

    expect(html).toContain("Conversion requirement not verified");
  });

  it("ignores ambiguous seller-name matching and shows RoR owner details directly", () => {
    const input = {
      ...CONSUMER_REPORT_FIXTURE,
      claimedOwnerName: "Mohapatra",
      ownershipReasoner: {
        ...CONSUMER_REPORT_FIXTURE.ownershipReasoner,
        officialOwnerName: "ବିକାଶ ଚନ୍ଦ୍ର ମୋହାପାତ୍ର",
        transliteratedOwnerName: "Bikash Chandra Mohapatra",
        nameMatch: "partial",
        discrepancyExplanation:
          "The provided name is only a surname or single word and cannot confirm identity.",
        confidenceBasis:
          "odia_surname_map matching, confidence 55%. Claim state: ambiguous; readiness: L2.",
        claimState: "ambiguous",
        readiness: "L2",
        inputQuality: "single_token",
        fatherHusbandMatch: "not_provided",
        nameMatchConfidence: { score: 0.55, method: "odia_surname_map" },
        blockingWarnings: [
          "Only a surname or single-word owner name was provided; this is not enough to confirm identity.",
        ],
        matchReasons: [
          {
            code: "odia_surname_map",
            label: "Surname appears in the Odia RoR name.",
            weight: 0.55,
          },
        ],
      },
      sourceStatus: {
        bhunaksha: "success",
        bhulekh: "success",
        ecourts: "success",
        rccms: "success",
      },
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };

    const { html } = generateConsumerReport(input as any);

    expect(html).toContain("Owner name");
    expect(html).toContain("RoR owner fetched");
    expect(html).toContain("Owner and family details recorded in the Bhulekh RoR");
    expect(html).not.toContain("Only a surname given");
    expect(html).not.toContain("not enough to confirm the seller's identity");
    expect(html).not.toContain("Readiness: L2");
  });

  it("adds action items for unknown land classification without seller-name matching copy", () => {
    const input = {
      ...CONSUMER_REPORT_FIXTURE,
      revenueRecords: {
        ...CONSUMER_REPORT_FIXTURE.revenueRecords,
        tenants: [
          {
            tenantName: "Sita Patnaik",
            surveyNo: "309",
            area: 1,
            unit: "acre",
            landClass: "unmapped-kisam",
          },
        ],
      },
      ownershipReasoner: {
        ...CONSUMER_REPORT_FIXTURE.ownershipReasoner,
        officialOwnerName: "Sita Patnaik",
        transliteratedOwnerName: "Sita Patnaik",
        nameMatch: "unknown",
        discrepancyExplanation: "Name comparison could not be completed.",
      },
      landClassifier: null,
      sourceStatus: {
        bhunaksha: "success",
        bhulekh: "success",
        ecourts: "success",
        rccms: "success",
      },
      courtCases: {
        total: 0,
        cases: [],
        sources: {
          ecourts: "success",
          rccms: "success",
        },
      },
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };

    const { html } = generateConsumerReport(input as any);

    expect(html).toContain("Land classification is unknown");
    expect(html).toContain("official kisam/land class");
    expect(html).not.toContain("Owner match is unknown");
    expect(html).not.toContain("seller is the same person as the recorded owner");
  });

  it("adds action items for unavailable owner records, incomplete court search, and incomplete regulatory screening", () => {
    const input = {
      ...CONSUMER_REPORT_FIXTURE,
      revenueRecords: null,
      ownershipReasoner: null,
      sourceStatus: {
        bhunaksha: "success",
        bhulekh: "error",
        ecourts: "success",
        rccms: "manual_required",
      },
      courtCases: {
        total: 0,
        cases: [],
        sources: {
          ecourts: "success",
          rccms: "manual_required",
        },
      },
      regulatoryScreener: {
        flags: [],
        plotConfirmedInRegulatedZone: false,
        overlaySource: "Bhunaksha GeoServer WFS (mapserver.odisha4kgeo.in)",
        confidence: 0.4,
        confidenceBasis: "Full overlay screening requires ORSAC KML data integration.",
      },
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };

    const { html } = generateConsumerReport(input as any);

    expect(html).toContain("RoR owner details are unavailable");
    expect(html).toContain("Court and revenue-case search is incomplete");
    expect(html).toContain("Regulatory screening is incomplete");
  });

  it("adds action item for failed source checks", () => {
    const input = {
      ...CONSUMER_REPORT_FIXTURE,
      sourceDetails: {
        bhulekh: {
          status: "error",
          statusReason: "Session expired while fetching RoR.",
        },
        ecourts: {
          status: "failed",
          statusReason: "Captcha service unavailable.",
        },
      },
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };

    const { html } = generateConsumerReport(input as any);

    expect(html).toContain("Some source checks failed");
    expect(html).toContain("bhulekh: error (Session expired while fetching RoR.)");
    expect(html).toContain("ecourts: failed (Captcha service unavailable.)");
    expect(html).toContain("Do not treat missing online data as a clean result");
  });

  it("marks plot source lines with source status when map and land-record sources fail", () => {
    const input = {
      ...CONSUMER_REPORT_FIXTURE,
      geoFetch: null,
      revenueRecords: null,
      sourceStatus: {
        bhunaksha: "failed",
        bhulekh: "failed",
        ecourts: "not_run",
        rccms: "not_run",
      },
      sourceDetails: {
        bhunaksha: { status: "failed", statusReason: "WFS timeout" },
        bhulekh: { status: "failed", statusReason: "RoR session expired" },
      },
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };

    const { html } = generateConsumerReport(input as any);

    expect(html).toContain("Revenue map source: Bhunaksha (failed: WFS timeout)");
    expect(html).toContain("Land-record source: Bhulekh RoR (failed: RoR session expired)");
    expect(html).not.toContain("Revenue map: Bhunaksha — GeoServer WFS");
  });

  it("shows exact Bhulekh source reason when land classification is unavailable", () => {
    const input = {
      ...CONSUMER_REPORT_FIXTURE,
      revenueRecords: null,
      ownershipReasoner: null,
      landClassifier: null,
      sourceStatus: {
        bhunaksha: "success",
        bhulekh: "failed",
        ecourts: "not_run",
        rccms: "not_run",
      },
      sourceDetails: {
        bhulekh: {
          status: "failed",
          statusReason: "Village code not found in browser-populated Bhulekh dropdown.",
        },
      },
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };

    const { html } = generateConsumerReport(input as any);

    expect(html).toContain("Classification not verified");
    expect(html).toContain("Source status:");
    expect(html).toContain("failed: Village code not found in browser-populated Bhulekh dropdown.");
    expect(html).toContain("Ask the seller for the current Bhulekh Khatiyan");
  });

  it("does not put partial eCourts into the matched summary even when RCCMS succeeds", () => {
    const input = {
      ...CONSUMER_REPORT_FIXTURE,
      sourceStatus: {
        bhunaksha: "success",
        bhulekh: "success",
        ecourts: "partial",
        rccms: "success",
      },
      courtCases: {
        total: 0,
        cases: [],
        sources: {
          ecourts: "partial",
          rccms: "success",
        },
        searchMetadata: {
          ecourts: {
            captchaAcceptedCount: 0,
            captchaFailedCount: 2,
            attempts: [{ complexName: "Bhubaneswar", outcome: "captcha_failed" }],
          },
        },
      },
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };

    const { html } = generateConsumerReport(input as any);

    expect(html).toContain("Only part of the court/revenue case check returned usable results.");
    expect(html).not.toContain("Court/revenue case checks returned usable results.");
    expect(html).not.toContain("Court/revenue case searches completed with accepted eCourts captcha metadata.");
  });

  it("labels Bhulekh table rows as source-limited owner/plot rows", () => {
    const input = {
      ...CONSUMER_REPORT_FIXTURE,
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };

    const { html } = generateConsumerReport(input as any);

    expect(html).toContain("Bhulekh owner/plot row");
    expect(html).toContain("source-limited Bhulekh RoR owner records joined with the selected plot/khata fields");
    expect(html).toContain("RoR Name (Odia)");
    expect(html).toContain("Guardian/Father");
    expect(html).not.toContain("View all 1 recorded owners");
  });
});

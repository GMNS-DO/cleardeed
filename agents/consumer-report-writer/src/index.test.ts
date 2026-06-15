/**
 * A10 ConsumerReportWriter — tests
 *
 * Verifies that generateConsumerReport() produces valid HTML with all 6 sections.
 */
import { describe, it, expect } from "vitest";
import { generateConsumerReport, generateWhatsAppForward, mapToReportInput, buildFounderCuratedClusters } from "./index";
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

  it("embeds Sprint 5 print-optimized CSS and print footer", () => {
    const input = {
      ...CONSUMER_REPORT_FIXTURE,
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { html } = generateConsumerReport(input as any);

    // The extended @media print block must be present in the inline stylesheet.
    expect(html).toContain("@media print");
    expect(html).toContain("@page { size: A4;");
    expect(html).toContain("Sprint 5: print-optimized CSS");
    // The footer element is wired into the body.
    expect(html).toContain("class=\"print-footer\"");
    // Screen CSS hides the footer (display: none outside @media print).
    expect(html).toMatch(/\.print-footer\s*\{\s*display:\s*none/);
    // Footer content includes the report id and generation date.
    expect(html).toMatch(/print-footer[^<]*ClearDeed Property Report/);
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

    // Positive signals and watch-out insights from risk intelligence engine
    expect(html).toContain("View Bhulekh source screenshots");
    expect(html).toContain("Watch-out");
    expect(html).toContain("Positive signal");
    // Risk intelligence: court case in Back Page remarks → title red flag
    expect(html).toContain("Court case");
    // Risk intelligence: mortgage → title red flag
    expect(html).toContain("Registered mortgage");
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
      revenueRecords: {
        ...CONSUMER_REPORT_FIXTURE.revenueRecords,
        tenants: [
          {
            tenantName: "Sita Patnaik",
            surveyNo: "309",
            area: 1,
            unit: "acre",
            landClass: "homestead",
          },
        ],
      },
      ownershipReasoner: {
        ...CONSUMER_REPORT_FIXTURE.ownershipReasoner,
        officialOwnerName: "Sita Patnaik",
        transliteratedOwnerName: "Sita Patnaik",
        nameMatch: "exact",
        claimState: "ror_available",
        readiness: "L3",
        inputQuality: "full_name",
        fatherHusbandMatch: "not_provided",
        nameMatchConfidence: { score: 1.0, method: "exact_match" },
        blockingWarnings: [],
        matchReasons: [{ code: "exact_full_name", label: "Exact Bhulekh RoR full name match", weight: 1.0 }],
      },
      landClassifier: { currentClassification: "Homestead" },
      sourceStatus: {
        bhunaksha: "success",
        bhulekh: "success",
        ecourts: "success",
        rccms: "success",
      },
      courtCases: {
        total: 0,
        cases: [],
        sources: { ecourts: "success", rccms: "success" },
      },
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };

    const { html } = generateConsumerReport(input as any);

    expect(html).toContain("Owner name");
    // Risk intelligence: single owner → positive signal in owner section
    expect(html).toContain("Single owner recorded");
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

  it("Six Buyer Questions renders all 6 questions with Q1-Q6 labels", () => {
    const input = {
      ...CONSUMER_REPORT_FIXTURE,
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };
    const { html } = generateConsumerReport(input as any);

    expect(html).toContain('id="section-six-questions"');
    expect(html).toContain("Q1");
    expect(html).toContain("Q2");
    expect(html).toContain("Q3");
    expect(html).toContain("Q4");
    expect(html).toContain("Q5");
    expect(html).toContain("Q6");
    expect(html).toContain("Does the seller actually own this");
    expect(html).toContain("Can I build my house here");
    expect(html).toContain("Could I lose it after paying");
    expect(html).toContain("Am I overpaying");
    expect(html).toContain("Is the area going to develop or decay");
    expect(html).toContain("What happens after I buy");
    expect(html).toContain("regis.odisha.gov.in");
    expect(html).toContain("bda.gov.in");
  });

  it("Six Buyer Questions shows warning state when Bhulekh not usable", () => {
    const input = {
      ...CONSUMER_REPORT_FIXTURE,
      revenueRecords: null,
      sourceStatus: {
        bhunaksha: "success",
        bhulekh: "failed",
        ecourts: "not_run",
        rccms: "not_run",
      },
      gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
    };
    const { html } = generateConsumerReport(input as any);

    expect(html).toContain("Owner not verified");
    expect(html).toContain("Land class not verified");
    expect(html).toContain("Post-purchase costs need manual estimation");
  });

  // Sprint 4 — Section 7 (What is it worth) renders 3-band floor/directional/ceiling
  // from circle-rate fetcher data, and Section 3 (Land Classification) renders
  // a BDA Master Plan zone card from bda-zoning fetcher data.
  describe("Sprint 4 — Section 7 benchmark + Section 3 BDA zone", () => {
    const reportInput = mapToReportInput(
      {
        reportId: "CLD-S4-BM-BDA",
        completedAt: "2026-06-12T10:30:00.000Z",
        validationFindings: [],
        sources: [
          {
            source: "bhulekh",
            status: "success",
            verification: "verified",
            fetchedAt: "2026-06-12T10:30:00.000Z",
            data: {
              khataNo: "415",
              village: "Mendhasala",
              plotRows: [
                { plotNo: "415", areaAcres: 0.1, areaDecimals: 10 },
              ],
              tenants: [
                { tenantName: "Test Owner", surveyNo: "415", areaAcres: 0.1, landClassEnglish: "Residential" },
              ],
            },
          },
          {
            source: "circle-rate",
            status: "success",
            verification: "verified",
            fetchedAt: "2026-06-12T10:30:00.000Z",
            data: [
              {
                mouza: "Mendhasala",
                tehsil: "Bhubaneswar",
                kisam: "Residential",
                ratePerAcre: 0,
                ratePerSqft: 1800,
                rateType: "peri-urban",
                sourceUrl: "https://regis.odisha.gov.in/Benchmark/BMV_Search.aspx",
                lastUpdated: "2024-06-01",
              },
            ],
          },
          {
            source: "bda-zoning",
            status: "success",
            verification: "verified",
            fetchedAt: "2026-06-12T10:30:00.000Z",
            data: [
              {
                tehsil: "Bhubaneswar",
                village: "Mendhasala",
                locality: "Patia",
                zone: {
                  id: "residential",
                  name: "Residential",
                  zoneCode: "R",
                  description: "Areas designated for residential development",
                  permittedUses: ["Single-family residential", "Apartments"],
                  restrictions: ["No industrial/commercial use"],
                },
              },
            ],
          },
        ] as any,
      },
      {
        gps: { lat: 20.272688, lon: 85.701271 },
        claimedOwnerName: "Test Owner",
        disclaimerText: CONSUMER_REPORT_FIXTURE.disclaimerText,
        circleRateData: {
          source: "circle-rate",
          status: "success",
          data: [
            {
              mouza: "Mendhasala",
              tehsil: "Bhubaneswar",
              kisam: "Residential",
              ratePerAcre: 0,
              ratePerSqft: 1800,
              rateType: "peri-urban",
              sourceUrl: "https://regis.odisha.gov.in/Benchmark/BMV_Search.aspx",
              lastUpdated: "2024-06-01",
            },
          ],
        },
        bdaZoneData: {
          source: "bda-zoning",
          status: "success",
          data: [
            {
              tehsil: "Bhubaneswar",
              village: "Mendhasala",
              locality: "Patia",
              zone: {
                id: "residential",
                name: "Residential",
                zoneCode: "R",
                description: "Areas designated for residential development",
                permittedUses: ["Single-family residential", "Apartments"],
                restrictions: ["No industrial/commercial use"],
              },
            },
          ],
        },
      }
    );

    it("Section 7 renders the 3-band floor/directional/ceiling layout", () => {
      const { html } = generateConsumerReport(reportInput as any);

      // Section 7 floor band with rate from circle-rate data
      expect(html).toContain("id=\"section-benchmark\"");
      expect(html).toContain("Floor");
      expect(html).toContain("Circle rate");
      expect(html).toContain("1,800 per sqft");
      expect(html).toContain("Mendhasala");
      expect(html).toContain("Bhubaneswar");
      expect(html).toContain("Residential");

      // Scaled floor value for the 0.1-acre plot (1800 sqft * 43560 sqft/acre
      // * 0.1 = 7,840,800 INR). The "bm-band-scaled" div is the discriminator
      // — it only renders when acres AND ratePerAcre > 0.
      expect(html).toMatch(/Floor for this plot|bm-band-scaled/);

      // Directional and ceiling bands are present, marked as "not fetched"
      // since IGR-transaction and market-comparable wiring is post-Sprint-4.
      expect(html).toContain("Directional");
      expect(html).toContain("Ceiling");
      expect(html).toContain("Not fetched in this run");

      // IGR verify-yourself link
      expect(html).toContain("regis.odisha.gov.in");
    });

    it("Section 3 renders the BDA Master Plan zone card", () => {
      const { html } = generateConsumerReport(reportInput as any);

      // BDA card appears in Section 3 (Land Classification), before Section 7
      expect(html).toContain("BDA Master Plan zone");
      expect(html).toContain("Residential");
      expect(html).toMatch(/\(zone code R\)/);
      expect(html).toContain("Patia"); // locality
      expect(html).toContain("Single-family residential"); // permitted uses
      expect(html).toContain("No industrial/commercial use"); // restrictions
    });

    it("Section 7 falls back to a clear 'not in our dataset' message when no rate row matches", () => {
      const noRateInput = {
        ...reportInput,
        circleRateData: { source: "circle-rate", status: "no_data_match", data: [] },
      };
      const { html } = generateConsumerReport(noRateInput as any);

      expect(html).toContain("Not in our dataset");
      expect(html).toContain("regis.odisha.gov.in");
    });

    it("BDA zone card is suppressed when bdaZoneData has no data rows", () => {
      const noZoneInput = {
        ...reportInput,
        bdaZoneData: { source: "bda-zoning", status: "no_data_match", data: [] },
      };
      const { html } = generateConsumerReport(noZoneInput as any);

      expect(html).not.toContain("BDA Master Plan zone");
    });

    it("BDA zone card flags watch-out zones (green_belt) with watchout styling", () => {
      const greenBeltInput = {
        ...reportInput,
        bdaZoneData: {
          source: "bda-zoning",
          status: "success",
          data: [
            {
              tehsil: "Bhubaneswar",
              village: "Mendhasala",
              zone: {
                id: "green_belt",
                name: "Green Belt",
                zoneCode: "G",
                description: "Areas reserved for environmental conservation",
                permittedUses: ["Agriculture", "Parks"],
                restrictions: ["No construction", "No development"],
              },
            },
          ],
        },
      };
      const { html } = generateConsumerReport(greenBeltInput as any);

      expect(html).toContain("Green Belt");
      expect(html).toContain("bda-card-watchout");
      expect(html).toContain("No construction");
    });
  });

  // Sprint 5 — "Verify yourself" source links appear in each section whose
  // underlying data carries a real source URL. The links use the
  // `.verify-link` class (small, subdued) and target an actual href.
  describe("Sprint 5 — verify-yourself source links per section", () => {
    const sliceBetween = (html: string, marker: string, nextMarker?: string): string => {
      const start = html.indexOf(marker);
      if (start === -1) return "";
      const end = nextMarker ? html.indexOf(nextMarker, start) : -1;
      return end === -1 ? html.slice(start) : html.slice(start, end);
    };

    it("Section 1 (The Plot) renders a verify-yourself link to Bhunaksha and Bhulekh", () => {
      const input = {
        ...CONSUMER_REPORT_FIXTURE,
        sourceStatus: {
          bhunaksha: "success",
          bhulekh: "success",
          ecourts: "success",
          rccms: "success",
        },
        gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
      };
      const { html } = generateConsumerReport(input as any);

      // Slice between Section 1 and Section 2 to scope the assertion.
      const section1 = sliceBetween(html, 'id="section-plot"', 'id="section-owner"');
      expect(section1).toContain("Verify yourself on Bhunaksha");
      expect(section1).toContain("Verify yourself on Bhulekh");
      expect(section1).toContain("mapserver.odisha4kgeo.in");
      expect(section1).toContain("bhulekh.ori.nic.in");
      // href and class appear in either order in the rendered HTML — match both.
      const linkMatcher = (href: string) =>
        new RegExp(`<a [^>]*(?:class="verify-link"[^>]*href="${href}"|href="${href}"[^>]*class="verify-link")`);
      expect(section1).toMatch(linkMatcher("https:\\/\\/mapserver\\.odisha4kgeo\\.in[^\"]*"));
      expect(section1).toMatch(linkMatcher("https:\\/\\/bhulekh\\.ori\\.nic\\.in[^\"]*"));
    });

    it("Section 2 (The Owner) renders a verify-yourself link to Bhulekh when bhulekh is usable", () => {
      const input = {
        ...CONSUMER_REPORT_FIXTURE,
        sourceStatus: { bhunaksha: "success", bhulekh: "success", ecourts: "success", rccms: "success" },
        gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
      };
      const { html } = generateConsumerReport(input as any);

      const section2 = sliceBetween(html, 'id="section-owner"', 'id="section-land"');
      expect(section2).toContain("Verify yourself on Bhulekh");
      const linkMatcher = (href: string) =>
        new RegExp(`<a [^>]*(?:class="verify-link"[^>]*href="${href}"|href="${href}"[^>]*class="verify-link")`);
      expect(section2).toMatch(linkMatcher("https:\\/\\/bhulekh\\.ori\\.nic\\.in[^\"]*"));
    });

    it("Section 3 (Land Classification) renders a verify-yourself link to Bhulekh", () => {
      const input = {
        ...CONSUMER_REPORT_FIXTURE,
        sourceStatus: { bhunaksha: "success", bhulekh: "success", ecourts: "success", rccms: "success" },
        gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
      };
      const { html } = generateConsumerReport(input as any);

      // Adjacent plots section may not render in every fixture — pick a
      // marker that always follows Section 3.
      const section3 = sliceBetween(html, 'id="section-land"', 'id="section-encumbrance"');
      expect(section3).toContain("Verify yourself on Bhulekh");
      const linkMatcher = (href: string) =>
        new RegExp(`<a [^>]*(?:class="verify-link"[^>]*href="${href}"|href="${href}"[^>]*class="verify-link")`);
      expect(section3).toMatch(linkMatcher("https:\\/\\/bhulekh\\.ori\\.nic\\.in[^\"]*"));
    });

    it("Section 4 (Court Cases & Encumbrances) renders verify-yourself links to eCourts, RCCMS, and IGR", () => {
      const input = {
        ...CONSUMER_REPORT_FIXTURE,
        sourceStatus: { bhunaksha: "success", bhulekh: "success", ecourts: "success", rccms: "success" },
        courtCases: {
          total: 0,
          cases: [],
          sources: { ecourts: "success", rccms: "success" },
        },
        gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
      };
      const { html } = generateConsumerReport(input as any);

      const section4 = sliceBetween(html, 'id="section-encumbrance"', 'id="section-regulatory"');
      expect(section4).toContain("Verify yourself on eCourts");
      expect(section4).toContain("Verify yourself on RCCMS");
      expect(section4).toContain("Verify yourself on IGR Odisha");
      const linkMatcher = (href: string) =>
        new RegExp(`<a [^>]*(?:class="verify-link"[^>]*href="${href}"|href="${href}"[^>]*class="verify-link")`);
      expect(section4).toMatch(linkMatcher("https:\\/\\/services\\.ecourts\\.gov\\.in[^\"]*"));
      expect(section4).toMatch(linkMatcher("https:\\/\\/rccms\\.odisha\\.gov\\.in[^\"]*"));
      expect(section4).toMatch(linkMatcher("https:\\/\\/igrodisha\\.gov\\.in[^\"]*"));
    });

    it("Section 4 does not render eCourts or RCCMS verify-yourself links when those sources did not run", () => {
      const input = {
        ...CONSUMER_REPORT_FIXTURE,
        sourceStatus: { bhunaksha: "success", bhulekh: "success", ecourts: "not_run", rccms: "not_run" },
        courtCases: {
          total: 0,
          cases: [],
          sources: { ecourts: "not_run", rccms: "not_run" },
        },
        gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
      };
      const { html } = generateConsumerReport(input as any);

      const section4 = sliceBetween(html, 'id="section-encumbrance"', 'id="section-regulatory"');
      // eCourts and RCCMS should NOT appear (no successful run → no link).
      expect(section4).not.toContain("Verify yourself on eCourts");
      expect(section4).not.toContain("Verify yourself on RCCMS");
      // IGR EC link is still wired (it comes from registryLinks, not the
      // source status).
      expect(section4).toContain("Verify yourself on IGR Odisha");
    });

    it("Section 7 (Market Benchmark) keeps the existing IGR verify-yourself link", () => {
      const input = {
        ...CONSUMER_REPORT_FIXTURE,
        sourceStatus: { bhunaksha: "success", bhulekh: "success", ecourts: "success", rccms: "success" },
        circleRateData: {
          source: "circle-rate",
          status: "success",
          data: [
            {
              mouza: "Mendhasala",
              tehsil: "Bhubaneswar",
              kisam: "Residential",
              ratePerSqft: 1800,
              rateType: "peri-urban",
              sourceUrl: "https://regis.odisha.gov.in/Benchmark/BMV_Search.aspx",
              lastUpdated: "2024-06-01",
            },
          ],
        },
        gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
      };
      const { html } = generateConsumerReport(input as any);

      const section7 = sliceBetween(html, 'id="section-benchmark"', 'id="section-action"');
      expect(section7).toContain("View source at IGR Odisha");
      expect(section7).toContain("regis.odisha.gov.in");
    });

    it("Adjacent Plots section renders a verify-yourself link to Bhunaksha GeoServer", () => {
      const input = {
        ...CONSUMER_REPORT_FIXTURE,
        gpsCoordinates: { latitude: 20.272688, longitude: 85.701271 },
        adjacentPlots: {
          adjacentPlots: [
            { plotNo: "414", village: "Mendhasala", featureId: "f-1", geometryHash: "h-1", areaSqKm: 0.001 },
          ],
          totalFound: 1,
          filteredFromTarget: 0,
          status: "success",
        },
      };
      const { html } = generateConsumerReport(input as any);

      const section = sliceBetween(html, 'id="section-adjacent-plots"', 'id="section-encumbrance"');
      expect(section).toContain("Verify yourself on Bhunaksha GeoServer");
      const linkMatcher = (href: string) =>
        new RegExp(`<a [^>]*(?:class="verify-link"[^>]*href="${href}"|href="${href}"[^>]*class="verify-link")`);
      expect(section).toMatch(linkMatcher("https:\\/\\/mapserver\\.odisha4kgeo\\.in[^\"]*"));
    });
  });

  describe("buildFounderCuratedClusters", () => {
    it("fires clusters on co-owners + cersai charges + cases + conversion", () => {
      const ctx = {
        coOwners: ["Ramesh", "Suresh", "Mahesh"],
        cersaiChargeCount: 2,
        courtCaseCount: 1,
        rccmsCaseCount: 3,
        landConversionRequired: true,
        currentLandClass: "Agricultural",
      };

      const clusters = buildFounderCuratedClusters(ctx);

      // Should fire on 4 signals: coOwners, cersai, courts, conversion
      expect(clusters.length).toBe(4);
      expect(clusters.map((c) => c.patternCluster)).toStrictEqual([
        "Co-ownership consent gap",
        "Active mortgage / charge on title",
        "Litigation on owner or plot",
        "Land-use conversion required",
      ]);

      // Check co-ownership cluster
      const coOwnerCluster = clusters.find((c) => c.patternCluster.includes("consent"));
      expect(coOwnerCluster?.clusterSummary).toContain("3 co-owner(s)");
      expect(coOwnerCluster?.similarCaseCount).toBe(0);

      // Check CERSAI cluster
      const chargeCluster = clusters.find((c) => c.patternCluster.includes("mortgage"));
      expect(chargeCluster?.clusterSummary).toContain("2 charge record(s)");
      expect(chargeCluster?.clusterSummary).toContain("Undisclosed charges are a common route to fraudulent second-sales");

      // Check court cluster
      const courtCluster = clusters.find((c) => c.patternCluster.includes("Litigation"));
      expect(courtCluster?.clusterSummary).toContain("1 eCourts case(s) and 3 RCCMS revenue-court case(s)");

      // Check conversion cluster
      const conversionCluster = clusters.find((c) => c.patternCluster.includes("conversion"));
      expect(conversionCluster?.clusterSummary).toContain("requires a formal land-use conversion order");
    });

    it("doesn't fire clusters when signals are clear", () => {
      const ctx = {
        coOwners: [],
        cersaiChargeCount: 0,
        courtCaseCount: 0,
        rccmsCaseCount: 0,
        landConversionRequired: false,
      };

      const clusters = buildFounderCuratedClusters(ctx);
      expect(clusters.length).toBe(0);
    });
  });

  describe("P-NEW-3 similarity search integration", () => {
    // Note: This test requires the PID Pattern Intelligence Dataset, built separately.
    // See DECISIONS.md D-025 for PID track integration details.
    it.runIf(process.env.RUN_PID_TESTS === "true")("runs similarity search against corpus and returns matches with score", async () => {
      const { findSimilarCases } = await import(
        "../../../pid/lib/case-shape-similarity.mjs"
      );
      const { readJsonl } = await import(
        "../../../pid/lib/corpus-store.mjs"
      );

      const casesPath = new URL(
        "../../../pid/data/corpus/cases.jsonl",
        import.meta.url
      ).pathname;
      const cases = (await readJsonl(casesPath)) as any[];

      // Co-ownership trigger: court_or_forum + case_type + district
      const shape = {
        court_or_forum: "drt cuttack",
        case_type: "oa",
        district: "khordha",
        case_outcome: "disputed",
      };
      const matches = findSimilarCases(cases, shape, { k: 5, minScore: 0.4 });

      // Should return matches (corpus has 278 DRT Cuttack cases)
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]).toHaveProperty("case_id");
      expect(matches[0]).toHaveProperty("case_number");
      expect(matches[0]).toHaveProperty("score");
      expect(matches[0].score).toBeGreaterThanOrEqual(0.4);
    });

    it.runIf(process.env.RUN_PID_TESTS === "true")("clusterFromMatches returns empty when no resolution_summary (P-NEW-2 safety bound)", async () => {
      const { findSimilarCases, clusterFromMatches } = await import(
        "../../../pid/lib/case-shape-similarity.mjs"
      );
      const { readJsonl } = await import(
        "../../../pid/lib/corpus-store.mjs"
      );

      const casesPath = new URL(
        "../../../pid/data/corpus/cases.jsonl",
        import.meta.url
      ).pathname;
      const cases = (await readJsonl(casesPath)) as any[];

      const shape = {
        court_or_forum: "drt cuttack",
        case_type: "oa",
        district: "khordha",
      };
      const matches = findSimilarCases(cases, shape, { k: 5, minScore: 0.4 });
      const synthesized = clusterFromMatches(matches, "Test cluster");

      // P-NEW-2 backfill is not done yet — corpus has no resolution_summary.
      // The safety bound must produce an empty cluster rather than fabricated precedent.
      expect(synthesized.length).toBe(0);
    });
  });
});

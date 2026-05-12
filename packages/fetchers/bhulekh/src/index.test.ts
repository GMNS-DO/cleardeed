import { describe, expect, it } from "vitest";
import { fetch as bhulekhFetch, parseRoRHtml } from "./index";
import type { VillageMapping } from "./villages";

const villageInfo: VillageMapping = {
  english: "Mendhasala",
  odia: "ମେଣ୍ଢାଶାଳ",
  tahasil: "Bhubaneswar",
  riCircle: "Chandaka",
  bhulekhTahasilCode: "2",
};

function makeHtml(ownerBlock: string, specialRemarks = ""): string {
  return `
    <html>
      <body>
        <span id="gvfront_ctl02_lblMouja">ମେଣ୍ଢାଶାଳ</span>
        <span id="gvfront_ctl02_lblTehsil">ଭୁବନେଶ୍ଵର</span>
        <span id="gvfront_ctl02_lblThana">ଚନ୍ଦକା</span>
        <span id="gvfront_ctl02_lblTesilNo">..</span>
        <span id="gvfront_ctl02_lblThanano">22</span>
        <span id="gvfront_ctl02_lblDist">ଖୋର୍ଦ୍ଧା</span>
        <span id="gvfront_ctl02_lblLandlordName">ଓଡିଶା ସରକାର ଖେୱାଟ ନମ୍ବର 1</span>
        <span id="gvfront_ctl02_lblKhatiyanslNo">830</span>
        <span id="gvfront_ctl02_lblName">${ownerBlock}</span>
        <span id="gvfront_ctl02_lblStatua">ସ୍ଥିତିବାନ</span>
        <span id="gvfront_ctl02_lblLastPublishDate">03/06/1962</span>
        <span id="gvfront_ctl02_lblTaxDate">01/01/2024</span>
        <span id="gvfront_ctl02_lblSpecialCase">${specialRemarks}</span>
        <table id="gvRorBack">
          <tr>
            <th>ପ୍ଲଟ ନଂ</th><th>ଚକ</th><th>କିସମ</th><th>ସୀମା</th><th>ଏକର</th><th>ଡେସିମିଲ</th><th>ହେକ୍ଟର</th><th>ମନ୍ତବ୍ୟ</th>
          </tr>
          <tr>
            <td><a id="gvRorBack_ctl05_lblPlotNo">128</a></td>
            <td><span id="gvRorBack_ctl05_lblchaka"></span></td>
            <td><span id="gvRorBack_ctl05_lbllType">ଦଣ୍ଡା</span></td>
            <td>
              <span id="gvRorBack_ctl05_lbln_occu">ଉତ୍ତର</span>
              <span id="gvRorBack_ctl05_lble_occu">ପୂର୍ବ</span>
              <span id="gvRorBack_ctl05_lbls_occu">ଦକ୍ଷିଣ</span>
              <span id="gvRorBack_ctl05_lblw_occu">ପଶ୍ଚିମ</span>
            </td>
            <td><span id="gvRorBack_ctl05_lblAcre">0</span></td>
            <td><span id="gvRorBack_ctl05_lblDecimil">1050</span></td>
            <td><span id="gvRorBack_ctl05_lblHector">0.425</span></td>
            <td><span id="gvRorBack_ctl05_lblPlotRemarks">ନମୁନା</span></td>
          </tr>
          <tr>
            <td><a id="gvRorBack_ctl06_lblPlotNo">129</a></td>
            <td><span id="gvRorBack_ctl06_lblchaka"></span></td>
            <td><span id="gvRorBack_ctl06_lbllType">ଗୋଦଣ୍ଡା</span></td>
            <td><span id="gvRorBack_ctl06_lblKisama"></span></td>
            <td><span id="gvRorBack_ctl06_lblAcre">0</span></td>
            <td><span id="gvRorBack_ctl06_lblDecimil">1800</span></td>
            <td><span id="gvRorBack_ctl06_lblHector"></span></td>
            <td><span id="gvRorBack_ctl06_lblPlotRemarks"></span></td>
          </tr>
        </table>
        <span id="lblCurrDate">18/04/2026 03:10:56  IP :223.181.33.111</span>
      </body>
    </html>
  `;
}

describe("parseRoRHtml", () => {
  it("models a single owner block once and preserves plot rows in rawResponse", () => {
    const result = parseRoRHtml(
      makeHtml("ଗଫୁରନ ବିବି ସ୍ଵା:ସେକ୍ ରହେମାନ ଜା: ମୁସଲମାନ ବା: ନିଜିଗାଁ"),
      villageInfo,
      "Plot",
      "128",
      "128",
      "2026-04-29T00:00:00.000Z"
    );

    expect(result.status).toBe("success");
    expect(result.parserVersion).toBe("bhulekh-ror-html-v3");
    expect(result.rawArtifactHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.rawArtifactRef).toBe(`sha256:${result.rawArtifactHash}`);
    expect(result.templateHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.data?.tenants).toHaveLength(1);
    expect(result.data?.tenants[0]).toMatchObject({
      surveyNo: "128",
      area: 10.5,
      areaAcresRaw: "0",
      areaDecimalsRaw: "1050",
      areaHectaresRaw: "0.425",
      areaUnitRaw: "acre+decimal",
      areaComputation: "acres_plus_decimals_over_100",
      sourcePlotNo: "128",
      landClass: "jalasechita_single",
      tenantName: "ଗଫୁରନ ବିବି",
      fatherHusbandName: "ସେକ୍ ରହେମାନ",
    });
    expect(result.data?.tenants[0].sourceRowHash).toMatch(/^[a-f0-9]{64}$/);

    const raw = JSON.parse(result.rawResponse ?? "{}");
    expect(raw.source.rawArtifactHash).toBe(result.rawArtifactHash);
    expect(raw.source.rawArtifactRef).toBe(result.rawArtifactRef);
    expect(raw.record.guardianRelationOdia).toBe("spouse");
    expect(raw.record.casteOdia).toBe("ମୁସଲମାନ");
    expect(raw.record.residenceOdia).toBe("ନିଜିଗାଁ");
    expect(raw.plotTable.rows).toHaveLength(2);
    expect(raw.remarks.finalPublicationDate).toBe("03/06/1962");
    expect(raw.remarks.revenueAssessmentDate).toBe("01/01/2024");
    expect(raw.remarks.generatedAtRaw).toContain("18/04/2026");
    expect(raw.plotTable.headersOdia).toContain("ପ୍ଲଟ ନଂ");
    expect(raw.plotTable.totals.areaAcres).toBe("28.5");
    expect(raw.raw.rawHtml).toContain("gvfront_ctl02_lblName");
    expect(raw.plotTable.rows[0]).toMatchObject({
      plotNo: "128",
      northBoundaryOdia: "ଉତ୍ତର",
      areaUnitRaw: "acre+decimal",
      areaComputation: "acres_plus_decimals_over_100",
      remarksOdia: "ନମୁନା",
    });
    expect(raw.plotTable.rows[0].sourceRowHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("extracts mutation or case references from special and plot remarks without inferring ownership history", () => {
    const result = parseRoRHtml(
      makeHtml(
        "ଗଫୁରନ ବିବି ସ୍ଵା:ସେକ୍ ରହେମାନ",
        "D. Reservation Case No. 10/97 ଜିଲ୍ଲାପାଳ ଖୋର୍ଦ୍ଧାଙ୍କ ଆଦେଶ ତା 14.03.2000 ମୁତାବକ ପ୍ଲଟ ନଂ 3"
      ).replace(
        "ନମୁନା",
        "ଡି.ଆର. କେସ, ନମ୍ବର 562/88 ହୁକୁମ ମୁତାବକ"
      ),
      villageInfo,
      "Plot",
      "128",
      "128",
      "2026-04-29T00:00:00.000Z"
    );

    expect(result.data?.mutationReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          caseNo: "10/97",
          orderDate: "14.03.2000",
          sourceField: "specialRemarksRawOdia",
        }),
        expect.objectContaining({
          caseNo: "562/88",
          plotNo: "128",
          sourceField: "plotRemarks",
        }),
      ])
    );

    const raw = JSON.parse(result.rawResponse ?? "{}");
    expect(raw.remarks.specialRemarksRawOdia).toContain("Reservation Case No. 10/97");
  });

  it("keeps separate owner blocks as separate tenants", () => {
    const result = parseRoRHtml(
      makeHtml("ପ୍ରଥମ ପି:ବାପା ଏକ<br/>ଦ୍ୱିତୀୟ ପି:ବାପା ଦୁଇ"),
      villageInfo,
      "Khatiyan",
      "830",
      "830",
      "2026-04-29T00:00:00.000Z"
    );

    expect(result.data?.tenants).toHaveLength(2);
    expect(result.data?.tenants.map((tenant) => tenant.tenantName)).toEqual(["ପ୍ରଥମ", "ଦ୍ୱିତୀୟ"]);
    expect(result.data?.tenants[0].area).toBe(28.5);
    expect(result.data?.tenants[0].areaComputation).toBe("sum_unique_plot_rows_acres_plus_decimals_over_100");
  });

  it("returns failure provenance with stable artifact hashes before live lookup is attempted", async () => {
    const result = await bhulekhFetch({ village: "Mendhasala" });

    expect(result.status).toBe("failed");
    expect(result.rawArtifactHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.rawArtifactRef).toBe(`sha256:${result.rawArtifactHash}`);
    expect(result.rawResponse).toContain("bhulekh-failure-v1");

    const raw = JSON.parse(result.rawResponse ?? "{}");
    expect(raw.statusReason).toContain("requires plotNo or khatiyanNo");
    expect(raw.source.rawArtifactRef).toBe(result.rawArtifactRef);
  });
});

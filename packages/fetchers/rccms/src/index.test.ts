import { describe, it, expect } from "vitest";
import { fetch, healthCheck, parseRccmsTable } from "./index";

/**
 * Columns align with the parser's expected positional layout:
 *   cells[0]=caseNo, [1]=caseType, [2]=filingDate, [3]=status, [4]=subject,
 *   [5]=petitioner, [6]=respondent.
 */
const MOCK_HTML_RESULT = `
<table id="example" class="table table-striped table-bordered" style="width:100%">
    <thead>
        <tr>
            <th>Case No</th>
            <th>Case Type</th>
            <th>Filing Date</th>
            <th>Status</th>
            <th>Subject</th>
            <th>Petitioner</th>
            <th>Respondent</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>94/2022</td>
            <td>OEA CLS-I</td>
            <td>14-Mar-2022</td>
            <td>Disposed</td>
            <td>Land dispute over Plot 415</td>
            <td>JOHN DOE</td>
            <td>STATE OF ODISHA</td>
        </tr>
    </tbody>
</table>
`;

describe("T-011: RCCMS Fetcher Parser", () => {
  it("should parse the RCCMS results table correctly", () => {
    const { cases, total } = parseRccmsTable(MOCK_HTML_RESULT, "415");
    expect(total).toBe(1);
    expect(cases).toHaveLength(1);
    // Shared-schema fields (caseNo/plotNo/caseType/filingDate/status/court)
    expect(cases[0].caseNo).toBe("94/2022");
    expect(cases[0].caseType).toBe("OEA CLS-I");
    expect(cases[0].filingDate).toBe("14-Mar-2022");
    expect(cases[0].status).toBe("Disposed");
    expect(cases[0].court).toBe("RCCMS Odisha");
    expect(cases[0].plotNo).toBe("415");
    // Local-extension fields (not in @cleardeed/schema contract — KI-002)
    expect(cases[0].subject).toBe("Land dispute over Plot 415");
    expect(cases[0].parties).toEqual([
      { name: "JOHN DOE", role: "petitioner" },
      { name: "STATE OF ODISHA", role: "respondent" },
    ]);
  });

  it("omits plotNo when caller does not pass one", () => {
    const { cases } = parseRccmsTable(MOCK_HTML_RESULT);
    expect(cases[0].plotNo).toBeUndefined();
  });

  it("emits undefined filingDate (not empty string) when the cell is blank", () => {
    const html = `
      <table><tr><th>A</th><th>B</th><th>C</th><th>D</th><th>E</th></tr>
        <tr><td>RC/2024/1</td><td>Mutation</td><td></td><td>Pending</td><td>Subject</td></tr>
      </table>`;
    const { cases } = parseRccmsTable(html);
    expect(cases[0].filingDate).toBeUndefined();
    expect(cases[0].filingDate).not.toBe("");
  });

  it("matches the shared @cleardeed/schema RCCMSResult case shape", () => {
    const { cases } = parseRccmsTable(MOCK_HTML_RESULT, "415");
    // Only the shared-schema fields should be present in a case object when
    // local extensions are stripped. This guards against silent field drift
    // (KI-002).
    const { subject, parties, ...sharedFields } = cases[0];
    expect(Object.keys(sharedFields).sort()).toEqual(
      ["caseNo", "caseType", "court", "filingDate", "plotNo", "status"].sort()
    );
    // `subject` and `parties` must be present on the local extension type
    expect(subject).toBeDefined();
    expect(parties).toHaveLength(2);
  });
});

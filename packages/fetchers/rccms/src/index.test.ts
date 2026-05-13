import { describe, it, expect } from "vitest";
import { fetch, healthCheck, parseRccmsTable } from "./index";

const MOCK_HTML_RESULT = `
<table id="example" class="table table-striped table-bordered" style="width:100%">
    <thead>
        <tr>
            <th>Sl.No</th>
            <th>District</th>
            <th>Tahasil</th>
            <th>Village</th>
            <th>Case Type</th>
            <th>Case No</th>
            <th>Petitioner</th>
            <th>Respondent</th>
            <th>Status</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>1</td>
            <td>KHORDHA</td>
            <td>BHUBANESWAR</td>
            <td>MENDHASALA</td>
            <td>OEA CLS-I</td>
            <td>94/2022</td>
            <td>JOHN DOE</td>
            <td>STATE OF ODISHA</td>
            <td>Disposed</td>
        </tr>
    </tbody>
</table>
`;

describe("T-011: RCCMS Fetcher Parser", () => {
  it("should parse the RCCMS results table correctly", () => {
    const { cases, total } = parseRccmsTable(MOCK_HTML_RESULT);
    expect(total).toBe(1);
    expect(cases).toHaveLength(1);
    expect(cases[0].caseId).toBe("94/2022");
    expect(cases[0].caseType).toBe("OEA CLS-I");
    expect(cases[0].petitioner).toBe("JOHN DOE");
    expect(cases[0].respondent).toBe("STATE OF ODISHA");
    expect(cases[0].status).toBe("Disposed");
  });

  it("marks placeholder results with provenance metadata", async () => {
    const result = await fetch({
      district: "Khordha",
      tahasil: "Bhubaneswar",
      village: "Mendhasala",
      plotNo: "123",
    });

    expect(result.status).toBe("partial");
    expect(result.statusReason).toBe("not_implemented");
    expect(result.attempts).toBe(0);
    expect(result.inputsTried).toHaveLength(1);
    expect(result.parserVersion).toBe("rccms-placeholder-v1");
    expect(result.templateHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.warnings?.[0]).toMatchObject({ code: "not_implemented" });
  });

  it("fails health check while RCCMS is not implemented", async () => {
    const result = await healthCheck();
    expect(result.ok).toBe(false);
    expect(result.message).toContain("not implemented");
  });
});

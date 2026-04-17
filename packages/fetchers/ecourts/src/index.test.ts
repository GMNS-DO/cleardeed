import { describe, it, expect } from "vitest";
import { ecourtsFetch } from "./index.js";

describe("ecourts fetcher", () => {
  describe("parsePartyTable", () => {
    it("parses valid eCourts table HTML", async () => {
      const { parsePartyTable } = await import("./index.js");
      const html = `
        <tr><td>CNROD12D00342015 (Summary Suit)</td><td>Petitioner: Raj Kumar<br>Respondent: State</td><td>15-12-2015</td><td>Pending</td><td>Court of ADJ, Khurda</td></tr>
        <tr><td>CNROD12D00342 (Civil)</td><td>Applicant: Singh</td><td>01-01-2020</td><td>Disposed</td><td>District Court</td></tr>
      `;
      const { cases } = parsePartyTable(html);
      expect(cases).toHaveLength(2);
      expect(cases[0].caseNo).toMatch(/CNROD/);
      expect(cases[0].parties[0].name).toBe("Raj Kumar");
    });

    it("skips rows with no records found", async () => {
      const { parsePartyTable } = await import("./index.js");
      const html = `<tr><td>No records found</td></tr>`;
      const { cases } = parsePartyTable(html);
      expect(cases).toHaveLength(0);
    });
  });

  describe("healthCheck", () => {
    it("is exported and is a function", async () => {
      const { healthCheck } = await import("./index.js");
      expect(typeof healthCheck).toBe("function");
    });
  });
});

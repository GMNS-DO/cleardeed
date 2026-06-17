import { describe, it } from "vitest";
import { validateQuote, extractDocumentText } from "./validate-quotes";

describe("debug", () => {
  it("checks each field", () => {
    const html = `<html><body>
<h1>Encumbrance Certificate</h1>
<table><tr><th>SRO</th><td>Bhubaneswar</td></tr></table>
<h2>Entries</h2>
<table>
<tr><th>Type</th><th>Party</th><th>Doc No</th><th>Date</th><th>Amount</th></tr>
<tr><td>Type Mortgage</td><td>Party State Bank of India</td><td>DOC-100</td><td>15/08/2020</td><td>Rs. 500000/-</td></tr>
<tr><td>Type Sale</td><td>Party Harihar Panda</td><td>DOC-200</td><td>22/01/2022</td><td>Rs. 1200000/-</td></tr>
</table>
</body></html>`;
    const doc = extractDocumentText({ kind: "html", content: html });
    console.log("DOC:", doc);

    const cases = [
      { field: "sro", quote: "SRO Bhubaneswar" },
      { field: "encumbranceType", quote: "Type Mortgage" },
      { field: "partyName", quote: "Party State Bank of India" },
      { field: "docNo", quote: "DOC-100" },
      { field: "date", quote: "15/08/2020" },
      { field: "amount", quote: "Rs. 500000/-" },
    ];
    for (const c of cases) {
      const r = validateQuote(
        { field: c.field, value: "x", quote: { text: c.quote }, interpretation: "x", confidence: 0.9 },
        doc,
      );
      console.log(`${c.field}: passed=${r.passed} reason=${r.reason ?? "(ok)"}`);
    }
  });
});

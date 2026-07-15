import { describe, it } from "vitest";
import { renderPdf } from "/Users/deekshamohapatra/Documents/cleardeed/packages/pdf-renderer/src/index";
import { writeFileSync } from "node:fs";

describe("DEBUG: PDF Renderer", () => {
  it("renders and dumps the PDF binary", async () => {
    const html = "<html><body><h1>Hello PDF</h1></body></html>";
    const buffer = await renderPdf({ html, reportId: "DEBUG-ID", reportTitle: "DEBUG-TITLE" });
    writeFileSync("/tmp/debug.pdf", buffer);
    const slice = buffer.toString("binary");
    console.log("DEBUG-ID found:", slice.includes("DEBUG-ID"));
    console.log("DEBUG-TITLE found:", slice.includes("DEBUG-TITLE"));
    console.log("CLEARDEED found:", slice.includes("CLEARDEED"));
    console.log("consult a lawyer found:", slice.toLowerCase().includes("consult a lawyer"));
    console.log("Buffer length:", buffer.length);
    console.log("First 200 bytes:", slice.slice(0, 200));
    console.log("Last 200 bytes:", slice.slice(-200));
  }, 30000);
});

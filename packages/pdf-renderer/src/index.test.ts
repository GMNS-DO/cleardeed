import { describe, it, expect } from "vitest";
import { renderPdf } from "./index";

describe("T-008: PDF Renderer", () => {
  it("should render a simple HTML string to a non-empty PDF buffer", async () => {
    const html = "<html><body><h1>Hello PDF</h1></body></html>";
    const buffer = await renderPdf({ html });

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000); // PDFs are usually at least a few KB
    expect(buffer.toString("utf8", 0, 5)).toBe("%PDF-");
  }, 30000); // Increase timeout for headless browser launch
});
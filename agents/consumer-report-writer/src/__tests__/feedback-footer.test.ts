import { describe, it, expect } from "vitest";
import { buildFeedbackFooter } from "../index";

describe("buildFeedbackFooter", () => {
  it("renders a single-line disclaimer", () => {
    const html = buildFeedbackFooter({ reportId: "CLD-2026-0142" });
    expect(html).toContain('class="feedback-footer"');
    expect(html).toContain("lawyer");
  });

  it("includes the report id so the footer anchors the document", () => {
    const html = buildFeedbackFooter({ reportId: "CLD-2026-0142" });
    expect(html).toContain("CLD-2026-0142");
  });

  it("includes the survey link placeholder", () => {
    const html = buildFeedbackFooter({ reportId: "CLD-2026-0142" });
    expect(html).toContain("survey");
  });

  it("escapes user-supplied reportId to prevent XSS", () => {
    const html = buildFeedbackFooter({ reportId: "<img src=x onerror=alert(1)>" });
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;img");
  });
});

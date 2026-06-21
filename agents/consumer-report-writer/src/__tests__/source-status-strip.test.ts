import { describe, it, expect } from "vitest";
import { buildSourceStatusStrip } from "../index";

const fixtureSources = [
  { name: "Bhulekh RoR", fetchedAt: "14:32", status: "verified" },
  { name: "Bhunaksha", fetchedAt: "14:32", status: "verified" },
  { name: "eCourts", fetchedAt: "14:35", status: "watchout" },
  { name: "RCCMS", fetchedAt: "—", status: "manual" },
  { name: "BDA", fetchedAt: "14:40", status: "verified" },
  { name: "IGR EC", fetchedAt: "—", status: "manual" },
];

describe("source-status-strip", () => {
  it("renders one chip per source with status color", () => {
    const html = buildSourceStatusStrip(fixtureSources);
    expect(html).toContain('class="source-status-strip"');
    expect(html).toContain('id="source-status"');
    expect(html).toContain("Bhulekh RoR");
    expect(html).toContain("Bhunaksha");
    expect(html).toContain("eCourts");
    expect(html).toContain("RCCMS");
    expect(html).toContain("BDA");
    expect(html).toContain("IGR EC");
    const chipCount = (html.match(/class="source-status-chip"/g) ?? []).length;
    expect(chipCount).toBe(6);
  });

  it("uses the right status token for each chip", () => {
    const html = buildSourceStatusStrip(fixtureSources);
    expect(html).toMatch(/data-status="verified"/);
    expect(html).toMatch(/data-status="watchout"/);
    expect(html).toMatch(/data-status="manual"/);
  });
});

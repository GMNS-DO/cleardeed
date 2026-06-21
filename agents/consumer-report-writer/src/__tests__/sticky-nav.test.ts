import { describe, it, expect } from "vitest";
import { buildStickyNav } from "../index";

const fixtureQuestions = [
  { id: "q1", index: 1, label: "Does the seller own this?", status: "verified" },
  { id: "q2", index: 2, label: "Can you build a house here?", status: "watchout" },
  { id: "q3", index: 3, label: "Could you lose it after paying?", status: "verified" },
  { id: "q4", index: 4, label: "Are you overpaying?", status: "verified" },
  { id: "q5", index: 5, label: "Is the area developing or decaying?", status: "watchout" },
  { id: "q6", index: 6, label: "What happens after you buy?", status: "manual" },
];

describe("sticky-nav", () => {
  it("renders 6 anchors, one per question", () => {
    const html = buildStickyNav(fixtureQuestions);
    expect(html).toContain('class="sticky-nav"');
    const linkCount = (html.match(/sticky-nav-link/g) ?? []).length;
    expect(linkCount).toBe(6);
  });

  it("each anchor links to the corresponding detail section", () => {
    const html = buildStickyNav(fixtureQuestions);
    expect(html).toContain('href="#q1-detail"');
    expect(html).toContain('href="#q6-detail"');
  });

  it("renders the question label", () => {
    const html = buildStickyNav(fixtureQuestions);
    expect(html).toContain("Q1");
    expect(html).toContain("Q6");
  });

  it("marks the active question via data-status attribute", () => {
    const html = buildStickyNav(fixtureQuestions);
    expect(html).toMatch(/data-q="q1" data-status="verified"/);
    expect(html).toMatch(/data-q="q2" data-status="watchout"/);
  });
});

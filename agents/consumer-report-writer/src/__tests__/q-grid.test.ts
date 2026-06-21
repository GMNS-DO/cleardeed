import { describe, it, expect } from "vitest";
import { buildQGrid } from "../index";

const fixtureQuestions = [
  { id: "q1", index: 1, question: "Does the seller actually own this?", statusChipLabel: "Verified", status: "verified", oneLineAnswer: "RoR owner matches the seller name exactly.", exposureDisplay: "₹0", exposureKind: "money" as const, detailsCount: 3 },
  { id: "q2", index: 2, question: "Can you build a house here?", statusChipLabel: "Watch", status: "watchout", oneLineAnswer: "Land class is irrigated; conversion may be required.", exposureDisplay: "₹0", exposureKind: "money" as const, detailsCount: 2 },
  { id: "q3", index: 3, question: "Could you lose it after paying?", statusChipLabel: "Verified", status: "verified", oneLineAnswer: "No active encumbrances found.", exposureDisplay: "₹0", exposureKind: "money" as const, detailsCount: 1 },
  { id: "q4", index: 4, question: "Are you overpaying?", statusChipLabel: "Verified", status: "verified", oneLineAnswer: "Asking price is at IGR benchmark.", exposureDisplay: "₹0", exposureKind: "money" as const, detailsCount: 2 },
  { id: "q5", index: 5, question: "Is the area developing or decaying?", statusChipLabel: "Watch", status: "watchout", oneLineAnswer: "BDA zone is residential; metro corridor 1.2 km.", exposureDisplay: "₹0", exposureKind: "money" as const, detailsCount: 3 },
  { id: "q6", index: 6, question: "What happens after you buy?", statusChipLabel: "Manual", status: "manual", oneLineAnswer: "Mutation, property tax, EC concierge instructions below.", exposureDisplay: "3 items", exposureKind: "count" as const, detailsCount: 3 },
];

describe("q-grid", () => {
  it("renders 6 hero cards", () => {
    const html = buildQGrid(fixtureQuestions);
    expect(html).toContain('class="q-grid"');
    const cardCount = (html.match(/q-tile/g) ?? []).length;
    expect(cardCount).toBe(6);
  });

  it("each tile has a question, status chip, and exposure", () => {
    const html = buildQGrid(fixtureQuestions);
    expect(html).toContain("Does the seller actually own this?");
    expect(html).toContain("Can you build a house here?");
    expect(html).toContain("Could you lose it after paying?");
    expect(html).toContain("Are you overpaying?");
    expect(html).toContain("Is the area developing or decaying?");
    expect(html).toContain("What happens after you buy?");
    expect(html).toContain("Verified");
    expect(html).toContain("Watch");
    expect(html).toContain("Manual");
    expect(html).toContain("₹0");
    expect(html).toContain("3 items");
  });

  it("each tile is a link to its detail anchor", () => {
    const html = buildQGrid(fixtureQuestions);
    expect(html).toContain('href="#q1-detail"');
    expect(html).toContain('href="#q6-detail"');
  });

  it("renders the question index eyebrow", () => {
    const html = buildQGrid(fixtureQuestions);
    expect(html).toContain("Q1 of 6");
    expect(html).toContain("Q6 of 6");
  });
});

import { describe, it, expect } from "vitest";
import { buildQDetail } from "../index";

const fixtureQ1 = {
  id: "q1",
  index: 1,
  question: "Does the seller actually own this?",
  oneLineAnswer: "Yes — RoR owner matches the seller name exactly.",
  keyFacts: [
    { label: "RoR Owner", value: "Krushnachandra Barajena", status: "verified" },
    { label: "Match", value: "Exact (Soundex OK)", status: "verified" },
    { label: "Last Mutation", value: "2018-09-12", status: "verified" },
  ],
  subFindings: [
    { id: "sf1", label: "Single owner recorded", status: "verified" },
    { id: "sf2", label: "Father's name matches RoR", status: "verified" },
    { id: "sf3", label: "No encumbrance certificate", status: "manual" },
  ],
  provenance: {
    source: "Bhulekh RoR (Plot 415, Chandaka)",
    fetchedAt: "2026-04-12 14:32 IST",
    verifyUrl: "https://bhulekh.ori.nic.in/…",
  },
};

describe("q-detail", () => {
  it("renders the detail section with anchor", () => {
    const html = buildQDetail(fixtureQ1);
    expect(html).toContain('id="q1-detail"');
    expect(html).toContain('class="q-detail"');
  });

  it("renders the question title and 1-line answer", () => {
    const html = buildQDetail(fixtureQ1);
    expect(html).toContain("Does the seller actually own this?");
    expect(html).toContain("Yes — RoR owner matches");
  });

  it("renders one key-fact card per fact", () => {
    const html = buildQDetail(fixtureQ1);
    const factCardCount = (html.match(/q-detail-fact/g) ?? []).length;
    expect(factCardCount).toBe(3);
    expect(html).toContain("Krushnachandra Barajena");
    expect(html).toContain("Exact (Soundex OK)");
  });

  it("renders sub-finding chips", () => {
    const html = buildQDetail(fixtureQ1);
    const chipCount = (html.match(/q-detail-chip/g) ?? []).length;
    expect(chipCount).toBe(3);
    expect(html).toContain("Single owner recorded");
    expect(html).toContain("Father's name matches RoR");
    expect(html).toContain("No encumbrance certificate");
  });

  it("renders the provenance strip", () => {
    const html = buildQDetail(fixtureQ1);
    expect(html).toContain("Bhulekh RoR (Plot 415, Chandaka)");
    expect(html).toContain("2026-04-12 14:32 IST");
  });
});

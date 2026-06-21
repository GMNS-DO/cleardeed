// agents/consumer-report-writer/src/__tests__/trust-strip.test.ts
//
// T13 — verify the trust strip renders correctly on critical facts.
//
// Critical facts per the design spec are:
//   - Q1 (does the seller own this?)
//   - Q2 (can you build a house here?)
//   - Q3 (could you lose it after paying?)
//
// Each of these gets a trust strip under the basic provenance line.
// The strip is a collapsible <details> with a one-line summary visible
// by default. When expanded, it shows raw source hash, parser version,
// fetch attempts, raw Odia paired with English, and any
// transferability flags.

import { describe, it, expect } from "vitest";
import {
  buildQDetail,
  renderTrustStrip,
  type TrustStrip,
} from "../index";

const baseInput = {
  id: "q1",
  index: 1,
  question: "Does the seller actually own this?",
  oneLineAnswer: "Yes — RoR owner matches.",
  keyFacts: [
    { label: "RoR Owner", value: "Krushnachandra Barajena", status: "verified" },
  ],
  subFindings: [
    { id: "q1-sf1", label: "Single owner recorded", status: "verified" },
  ],
  provenance: {
    source: "Bhulekh RoR (Plot, Village)",
    fetchedAt: "2026-04-12 14:32 IST",
    verifyUrl: "https://bhulekh.ori.nic.in/",
  },
};

describe("renderTrustStrip", () => {
  it("returns empty string when no strip is passed", () => {
    expect(renderTrustStrip(undefined)).toBe("");
  });

  it("returns a <details> with summary visible by default", () => {
    const strip: TrustStrip = {
      summary: "📍 bhulekh.ori.nic.in · ⏱ 2h ago",
    };
    const html = renderTrustStrip(strip);
    expect(html).toContain("<details");
    expect(html).toContain("</details>");
    expect(html).toContain("📍 bhulekh.ori.nic.in");
    expect(html).toContain('class="q-trust-summary"');
  });

  it("renders the source hash row when present", () => {
    const strip: TrustStrip = {
      summary: "x",
      sourceHash: "7a3f9b2c (sha256)",
    };
    const html = renderTrustStrip(strip);
    expect(html).toContain("🔒 Source hash");
    expect(html).toContain("7a3f9b2c");
  });

  it("renders the parser version row when present", () => {
    const strip: TrustStrip = {
      summary: "x",
      parserVersion: "Bhulekh v3.2",
    };
    const html = renderTrustStrip(strip);
    expect(html).toContain("🔧 Parser");
    expect(html).toContain("Bhulekh v3.2");
  });

  it("renders the attempts row when present", () => {
    const strip: TrustStrip = {
      summary: "x",
      attempts: "3 attempts (captcha hard)",
    };
    const html = renderTrustStrip(strip);
    expect(html).toContain("🔁 Attempts");
    expect(html).toContain("3 attempts (captcha hard)");
  });

  it("renders raw Odia paired with English translation", () => {
    const strip: TrustStrip = {
      summary: "x",
      rawOdia: {
        odia: "କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା",
        english: "Krushnachandra Barajena",
      },
    };
    const html = renderTrustStrip(strip);
    expect(html).toContain("📜 Original (Odia)");
    expect(html).toContain("କୃଷ୍ଣଚନ୍ଦ୍ର ବଡ଼ଯେନା");
    expect(html).toContain("Krushnachandra Barajena");
  });

  it("renders the caste transferability flag (not identity)", () => {
    const strip: TrustStrip = {
      summary: "x",
      casteFlag:
        "RoR shows SC/ST owner. Land in reserved categories may have transfer restrictions under Odisha Land Reforms Act §22.",
    };
    const html = renderTrustStrip(strip);
    expect(html).toContain("⚖️ Transferability");
    expect(html).toContain("Odisha Land Reforms Act §22");
    // The text mentions SC/ST as the government's legal category for transfer
    // restrictions — that's the law's classification, not personal caste identity.
    // We're not exposing actual caste names (Khandayat, Brahmin, etc.).
    expect(html).not.toMatch(/Khandayat|Brahmin|Chasa|Teli|Gudia|Kumuti/);
  });

  it("renders inputs tried when present", () => {
    const strip: TrustStrip = {
      summary: "x",
      inputsTried: ["Searched Plot 309", "then Khata 94"],
    };
    const html = renderTrustStrip(strip);
    expect(html).toContain("🔍 Inputs tried");
    expect(html).toContain("Searched Plot 309 → then Khata 94");
  });

  it("renders parser warnings when present", () => {
    const strip: TrustStrip = {
      summary: "x",
      warnings: ["⚠️ Bhunaksha area truncated", "⚠️ Owner field OCR-uncertain"],
    };
    const html = renderTrustStrip(strip);
    expect(html).toContain("⚠️ Warnings");
    expect(html).toContain("Bhunaksha area truncated");
  });

  it("renders multiple rows in expected order", () => {
    const strip: TrustStrip = {
      summary: "x",
      sourceHash: "abc",
      parserVersion: "v1",
      attempts: "1 attempt",
      rawOdia: { odia: "X", english: "Y" },
      casteFlag: "Z",
    };
    const html = renderTrustStrip(strip);
    // The hash should come before parser, which should come before
    // attempts, which should come before rawOdia, which should come
    // before casteFlag.
    const hashIdx = html.indexOf("🔒 Source hash");
    const parserIdx = html.indexOf("🔧 Parser");
    const attemptsIdx = html.indexOf("🔁 Attempts");
    const odiaIdx = html.indexOf("📜 Original (Odia)");
    const casteIdx = html.indexOf("⚖️ Transferability");
    expect(hashIdx).toBeGreaterThan(0);
    expect(parserIdx).toBeGreaterThan(hashIdx);
    expect(attemptsIdx).toBeGreaterThan(parserIdx);
    expect(odiaIdx).toBeGreaterThan(attemptsIdx);
    expect(casteIdx).toBeGreaterThan(odiaIdx);
  });
});

describe("buildQDetail — trust strip wiring", () => {
  it("renders the trust strip under the basic provenance when provided", () => {
    const html = buildQDetail({
      ...baseInput,
      provenance: {
        ...baseInput.provenance,
        trustStrip: {
          summary: "📍 bhulekh.ori.nic.in",
          sourceHash: "abc",
        },
      },
    });
    // The basic provenance is rendered
    expect(html).toContain("Source: Bhulekh RoR (Plot, Village)");
    expect(html).toContain("Fetched: 2026-04-12 14:32 IST");
    // The trust strip is rendered under it
    expect(html).toContain('<details class="q-trust-strip"');
    expect(html).toContain("📍 bhulekh.ori.nic.in");
    expect(html).toContain("abc");
  });

  it("does NOT render the trust strip when not provided", () => {
    const html = buildQDetail(baseInput);
    expect(html).not.toContain("q-trust-strip");
    // But the basic provenance is still there
    expect(html).toContain("Source: Bhulekh RoR (Plot, Village)");
  });

  it("escapes HTML in summary text (defense-in-depth)", () => {
    const html = buildQDetail({
      ...baseInput,
      provenance: {
        ...baseInput.provenance,
        trustStrip: {
          summary: "<script>alert('xss')</script>",
        },
      },
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in raw Odia content (defense-in-depth)", () => {
    const html = buildQDetail({
      ...baseInput,
      provenance: {
        ...baseInput.provenance,
        trustStrip: {
          summary: "x",
          rawOdia: {
            odia: "<img onerror=alert(1) src=x>",
            english: "Y",
          },
        },
      },
    });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

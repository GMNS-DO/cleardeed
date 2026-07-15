/**
 * Tests for buildPdPdFooter (PI-4 T2 — PDPD Act disclosure footer).
 *
 * Verifies:
 * - Renders the disclosure block when pdpdAcceptedAt is set
 * - Returns "" when pdpdAcceptedAt is null (no retroactive consent on legacy reports)
 * - Mentions the grievance officer + email
 * - Always points at /privacy for the full notice
 */

import { describe, it, expect } from "vitest";
import { buildPdPdFooter } from "../index";

describe("buildPdPdFooter", () => {
  it("renders the PDPD disclosure block when pdpdAcceptedAt is set", () => {
    const html = buildPdPdFooter({
      pdpdAcceptedAt: "2026-07-15T08:30:00Z",
    });
    expect(html).toContain("pdpd-footer");
    expect(html).toContain("Digital Personal Data Protection Act");
    expect(html).toContain("2026-07-15T08:30:00Z");
    expect(html).toContain("Grievance officer");
    expect(html).toContain("privacy@cleardeed.in");
    expect(html).toContain("/privacy");
    expect(html).toContain('href="mailto:privacy@cleardeed.in"');
  });

  it("uses custom contact email and grievance officer when provided", () => {
    const html = buildPdPdFooter({
      pdpdAcceptedAt: "2026-07-15T08:30:00Z",
      contactEmail: "dpo@example.in",
      grievanceOfficer: "Jane Doe, DPO",
    });
    expect(html).toContain("dpo@example.in");
    expect(html).toContain("Jane Doe, DPO");
    expect(html).not.toContain("privacy@cleardeed.in");
  });

  it("returns empty string when pdpdAcceptedAt is null", () => {
    const html = buildPdPdFooter({ pdpdAcceptedAt: null });
    expect(html).toBe("");
  });

  it("returns empty string when pdpdAcceptedAt is undefined", () => {
    const html = buildPdPdFooter({});
    expect(html).toBe("");
  });

  it("escapes HTML in custom values to prevent injection", () => {
    const html = buildPdPdFooter({
      pdpdAcceptedAt: "2026-07-15T08:30:00Z",
      grievanceOfficer: '<script>alert("xss")</script>',
    });
    // escapeText() converts < and > to entities, so no literal <script> tag
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

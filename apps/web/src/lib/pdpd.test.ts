/**
 * PDPD compliance tests for consent text, retention constants, and
 * the PDPDConsentCheckbox client component.
 */

import { describe, expect, it } from "vitest";
import { pdpdConsentLabel, pdpdDisclosureText, PDPD_RETENTION_DAYS } from "@/lib/pdpd";

describe("pdpd.ts", () => {
  it("exports a positive retention constant", () => {
    expect(PDPD_RETENTION_DAYS).toBeGreaterThan(0);
  });

  it("disclosure text mentions ClearDeed, PDPD rights, and contact email", () => {
    for (const bucket of ["report", "feedback", "payment", "account"] as const) {
      const text = pdpdDisclosureText(bucket);
      expect(text).toContain("ClearDeed");
      expect(text).toContain("support@cleardeed.in");
      expect(text).toContain("PDPD");
    }
  });

  it("disclosure text contains a numeric retention figure", () => {
    const text = pdpdDisclosureText("report");
    expect(text).toMatch(/\d+ days/);
  });

  it("consent label is non-empty and differs per bucket", () => {
    const r = pdpdConsentLabel("checkout");
    expect(r.length).toBeGreaterThan(10);
    expect(pdpdConsentLabel("account")).not.toBe(r);
  });
});

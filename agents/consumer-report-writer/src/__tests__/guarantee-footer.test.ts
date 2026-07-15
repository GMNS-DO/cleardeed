/**
 * Tests for buildGuaranteeFooter (PI-3 T2 — guarantee tier footer).
 *
 * Verifies:
 * - Renders the 18-month guarantee block when paidTier is "guaranteed"
 *   and guaranteeAcceptedAt is set
 * - Renders the optional lawyer signature block when lawyerName is set
 * - Returns "" when paidTier is not "guaranteed"
 * - Returns "" when guaranteeAcceptedAt is null
 */

import { describe, it, expect } from "vitest";
import { buildGuaranteeFooter } from "../index";

describe("buildGuaranteeFooter", () => {
  it("renders the guarantee block when tier is guaranteed and acceptance is set", () => {
    const html = buildGuaranteeFooter({
      paidTier: "guaranteed",
      guaranteeAcceptedAt: "2026-07-01T10:00:00Z",
    });
    expect(html).toContain("18-month correctness guarantee");
    expect(html).toContain("verified clear");
    expect(html).toContain("guarantee-terms");
  });

  it("renders the lawyer signature block when lawyerName is set", () => {
    const html = buildGuaranteeFooter({
      paidTier: "guaranteed",
      guaranteeAcceptedAt: "2026-07-01T10:00:00Z",
      lawyerName: "Adv. R Sharma",
      lawyerFirm: "Sharma Legal",
      signedAt: "2026-07-02T09:30:00Z",
    });
    expect(html).toContain("Signed by:");
    expect(html).toContain("Adv. R Sharma");
    expect(html).toContain("Sharma Legal");
  });

  it("returns empty string when paidTier is standard", () => {
    const html = buildGuaranteeFooter({
      paidTier: "standard",
      guaranteeAcceptedAt: "2026-07-01T10:00:00Z",
    });
    expect(html).toBe("");
  });

  it("returns empty string when guaranteeAcceptedAt is null", () => {
    const html = buildGuaranteeFooter({
      paidTier: "guaranteed",
      guaranteeAcceptedAt: null,
    });
    expect(html).toBe("");
  });

  it("omits the lawyer block when lawyerName is not set", () => {
    const html = buildGuaranteeFooter({
      paidTier: "guaranteed",
      guaranteeAcceptedAt: "2026-07-01T10:00:00Z",
      lawyerName: null,
    });
    expect(html).not.toContain("Signed by:");
  });
});

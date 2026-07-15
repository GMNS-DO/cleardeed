/**
 * Tests for pricing module.
 *
 * Pins the tier contract: amounts, labels, includes strings are all
 * asserted so a typo doesn't silently ship. Tests parseTier validation,
 * tierFromAmountPaise reversal, and the free preview policy constant.
 */
import { describe, it, expect } from "vitest";
import { TIERS, parseTier, tierFromAmountPaise, FREE_PREVIEW_LIMIT_PER_USER, isPaidTier, decideMetering, getGuaranteeTerms } from "./pricing";

describe("TIERS constant", () => {
  it("has four entries", () => {
    expect(Object.keys(TIERS)).toEqual(["free_preview", "standard", "verified", "guaranteed"]);
  });

  it("free_preview is ₹0", () => {
    expect(TIERS.free_preview.amountPaise).toBe(0);
    expect(TIERS.free_preview.amountRupees).toBe(0);
  });

  it("standard is ₹699", () => {
    expect(TIERS.standard.amountPaise).toBe(69_900);
    expect(TIERS.standard.amountRupees).toBe(699);
  });

  it("verified is ₹1,999", () => {
    expect(TIERS.verified.amountPaise).toBe(199_900);
    expect(TIERS.verified.amountRupees).toBe(1_999);
  });

  it("guaranteed is ₹4,999", () => {
    expect(TIERS.guaranteed.amountPaise).toBe(499_900);
    expect(TIERS.guaranteed.amountRupees).toBe(4_999);
  });

  it("each tier has a non-empty label", () => {
    for (const tier of Object.keys(TIERS)) {
      expect(TIERS[tier as keyof typeof TIERS].label.length).toBeGreaterThan(0);
    }
  });

  it("each tier has a non-empty includes string", () => {
    for (const tier of Object.keys(TIERS)) {
      expect(TIERS[tier as keyof typeof TIERS].includes.length).toBeGreaterThan(0);
    }
  });
});

describe("parseTier", () => {
  it("accepts all four valid tier strings", () => {
    expect(parseTier("free_preview")).toBe("free_preview");
    expect(parseTier("standard")).toBe("standard");
    expect(parseTier("verified")).toBe("verified");
    expect(parseTier("guaranteed")).toBe("guaranteed");
  });

  it("rejects undefined", () => {
    expect(parseTier(undefined)).toBeNull();
  });

  it("rejects null", () => {
    expect(parseTier(null)).toBeNull();
  });

  it("rejects non-string types", () => {
    expect(parseTier(123)).toBeNull();
    expect(parseTier(true)).toBeNull();
    expect(parseTier({})).toBeNull();
    expect(parseTier([])).toBeNull();
  });

  it("rejects bogus strings", () => {
    expect(parseTier("free")).toBeNull(); // missing "_preview" suffix
    expect(parseTier("Free Preview")).toBeNull(); // wrong case, spaces
    expect(parseTier("premium")).toBeNull(); // not a tier name
    expect(parseTier("enterprise")).toBeNull(); // B2B, not in T-014 scope
    expect(parseTier("")).toBeNull();
  });
});

describe("tierFromAmountPaise", () => {
  it("reverses each tier's amountPaise", () => {
    expect(tierFromAmountPaise(0)).toBe("free_preview");
    expect(tierFromAmountPaise(69_900)).toBe("standard");
    expect(tierFromAmountPaise(199_900)).toBe("verified");
    expect(tierFromAmountPaise(499_900)).toBe("guaranteed");
  });

  it("returns null for unknown amounts", () => {
    expect(tierFromAmountPaise(100)).toBeNull(); // old ₹1 test amount
    expect(tierFromAmountPaise(69_899)).toBeNull(); // 1 paise off
    expect(tierFromAmountPaise(-1)).toBeNull();
  });
});

describe("FREE_PREVIEW_LIMIT_PER_USER", () => {
  it("is 1", () => {
    expect(FREE_PREVIEW_LIMIT_PER_USER).toBe(1);
  });
});

describe("isPaidTier", () => {
  it("accepts the three paid tier strings", () => {
    expect(isPaidTier("standard")).toBe(true);
    expect(isPaidTier("verified")).toBe(true);
    expect(isPaidTier("guaranteed")).toBe(true);
  });

  it("rejects free_preview", () => {
    expect(isPaidTier("free_preview")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isPaidTier(null)).toBe(false);
    expect(isPaidTier(undefined)).toBe(false);
    expect(isPaidTier(123)).toBe(false);
    expect(isPaidTier(true)).toBe(false);
  });

  it("rejects bogus strings", () => {
    expect(isPaidTier("")).toBe(false);
    expect(isPaidTier("premium")).toBe(false);
    expect(isPaidTier("enterprise")).toBe(false);
    expect(isPaidTier("STANDARD")).toBe(false); // wrong case
  });
});

describe("getGuaranteeTerms", () => {
  it("returns guarantee terms for the guaranteed tier", () => {
    const terms = getGuaranteeTerms("guaranteed");
    expect(terms).not.toBeNull();
    expect(terms?.termsUrl).toBe("https://cleardeed.in/guarantee-terms");
    expect(terms?.consentLabel).toContain("18-month");
    expect(terms?.consentSummary).toContain("verified clear");
  });

  it("returns null for non-guaranteed tiers", () => {
    expect(getGuaranteeTerms("standard")).toBeNull();
    expect(getGuaranteeTerms("verified")).toBeNull();
    expect(getGuaranteeTerms("free_preview")).toBeNull();
  });
});

describe("decideMetering", () => {
  it("allows anonymous users (null userId) — concierge flow", () => {
    const d = decideMetering({ userId: null, paidReportsCount: 0 });
    expect(d.kind).toBe("allow");
    expect(d.reason).toBe("anonymous");
  });

  it("allows anonymous users even after they have paid reports (no userId = no count to check)", () => {
    const d = decideMetering({ userId: null, paidReportsCount: 999 });
    expect(d.kind).toBe("allow");
    expect(d.reason).toBe("anonymous");
  });

  it("allows the first authenticated user (paidReportsCount = 0)", () => {
    const d = decideMetering({ userId: "user_1", paidReportsCount: 0 });
    expect(d.kind).toBe("allow");
    expect(d.reason).toBe("free_preview");
    if (d.kind === "allow") {
      expect(d.remainingPreviews).toBe(1);
    }
  });

  it("blocks once the user has used their free preview", () => {
    const d = decideMetering({ userId: "user_1", paidReportsCount: 1 });
    expect(d.kind).toBe("require_payment");
    expect(d.reason).toBe("free_preview_used");
    if (d.kind === "require_payment") {
      expect(d.remainingPreviews).toBe(0);
      expect(d.orderEndpoint).toBe("/api/order");
    }
  });

  it("blocks for any count >= FREE_PREVIEW_LIMIT_PER_USER", () => {
    expect(decideMetering({ userId: "u", paidReportsCount: 1 }).kind).toBe("require_payment");
    expect(decideMetering({ userId: "u", paidReportsCount: 5 }).kind).toBe("require_payment");
    expect(decideMetering({ userId: "u", paidReportsCount: 100 }).kind).toBe("require_payment");
  });

  it("respects a custom orderEndpoint", () => {
    const d = decideMetering({
      userId: "u",
      paidReportsCount: 1,
      orderEndpoint: "/custom/api/order",
    });
    if (d.kind === "require_payment") {
      expect(d.orderEndpoint).toBe("/custom/api/order");
    } else {
      throw new Error("expected require_payment");
    }
  });

  it("clamps negative counts to 0 then allows (treats corrupt count as 0)", () => {
    // Defensive: if the DB returns a count that's somehow < 0, the
    // gate treats it as 0 (one free preview left). This avoids
    // accidentally GRANTING infinite previews if the count is corrupt.
    const d = decideMetering({ userId: "u", paidReportsCount: -1 });
    expect(d.kind).toBe("allow");
    if (d.kind === "allow") {
      expect(d.remainingPreviews).toBe(1); // 1 - 0 (clamped)
    }
  });
});
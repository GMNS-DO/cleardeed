/**
 * Premium styles — Phase 1 CSS layer tests.
 *
 * getPremiumStyles() emits a CSS string that activates only under
 * `body.buyer-page[data-cleardeed-theme="premium"]` and styles the
 * premium-specific surfaces defined in REPORT_REDESIGN_PREMIUM.md:
 *   - Display font on the verdict headline
 *   - Mesh backdrop layer behind the buyer page
 *   - Verdict chip refinements (saturated, not pill)
 *   - Reduced-motion support for premium transitions
 *
 * The block is ADDITIVE: it never overrides an existing CSS rule
 * unless that rule is intended to be replaced in premium mode. The
 * only selectors that target existing class names are gated on
 * [data-cleardeed-theme="premium"] so they have no effect on
 * classic reports.
 *
 * Compatibility:
 *   - Classic mode (no premium flag): returns "". Existing CSS
 *     rules in the 900-line stylesheet run unchanged.
 *   - Premium mode: the block is inlined as a second <style> after
 *     the main stylesheet, so it wins specificity ties.
 */

import { describe, it, expect } from "vitest";
import { getPremiumStyles } from "../theme";

describe("premium styles — default (classic) mode", () => {
  it("returns an empty string with no opts", () => {
    expect(getPremiumStyles()).toBe("");
  });

  it("returns an empty string with premium: false", () => {
    expect(getPremiumStyles({ premium: false })).toBe("");
  });

  it("returns an empty string with empty opts", () => {
    expect(getPremiumStyles({})).toBe("");
  });
});

describe("premium styles — active mode", () => {
  const css = getPremiumStyles({ premium: true });

  it("returns a non-empty CSS block", () => {
    expect(css.length).toBeGreaterThan(0);
  });

  it("is scoped to [data-cleardeed-theme='premium']", () => {
    expect(css).toContain('[data-cleardeed-theme="premium"]');
  });

  it("does not contain any :root rules (would conflict with the existing :root palette)", () => {
    // Strip comments before checking — :root must not be redefined here.
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(stripped).not.toMatch(/^\s*:root\s*\{/m);
  });

  it("applies the display font to the verdict headline", () => {
    // The class is .verdict-card-headline in the existing CSS; the
    // premium block uses it as the anchor for the display font.
    expect(css).toContain("verdict-card-headline");
    expect(css).toContain("var(--cd-font-display)");
  });

  it("includes the mesh backdrop layer", () => {
    // Implemented as body::before — a fixed gradient layer behind
    // the buyer page. The test pins the surface, not the class name.
    expect(css).toMatch(/body[^{]*::before/);
    expect(css).toContain("radial-gradient");
  });

  it("includes a reduced-motion override", () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  it("is idempotent — same output for repeated calls", () => {
    const a = getPremiumStyles({ premium: true });
    const b = getPremiumStyles({ premium: true });
    expect(a).toBe(b);
  });
});

describe("premium styles — no override of classic selectors", () => {
  it("does not redefine .report-header at the :root scope", () => {
    // The existing CSS in buildBuyerPage defines .report-header. The
    // premium block may extend it under [data-cleardeed-theme] but
    // must not redefine it at the top scope (that would change the
    // classic rendering — load-bearing).
    const css = getPremiumStyles({ premium: true });
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(stripped).not.toMatch(/^\s*\.report-header\s*\{/m);
  });
});

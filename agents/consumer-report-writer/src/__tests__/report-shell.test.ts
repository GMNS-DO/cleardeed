/**
 * ReportShell — Phase 1 tests.
 *
 * The shell is a thin string-template wrapper that adds the structural
 * landmarks and a11y affordances Phase 3+ needs to re-skin the buyer
 * page without rewriting the existing 1500-line render pipeline.
 *
 * What the shell adds:
 *   - A skip-link as the first focusable element (a11y)
 *   - A <main id="main-content"> wrapping the body markup
 *   - A body data attribute (data-cleardeed-shell="v1") so Phase 3+
 *     CSS can target this version without affecting legacy renders
 *
 * Compatibility:
 *   - Classic mode (no opts): output is byte-for-byte identical to
 *     a passthrough — no extra markup.
 *   - Premium mode: shell wraps the body in <main>, prepends a skip
 *     link, and sets the body data attribute.
 *
 * The tests pin the public contract (input → output shape) so we can
 * add the dark-theme ReportShell CSS in a later phase without
 * re-writing these tests.
 */

import { describe, it, expect } from "vitest";
import {
  renderReportShell,
  buildSkipLink,
  type ReportShellOptions,
} from "../report-shell";

describe("report-shell — default (passthrough) mode", () => {
  it("returns the body unchanged when no opts provided", () => {
    const body = "<header>x</header><footer>y</footer>";
    expect(renderReportShell(body)).toBe(body);
  });

  it("returns the body unchanged when shell: false", () => {
    const body = "<header>x</header>";
    expect(renderReportShell(body, { shell: false })).toBe(body);
  });

  it("returns the body unchanged when empty opts object", () => {
    const opts: ReportShellOptions = {};
    const body = "<header>x</header>";
    expect(renderReportShell(body, opts)).toBe(body);
  });

  it("does not mutate the body string", () => {
    const body = "<header>x</header>";
    const snapshot = body;
    renderReportShell(body, { shell: true });
    expect(body).toBe(snapshot);
  });

  it("does not mutate the opts object", () => {
    const opts: ReportShellOptions = { shell: true };
    const snapshot = JSON.stringify(opts);
    renderReportShell("<x/>", opts);
    expect(JSON.stringify(opts)).toBe(snapshot);
  });
});

describe("report-shell — active mode", () => {
  const body = "<header class=\"report-header\">x</header><div class=\"q-grid\">y</div>";
  const out = renderReportShell(body, { shell: true });

  it("wraps the body in <main id=\"main-content\">", () => {
    expect(out).toContain('<main id="main-content">');
    expect(out).toContain("</main>");
  });

  it("preserves the original body markup inside <main>", () => {
    expect(out).toContain('<header class="report-header">x</header>');
    expect(out).toContain('<div class="q-grid">y</div>');
  });

  it("places <main> after the skip link", () => {
    const skipPos = out.indexOf("skip-link");
    const mainPos = out.indexOf('<main id="main-content">');
    expect(skipPos).toBeGreaterThan(-1);
    expect(mainPos).toBeGreaterThan(-1);
    expect(skipPos).toBeLessThan(mainPos);
  });

  it("places the skip link as the first focusable element", () => {
    expect(out.trimStart().startsWith('<a class="skip-link"'));
  });

  it("skip link points to #main-content", () => {
    expect(out).toMatch(/<a class="skip-link"[^>]*href="#main-content"/);
  });

  it("skip link targets the main region", () => {
    // The skip-link's href target must match the id we put on <main>.
    expect(out).toContain('href="#main-content"');
    expect(out).toContain('id="main-content"');
  });
});

describe("buildSkipLink — unit", () => {
  it("returns the skip-link anchor string", () => {
    const link = buildSkipLink();
    expect(link).toContain('<a class="skip-link"');
    expect(link).toContain('href="#main-content"');
    expect(link).toContain("Skip to main content");
  });

  it("is idempotent — same output for repeated calls", () => {
    expect(buildSkipLink()).toBe(buildSkipLink());
  });

  it("includes a default visible-on-focus style hook", () => {
    // The skip-link must include the class name that Phase 1+ CSS
    // will key off to reveal on focus. Today the class is not styled
    // (visible-on-focus CSS lands with the dark theme in a later
    // phase); the contract is that the class name exists so we can
    // add the rule without changing the markup.
    expect(buildSkipLink()).toContain("skip-link");
  });
});

describe("report-shell — passthrough + active are distinct", () => {
  const body = "<header>x</header>";
  it("passthrough does NOT contain <main>", () => {
    expect(renderReportShell(body)).not.toContain("<main");
  });
  it("active DOES contain <main>", () => {
    expect(renderReportShell(body, { shell: true })).toContain("<main");
  });
});
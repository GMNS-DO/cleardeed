/**
 * Theme module — Phase 0 tests.
 *
 * Verifies the design-token module:
 *   - default mode returns empty string (no behavior change for existing reports)
 *   - premium mode returns a non-empty token block containing the expected
 *     custom property names
 *   - the wrapper data attribute correctly indicates the active variant
 *   - the variant resolver is a pure function (no side effects)
 *
 * These tests run on the source module, not on the rendered HTML, so
 * they stay fast and isolated.
 */

import { describe, it, expect } from "vitest";
import {
  getThemeTokens,
  getThemeAttribute,
  getThemeBridge,
  resolveVariant,
  type ThemeOptions,
} from "../theme";

describe("theme — default (classic) mode", () => {
  it("returns an empty string with no opts", () => {
    expect(getThemeTokens()).toBe("");
  });

  it("returns an empty string with premium: false", () => {
    expect(getThemeTokens({ premium: false })).toBe("");
  });

  it("returns an empty string with empty object", () => {
    const opts: ThemeOptions = {};
    expect(getThemeTokens(opts)).toBe("");
  });

  it("yields a null attribute (no data attr) so existing reports are unchanged", () => {
    expect(getThemeAttribute()).toBeNull();
    expect(getThemeAttribute({ premium: false })).toBeNull();
  });

  it("resolves to 'classic' variant by default", () => {
    expect(resolveVariant()).toBe("classic");
    expect(resolveVariant({ premium: false })).toBe("classic");
  });
});

describe("theme — premium mode", () => {
  it("returns a non-empty CSS block when premium: true", () => {
    const tokens = getThemeTokens({ premium: true });
    expect(tokens.length).toBeGreaterThan(0);
  });

  it("scopes the token block to [data-cleardeed-theme='premium']", () => {
    const tokens = getThemeTokens({ premium: true });
    expect(tokens).toContain('[data-cleardeed-theme="premium"]');
  });

  it("defines the expected design-token custom properties", () => {
    const tokens = getThemeTokens({ premium: true });
    const expected = [
      "--cd-color-bg",
      "--cd-color-surface",
      "--cd-color-ink",
      "--cd-color-accent",
      "--cd-color-redflag",
      "--cd-font-display",
      "--cd-font-body",
      "--cd-space-1",
      "--cd-radius-md",
      "--cd-shadow-2",
    ];
    for (const name of expected) {
      expect(tokens).toContain(name);
    }
  });

  it("includes a body.buyer-page override (the only active rule today)", () => {
    const tokens = getThemeTokens({ premium: true });
    expect(tokens).toContain("body.buyer-page");
  });

  it("yields the wrapper data attribute when premium: true", () => {
    const attr = getThemeAttribute({ premium: true });
    expect(attr).toEqual({ "data-cleardeed-theme": "premium" });
  });

  it("resolves to 'premium' variant", () => {
    expect(resolveVariant({ premium: true })).toBe("premium");
  });
});

describe("theme — idempotence", () => {
  it("returns identical output for identical opts", () => {
    const a = getThemeTokens({ premium: true });
    const b = getThemeTokens({ premium: true });
    expect(a).toBe(b);
  });

  it("does not mutate the input", () => {
    const opts: ThemeOptions = { premium: true };
    const snapshot = JSON.stringify(opts);
    getThemeTokens(opts);
    getThemeAttribute(opts);
    resolveVariant(opts);
    expect(JSON.stringify(opts)).toBe(snapshot);
  });
});

describe("theme — bridge (Phase 1)", () => {
  it("returns an empty string in classic mode (no legacy remap)", () => {
    expect(getThemeBridge()).toBe("");
    expect(getThemeBridge({ premium: false })).toBe("");
  });

  it("returns a non-empty scoped block when premium: true", () => {
    const bridge = getThemeBridge({ premium: true });
    expect(bridge.length).toBeGreaterThan(0);
    expect(bridge).toContain('body.buyer-page[data-cleardeed-theme="premium"]');
  });

  it("remaps the legacy --paper / --ink / --accent / --bad tokens onto --cd-* names", () => {
    const bridge = getThemeBridge({ premium: true });
    // Surface remap
    expect(bridge).toMatch(/--paper:\s*var\(--cd-color-ink-900\)/);
    expect(bridge).toMatch(/--card:\s*var\(--cd-color-ink-800\)/);
    // Ink remap
    expect(bridge).toMatch(/--ink:\s*var\(--cd-color-ink-100\)/);
    // Accent remap
    expect(bridge).toMatch(/--accent:\s*var\(--cd-color-gold-500\)/);
    // Status remap
    expect(bridge).toMatch(/--bad:\s*var\(--cd-color-verdict-red\)/);
  });
});

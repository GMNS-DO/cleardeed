/**
 * ClearDeed consumer report — premium theme tokens (Phase 1).
 *
 * Two output functions:
 *  - getThemeTokens() returns a CSS string that, when inlined ahead of
 *    the main stylesheet, defines custom properties under a selector
 *    keyed to a data-attribute. When no premium flag is set, returns
 *    "" so the rendered document is byte-for-byte identical to the
 *    pre-Phase-0 baseline (load-bearing compatibility contract).
 *  - getThemeBridge() remaps the legacy :root token names
 *    (--paper, --ink, --accent, --bad, etc.) onto the new --cd-*
 *    palette. Returns "" in classic mode and a scoped block in
 *    premium mode. This is the leverage that lets the existing
 *    900-line CSS in buildBuyerPage pick up the dark palette
 *    automatically — every existing rule that references var(--paper)
 *    or var(--ink) re-resolves to the dark value via the cascade.
 *  - getThemeAttribute() returns a body attribute object or null when
 *    no flag is set. The body wrapper applies it so the custom-
 *    properties cascade.
 *
 * Why we don't redesign the existing CSS in Phase 1:
 *  - The premium design language in REPORT_REDESIGN_PREMIUM.md calls
 *    for a full visual overhaul (color, type, spacing, motion). Doing
 *    that on the live consumer report would risk visual regressions
 *    to a surface that is currently working. The token system below
 *    is the foundation — the bridge makes the dark palette active
 *    today, and later phases will rewrite the existing CSS to
 *    consume --cd-* tokens directly without re-architecting the
 *    document structure (CSS class names, panel layout, trust strip)
 *    that tests already pin down.
 *
 * Token coverage in Phase 1:
 *  - Color: --cd-color-ink-50 → --cd-color-ink-900 (10-step scale),
 *    --cd-color-gold-200/400/500, --cd-color-verdict-{red,amber,
 *    green,blue}, --cd-color-border, --cd-color-border-strong,
 *    --cd-color-surface-elev, --cd-color-redflag (alias)
 *  - Type: --cd-font-display, --cd-font-body
 *  - Spacing: --cd-space-1 → --cd-space-7 (4/8/12/16/24/32/48px)
 *  - Radii: --cd-radius-sm (8px), --cd-radius-md (12px)
 *  - Shadow: --cd-shadow-1 (subtle inset), --cd-shadow-2 (1px lift)
 *  - Motion: --cd-duration-fast/base/slow, --cd-ease-out
 *
 * Bridge coverage (legacy → --cd-*):
 *  - Surface: --paper, --card, --card-elev
 *  - Ink: --ink, --ink-2, --ink-3, --ink-4
 *  - Lines: --border, --border-bold
 *  - Accent: --accent, --accent-2, --accent-glow
 *  - Status: --good, --good-soft, --watch, --watch-soft,
 *            --bad, --bad-soft, --info, --info-soft
 *
 * Compatibility:
 *  - Classic mode: getThemeTokens and getThemeBridge both return "".
 *    Existing reports render unchanged.
 *  - Premium mode: both blocks render, body gets
 *    `data-cleardeed-theme="premium"`, and the existing rules
 *    auto-resolve to dark values.
 */

export type ThemeOptions = { premium?: boolean };

/**
 * Premium theme tokens. Returns a self-contained CSS string that
 * activates when the body has `data-cleardeed-theme="premium"`.
 *
 * Returns "" when premium is not requested — this is the
 * load-bearing compatibility contract for Phase 0/1.
 */
export function getThemeTokens(opts: ThemeOptions = {}): string {
  if (opts.premium !== true) return "";

  return `[data-cleardeed-theme="premium"] {
  /* Canvas */
  --cd-color-bg: #0A0E14;
  --cd-color-surface: #11161F;
  --cd-color-surface-elev: #1A2230;

  /* Ink scale (10-step, low = bright) */
  --cd-color-ink-50: #F4F6F9;
  --cd-color-ink-100: #E8ECF1;
  --cd-color-ink-200: #D5DCE5;
  --cd-color-ink-300: #B8C0CC;
  --cd-color-ink-400: #8C95A4;
  --cd-color-ink-500: #6B7280;
  --cd-color-ink-600: #2A3343;
  --cd-color-ink-700: #1A2230;
  --cd-color-ink-800: #11161F;
  --cd-color-ink-900: #0A0E14;

  /* Accent (gold) */
  --cd-color-accent: #C9A961;
  --cd-color-gold-200: #8A7548;
  --cd-color-gold-400: #D4B978;
  --cd-color-gold-500: #C9A961;

  /* Verdict (status) */
  --cd-color-redflag: #E5484D;
  --cd-color-verdict-red: #E5484D;
  --cd-color-verdict-amber: #F5A524;
  --cd-color-verdict-green: #30A46C;
  --cd-color-verdict-blue: #4DABF7;
  --cd-color-status-good: #30A46C;
  --cd-color-status-watch: #F5A524;
  --cd-color-status-info: #4DABF7;
  --cd-color-status-bad: #E5484D;

  /* Borders */
  --cd-color-border: rgba(232, 236, 241, 0.10);
  --cd-color-border-strong: rgba(232, 236, 241, 0.16);

  /* Type */
  --cd-font-display: 'GT Sectra', 'Playfair Display', Georgia, serif;
  --cd-font-body: 'Inter', system-ui, -apple-system, sans-serif;
  --cd-font-mono: 'JetBrains Mono', 'Berkeley Mono', ui-monospace, 'SF Mono', Menlo, monospace;

  /* Spacing scale (8px base grid) */
  --cd-space-1: 4px;
  --cd-space-2: 8px;
  --cd-space-3: 12px;
  --cd-space-4: 16px;
  --cd-space-5: 24px;
  --cd-space-6: 32px;
  --cd-space-7: 48px;

  /* Radii */
  --cd-radius-sm: 8px;
  --cd-radius-md: 12px;

  /* Shadow */
  --cd-shadow-1: inset 0 1px 0 0 rgba(232, 236, 241, 0.04);
  --cd-shadow-2: 0 1px 0 0 rgba(232, 236, 241, 0.05);

  /* Motion */
  --cd-duration-fast: 150ms;
  --cd-duration-base: 250ms;
  --cd-duration-slow: 400ms;
  --cd-ease-out: cubic-bezier(0.2, 0.6, 0.2, 1);
}

/* Body-level cascade — the buyer's body class picks up the new palette. */
body.buyer-page[data-cleardeed-theme="premium"] {
  background: var(--cd-color-bg);
  color: var(--cd-color-ink-100);
  font-family: var(--cd-font-body);
}`;
}

/**
 * Token bridge — remaps the legacy :root token names used by the
 * existing 900-line CSS in buildBuyerPage onto the --cd-* palette.
 *
 * In premium mode, every existing rule that references var(--paper),
 * var(--ink), var(--accent), var(--bad), etc. re-resolves through this
 * scoped cascade. We don't rewrite any existing CSS rules — the
 * bridge makes them inherit the dark palette automatically.
 *
 * In classic mode, returns "" — the existing :root tokens in the
 * existing CSS keep their original light values.
 */
export function getThemeBridge(opts: ThemeOptions = {}): string {
  if (opts.premium !== true) return "";

  return `body.buyer-page[data-cleardeed-theme="premium"] {
  /* Surface */
  --paper:        var(--cd-color-ink-900);
  --card:         var(--cd-color-ink-800);
  --card-elev:    var(--cd-color-ink-700);
  --card-hover:   var(--cd-color-ink-600);

  /* Ink */
  --ink:          var(--cd-color-ink-100);
  --ink-2:        var(--cd-color-ink-200);
  --ink-3:        var(--cd-color-ink-300);
  --ink-4:        var(--cd-color-ink-400);

  /* Lines */
  --border:       var(--cd-color-border);
  --border-bold:  var(--cd-color-border-strong);

  /* Accent */
  --accent:       var(--cd-color-gold-500);
  --accent-2:     var(--cd-color-verdict-amber);
  --accent-glow:  rgba(201, 169, 97, 0.12);

  /* Status */
  --good:         var(--cd-color-verdict-green);
  --good-soft:    rgba(48, 164, 108, 0.12);
  --watch:        var(--cd-color-verdict-amber);
  --watch-soft:   rgba(245, 165, 36, 0.12);
  --bad:          var(--cd-color-verdict-red);
  --bad-soft:     rgba(229, 72, 77, 0.12);
  --info:         var(--cd-color-verdict-blue);
  --info-soft:    rgba(77, 171, 247, 0.12);
}`;
}

/**
 * Premium-specific CSS layer.
 *
 * Emits an ADDITIVE stylesheet that activates only under
 * `body.buyer-page[data-cleardeed-theme="premium"]` and styles the
 * premium surfaces defined in REPORT_REDESIGN_PREMIUM.md §4-§8:
 *   - Display font (GT Sectra / Playfair Display) on the verdict
 *     headline — a premium typography signature on the buyer's
 *     first read.
 *   - Mesh backdrop — a fixed-position gradient layer that sits
 *     behind the buyer page and gives the dark canvas a sense of
 *     depth (the spec's "atmospheric dark mode" — §4.3).
 *   - Verdict chip refinement — saturated colours, subtle border
 *     instead of pill background (the spec's "verdict chip" — §5.2).
 *   - Reduced-motion override — premium transitions collapse to
 *     instant when prefers-reduced-motion: reduce is set.
 *
 * Compatibility:
 *   - Classic mode: returns "" — no override of any existing rule.
 *   - Premium mode: rules are gated on
 *     `[data-cleardeed-theme="premium"]` so they have ZERO effect
 *     on the classic rendering, even if both stylesheets are
 *     loaded.
 *   - The block never redefines :root. :root continues to hold the
 *     light palette, so any future code path that falls back to
 *     the root tokens still works.
 *
 * Specificity:
 *   - Inlined AFTER the main stylesheet, so it wins on tie.
 *   - All selectors include either `[data-cleardeed-theme="premium"]`
 *     or a body-level class, so classic mode never matches.
 */
export function getPremiumStyles(opts: ThemeOptions = {}): string {
  if (opts.premium !== true) return "";

  return `/* Premium styles — activate under [data-cleardeed-theme="premium"] only. */

body.buyer-page[data-cleardeed-theme="premium"] .verdict-card-headline {
  font-family: var(--cd-font-display);
  font-weight: 500;
  letter-spacing: -0.01em;
  color: var(--cd-color-ink-50);
}

/* Mesh backdrop — fixed-position gradient layer behind the buyer page.
   Pure CSS so it costs no HTTP request. Phase 2 hero map will sit on
   top of this canvas. */
body.buyer-page[data-cleardeed-theme="premium"]::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(ellipse 60% 40% at 20% 0%, rgba(201, 169, 97, 0.06), transparent 60%),
    radial-gradient(ellipse 50% 50% at 100% 100%, rgba(77, 171, 247, 0.04), transparent 70%),
    var(--cd-color-bg);
  pointer-events: none;
}

/* Verdict chip — saturated colour, thin border (no pill background).
   The existing .verdict-card[data-tier] CSS in buildBuyerPage handles
   tier→colour; this rule refines the eyebrow/chip surface to feel
   more like a status indicator than a soft pill. */
body.buyer-page[data-cleardeed-theme="premium"] .verdict-card-eyebrow {
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-size: 12px;
  color: var(--cd-color-ink-300);
  font-weight: 600;
}

/* MapCard (Phase 2 v0) — premium hero chrome around the cached plot
   diagram. The frame is gated on [data-premium-frame="map"] so it
   only activates when the MapCard has rendered its premium hero
   surface. The gold border, soft glow on verified plots, and
   layer-toggle surface are the v0 deliverables — MapLibre / deck.gl
   come in Phase 2 v1. */
body.buyer-page[data-cleardeed-theme="premium"] [data-premium-frame="map"] {
  position: relative;
  border: 1px solid var(--cd-color-gold-200);
  border-radius: var(--cd-radius-md);
  overflow: hidden;
  background: var(--cd-color-surface);
  box-shadow: var(--cd-shadow-1);
}

body.buyer-page[data-cleardeed-theme="premium"] [data-premium-frame="map"] .map-card-img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--cd-radius-md);
}

body.buyer-page[data-cleardeed-theme="premium"] [data-state="success"][data-premium-frame="map"] {
  box-shadow:
    var(--cd-shadow-1),
    0 0 0 1px var(--cd-color-gold-500),
    0 0 24px -8px var(--cd-color-gold-500);
}

body.buyer-page[data-cleardeed-theme="premium"] .map-card-layer-toggle {
  position: absolute;
  top: 12px;
  right: 12px;
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  background: rgba(10, 14, 20, 0.78);
  border: 1px solid var(--cd-color-ink-600);
  border-radius: 999px;
  backdrop-filter: blur(8px);
  font-size: 11px;
  letter-spacing: 0.04em;
}

body.buyer-page[data-cleardeed-theme="premium"] .map-card-layer-btn {
  padding: 4px 10px;
  border-radius: 999px;
  color: var(--cd-color-ink-300);
  cursor: default;
}

body.buyer-page[data-cleardeed-theme="premium"] .map-card-layer-btn.is-active {
  background: var(--cd-color-gold-500);
  color: var(--cd-color-ink-900);
  font-weight: 600;
}

body.buyer-page[data-cleardeed-theme="premium"] .map-card-cta {
  display: inline-block;
  padding: 8px 16px;
  border: 1px solid var(--cd-color-gold-500);
  border-radius: var(--cd-radius-md);
  color: var(--cd-color-gold-500);
  font-weight: 600;
  text-decoration: none;
  font-size: 13px;
  letter-spacing: 0.02em;
}

body.buyer-page[data-cleardeed-theme="premium"] .map-card-cta:hover {
  background: var(--cd-color-gold-500);
  color: var(--cd-color-ink-900);
}

body.buyer-page[data-cleardeed-theme="premium"] .map-card-link {
  display: inline-block;
  margin-left: 12px;
  font-size: 12px;
  color: var(--cd-color-ink-300);
  text-decoration: none;
  border-bottom: 1px dotted var(--cd-color-ink-600);
}

body.buyer-page[data-cleardeed-theme="premium"] .map-card-link:hover {
  color: var(--cd-color-gold-400);
  border-bottom-color: var(--cd-color-gold-400);
}

body.buyer-page[data-cleardeed-theme="premium"] .map-card-caption {
  margin-top: 8px;
  font-family: var(--cd-font-mono);
  font-size: 11px;
  color: var(--cd-color-ink-300);
  letter-spacing: 0.04em;
}

body.buyer-page[data-cleardeed-theme="premium"] .map-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

body.buyer-page[data-cleardeed-theme="premium"] .map-badge-verified {
  background: rgba(48, 164, 108, 0.16);
  color: var(--cd-color-verdict-green);
  border: 1px solid var(--cd-color-verdict-green);
}

body.buyer-page[data-cleardeed-theme="premium"] .map-badge-partial {
  background: rgba(245, 165, 36, 0.16);
  color: var(--cd-color-verdict-amber);
  border: 1px solid var(--cd-color-verdict-amber);
}

body.buyer-page[data-cleardeed-theme="premium"] .map-badge-failed {
  background: rgba(229, 72, 77, 0.16);
  color: var(--cd-color-verdict-red);
  border: 1px solid var(--cd-color-verdict-red);
}

/* Mobile — collapse the layer toggle into a column on narrow screens
   and let the map image scale fluidly. The single-column mobile
   layout in the spec ("Map collapses to single column with sticky
   bottom nav") is handled by the existing @media (max-width: 720px)
   in the main stylesheet; this block only refines premium surfaces. */
@media (max-width: 720px) {
  body.buyer-page[data-cleardeed-theme="premium"] [data-premium-frame="map"] {
    border-radius: 8px;
  }
  body.buyer-page[data-cleardeed-theme="premium"] .map-card-layer-toggle {
    top: 8px;
    right: 8px;
    font-size: 10px;
  }
  body.buyer-page[data-cleardeed-theme="premium"] .map-card-cta {
    display: block;
    text-align: center;
    margin-top: 8px;
  }
}

/* Reduced-motion — collapse premium transitions to instant.
   Phases 3+ will add more transitions; this rule is the early
   opt-out hook. */
@media (prefers-reduced-motion: reduce) {
  body.buyer-page[data-cleardeed-theme="premium"] *,
  body.buyer-page[data-cleardeed-theme="premium"] *::before,
  body.buyer-page[data-cleardeed-theme="premium"] *::after {
    transition-duration: 0ms !important;
    animation-duration: 0ms !important;
  }
}`;
}

/**
 * Body attribute object for the premium theme. When premium is not
 * requested, returns null so the body tag renders without the
 * data-attribute (load-bearing compatibility contract).
 */
export function getThemeAttribute(
  opts: ThemeOptions = {}
): Record<string, string> | null {
  if (opts.premium !== true) return null;
  return { "data-cleardeed-theme": "premium" };
}

/**
 * Pure-function variant resolver. Returns the variant name for the
 * given options. Useful for tests and for code that branches on the
 * active variant.
 */
export function resolveVariant(
  opts: ThemeOptions = {}
): "classic" | "premium" {
  return opts.premium === true ? "premium" : "classic";
}

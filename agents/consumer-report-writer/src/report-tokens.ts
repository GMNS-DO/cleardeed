/**
 * ClearDeed — report-tokens.ts (light brand palette, PI-0 T9).
 *
 * This is the single source of truth for the ClearDeed visual brand as
 * it applies to the consumer-facing Layer 1 report. It centralises the
 * values that were previously hard-coded across:
 *
 *  - `apps/web/src/app/report/[id]/ReportShell.tsx` and friends (T5)
 *  - `apps/web/src/app/report/[id]/components/*.tsx` (T6-T7)
 *  - The consumer-report-writer's inline `<style>` block (legacy HTML path)
 *
 * Migrating from `theme.ts`'s dark-mode premium palette:
 *  - `theme.ts` is left untouched (it backs the premium/dark-mode surface
 *    and its tests must keep passing). It is the *dark* brand token file.
 *  - `report-tokens.ts` is the *light* brand token file and is what the
 *    new React component tree consumes.
 *
 * Why a separate file instead of folding into theme.ts:
 *  - The consumer-report-writer agent has its own publish/version cadence;
 *    we don't want its existing CSS bridge behavior regressing.
 *  - The report shell lives in the web app. Decoupling lets us ship one
 *    without coordinating with the other.
 *
 * Palette (per REPORT-SHELL-REDESIGN-PI.md §"Lock token palette"):
 *  - Background:  #f7f7f2
 *  - Brand:       #163d33  (dark green — headers, active states, heavy use)
 *  - Brand hover: #1d6f5b  (lighter green — hover, interactive)
 *  - Action:      #d4a017  (gold — primary CTAs, active tab)
 *  - Ink body:    #17231d  (near-black green-tinted — headings, body)
 *  - Ink muted:   #5b665f  (secondary text, captions)
 *  - Border:      #d9ddd4  (dividers, card outlines)
 *
 * Consumers:
 *  - Web Layer 1: import `REPORT_TOKENS` and use its values as Tailwind
 *    arbitrary-value tokens (`bg-[var(--cd-bg)]`, etc.) or directly.
 *  - Consumer-report-writer Layer 1: call `getReportBodyCss()` to inject
 *    a `<style>` block matching the same palette so the HTML fallback path
 *    looks identical.
 */

// ── Token map ──────────────────────────────────────────────────────────────────
// Each key is a CSS custom property name that the report shell and the
// agent HTML both use. Values are hex strings; consumers can write them
// inline, use arbitrary-value Tailwind, or emit a <style> block.
export interface ReportTokenMap {
  /** Page background */
  bg: string;
  /** Card / elevated surface */
  surface: string;
  /** Primary brand colour (headers, active states, heavy use) */
  brand: string;
  /** Brand hover / secondary brand */
  brandHover: string;
  /** Primary action colour (CTA buttons, active tab) */
  action: string;
  /** Primary body text (headings, body) */
  ink: string;
  /** Secondary text (captions, status) */
  inkMuted: string;
  /** Dividers and card outlines */
  border: string;
  /** Verdict — red flag */
  verdictRed: string;
  /** Verdict — watchout / amber */
  verdictAmber: string;
  /** Verdict — clear / green */
  verdictGreen: string;
  /** Verdict — info / blue */
  verdictBlue: string;
  /** "Verified-clear" badge background */
  clearBg: string;
  /** "Verified-clear" badge text */
  clearInk: string;
  /** Red-flag watchout background */
  redFlagBg: string;
  /** Red-flag watchout text */
  redFlagInk: string;
}

export const REPORT_TOKENS: ReportTokenMap = {
  bg: "#f7f7f2",
  surface: "#ffffff",
  brand: "#163d33",
  brandHover: "#1d6f5b",
  action: "#d4a017",
  ink: "#17231d",
  inkMuted: "#5b665f",
  border: "#d9ddd4",
  verdictRed: "#be123c",
  verdictAmber: "#b45309",
  verdictGreen: "#166534",
  verdictBlue: "#1d4ed8",
  clearBg: "#ecfdf5",
  clearInk: "#064e3b",
  redFlagBg: "#fff1f2",
  redFlagInk: "#9f1239",
};

// ── CSS output ─────────────────────────────────────────────────────────────────
// Generates a `<style>` block that maps the token map onto `--cd-*`
// CSS custom properties. The web app and the agent both scope these
// properties under `[data-cleardeed-theme="light"]` on the report root,
// so a page can load both palettes without collision.

export function getLightThemeCss(): string {
  const t = REPORT_TOKENS;
  return `[data-cleardeed-theme="light"] {
    --cd-bg:            ${t.bg};
    --cd-surface:       ${t.surface};
    --cd-brand:         ${t.brand};
    --cd-brand-hover:   ${t.brandHover};
    --cd-action:        ${t.action};
    --cd-ink:           ${t.ink};
    --cd-ink-muted:     ${t.inkMuted};
    --cd-border:        ${t.border};
    --cd-verdict-red:   ${t.verdictRed};
    --cd-verdict-amber: ${t.verdictAmber};
    --cd-verdict-green: ${t.verdictGreen};
    --cd-verdict-blue:  ${t.verdictBlue};
    --cd-clear-bg:      ${t.clearBg};
    --cd-clear-ink:     ${t.clearInk};
    --cd-redflag-bg:    ${t.redFlagBg};
    --cd-redflag-ink:   ${t.redFlagInk};
  }`;
}

/**
 * Legacy bridge: re-map the dark-mode premium tokens (--paper, --ink, etc.)
 * onto the new light --cd-* keys so the existing 900-line CSS in
 * buildBuyerPage picks up the light palette automatically when the report
 * is rendered in Layer 1 with the "light" attribute.
 *
 * Classic (no-premium) mode in the agent returns ""; Layer 1 from the
 * web app doesn't go through this path.
 */
export function getLightThemeBridge(): string {
  const t = REPORT_TOKENS;
  return `[data-cleardeed-theme="light"] {
    --paper:      ${t.surface};
    --paper-elev: ${t.surface};
    --ink:        ${t.ink};
    --ink-2:      ${t.inkMuted};
    --ink-3:      ${t.border};
    --ink-4:      ${t.inkMuted};
    --border:     ${t.border};
    --border-bold:${t.border};
    --accent:     ${t.brand};
    --accent-2:   ${t.brandHover};
    --good:       ${t.verdictGreen};
    --good-soft:  ${t.clearBg};
    --watch:      ${t.verdictAmber};
    --watch-soft: #fffbeb;
    --bad:        ${t.verdictRed};
    --bad-soft:   ${t.redFlagBg};
    --info:       ${t.verdictBlue};
    --info-soft:  #eff6ff;
  }`;
}

/**
 * Returns a complete <style> block that emits both the --cd-* custom
 * properties and the legacy bridge for the light palette. For the web
 * Layer 1, the shell component inlines this directly.
 *
 * For the agent HTML fallback, `generateBuyerLayerReport` injects this
 * into the `<head>` of the rendered document so the HTML path looks
 * identical to the React component tree.
 */
export function getReportBodyCss(): string {
  const lines: string[] = [];
  const tokenCss = getLightThemeCss();
  if (tokenCss) lines.push(tokenCss);
  const bridgeCss = getLightThemeBridge();
  if (bridgeCss) lines.push(bridgeCss);
  return lines.length ? `<style>${lines.join("\n")}</style>` : "";
}

/**
 * Returns the data attribute to apply to the report's root element
 * so the light palette activates. Defaults to `data-cleardeed-theme="light"`.
 */
export function getReportThemeAttribute(): Record<string, string> | null {
  return { "data-cleardeed-theme": "light" };
}
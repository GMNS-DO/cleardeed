/**
 * ReportShell — Phase 1 of the premium report redesign.
 *
 * Wraps the existing buyer-page body markup in a semantic shell so
 * later phases (Phase 3+ section restructure, Phase 4 PDF dossier)
 * can re-skin the page without re-architecting the 1500-line render
 * pipeline in index.ts.
 *
 * What the shell adds (active mode):
 *   1. A skip-link as the first focusable element (a11y)
 *   2. A <main id="main-content"> wrapping the body markup
 *
 * What the shell does NOT do (intentional):
 *   - It does not re-style anything. The existing CSS in ctx.css still
 *     drives every visual rule today. Phase 3 will add dark-theme
 *     rules that target [data-cleardeed-shell] selectors.
 *   - It does not change any existing class names. The body still
 *     carries class="buyer-page" — the shell sits ON TOP of the
 *     existing structure, not in place of it.
 *   - It does not add the dark theme itself. The dark theme is the
 *     responsibility of theme.ts (already shipped) and Phase 1+ CSS.
 *
 * Compatibility:
 *   - Passthrough mode (default, no opts): the body string is
 *     returned unchanged. Existing classic reports render
 *     byte-for-byte identical to pre-Phase-1.
 *   - Active mode: the body is wrapped, a skip-link is prepended.
 *     Existing class names and structure inside the body are
 *     preserved verbatim.
 *
 * The shell is intentionally string-based (not a React component) so
 * the rest of the pipeline (buildBuyerPage → wrapBuyerPageDocument)
 * stays a single self-contained HTML string. That is what makes the
 * rendered output easy to feed into the PDF dossier pipeline later
 * (Phase 4).
 */

export interface ReportShellOptions {
  /**
   * When true, wrap body in <main> and prepend a skip-link.
   * Default: false (passthrough — no behavior change).
   */
  shell?: boolean;
}

/**
 * The skip-link's visible-on-focus CSS rule is intentionally NOT
 * inlined here today. It will be added in the same Phase 1+ commit
 * that introduces the dark-theme stylesheet. The class name "skip-link"
 * is the stable contract; the CSS that targets it is owned by the
 * theme/stylesheet layer, not this string-template helper.
 */
const SKIP_LINK_TEXT = "Skip to main content";
const SKIP_LINK_TARGET = "#main-content";

/**
 * Build the skip-link anchor string. Returns a self-contained <a>
 * element that is the first focusable element in the document.
 * When focused, the user is taken to the <main id="main-content">
 * region. The visible-on-focus reveal is a CSS-layer concern; the
 * markup is stable.
 */
export function buildSkipLink(): string {
  return `<a class="skip-link" href="${SKIP_LINK_TARGET}">${SKIP_LINK_TEXT}</a>`;
}

/**
 * Wrap the body markup in a ReportShell.
 *
 * @param body  The existing buyer-page body HTML. The shell does not
 *              modify this string; it is wrapped verbatim inside <main>.
 * @param opts  When shell: true, prepend a skip-link and wrap in
 *              <main id="main-content">. Default: passthrough.
 * @returns     The wrapped HTML, or the original body if shell is
 *              not enabled.
 */
export function renderReportShell(
  body: string,
  opts: ReportShellOptions = {}
): string {
  if (opts.shell !== true) return body;
  return `${buildSkipLink()}\n<main id="main-content">\n${body}\n</main>`;
}

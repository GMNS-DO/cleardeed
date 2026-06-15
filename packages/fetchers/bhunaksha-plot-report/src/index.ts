/**
 * Bhunaksha Plot Report fetcher.
 *
 * Fetches the per-plot report at plotreportOR.jsp. This is a sibling document
 * to the Bhulekh ROR — both are published from the same underlying revenue
 * record, but as separate runs. Where they agree, confidence is high. Where
 * they disagree, the ROR wins, and the buyer should verify at the Tehsil.
 *
 * Architecture (per bhulekh_bhunaksha_guide.md §3.2 + §3.3):
 *   1. Build the giscode from the lookup table (state/sub/district/tehsil/RI/mouza).
 *   2. GET plotreportOR.jsp?state=21&giscode=...&plotno=... — pure HTTP, no login.
 *   3. The page is a JavaScript loader; the actual report renders client-side
 *      via AJAX POST to ../rest/ReportsOR/PlotReport. We use Playwright to
 *      execute the loader and capture the rendered DOM.
 *   4. Parse the rendered DOM using position-based cell matching — every
 *      text field is in an absolutely-positioned <div>, so we match labels
 *      to values by spatial proximity (same row, to the right).
 *   5. Screenshot the cadastral map <img> as a base64 PNG.
 */

import { BhunakshaPlotReportResult } from "@cleardeed/schema";
import { createHash } from "node:crypto";
import { findGisCode, buildGisCodeCandidates } from "./gis-codes";

const BHUNAKSHA_BASE = "https://app3bhunakshaodisha.nic.in";
const PLOT_REPORT_PATH = "/bhunaksha/21/plotreportOR.jsp";
const PARSER_VERSION = "bhunaksha-plot-report-v2";
const HTTP_TIMEOUT_MS = 15_000;
const SCREENSHOT_TIMEOUT_MS = 20_000;

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 ClearDeed/1.0";

export interface BhunakshaPlotReportInput {
  village: string;
  tahasil: string;
  plotNo: string;
  /**
   * Override the giscode lookup with explicit parts. Used when the village
   * is not in the lookup table or the lookup is unverified.
   */
  gisCodeOverride?: {
    districtCode: string;
    tehsilCode: string;
    riCode: string;
    mouzaCode: string;
  };
  /**
   * Skip the Playwright screenshot step. Use in tests or when chromium is
   * unavailable; the fetcher still returns parsed text fields.
   */
  skipScreenshot?: boolean;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function emptyResult(
  status: "failed" | "partial",
  reason: string,
  fetchedAt: string
): BhunakshaPlotReportResult {
  return {
    source: "bhunaksha_plot_report",
    status,
    fetchedAt,
    verification: "manual_required",
    statusReason: reason,
    parserVersion: PARSER_VERSION,
    data: {
      plotNo: "",
    },
  };
}

/**
 * Build the plotreportOR.jsp URL for a given giscode + plotNo.
 */
function buildPlotReportUrl(giscode: string, plotNo: string): string {
  const params = new URLSearchParams({
    state: "21",
    giscode,
    plotno: plotNo,
  });
  return `${BHUNAKSHA_BASE}${PLOT_REPORT_PATH}?${params.toString()}`;
}

/**
 * Pull the first capture group from a regex; returns null if no match.
 */
function firstMatch(re: RegExp, haystack: string): string | null {
  const m = re.exec(haystack);
  return m && m[1] ? m[1].trim() : null;
}

/**
 * A single positioned cell from the rendered plot report.
 */
interface PositionedCell {
  left: number;
  top: number;
  width: number;
  height: number;
  text: string;
}

/**
 * Extract all absolutely-positioned text cells from the rendered Jasper
 * report HTML. The portal uses `position:absolute;left:Npx;top:Npx;...`
 * for every text field. Stripping nested tags yields the visible text.
 */
function extractPositionedCells(html: string): PositionedCell[] {
  const re = /<div\s+style="position:absolute;left:(\d+)px;top:(\d+)px;width:(\d+)px;height:(\d+)px;overflow:\s*hidden;"[^>]*>([\s\S]*?)<\/div>/g;
  const cells: PositionedCell[] = [];
  for (const m of html.matchAll(re)) {
    const text = m[5].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text) {
      cells.push({
        left: parseInt(m[1], 10),
        top: parseInt(m[2], 10),
        width: parseInt(m[3], 10),
        height: parseInt(m[4], 10),
        text,
      });
    }
  }
  return cells;
}

/**
 * Find the value cell that pairs with a label cell. Convention in this
 * portal: the value sits to the right of the label on the same row (same
 * `top`, within ±rowTolerance px), and its `left` is greater than the
 * label's `left`. Returns the cell with the smallest `left` difference
 * that satisfies these constraints.
 */
/**
 * Heuristic: a cell looks like a "value" (not a label) if it starts with
 * ":" or is a number, OR if it is significantly longer than the labels
 * in its row.
 */
function looksLikeValue(cell: PositionedCell): boolean {
  if (cell.text.startsWith(":")) return true;
  if (/^[\d.,\-\s]+$/.test(cell.text.trim())) return true;
  if (cell.text.length > 30) return true;
  return false;
}

function findValueAfterLabel(
  cells: PositionedCell[],
  labelLeft: number,
  labelTop: number,
  rowTolerance = 5
): PositionedCell | null {
  const candidates = cells.filter(
    (c) =>
      c.left > labelLeft &&
      Math.abs(c.top - labelTop) <= rowTolerance &&
      looksLikeValue(c)
  );
  if (!candidates.length) return null;
  return candidates.reduce((best, c) => {
    if (!best) return c;
    // Prefer the closest `top` first (same row), then the closest `left`.
    // The portal places labels and values on the same horizontal band,
    // so top distance matters more than left distance.
    const dTop = Math.abs(c.top - labelTop);
    const bestDTop = Math.abs(best.top - labelTop);
    if (dTop < bestDTop) return c;
    if (dTop === bestDTop) {
      const dLeft = c.left - labelLeft;
      const bestDLeft = best.left - labelLeft;
      if (dLeft < bestDLeft) return c;
    }
    return best;
  }, null as PositionedCell | null);
}

/**
 * Find a value cell near a given top, constrained to a left range. Used
 * for cells whose labels appear in awkward positions (e.g. the khatiyan
 * number sits in a separate sub-section with a different top).
 */
function findValueNearTop(
  cells: PositionedCell[],
  top: number,
  leftMin: number,
  leftMax: number,
  rowTolerance = 8
): PositionedCell | null {
  const candidates = cells.filter(
    (c) =>
      c.left >= leftMin &&
      c.left <= leftMax &&
      Math.abs(c.top - top) <= rowTolerance
  );
  if (!candidates.length) return null;
  return candidates.reduce((best, c) => {
    if (!best) return c;
    return Math.abs(c.top - top) < Math.abs(best.top - top) ? c : best;
  }, null as PositionedCell | null);
}

/**
 * Strip the leading ": " or " : " that the portal often prefixes to a
 * value cell. Returns the trimmed text or null if it becomes empty.
 */
function stripValuePrefix(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.replace(/^[\s:,]+/, "").trim();
  return trimmed.length ? trimmed : null;
}

/**
 * Extract a numeric value from a string. Returns null if no digits.
 */
function extractNumberFromText(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.\-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse the owner block — a single large cell containing the full owner
 * string in the form:
 *   NAME SW:FATHER CAST:CASTE ADDR:ADDRESS
 * The colon tokens are the separators (S/o, Caste, Address). Both Odia
 * and English forms are accepted.
 */
function parseOwnerBlock(raw: string | null): {
  name: string | null;
  father: string | null;
  caste: string | null;
  address: string | null;
} | null {
  if (!raw) return null;
  // Live Odia separators: SWA:, JAA:, BAA: (the portal uses these exact
  // glyphs). English fallbacks: S/o, Caste, Address, Father.
  const SEP_SO_RE = /ସ୍ଵା:|ସ୍ଵ:|S\/o|Father/i;
  const SEP_CASTE_RE = /ଜା:|Caste/i;
  const SEP_ADDR_RE = /ବା:|Address/i;

  // First cut: split on the S/o marker to get [name, rest].
  const soMatch = raw.split(SEP_SO_RE);
  const name = soMatch[0]?.trim() || null;
  const rest = soMatch[1]?.trim() || null;

  let father: string | null = null;
  let caste: string | null = null;
  let address: string | null = null;
  if (rest) {
    const casteParts = rest.split(SEP_CASTE_RE);
    father = casteParts[0]?.trim() || null;
    if (casteParts.length >= 2) {
      const addrParts = casteParts[1].split(SEP_ADDR_RE);
      caste = addrParts[0]?.trim() || null;
      if (addrParts.length >= 2) {
        address = addrParts[1]?.trim() || null;
      }
    }
  }
  return { name, father, caste, address };
}

/**
 * Parse the plot report HTML. The page is rendered in Odia script with
 * Latin numerics for IDs and area values. The live portal uses Jasper
 * Reports absolute positioning — every text field sits in its own
 * `<div style="position:absolute;left:Xpx;top:Ypx;...">`. We extract
 * all positioned cells, then match labels to values by spatial proximity
 * on the same horizontal band.
 *
 * Exported for unit testing.
 */
export function parsePlotReportHtml(
  html: string,
  plotNo: string
): NonNullable<BhunakshaPlotReportResult["data"]> {
  const cells = extractPositionedCells(html);

  function findLabel(
    startsWith: string,
    leftMin = 0,
    leftMax = 1000,
    topMin = 0,
    topMax = 1000
  ): PositionedCell | null {
    for (const c of cells) {
      if (
        c.text.startsWith(startsWith) &&
        c.left >= leftMin &&
        c.left <= leftMax &&
        c.top >= topMin &&
        c.top <= topMax
      ) {
        return c;
      }
    }
    return null;
  }

  // Plot No — label at L~43, value to the right on the same row
  const PLOT_LABEL_ODIA = "ନମ୍ବର ଅ:"; // ପ୍ଳଟ ନମ୍ବର
  const PLOT_LABEL_ODIA2 = "ପ୍ଲଟ ନମ୍ବର ଅ:"; // ପ୍ଲଟ ନମ୍ବର :
  const plotLabel = findLabel(PLOT_LABEL_ODIA2, 0, 200, 50, 200) ??
    findLabel(PLOT_LABEL_ODIA, 0, 200, 50, 200) ??
    findLabel("Plot No", 0, 200, 50, 200);
  const plotNoValue = plotLabel
    ? stripValuePrefix(findValueAfterLabel(cells, plotLabel.left, plotLabel.top)?.text ?? "")
    : null;

  // Khatiyan No — label at L~403, value is rendered in a separate
  // sub-section (different top) at L~500. The value is the only short
  // numeric cell to the right of the label, so find the nearest numeric
  // cell in the right half of the page regardless of row.
  const khatiyanLabel = cells.find((c) => c.text === "ଖତିୟାନ୍ ନମ୍ବର:" || c.text === "Khatiyan No" || c.text === "Khatiyan No.");
  let khatiyanNo: string | null = null;
  if (khatiyanLabel) {
    // The khatiyan value is a short integer in the right half of the page.
    // Find the closest cell to the label that is a short integer and lies
    // to the right.
    const candidates = cells.filter(
      (c) =>
        c.left > khatiyanLabel.left &&
        /^\d{1,5}$/.test(c.text.trim())
    );
    if (candidates.length) {
      const closest = candidates.reduce((best, c) => {
        if (!best) return c;
        const bestD = Math.hypot(c.left - khatiyanLabel.left, c.top - khatiyanLabel.top);
        const curD = Math.hypot(best.left - khatiyanLabel.left, best.top - khatiyanLabel.top);
        return bestD < curD ? c : best;
      }, null as PositionedCell | null);
      khatiyanNo = closest?.text.trim() ?? null;
    }
  }

  // Mouza — label at L~43, value to the right on the same row
  const MOUZA_LABEL = "ମୌଜା"; // ମୌଜା
  const mouzaLabel = findLabel(MOUZA_LABEL, 0, 200, 50, 200) ??
    findLabel("Mouza", 0, 200, 50, 200);
  const mouza = mouzaLabel
    ? stripValuePrefix(findValueAfterLabel(cells, mouzaLabel.left, mouzaLabel.top)?.text ?? "")
    : null;

  // Thana — exact-match the bare "ଥାନା" label (not "ଥାନା ନମ୍ବର")
  const THANA_LABEL = "ଥାନା"; // ଥାନା
  const thanaLabel = cells.find((c) => c.text === THANA_LABEL || c.text === "Thana");
  const thana = thanaLabel
    ? stripValuePrefix(findValueAfterLabel(cells, thanaLabel.left, thanaLabel.top)?.text ?? "")
    : null;

  // Thana No — exact-match "ଥାନା ନମ୍ବର" / "Thana No".
  // The value is a small integer. The portal jumbles row positions, so we
  // look in a wider band (~25px) and prefer cells that are pure digits.
  const thanaNoLabel = cells.find(
    (c) => c.text === "ଥାନା ନମ୍ବର" || c.text === "Thana No" || c.text === "Thana No."
  );
  let thanaNo: string | null = null;
  if (thanaNoLabel) {
    const candidates = cells
      .filter(
        (c) =>
          c.left > thanaNoLabel.left &&
          Math.abs(c.top - thanaNoLabel.top) <= 25
      )
      .filter((c) => /^\d+/.test(stripValuePrefix(c.text) ?? ""));
    if (candidates.length) {
      // Pick the closest top, then the closest left.
      const closest = candidates.reduce((best, c) => {
        if (!best) return c;
        const dTop = Math.abs(c.top - thanaNoLabel.top);
        const bestDTop = Math.abs(best.top - thanaNoLabel.top);
        if (dTop < bestDTop) return c;
        if (dTop === bestDTop && c.left < best.left) return c;
        return best;
      }, null as PositionedCell | null);
      thanaNo = stripValuePrefix(closest?.text ?? null);
    }
  }

  // Tehsil — exact-match "ତହସିଲ୍" / "ତହସିଲ"
  const TEHSIL_LABELS = ["ତହସିଲ୍", "ତହସିଲ"];
  const tehsilLabel = cells.find(
    (c) => TEHSIL_LABELS.includes(c.text) || c.text === "Tehsil" || c.text === "Tahasil"
  );
  const tehsil = tehsilLabel
    ? stripValuePrefix(findValueAfterLabel(cells, tehsilLabel.left, tehsilLabel.top)?.text ?? "")
    : null;

  // Tehsil No — not always present in the live render
  const TEHSIL_NO_LABELS = ["ତହସିଲ୍ ନମ୍ବର"];
  const tehsilNoLabel = cells.find(
    (c) => TEHSIL_NO_LABELS.includes(c.text) || c.text === "Tehsil No" || c.text === "Tehsil No."
  );
  const tehsilNo = tehsilNoLabel
    ? stripValuePrefix(findValueAfterLabel(cells, tehsilNoLabel.left, tehsilNoLabel.top)?.text ?? "")
    : null;

  // District — exact-match "ଜିଲ୍ଲା"
  const DISTRICT_LABEL = "ଜିଲ୍ଲା"; // ଜିଲ୍ଲା
  const districtLabel = cells.find(
    (c) => c.text === DISTRICT_LABEL || c.text === "District" || c.text === "Jilla"
  );
  const district = districtLabel
    ? stripValuePrefix(findValueAfterLabel(cells, districtLabel.left, districtLabel.top)?.text ?? "")
    : null;

  // Area — three columns: ଏକର୍ (acres), ଡିସିମିଲ (decimal), ହେକ୍ଟର (hectare).
  // Header at one top, value ~16-20px below at the same `left`.
  const ACRES_LABELS = ["ଏକର୍", "ଏ"]; // ଏକର୍, ଏ
  const DECIMAL_LABELS = ["ଡିସିମିଲ", "ଡି"]; // ଡିସିମିଲ, ଡି
  const HECTARE_LABELS = ["ହେକ୍ଟର", "ହେ"]; // ହେକ୍ଟର, ହେ
  const acresHeader = cells.find((c) => ACRES_LABELS.includes(c.text) || c.text === "Acres");
  const decimalHeader = cells.find((c) => DECIMAL_LABELS.includes(c.text) || c.text === "Decimal");
  const hectareHeader = cells.find((c) => HECTARE_LABELS.includes(c.text) || c.text === "Hectare");

  function areaValueAt(header: PositionedCell | undefined): number | null {
    if (!header) return null;
    const value = cells.find(
      (c) =>
        c.left === header.left &&
        c.top > header.top &&
        c.top - header.top <= 25
    );
    return extractNumberFromText(value?.text);
  }
  const acres = areaValueAt(acresHeader);
  const decimal = areaValueAt(decimalHeader);
  const hectare = areaValueAt(hectareHeader);

  // Owner block — a wide cell (>=300px) containing the SWA: (S/o) marker.
  // Live portal uses "ସ୍ୱା:" (swaa + colon). Older renders and English
  // forms use "S/o" or "Father".
  const SW_MARKERS = ["ସ୍ଵା:", "ସ୍ଵ:", "S/o", "Father"];
  const ownerCell = cells.find(
    (c) => c.width >= 300 && SW_MARKERS.some((m) => c.text.includes(m))
  );
  const owner = parseOwnerBlock(ownerCell?.text ?? null);

  // Map scale — "ସ୍କୌ" (scale) label; value is a short integer in the
  // same row, to the right (label is in the top-right corner of the page).
  const scaleLabel = cells.find((c) => c.text === "ସ୍କୌ" || c.text === "Scale");
  let mapScale: string | null = null;
  if (scaleLabel) {
    const valueCell = cells.find(
      (c) =>
        c.left > scaleLabel.left &&
        Math.abs(c.top - scaleLabel.top) <= 8 &&
        /^\d+/.test(c.text.trim())
    );
    if (valueCell) {
      mapScale = `1:${valueCell.text.trim()}`;
    }
  }

  return {
    plotNo: plotNoValue ?? plotNo,
    khatiyanNo: khatiyanNo || null,
    thana: thana || null,
    thanaNo: thanaNo || null,
    mouza: mouza || null,
    tehsil: tehsil || null,
    tehsilNo: tehsilNo || null,
    district: district || null,
    area: { acres, decimal, hectare },
    owner,
    mapImageBase64: null, // filled in by screenshot pass
    mapScale,
  };
}

/**
 * Resolve a giscode to try. Falls back to a perturb-and-try list if the
 * village is not in the lookup table or is unverified.
 */
function resolveGisCodes(
  input: BhunakshaPlotReportInput
): { giscode: string; candidates: string[]; verified: boolean } | null {
  if (input.gisCodeOverride) {
    const o = input.gisCodeOverride;
    return {
      giscode: o.districtCode + o.tehsilCode.padStart(2, "0") + o.riCode.padStart(2, "0") + o.mouzaCode.padStart(3, "0"),
      candidates: buildGisCodeCandidates(o.districtCode, o.tehsilCode, o.riCode, o.mouzaCode),
      verified: false,
    };
  }
  const lookup = findGisCode(input.village, input.tahasil);
  if (!lookup) return null;
  return {
    giscode: lookup.gisCode,
    candidates: [lookup.gisCode],
    verified: lookup.entry.verified,
  };
}

/**
 * Fetch the plot report HTML over HTTP. Tries each giscode candidate in turn.
 * This is a probe only — the actual data is rendered client-side via AJAX,
 * so we only need to confirm the page returns a 200 with a real loader.
 */
async function fetchPlotReportHtml(
  candidates: string[],
  plotNo: string
): Promise<{ html: string; giscode: string } | null> {
  for (const giscode of candidates) {
    const url = buildPlotReportUrl(giscode, plotNo);
    try {
      const res = await globalThis.fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9,or;q=0.8",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      if (!res.ok) continue;
      const html = await res.text();
      if (html.length < 1_000) continue;
      if (!html.includes(giscode)) continue;
      const plotParts = plotNo.split("/").map((p) => p.trim()).filter(Boolean);
      const allPartsPresent = plotParts.every((part) => html.includes(part));
      if (plotParts.length > 0 && !allPartsPresent) continue;
      return { html, giscode };
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Main entry: fetch + parse the Bhunaksha plot report for a single plot.
 *
 * Returns a BhunakshaPlotReportResult. Status is "success" when at least the
 * parsed text fields are available; the map screenshot is a bonus and its
 * presence or absence does not change the status.
 */
export async function bhunakshaPlotReportFetch(
  input: BhunakshaPlotReportInput
): Promise<BhunakshaPlotReportResult> {
  const fetchedAt = new Date().toISOString();
  const plotNo = input.plotNo.trim();
  if (!plotNo) {
    return emptyResult("failed", "missing_plot_no", fetchedAt);
  }
  if (!input.village || !input.tahasil) {
    return emptyResult("failed", "missing_village_or_tahasil", fetchedAt);
  }

  const resolved = resolveGisCodes(input);
  if (!resolved) {
    return {
      ...emptyResult(
        "failed",
        `giscode_not_in_lookup:${input.village}/${input.tahasil}`,
        fetchedAt
      ),
      data: { plotNo },
    };
  }

  return runOnceWithTimeout(
    async () => {
      const probe = await fetchPlotReportHtml(resolved.candidates, plotNo);
      if (!probe) {
        return {
          ...emptyResult(
            "failed",
            `http_probe_failed: tried ${resolved.candidates.length} giscode(s)`,
            fetchedAt
          ),
          data: { plotNo, gisCode: resolved.giscode },
        };
      }

      const sourceUrl = buildPlotReportUrl(probe.giscode, plotNo);
      const rendered = input.skipScreenshot
        ? { html: null, mapImageBase64: null as string | null }
        : await renderPlotReportInBrowser(sourceUrl, SCREENSHOT_TIMEOUT_MS);

      const htmlToParse = rendered.html ?? probe.html;
      const parsed = parsePlotReportHtml(htmlToParse, plotNo);

      const finalData = {
        ...parsed,
        mapImageBase64: rendered.mapImageBase64,
        gisCode: probe.giscode,
        sourceUrl,
      };
      const hasAnyField =
        Boolean(finalData.khatiyanNo) ||
        Boolean(finalData.owner?.name) ||
        finalData.area?.decimal != null ||
        Boolean(finalData.mapImageBase64);

      return {
        source: "bhunaksha_plot_report",
        status: hasAnyField ? "success" : "partial",
        fetchedAt,
        verification: hasAnyField ? "verified" : "manual_required",
        statusReason: hasAnyField
          ? resolved.verified
            ? "verified_lookup"
            : "unverified_lookup_but_parse_ok"
          : "no_parsed_fields",
        parserVersion: PARSER_VERSION,
        rawArtifactHash: sha256(htmlToParse),
        data: finalData,
      };
    },
    60_000
  ).catch((err: unknown): BhunakshaPlotReportResult => {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ...emptyResult("failed", `run_failed: ${message}`, fetchedAt),
      data: { plotNo, gisCode: resolved.giscode },
    };
  });
}

/**
 * Render the plot report page in a real browser, extract the rendered HTML
 * (includes the client-side AJAX data) and screenshot the cadastral map.
 */
async function renderPlotReportInBrowser(
  url: string,
  timeoutMs: number
): Promise<{
  html: string | null;
  mapImageBase64: string | null;
}> {
  let browser: import("playwright-core").Browser | null = null;
  try {
    const { chromium } = await import("playwright-core");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: USER_AGENT,
      viewport: { width: 1200, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: timeoutMs,
    });

    await page.waitForSelector("#htmlReport", { state: "attached", timeout: 10_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 });

    const html = await page.content();

    // The cadastral map image is the largest <img> on the page — a square
    // SVG/PNG (typically 300-400px) loaded from ../servlets/image. The portal
    // doesn't set a stable id, so we pick the largest image by area. The
    // image servlet requires the browser's session cookies, so we use
    // Playwright's request context (which shares the page's cookies).
    const mapImageBase64: string | null = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll("#htmlReport img"));
      if (!imgs.length) return null;
      const sized = imgs
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { src: el.getAttribute("src"), area: r.width * r.height, w: r.width, h: r.height };
        })
        .filter((x) => x.src && x.w >= 100 && x.h >= 100 && x.area > 0)
        .sort((a, b) => b.area - a.area);
      return sized[0]?.src ?? null;
    })
      .then(async (mapSrc: string | null) => {
        if (!mapSrc) return null;
        const absoluteUrl = new URL(mapSrc, url).toString();
        try {
          const resp = await page.request.get(absoluteUrl, {
            headers: { "User-Agent": USER_AGENT, Referer: url },
          });
          if (!resp.ok()) return null;
          const buf = await resp.body();
          if (buf.length === 0) return null;
          return buf.toString("base64");
        } catch {
          return null;
        }
      })
      .catch(() => null);

    return { html, mapImageBase64 };
  } catch (err) {
    return { html: null, mapImageBase64: null };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/**
 * Run an async fn once with a hard timeout. Returns the fn's result on
 * success, or throws on timeout. Mirrors the common one-shot retry shape
 * used by other fetchers in this codebase without depending on the
 * schema's runWithRetry (whose export we cannot reliably pull into a
 * top-level TypeScript entrypoint under tsx).
 */
async function runOnceWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout_after_${timeoutMs}ms`)), timeoutMs);
    fn().then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

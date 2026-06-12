/**
 * Section validator helpers — shared utilities for the 7 section tests.
 *
 * Responsibilities:
 *   - Load a ground-truth manifest from qa/ground_truth/<plot_id>/manifest.json
 *   - Load a fetcher_results.json from the same directory (V1 spec shape)
 *   - Load a pre-generated report HTML from qa/ground_truth/<plot_id>/report.html
 *   - Load and run the V1.1 pipeline to produce a fresh report HTML
 *   - Extract a section's HTML block by id (e.g. `#section-plot`)
 *   - Match a value or degradation tag inside a section block
 *
 * Tests should SKIP gracefully when no manifest + fetcher_results pair is
 * present (V1 hasn't been run yet) OR when a pre-generated report is not
 * available — that's the "no ground-truth yet" path.
 *
 * Tests should RUN when both manifest + fetcher_results are present, OR when a
 * pre-generated report.html exists. The V1 pipeline is not run from these
 * tests (it requires a live Bhulekh session). We test the report-generation
 * logic only via the report.html ground truth.
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// ─── Paths ──────────────────────────────────────────────────────────────────

const REPO_ROOT = resolve(__dirname, "..", "..");
const QA_DIR = join(REPO_ROOT, "qa");
const GROUND_TRUTH_DIR = join(QA_DIR, "ground_truth");
export const DEGRADATION_MATRIX_PATH = join(QA_DIR, "degradation_matrix.json");

/** All ground-truth plot directories, sorted by id. */
export function listGroundTruthPlots(): string[] {
  if (!existsSync(GROUND_TRUTH_DIR)) return [];
  return readdirSafe(GROUND_TRUTH_DIR)
    .filter((name) => name.startsWith("plot_"))
    .sort();
}

// ─── Existence checks ───────────────────────────────────────────────────────

export interface GroundTruthAssets {
  plotId: string;
  dir: string;
  manifestPath: string;
  manifestExists: boolean;
  fetcherResultsPath: string;
  fetcherResultsExists: boolean;
  reportPath: string;
  reportExists: boolean;
}

export function groundTruthAssets(plotId: string): GroundTruthAssets {
  const dir = join(GROUND_TRUTH_DIR, plotId);
  return {
    plotId,
    dir,
    manifestPath: join(dir, "manifest.json"),
    manifestExists: existsSync(join(dir, "manifest.json")),
    fetcherResultsPath: join(dir, "fetcher_results.json"),
    fetcherResultsExists: existsSync(join(dir, "fetcher_results.json")),
    reportPath: join(dir, "report.html"),
    reportExists: existsSync(join(dir, "report.html")),
  };
}

// ─── Loaders ────────────────────────────────────────────────────────────────

/** Manifest shape (from V1 spec). */
export interface GroundTruthManifest {
  plot_id: string;
  tehsil?: string;
  village?: string;
  plot_no?: string;
  expected_owner_name?: string;
  expected_khata_no?: string;
  expected_land_class?: string;
  expected_circle_rate_band?: "floor" | "directional" | "ceiling" | "outside_dataset";
  expected_regulatory_flags?: string[];
  expected_court_cases_count?: number;
  expected_bda_zone?: string;
  expected_section_larr_state?: "larr_not_wired" | "larr_wired_unknown" | "larr_elevated" | "larr_high" | "larr_low";
  notes?: string;
}

/** Fetcher results shape (per-fetcher raw output, V1 spec). */
export interface FetcherResults {
  bhulekh?: {
    status: string;
    data?: any;
  } | null;
  bhunaksha?: {
    status: string;
    data?: any;
  } | null;
  nominatim?: {
    status: string;
    data?: any;
  } | null;
  ecourts?: {
    status: string;
    data?: any;
  } | null;
  igr_ec?: {
    status: string;
    data?: any;
  } | null;
  cersai?: {
    status: string;
    data?: any;
  } | null;
  rccms?: {
    status: string;
    data?: any;
  } | null;
  circle_rate?: {
    status: string;
    data?: any;
  } | null;
  bda_zoning?: {
    status: string;
    data?: any;
  } | null;
  larr?: {
    status: string;
    data?: any;
  } | null;
}

export function loadManifest(plotId: string): GroundTruthManifest | null {
  const path = join(GROUND_TRUTH_DIR, plotId, "manifest.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as GroundTruthManifest;
  } catch {
    return null;
  }
}

export function loadFetcherResults(plotId: string): FetcherResults | null {
  const path = join(GROUND_TRUTH_DIR, plotId, "fetcher_results.json");
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as FetcherResults;
  } catch {
    return null;
  }
}

export function loadReportHtml(plotId: string): string | null {
  const path = join(GROUND_TRUTH_DIR, plotId, "report.html");
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

export function loadDegradationMatrix(): any {
  if (!existsSync(DEGRADATION_MATRIX_PATH)) {
    throw new Error(
      `Degradation matrix not found at ${DEGRADATION_MATRIX_PATH}. ` +
        "Run from the repo root."
    );
  }
  return JSON.parse(readFileSync(DEGRADATION_MATRIX_PATH, "utf-8"));
}

// ─── HTML extraction ────────────────────────────────────────────────────────

/**
 * Extract the HTML block for a section by its id (e.g. "section-plot").
 *
 * Looks for `<section ... id="<sectionId>" ...>...</section>` first, then
 * falls back to `<div ... id="<sectionId>" ...>...</div>` for panels like
 * `#section-summary` and `#section-financial`.
 *
 * Returns the inner HTML of the matched element. If the section is not
 * present, returns null.
 */
export function extractSection(html: string, sectionId: string): string | null {
  const tagPattern = `(?:section|div|aside|article)`;
  const openRe = new RegExp(
    `<${tagPattern}\\b[^>]*\\bid=["']${escapeRegex(sectionId)}["'][^>]*>`,
    "i"
  );
  const match = openRe.exec(html);
  if (!match) return null;
  const openTag = match[0];
  const startIndex = match.index + openTag.length;
  // Closing tag — find the matching `</section>` (or div/aside/article).
  // We assume the document is well-formed.
  const tagName = openTag.match(/^<(\w+)/i)?.[1]?.toLowerCase() ?? "section";
  // Track depth for nested same-tag elements (rare in our report, but safe).
  const closeRe = new RegExp(`</${tagName}\\s*>`, "gi");
  closeRe.lastIndex = startIndex;
  let depth = 1;
  let cursor = startIndex;
  while (depth > 0) {
    // Search for the next opening or closing tag with the same name.
    const openNext = findNextTag(html, tagName, cursor, true);
    const closeNext = closeRe.exec(html);
    if (!closeNext) break;
    if (openNext && openNext.index < closeNext.index) {
      depth += 1;
      cursor = openNext.index + openNext.match[0].length;
    } else {
      depth -= 1;
      cursor = closeNext.index + closeNext.match.length;
      if (depth === 0) {
        return html.slice(startIndex, closeNext.index);
      }
    }
  }
  return null;
}

function findNextTag(
  html: string,
  tag: string,
  start: number,
  opening: boolean
): RegExpExecArray | null {
  const re = new RegExp(`<${tag}\\b`, opening ? "gi" : "gi");
  re.lastIndex = start;
  return re.exec(html);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Value / degradation matching ──────────────────────────────────────────

/**
 * Check whether a value appears anywhere in the section HTML, or whether a
 * typed degradation tag is present.
 *
 * Pass the expected value (e.g. "Mendhasala", "415", "Irrigated") and an
 * optional list of accepted degradation tags (e.g. ["bhulekh_no_data"]).
 * Returns true if the section contains:
 *   (a) the expected value as a non-empty substring, OR
 *   (b) any of the degradation tags in any of the degradation-tag forms
 *
 * Degradation tags are matched as the literal string (e.g. "bhulekh_no_data")
 * OR as the human-readable degradation message (e.g. "Plot not found in this
 * village") drawn from the degradation matrix. This dual match is what the
 * section validators use to recognize "absent on purpose".
 */
export function valueOrDegradation(
  sectionHtml: string,
  expectedValue: string | null | undefined,
  degradationTags: string[] = [],
  matrixMessages: string[] = []
): boolean {
  if (expectedValue != null && String(expectedValue).trim() !== "") {
    if (sectionHtml.includes(String(expectedValue))) return true;
  }
  for (const tag of degradationTags) {
    if (sectionHtml.includes(tag)) return true;
  }
  for (const msg of matrixMessages) {
    if (msg && sectionHtml.includes(msg)) return true;
  }
  return false;
}

// ─── Skip reason ───────────────────────────────────────────────────────────

/** A common test-pattern helper: skip if ground-truth assets are not present. */
export function skipIfNoGroundTruth(
  assets: GroundTruthAssets,
  context: { plotId: string; needs?: Array<"manifest" | "fetcher_results" | "report"> }
): { skip: true; reason: string } | { skip: false } {
  const needs = context.needs ?? ["manifest", "fetcher_results", "report"];
  const missing: string[] = [];
  if (needs.includes("manifest") && !assets.manifestExists) missing.push("manifest.json");
  if (needs.includes("fetcher_results") && !assets.fetcherResultsExists) missing.push("fetcher_results.json");
  if (needs.includes("report") && !assets.reportExists) missing.push("report.html");
  if (missing.length > 0) {
    return {
      skip: true,
      reason: `[${context.plotId}] no ground-truth assets yet (missing: ${missing.join(", ")}). ` +
        "V1 ground truth not generated. Test will run when V1 produces the manifest + fetcher_results + report.html.",
    };
  }
  return { skip: false };
}

// ─── Read directory helper (no fs import in test files) ────────────────────

function readdirSafe(dir: string): string[] {
  try {
    // Node-only — tests run under vitest node env.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require("node:fs") as typeof import("node:fs");
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

// ─── Re-export for convenience ─────────────────────────────────────────────

export const __repoRoot = REPO_ROOT;
export const __qaDir = QA_DIR;
export const __groundTruthDir = GROUND_TRUTH_DIR;

// Avoid unused-var noise.
void pathToFileURL;

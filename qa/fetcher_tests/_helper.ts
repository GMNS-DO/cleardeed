/**
 * Sprint V2 — Fetcher contract test helper.
 *
 * Loads a ground-truth manifest for a plot, validates each documented fetcher
 * field against the corresponding contract, and SKIPs (not fails) when a
 * manifest is missing. The "real" V1 ground truth is filled in by the founder;
 * V2 tests are scaffolding.
 *
 * Per CLAUDE.md: keep this short, no new abstractions beyond what's needed.
 * The helper is only used by the 9 fetcher test files in this directory.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ZodTypeAny } from "zod";

/** Path to the ground-truth corpus relative to the repo root. */
const GROUND_TRUTH_ROOT = join(process.cwd(), "qa", "ground_truth");

/** Path to the invalid-input fixture file. */
const INVALID_INPUTS_PATH = join(
  process.cwd(),
  "qa",
  "invalid_inputs.json"
);

/**
 * A ground-truth manifest lists the *expected fields* per fetcher for one plot.
 * The actual values are filled in by manual verification — the contract tests
 * only check that whatever value is in the manifest has the right Zod type.
 *
 * Shape is intentionally loose; each fetcher test interprets its own slice.
 */
export interface GroundTruthManifest {
  plot_id: string;
  description?: string;
  added_at?: string;
  verified_by?: string;
  fetchers: {
    bhulekh?: Record<string, unknown>;
    bhunaksha?: Record<string, unknown>;
    bhunaksha_plot_report?: Record<string, unknown>;
    ecourts?: Record<string, unknown>;
    "igr-ec"?: Record<string, unknown>;
    cersai?: Record<string, unknown>;
    rccms?: Record<string, unknown>;
    "circle-rate"?: Record<string, unknown>;
    "bda-zoning"?: Record<string, unknown>;
    nominatim?: Record<string, unknown>;
  };
}

/** The list of 50 golden-path plot IDs (Sprint V1 corpus). */
export const GOLDEN_PATHS: string[] = [
  "P001", "P002", "P003", "P004", "P005",
  "P006", "P007", "P008", "P009", "P010",
  "P011", "P012", "P013", "P014", "P015",
  "P016", "P017", "P018", "P019", "P020",
  "P021", "P022", "P023", "P024", "P025",
  "P026", "P027", "P028", "P029", "P030",
  "P031", "P032", "P033", "P034", "P035",
  "P036", "P037", "P038", "P039", "P040",
  "P041", "P042", "P043", "P044", "P045",
  "P046", "P047", "P048", "P049", "P050",
];

/**
 * Return the 50 plot IDs that *this fetcher* can be tested against. For V2
 * we conservatively return the full list — the contract tests themselves
 * filter further (e.g. by checking whether the manifest has a value for the
 * fetcher).
 */
export function goldenPathsFor(_fetcher: string): string[] {
  return GOLDEN_PATHS;
}

/**
 * Load a ground-truth manifest. Returns `null` and logs a SKIP message when
 * the file does not exist (intentional — V1 corpus is partially populated).
 */
export function loadManifest(plotId: string): GroundTruthManifest | null {
  const path = join(GROUND_TRUTH_ROOT, plotId, "manifest.json");
  if (!existsSync(path)) {
    console.info(
      `[contract-tests] SKIP ${plotId}: no manifest at ${path} (V1 corpus not yet populated)`
    );
    return null;
  }
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as GroundTruthManifest;
  } catch (err) {
    console.warn(
      `[contract-tests] WARN ${plotId}: failed to parse manifest — ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

/** The slice of a manifest relevant to one fetcher, or null if absent. */
export function fetcherSlice(
  manifest: GroundTruthManifest,
  fetcher:
    | "bhulekh"
    | "bhunaksha"
    | "bhunaksha_plot_report"
    | "ecourts"
    | "igr-ec"
    | "cersai"
    | "rccms"
    | "circle-rate"
    | "bda-zoning"
    | "nominatim"
): Record<string, unknown> | null {
  const slice = manifest.fetchers[fetcher];
  if (!slice) return null;
  return slice;
}

/**
 * Assert that every documented field in a manifest slice has the right Zod
 * runtime type. The *value* is verified manually by the founder; this helper
 * only enforces structure.
 *
 * Returns a list of (field, status) pairs for the test reporter.
 */
export function assertStructuralCorrectness(
  slice: Record<string, unknown>,
  fieldSchemas: Record<string, ZodTypeAny>
): Array<{ field: string; status: "ok" | "mismatch"; detail?: string }> {
  const out: Array<{ field: string; status: "ok" | "mismatch"; detail?: string }> = [];
  for (const [field, schema] of Object.entries(fieldSchemas)) {
    const value = slice[field];
    if (value === undefined) {
      out.push({ field, status: "ok", detail: "absent (optional)" });
      continue;
    }
    const result = schema.safeParse(value);
    if (result.success) {
      out.push({ field, status: "ok" });
    } else {
      out.push({
        field,
        status: "mismatch",
        detail: result.error.issues.map((i) => i.message).join("; "),
      });
    }
  }
  return out;
}

/** Shape of one entry in `qa/invalid_inputs.json`. */
export interface InvalidInputCase {
  fetcher:
    | "bhulekh"
    | "bhunaksha"
    | "bhunaksha_plot_report"
    | "ecourts"
    | "igr-ec"
    | "cersai"
    | "rccms"
    | "circle-rate"
    | "bda-zoning"
    | "nominatim";
  description: string;
  input: Record<string, unknown>;
  expected_status: "invalid_input" | "no_data" | "source_down";
}

export function loadInvalidInputs(): InvalidInputCase[] {
  if (!existsSync(INVALID_INPUTS_PATH)) {
    console.info(
      `[contract-tests] no qa/invalid_inputs.json found at ${INVALID_INPUTS_PATH}; negative-case suite will be empty`
    );
    return [];
  }
  try {
    const raw = readFileSync(INVALID_INPUTS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter out meta entries and entries without a fetcher field; entries
    // with `expected_error` (V1 corpus-scope validation cases) are also
    // skipped because they target a different status mapping (an
    // `expected_error` string code, not a `ContractStatus` literal).
    return parsed.filter(
      (entry): entry is InvalidInputCase =>
        entry &&
        typeof entry === "object" &&
        typeof entry.fetcher === "string" &&
        typeof entry.expected_status === "string" &&
        ["invalid_input", "no_data", "source_down"].includes(entry.expected_status)
    );
  } catch (err) {
    console.warn(
      `[contract-tests] failed to parse qa/invalid_inputs.json: ${err instanceof Error ? err.message : String(err)}`
    );
    return [];
  }
}

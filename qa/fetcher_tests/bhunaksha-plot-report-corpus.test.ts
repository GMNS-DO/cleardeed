/**
 * Sprint V2 — Bhunaksha Plot Report corpus regression (typed contract envelope).
 *
 * The Plot Report fetcher is a sibling of the Bhunaksha WFS fetcher (D-036):
 * it hits `plotreportOR.jsp` directly (no captcha) and returns the rendered
 * per-plot report — text fields, owner block, three-column area, cadastral
 * map image (base64), and map scale.
 *
 * Per the 2026-06-14 plan:
 *  - The contract has a `mapBhunakshaPlotReportToContract` adapter.
 *  - This suite exercises both branches: `ok` (fields parsed) and
 *    `no_data` (no fields / giscode not in lookup table / portal returned
 *    nothing parsable).
 *  - The fetcher has its own 60s timeout (`runOnceWithTimeout`); the test
 *    passes `skipScreenshot: true` so the HTML-parse path runs without
 *    the Playwright screenshot step (shaves ~10s per call).
 *
 * CI slice: first 5 inputs. `RUN_FULL_CORPUS=1` for nightly.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { bhunakshaPlotReportFetch } from "@cleardeed/fetcher-bhunaksha-plot-report";

import {
  BhunakshaPlotReportContract,
  mapBhunakshaPlotReportToContract,
} from "../../apps/web/src/lib/pipeline/contracts/bhunaksha-plot-report";

// ── Corpus loading ────────────────────────────────────────────────────────

interface CorpusInput {
  tahasil: string;
  village: string;
  searchMode: string;
  identifier: string;
  coordinates?: { lat: number; lon: number };
  metadata?: {
    tahasilCode?: string;
    villageCode?: string;
    notDigitized?: boolean;
    patternCategory?: string;
  };
}

const CORPUS_PATH = join(process.cwd(), "qa", "khordha_inputs.json");
const CORPUS_LIMIT = process.env.RUN_FULL_CORPUS === "1"
  ? Number.POSITIVE_INFINITY
  : 5;

function loadCorpus(): CorpusInput[] {
  const raw = JSON.parse(readFileSync(CORPUS_PATH, "utf-8")) as { inputs: CorpusInput[] };
  return raw.inputs.slice(0, CORPUS_LIMIT);
}

const corpus = loadCorpus();

describe("Bhunaksha Plot Report — corpus regression (typed contract envelope)", () => {
  it("loads at least one corpus input", () => {
    expect(corpus.length).toBeGreaterThan(0);
  });

  for (const input of corpus) {
    it(`${input.tahasil} / ${input.village} / ${input.identifier} → typed envelope`, async () => {
      const fetchedAt = new Date().toISOString();

      // `skipScreenshot: true` so the test exercises the HTML-parse path
      // without the Playwright screenshot step (~10s per call).
      const result = await bhunakshaPlotReportFetch({
        village: input.village,
        tahasil: input.tahasil,
        plotNo: input.identifier,
        skipScreenshot: true,
      });

      expect(result.source).toBe("bhunaksha_plot_report");

      // Convert to typed contract envelope.
      const envelope = mapBhunakshaPlotReportToContract(result, fetchedAt);

      // Typed envelope: must pass Zod.
      const parsed = BhunakshaPlotReportContract.safeParse(envelope);
      if (!parsed.success) {
        console.error(
          `[${input.identifier}] Bhunaksha Plot Report envelope failed Zod:`,
          parsed.error.issues,
        );
      }
      expect(parsed.success).toBe(true);

      // Status sanity — the fetcher only emits success/partial/failed,
      // the adapter maps all three to ok/no_data/source_down/invalid_input
      // or parse_error.
      expect(["ok", "no_data", "source_down", "invalid_input", "parse_error"])
        .toContain(parsed.data.status);

      // Per-status structural invariants.
      if (parsed.data.status === "ok") {
        const d = parsed.data.data;
        // plotNo is always present
        expect(d.plotNo.length).toBeGreaterThan(0);
        // At least one of khatiyanNo / owner.name / area.decimal / mapImageBase64
        // must be non-empty — that's the "this is a real plot report" check.
        const hasAnyField =
          Boolean(d.khatiyanNo) ||
          Boolean(d.owner?.name) ||
          d.area?.decimal != null ||
          Boolean(d.mapImageBase64);
        expect(hasAnyField).toBe(true);
      } else {
        // Failure branch: must have a structured error with code + message.
        expect(parsed.data.error).toBeDefined();
        expect(parsed.data.error.code.length).toBeGreaterThan(0);
        expect(parsed.data.error.message.length).toBeGreaterThan(0);
      }
    }, 90_000);
  }
});

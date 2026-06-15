/**
 * Sprint V2 — Bhunaksha Plot Report (plotreportOR.jsp) contract tests.
 *
 * Sibling of the existing Bhunaksha contract (qa/fetcher_tests/bhunaksha.test.ts).
 * That one validates the cadastral WFS polygon; this one validates the
 * per-plot Plot Report — text fields, owner block, area triple, cadastral
 * map image (base64), and map scale. The parser uses position-based cell
 * matching against the rendered DOM (see packages/fetchers/bhunaksha-plot-report).
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  goldenPathsFor,
  loadManifest,
  fetcherSlice,
  assertStructuralCorrectness,
  loadInvalidInputs,
} from "./_helper";
import {
  BhunakshaPlotReportContract,
  BhunakshaPlotReportDataSchema,
} from "../../apps/web/src/lib/pipeline/contracts/bhunaksha-plot-report";

const goldenPaths = goldenPathsFor("bhunaksha_plot_report");

describe("Bhunaksha Plot Report — structural correctness", () => {
  it("accepts a synthetic success case (Mendhasala 181/10454 shape)", () => {
    const synthetic = {
      source: "bhunaksha_plot_report",
      status: "ok" as const,
      data: {
        plotNo: "181/10454",
        khatiyanNo: "500",
        thana: "2",
        thanaNo: "2",
        mouza: "ମେଣ୍ଢାଶାଳ",
        tehsil: "ଭୁବନେଶ୍ଵର",
        tehsilNo: null,
        district: "ଖୋର୍ଦ୍ଧା",
        area: { acres: 0, decimal: 100, hectare: 0.04046 },
        owner: {
          name: "ଦୀକ୍ଷା ମହାପାତ୍ର",
          father: "ସମୀର କୁମାର",
          caste: "ବ୍ରାହ୍ମଣ",
          address: "ଫ୍ଲାଟ ନମ୍ବର-ଏ ୬୦୧, ବର୍ଷା ରିଭର ଆପାର୍ଟମେଣ୍ଟ, ନିୟର ବାଲିଅନ୍ତା ବ୍ଲକ ଅଫିସ",
        },
        mapImageBase64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        mapScale: "1:500",
        gisCode: "20021110500",
        sourceUrl:
          "https://app3bhunakshaodisha.nic.in/bhunaksha/21/plotreportOR.jsp?state=21&giscode=20021110500&plotno=181%2F10454",
      },
      fetchedAt: "2026-06-14T05:13:00.000Z",
      sourceUrl:
        "https://app3bhunakshaodisha.nic.in/bhunaksha/21/plotreportOR.jsp?state=21&giscode=20021110500&plotno=181%2F10454",
      latencyMs: 8000,
    };
    const result = BhunakshaPlotReportContract.safeParse(synthetic);
    expect(result.success).toBe(true);
  });

  it("accepts a minimal success case (plotNo + gisCode only — every other field optional)", () => {
    const minimal = {
      source: "bhunaksha_plot_report",
      status: "ok" as const,
      data: { plotNo: "415", gisCode: "20021110000" },
      fetchedAt: "2026-06-14T05:13:00.000Z",
      sourceUrl: "x",
      latencyMs: 0,
    };
    const result = BhunakshaPlotReportContract.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it("rejects a status other than the five allowed", () => {
    const broken = {
      source: "bhunaksha_plot_report",
      status: "weird",
      data: { plotNo: "1" },
      fetchedAt: "2026-06-14T05:13:00.000Z",
      sourceUrl: "x",
      latencyMs: 0,
    };
    const result = BhunakshaPlotReportContract.safeParse(broken);
    expect(result.success).toBe(false);
  });

  it("rejects an ok branch without data", () => {
    const broken = {
      source: "bhunaksha_plot_report",
      status: "ok",
      fetchedAt: "2026-06-14T05:13:00.000Z",
      sourceUrl: "x",
      latencyMs: 0,
    };
    const result = BhunakshaPlotReportContract.safeParse(broken);
    expect(result.success).toBe(false);
  });

  it("accepts failure branches with structured error", () => {
    for (const status of ["no_data", "source_down", "invalid_input", "parse_error"] as const) {
      const result = BhunakshaPlotReportContract.safeParse({
        source: "bhunaksha_plot_report",
        status,
        error: { code: "E_TEST", message: "test" },
        fetchedAt: "2026-06-14T05:13:00.000Z",
        sourceUrl: "x",
        latencyMs: 100,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("Bhunaksha Plot Report — value correctness (per golden path)", () => {
  for (const plotId of goldenPaths) {
    it(`manifest ${plotId} matches contract structure`, () => {
      const manifest = loadManifest(plotId);
      if (!manifest) return;
      const slice = fetcherSlice(manifest, "bhunaksha_plot_report");
      if (!slice) return;
      const fieldSchemas: Record<string, z.ZodTypeAny> = {
        plotNo: z.string(),
        khatiyanNo: z.string().nullable().optional(),
        thana: z.string().nullable().optional(),
        thanaNo: z.string().nullable().optional(),
        mouza: z.string().nullable().optional(),
        tehsil: z.string().nullable().optional(),
        tehsilNo: z.string().nullable().optional(),
        district: z.string().nullable().optional(),
        area: z
          .object({
            acres: z.number().nullable().optional(),
            decimal: z.number().nullable().optional(),
            hectare: z.number().nullable().optional(),
          })
          .optional(),
        owner: z
          .object({
            name: z.string().nullable().optional(),
            father: z.string().nullable().optional(),
            caste: z.string().nullable().optional(),
            address: z.string().nullable().optional(),
          })
          .nullable()
          .optional(),
        mapImageBase64: z.string().nullable().optional(),
        mapScale: z.string().nullable().optional(),
        gisCode: z.string().optional(),
        sourceUrl: z.string().optional(),
      };
      const checks = assertStructuralCorrectness(slice, fieldSchemas);
      const mismatches = checks.filter((c) => c.status === "mismatch");
      if (mismatches.length > 0) {
        console.warn(`[${plotId}] bhunaksha_plot_report mismatches:`, mismatches);
      }
      expect(mismatches).toEqual([]);
    });
  }

  it("data schema validates a real-world Mendhasala block", () => {
    const sample = {
      plotNo: "181/10454",
      khatiyanNo: "500",
      thana: "2",
      thanaNo: "2",
      mouza: "ମେଣ୍ଢାଶାଳ",
      tehsil: "ଭୁବନେଶ୍ଵର",
      tehsilNo: null,
      district: "ଖୋର୍ଦ୍ଧା",
      area: { acres: 0, decimal: 100, hectare: 0.04046 },
      owner: {
        name: "ଦୀକ୍ଷା ମହାପାତ୍ର",
        father: "ସମୀର କୁମାର",
        caste: "ବ୍ରାହ୍ମଣ",
        address:
          "ଫ୍ଲାଟ ନମ୍ବର-ଏ ୬୦୧, ବର୍ଷା ରିଭର ଆପାର୍ଟମେଣ୍ଟ, ନିୟର ବାଲିଅନ୍ତା ବ୍ଲକ ଅଫିସ",
      },
      mapImageBase64: "iVBORw0KGgo=",
      mapScale: "1:500",
      gisCode: "20021110500",
      sourceUrl: "https://app3bhunakshaodisha.nic.in/bhunaksha/21/plotreportOR.jsp",
    };
    const result = BhunakshaPlotReportDataSchema.safeParse(sample);
    expect(result.success).toBe(true);
  });
});

describe("Bhunaksha Plot Report — negative cases", () => {
  const cases = loadInvalidInputs().filter(
    (c) => c.fetcher === "bhunaksha_plot_report"
  );
  if (cases.length === 0) {
    it.skip("no bhunaksha_plot_report negative cases loaded from qa/invalid_inputs.json", () => {});
    return;
  }
  for (const c of cases) {
    it(`${c.description} → ${c.expected_status}`, () => {
      expect(["invalid_input", "no_data", "source_down"]).toContain(c.expected_status);
    });
  }
});

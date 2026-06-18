/**
 * Tests for apps/web/src/lib/plot-diagram-storage.ts
 *
 * Phase 8 (Task 34). The Supabase Storage SDK is mocked via vi.mock so
 * we can verify the helper calls the right bucket/path with the right
 * content-type and upsert flag, and that it threads the public URL
 * back to the caller.
 *
 * The pure path-builder + URL-builder paths are tested without mocks.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  uploadMock: vi.fn(),
  getPublicUrlMock: vi.fn(),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  const mockClient = {
    storage: {
      from: (bucket: string) => {
        if (bucket !== "plot-diagrams") {
          throw new Error(`unexpected bucket: ${bucket}`);
        }
        return {
          upload: mocks.uploadMock,
          getPublicUrl: mocks.getPublicUrlMock,
        };
      },
    },
  };
  return {
    ...actual,
    getSupabaseServerClient: () => mockClient,
  };
});

import {
  buildPlotDiagramPath,
  storePlotDiagram,
  getPlotDiagramUrl,
  PLOT_DIAGRAMS_BUCKET,
} from "./plot-diagram-storage";

const SAMPLE_SVG =
  '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 480"><title>Plot 415</title></svg>';

describe("buildPlotDiagramPath", () => {
  it("builds the canonical path layout reports/{reportId}/plot-diagram-{key}.svg", () => {
    expect(buildPlotDiagramPath("rep_abc", "front")).toBe(
      "reports/rep_abc/plot-diagram-front.svg",
    );
    expect(buildPlotDiagramPath("rep_abc", "target")).toBe(
      "reports/rep_abc/plot-diagram-target.svg",
    );
  });

  it("throws when reportId is empty", () => {
    expect(() => buildPlotDiagramPath("", "front")).toThrow(/reportId/);
  });

  it("throws when plotDiagramKey is empty", () => {
    expect(() => buildPlotDiagramPath("rep_abc", "")).toThrow(/plotDiagramKey/);
  });
});

describe("PLOT_DIAGRAMS_BUCKET", () => {
  it("is the literal 'plot-diagrams'", () => {
    expect(PLOT_DIAGRAMS_BUCKET).toBe("plot-diagrams");
  });
});

describe("storePlotDiagram", () => {
  beforeEach(() => {
    mocks.uploadMock.mockReset();
    mocks.getPublicUrlMock.mockReset();
    mocks.getPublicUrlMock.mockReturnValue({
      data: {
        publicUrl:
          "https://abc.supabase.co/storage/v1/object/public/plot-diagrams/reports/rep_x/plot-diagram-front.svg",
      },
    });
  });

  it("uploads to the plot-diagrams bucket with the canonical path, SVG content-type, and upsert=true", async () => {
    mocks.uploadMock.mockResolvedValue({ data: { path: "reports/rep_abc/plot-diagram-front.svg" }, error: null });

    const result = await storePlotDiagram({
      reportId: "rep_abc",
      plotDiagramKey: "front",
      svg: SAMPLE_SVG,
    });

    expect(mocks.uploadMock).toHaveBeenCalledTimes(1);
    const [uploadPath, body, opts] = mocks.uploadMock.mock.calls[0];
    expect(uploadPath).toBe("reports/rep_abc/plot-diagram-front.svg");
    expect(body).toBe(SAMPLE_SVG);
    expect(opts).toEqual({
      contentType: "image/svg+xml",
      upsert: true,
    });
    expect(result).toEqual({
      url: "https://abc.supabase.co/storage/v1/object/public/plot-diagrams/reports/rep_x/plot-diagram-front.svg",
      path: "reports/rep_abc/plot-diagram-front.svg",
    });
  });

  it("threads the public URL from getPublicUrl back to the caller", async () => {
    const expectedUrl =
      "https://example.supabase.co/storage/v1/object/public/plot-diagrams/reports/rep_z/plot-diagram-target.svg";
    mocks.uploadMock.mockResolvedValue({ data: { path: "reports/rep_z/plot-diagram-target.svg" }, error: null });
    mocks.getPublicUrlMock.mockReturnValue({
      data: { publicUrl: expectedUrl },
    });

    const result = await storePlotDiagram({
      reportId: "rep_z",
      plotDiagramKey: "target",
      svg: SAMPLE_SVG,
    });

    expect(result.url).toBe(expectedUrl);
    expect(mocks.getPublicUrlMock).toHaveBeenCalledWith(
      "reports/rep_z/plot-diagram-target.svg",
    );
  });

  it("throws when the upload fails", async () => {
    mocks.uploadMock.mockResolvedValue({
      data: null,
      error: { message: "duplicate key" },
    });

    await expect(
      storePlotDiagram({
        reportId: "rep_abc",
        plotDiagramKey: "front",
        svg: SAMPLE_SVG,
      }),
    ).rejects.toThrow(/upload failed/);
  });
});

describe("getPlotDiagramUrl", () => {
  const ORIGINAL_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
  });

  it("returns null when reportId is empty", () => {
    expect(getPlotDiagramUrl("", "front")).toBeNull();
  });

  it("returns null when plotDiagramKey is empty", () => {
    expect(getPlotDiagramUrl("rep_abc", "")).toBeNull();
  });

  it("builds the canonical public URL for a valid (reportId, key) pair", () => {
    expect(getPlotDiagramUrl("rep_abc", "front")).toBe(
      "https://abc.supabase.co/storage/v1/object/public/plot-diagrams/reports/rep_abc/plot-diagram-front.svg",
    );
  });

  it("strips trailing slashes from NEXT_PUBLIC_SUPABASE_URL", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co///";
    expect(getPlotDiagramUrl("rep_abc", "front")).toBe(
      "https://abc.supabase.co/storage/v1/object/public/plot-diagrams/reports/rep_abc/plot-diagram-front.svg",
    );
  });

  it("throws when NEXT_PUBLIC_SUPABASE_URL is not set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    expect(() => getPlotDiagramUrl("rep_abc", "front")).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL/,
    );
    process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL_ENV;
  });
});
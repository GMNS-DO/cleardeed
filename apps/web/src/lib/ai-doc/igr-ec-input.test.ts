/**
 * Tests for the IGR EC → DocumentInput adapter.
 *
 * Most coverage is on renderIgrEcToHtml (pure function). The Supabase
 * branch is exercised via vi.mock on @/lib/db, so a single happy-path
 * test guards the wiring.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  getSupabaseServerClient: vi.fn(),
}));

import {
  renderIgrEcToHtml,
  fetchIgrEcInput,
} from "./igr-ec-input";
import { getSupabaseServerClient } from "@/lib/db";

describe("renderIgrEcToHtml", () => {
  it("renders the header block with district, SRO, and search period", () => {
    const html = renderIgrEcToHtml({
      district: "Khordha",
      sro: "Bhubaneswar",
      applicationNo: "APP-12345",
      searchPeriod: { from: "2020-01-01", to: "2025-06-17" },
    });
    expect(html).toContain("Khordha");
    expect(html).toContain("Bhubaneswar");
    expect(html).toContain("APP-12345");
    expect(html).toContain("2020-01-01 → 2025-06-17");
  });

  it("renders one <tr> per entry with all 8 columns", () => {
    const html = renderIgrEcToHtml({
      entries: [
        {
          docNo: "DOC-1",
          docType: "Sale Deed",
          executionDate: "2023-04-12",
          presentationDate: "2023-04-15",
          parties: [
            { name: "Rama Mohanty", role: "Vendor" },
            { name: "Hari Singh", role: "Vendee" },
          ],
          amount: "₹12,50,000",
          sro: "Bhubaneswar",
        },
      ],
    });
    expect(html).toContain("<tr>");
    expect(html).toContain("DOC-1");
    expect(html).toContain("Sale Deed");
    expect(html).toContain("Rama Mohanty (Vendor)");
    expect(html).toContain("Hari Singh (Vendee)");
    expect(html).toContain("₹12,50,000");
  });

  it("uses '—' for missing fields instead of undefined", () => {
    const html = renderIgrEcToHtml({ entries: [{}] });
    expect(html).not.toContain("undefined");
    expect(html).toContain("—");
  });

  it("renders the empty-state row when no entries are present", () => {
    const html = renderIgrEcToHtml({});
    expect(html).toContain("No entries recorded for the search period.");
  });

  it("escapes HTML in user-supplied strings to prevent injection", () => {
    const html = renderIgrEcToHtml({
      entries: [
        {
          docNo: "<script>alert(1)</script>",
          parties: [{ name: "Rama & Sons <Co>" }],
        },
      ],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Rama &amp; Sons &lt;Co&gt;");
  });

  it("falls back to consideration when amount is missing", () => {
    const html = renderIgrEcToHtml({
      entries: [{ consideration: "₹5,00,000" }],
    });
    expect(html).toContain("₹5,00,000");
  });

  it("falls back to district-level sro when entry-level sro is missing", () => {
    const html = renderIgrEcToHtml({
      sro: "Cutback",
      entries: [{ docNo: "DOC-2" }],
    });
    // Both the header and the entry row should reference the SRO.
    const occurrences = html.split("Cutback").length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});

describe("fetchIgrEcInput", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns null when no source_results row exists", async () => {
    (getSupabaseServerClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    });
    expect(await fetchIgrEcInput("CLD-X")).toBeNull();
  });

  it("returns null when the source status is not success", async () => {
    (getSupabaseServerClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  source_name: "igr-ec",
                  status: "captcha_wall",
                  parsed_data: null,
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });
    expect(await fetchIgrEcInput("CLD-X")).toBeNull();
  });

  it("returns a DocumentInput of kind 'html' on a successful source", async () => {
    (getSupabaseServerClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  source_name: "igr-ec",
                  status: "success",
                  parsed_data: {
                    district: "Khordha",
                    sro: "Bhubaneswar",
                    entries: [{ docNo: "DOC-1" }],
                  },
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });
    const result = await fetchIgrEcInput("CLD-X");
    expect(result?.kind).toBe("html");
    if (result?.kind === "html") {
      expect(result.content).toContain("Khordha");
      expect(result.content).toContain("DOC-1");
    }
  });

  it("returns null and warns when Supabase returns an error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    (getSupabaseServerClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: null,
                error: { message: "permission denied" },
              }),
            }),
          }),
        }),
      }),
    });
    expect(await fetchIgrEcInput("CLD-X")).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

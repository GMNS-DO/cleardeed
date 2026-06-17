/**
 * Tests for the Bhulekh back-page → DocumentInput adapter.
 *
 * Mirrors the IGR EC adapter test structure. renderBhulekhBackToHtml
 * is a pure function; fetchBhulekhBackInput is the Supabase-bound
 * loader exercised via vi.mock.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  getSupabaseServerClient: vi.fn(),
}));

import {
  renderBhulekhBackToHtml,
  fetchBhulekhBackInput,
} from "./bhulekh-back-input";
import { getSupabaseServerClient } from "@/lib/db";

describe("renderBhulekhBackToHtml", () => {
  it("renders the header block with district, tehsil, village, khata", () => {
    const html = renderBhulekhBackToHtml(
      {
        district: "Khordha",
        tehsil: "Bhubaneswar",
        village: "Balianta",
        khataNo: "K-123",
      },
      { fetchedAt: "2026-06-17T00:00:00.000Z" },
    );
    expect(html).toContain("Khordha");
    expect(html).toContain("Bhubaneswar");
    expect(html).toContain("Balianta");
    expect(html).toContain("K-123");
  });

  it("renders one mutation row per entry with all 7 columns", () => {
    const html = renderBhulekhBackToHtml(
      { khataNo: "K-1" },
      {
        mutationHistory: [
          {
            mutationNumber: "M-1",
            mutationDate: "2023-04-12",
            orderNumber: "ORD-9",
            fromKhatiyan: "K-1/old",
            toKhatiyan: "K-1/new",
            plotNo: "1234/5",
          },
        ],
      },
    );
    expect(html).toContain("<tr>");
    expect(html).toContain("M-1");
    expect(html).toContain("2023-04-12");
    expect(html).toContain("ORD-9");
    expect(html).toContain("K-1/old");
    expect(html).toContain("K-1/new");
    expect(html).toContain("1234/5");
    expect(html).toContain("Mutation history (1)");
  });

  it("renders one encumbrance row per entry with all 9 columns", () => {
    const html = renderBhulekhBackToHtml(
      {},
      {
        encumbranceEntries: [
          {
            type: "mortgage",
            partyName: "SBI",
            amount: "₹5,00,000",
            docNo: "DOC-22",
            date: "2020-08-15",
            period: "10 years",
            fromKhatiyan: "K-22",
            toKhatiyan: "K-22",
          },
        ],
      },
    );
    expect(html).toContain("mortgage");
    expect(html).toContain("SBI");
    expect(html).toContain("₹5,00,000");
    expect(html).toContain("DOC-22");
    expect(html).toContain("Encumbrance entries (1)");
  });

  it("renders remarks with category and raw text", () => {
    const html = renderBhulekhBackToHtml(
      {},
      {
        backPageRemarks: [
          { category: "court_case", rawText: "DR Case No. 14/2018" },
          { category: "bank_charge", rawText: "SBI charge 2020" },
        ],
      },
    );
    expect(html).toContain("court_case");
    expect(html).toContain("DR Case No. 14/2018");
    expect(html).toContain("bank_charge");
    expect(html).toContain("Back-page remarks (2)");
  });

  it("uses '—' for missing fields instead of 'undefined'", () => {
    const html = renderBhulekhBackToHtml({}, { mutationHistory: [{}] });
    expect(html).not.toContain("undefined");
    expect(html).toContain("—");
  });

  it("renders empty-state rows when sections are missing", () => {
    const html = renderBhulekhBackToHtml({}, {});
    expect(html).toContain("No mutation entries recorded.");
    expect(html).toContain("No encumbrance entries recorded.");
    expect(html).toContain("No remarks recorded.");
  });

  it("escapes HTML in user-supplied strings to prevent injection", () => {
    const html = renderBhulekhBackToHtml(
      { village: "<script>alert(1)</script>" },
      {
        backPageRemarks: [{ category: "other", rawText: "Plot & boundary <Co>" }],
      },
    );
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Plot &amp; boundary &lt;Co&gt;");
  });
});

describe("fetchBhulekhBackInput", () => {
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
    expect(await fetchBhulekhBackInput("CLD-X")).toBeNull();
  });

  it("returns null when source status is not success", async () => {
    (getSupabaseServerClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { source_name: "bhulekh", status: "captcha_wall", parsed_data: null },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });
    expect(await fetchBhulekhBackInput("CLD-X")).toBeNull();
  });

  it("returns null when backPage is null (front page only)", async () => {
    (getSupabaseServerClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  source_name: "bhulekh",
                  status: "success",
                  parsed_data: { backPage: null },
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });
    expect(await fetchBhulekhBackInput("CLD-X")).toBeNull();
  });

  it("returns null when backPage has no mutations/encumbrances/remarks", async () => {
    (getSupabaseServerClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  source_name: "bhulekh",
                  status: "success",
                  parsed_data: {
                    backPage: {
                      status: "success",
                      mutationHistory: [],
                      encumbranceEntries: [],
                      backPageRemarks: [],
                    },
                  },
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });
    expect(await fetchBhulekhBackInput("CLD-X")).toBeNull();
  });

  it("returns a DocumentInput of kind 'html' on a successful source with content", async () => {
    (getSupabaseServerClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  source_name: "bhulekh",
                  status: "success",
                  parsed_data: {
                    khataNo: "K-1",
                    district: "Khordha",
                    backPage: {
                      status: "success",
                      mutationHistory: [
                        { mutationNumber: "M-1", mutationDate: "2023-04-12" },
                      ],
                      encumbranceEntries: [],
                      backPageRemarks: [],
                    },
                  },
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });
    const result = await fetchBhulekhBackInput("CLD-X");
    expect(result?.kind).toBe("html");
    if (result?.kind === "html") {
      expect(result.content).toContain("Khordha");
      expect(result.content).toContain("M-1");
      expect(result.content).toContain("2023-04-12");
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
    expect(await fetchBhulekhBackInput("CLD-X")).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

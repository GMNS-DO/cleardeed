/**
 * Tests for the user-upload-input adapter.
 *
 * fetchUserUploadInput is the Supabase-bound loader; we exercise
 * all branches via vi.mock on supabaseAdmin.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  supabaseAdmin: vi.fn(),
}));

import { fetchUserUploadInput } from "./user-upload-input";
import { supabaseAdmin } from "@/lib/db";

type Row = { storage_path: string; mime_type: string; sha256: string } | null;

function makeClient(overrides: {
  row?: Row;
  rowError?: { message: string } | null;
  blob?: { arrayBuffer: () => Promise<ArrayBuffer> } | null;
  storageError?: { message: string } | null;
}) {
  const storage = {
    from: () => ({
      download: async () => ({
        data: overrides.blob ?? null,
        error: overrides.storageError ?? null,
      }),
    }),
  };
  return () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: overrides.row ?? null,
              error: overrides.rowError ?? null,
            }),
          }),
        }),
      }),
    }),
    storage,
  });
}

describe("fetchUserUploadInput", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns null when no upload row exists", async () => {
    (supabaseAdmin as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      makeClient({ row: null }),
    );
    expect(await fetchUserUploadInput("CLD-X", "user_upload_ec")).toBeNull();
  });

  it("returns null when the DB returns an error", async () => {
    (supabaseAdmin as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      makeClient({ row: null, rowError: { message: "permission denied" } }),
    );
    expect(await fetchUserUploadInput("CLD-X", "user_upload_ec")).toBeNull();
  });

  it("returns null when storage download fails", async () => {
    (supabaseAdmin as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      makeClient({
        row: {
          storage_path: "p/q/r.pdf",
          mime_type: "application/pdf",
          sha256: "abc",
        },
        blob: null,
        storageError: { message: "404" },
      }),
    );
    expect(await fetchUserUploadInput("CLD-X", "user_upload_ec")).toBeNull();
  });

  it("returns null for unsupported mime types", async () => {
    (supabaseAdmin as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      makeClient({
        row: {
          storage_path: "p/q/r.txt",
          mime_type: "text/plain",
          sha256: "abc",
        },
        blob: { arrayBuffer: async () => new ArrayBuffer(0) },
      }),
    );
    expect(await fetchUserUploadInput("CLD-X", "user_upload_ec")).toBeNull();
  });

  it("returns a pdfBase64 DocumentInput for an uploaded PDF", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.4 fake content").buffer;
    (supabaseAdmin as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      makeClient({
        row: {
          storage_path: "p/q/r.pdf",
          mime_type: "application/pdf",
          sha256: "abc",
        },
        blob: { arrayBuffer: async () => bytes },
      }),
    );
    const result = await fetchUserUploadInput("CLD-X", "user_upload_ec");
    expect(result?.kind).toBe("pdfBase64");
    if (result?.kind === "pdfBase64") {
      // base64 of "%PDF-1.4 fake content"
      const decoded = Buffer.from(result.content, "base64").toString("utf-8");
      expect(decoded).toBe("%PDF-1.4 fake content");
    }
  });

  it("returns a pngBase64 DocumentInput for an uploaded PNG", async () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer; // PNG magic
    (supabaseAdmin as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      makeClient({
        row: {
          storage_path: "p/q/r.png",
          mime_type: "image/png",
          sha256: "abc",
        },
        blob: { arrayBuffer: async () => bytes },
      }),
    );
    const result = await fetchUserUploadInput("CLD-X", "user_upload_ror");
    expect(result?.kind).toBe("pngBase64");
  });

  it("returns a pngBase64 DocumentInput for an uploaded JPEG (mime mapped)", async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff]).buffer; // JPEG magic
    (supabaseAdmin as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      makeClient({
        row: {
          storage_path: "p/q/r.jpg",
          mime_type: "image/jpeg",
          sha256: "abc",
        },
        blob: { arrayBuffer: async () => bytes },
      }),
    );
    const result = await fetchUserUploadInput(
      "CLD-X",
      "mutation_order_3g",
    );
    expect(result?.kind).toBe("pngBase64");
  });

  it("returns null when an unexpected exception is thrown", async () => {
    (supabaseAdmin as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => {
        throw new Error("boom");
      },
    );
    expect(await fetchUserUploadInput("CLD-X", "user_upload_ec")).toBeNull();
  });
});

/**
 * user-upload-input — adapter for user-uploaded EC / RoR / mutation-order
 * documents.
 *
 * Plan §3.1 V2: lets the user upload their own PDF/PNG and still get
 * an AI summary even if Bhulekh/IGR fetches failed.
 *
 * Three doc types share this adapter:
 *   - user_upload_ec        — uploaded EC PDF/PNG, Sonnet
 *   - user_upload_ror       — uploaded RoR PDF/PNG, Haiku
 *   - mutation_order_3g     — uploaded RoR with 3+ generations, Sonnet
 *
 * The adapter reads the bytes from Supabase Storage and returns a
 * DocumentInput (kind "pdfBase64" or "pngBase64") ready for the
 * interpreter to send to Claude.
 */

import { supabaseAdmin } from "@/lib/db";
import type { DocumentInput } from "@cleardeed/document-interpreter";

export type UserUploadDocType =
  | "user_upload_ec"
  | "user_upload_ror"
  | "mutation_order_3g";

const KIND_BY_MIME: Record<string, DocumentInput["kind"] | undefined> = {
  "application/pdf": "pdfBase64",
  "image/png": "pngBase64",
  "image/jpeg": "pngBase64",
};

/**
 * Read the most recent user upload for a (report, docType) and
 * return it as a DocumentInput. Returns null when no upload exists
 * (the user hasn't uploaded yet, or the upload was deleted).
 *
 * Returns null with a console.warn on storage / DB error so the
 * SSE route can fall back to a 404.
 */
export async function fetchUserUploadInput(
  reportId: string,
  docType: UserUploadDocType,
): Promise<DocumentInput | null> {
  try {
    const { data: row, error: dbError } = await supabaseAdmin()
      .from("user_uploads")
      .select("storage_path, mime_type, sha256")
      .eq("report_id", reportId)
      .eq("doc_type", docType)
      .maybeSingle();

    if (dbError) {
      console.warn("[/lib/ai-doc/user-upload-input] db error:", dbError);
      return null;
    }
    if (!row) return null;

    const { data: blob, error: storageError } = await supabaseAdmin()
      .storage
      .from("user-uploads")
      .download(row.storage_path);

    if (storageError || !blob) {
      console.warn("[/lib/ai-doc/user-upload-input] storage error:", storageError);
      return null;
    }

    const kind = KIND_BY_MIME[row.mime_type];
    if (!kind) {
      console.warn(
        `[/lib/ai-doc/user-upload-input] unsupported mime in row: ${row.mime_type}`,
      );
      return null;
    }

    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return { kind, content: base64 } as DocumentInput;
  } catch (err) {
    console.warn("[/lib/ai-doc/user-upload-input] unexpected error:", err);
    return null;
  }
}

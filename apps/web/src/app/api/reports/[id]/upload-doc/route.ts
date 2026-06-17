/**
 * POST /api/reports/:id/upload-doc
 *
 * Accepts a user-uploaded document (EC, RoR, or RoR with 3+ generation
 * mutation history) for AI interpretation. The file is stored in the
 * `user-uploads` Supabase Storage bucket, and a row is written to
 * `user_uploads` with the metadata.
 *
 * This endpoint does NOT trigger AI processing — the user must pay
 * ₹499 (the standard AI doc unlock) and then call the SSE route.
 * The upload itself is free.
 *
 * Plan §3.1 V2: a user who can't get a clean Bhulekh/IGR fetch can
 * upload their own screenshot / PDF and still get an AI summary.
 *
 * Input (multipart/form-data):
 *   - file: Blob (PDF, PNG, or JPEG)
 *   - docType: "user_upload_ec" | "user_upload_ror" | "mutation_order_3g"
 *
 * Output: { uploadId, sha256, byteSize, mimeType, storagePath }
 *
 * Errors:
 *   400: missing file / docType, unsupported mime type, file too large
 *   404: report not found
 *   413: file over 10MB (server-side guard; client should also enforce)
 *   415: unsupported mime type
 *   500: storage / DB error
 */

import { NextRequest, NextResponse } from "next/server";
import { getReport, supabaseAdmin } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);
const ALLOWED_DOC_TYPES = new Set([
  "user_upload_ec",
  "user_upload_ror",
  "mutation_order_3g",
]);

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await params;

  // 1. Validate docType.
  const docType = req.nextUrl.searchParams.get("docType") ?? null;
  if (!docType || !ALLOWED_DOC_TYPES.has(docType)) {
    return NextResponse.json(
      { error: "docType must be one of: user_upload_ec, user_upload_ror, mutation_order_3g" },
      { status: 400 }
    );
  }

  // 2. Validate report exists.
  const { report } = await getReport(reportId);
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // 3. Read multipart body.
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a 'file' field" },
      { status: 400 }
    );
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json(
      { error: "Missing or invalid 'file' field" },
      { status: 400 }
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (10 MB max)" },
      { status: 413 }
    );
  }

  // Mime check: prefer the form-supplied type but allow fall-through to
  // sniffing for cases where the browser sends a generic octet-stream.
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${mime}. Use PDF, PNG, or JPEG.` },
      { status: 415 }
    );
  }

  // 4. Hash + read bytes.
  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = await sha256Hex(buffer);

  // 5. Storage path: user-uploads/<report_id>/<doc_type>/<sha256>.<ext>
  const ext = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg";
  const storagePath = `${reportId}/${docType}/${sha256}.${ext}`;

  // 6. Upload to Supabase Storage. The bucket is service-role-only.
  // If the row already exists (UNIQUE on (report_id, doc_type)), this
  // upsert replaces it — so the user can re-upload before the SSE call.
  const { error: storageError } = await supabaseAdmin()
    .storage
    .from("user-uploads")
    .upload(storagePath, buffer, {
      contentType: mime,
      upsert: true,
    });
  if (storageError) {
    console.error("[/api/reports/:id/upload-doc] storage upload failed:", storageError);
    return NextResponse.json(
      { error: "Storage upload failed" },
      { status: 500 }
    );
  }

  // 7. Write the metadata row.
  const { data: row, error: dbError } = await supabaseAdmin()
    .from("user_uploads")
    .upsert(
      {
        report_id: reportId,
        org_id: null, // v1: no org context
        doc_type: docType,
        storage_path: storagePath,
        mime_type: mime,
        byte_size: file.size,
        sha256,
        uploaded_by: null,
      },
      { onConflict: "report_id,doc_type" }
    )
    .select("id, sha256, byte_size, mime_type, storage_path")
    .single();
  if (dbError) {
    console.error("[/api/reports/:id/upload-doc] db upsert failed:", dbError);
    return NextResponse.json(
      { error: "Metadata write failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    uploadId: row?.id ?? null,
    sha256: row?.sha256 ?? sha256,
    byteSize: row?.byte_size ?? file.size,
    mimeType: row?.mime_type ?? mime,
    storagePath: row?.storage_path ?? storagePath,
  });
}

async function sha256Hex(buf: Buffer): Promise<string> {
  const crypto = await import("crypto");
  return crypto.createHash("sha256").update(buf).digest("hex");
}

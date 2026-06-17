/**
 * GET /api/reports/:id/certified-copy?docType=igr_ec
 *
 * Returns a cryptographically-signed HTML certified copy of the
 * AI document interpretation. The file is downloadable and
 * self-contained (no external assets).
 *
 * The certified copy can be verified at /verify by re-deriving
 * the HMAC over (reportId, docType, hash).
 *
 * Auth: founder-only (ADMIN_VIEW_TOKEN). Anyone with the report
 * id + a valid token can download. The HMAC is the certification
 * surface — without the secret, no one can forge a valid copy.
 *
 * Plan §3.1 V2: legal contexts (loan applications, property
 * dispute filings) require a "certified" version. The HMAC
 * gives the user a verifiable artefact.
 */

import { NextRequest, NextResponse } from "next/server";
import { getReport, supabaseAdmin } from "@/lib/db";
import {
  buildCertifiedCopy,
  type CertifiedCopyInput,
} from "@/lib/ai-doc/certified-copy";
import { assertAdminToken } from "@/lib/admin-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DOC_TYPES = new Set([
  "igr_ec",
  "bhulekh_back",
  "user_upload_ec",
  "user_upload_ror",
  "mutation_order_3g",
]);

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Admin gate.
  if (!assertAdminToken(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: reportId } = await params;

  // 2. Validate docType.
  const docType = req.nextUrl.searchParams.get("docType") ?? "";
  if (!ALLOWED_DOC_TYPES.has(docType)) {
    return NextResponse.json(
      { error: "docType must be one of: igr_ec, bhulekh_back, user_upload_ec, user_upload_ror, mutation_order_3g" },
      { status: 400 }
    );
  }

  // 3. Look up the AI interpretation row.
  const { data, error } = await supabaseAdmin()
    .from("report_ai_interpretations")
    .select("fields, summary, model, cost_usd_cents, duration_ms, created_at")
    .eq("report_id", reportId)
    .eq("doc_type", docType)
    .maybeSingle();

  if (error) {
    console.error("[/api/reports/:id/certified-copy] db error:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: "No AI interpretation found for this report + docType" },
      { status: 404 }
    );
  }

  // 4. Build the certified copy.
  const fields = Array.isArray(data.fields) ? (data.fields as CertifiedCopyInput["fields"]) : [];
  const input: CertifiedCopyInput = {
    reportId,
    docType: docType as CertifiedCopyInput["docType"],
    fields,
    summary: typeof data.summary === "string" ? data.summary : "",
    generatedAt: data.created_at ?? new Date().toISOString(),
    model: data.model,
    costUsdCents: data.cost_usd_cents,
    durationMs: data.duration_ms,
  };
  const cc = buildCertifiedCopy(input);

  // 5. Return as HTML. The filename includes the report id + docType
  // + hash prefix so the user can identify the file later.
  const filename = `cleardeed-certified-${reportId}-${docType}-${cc.hash.slice(0, 8)}.html`;
  return new NextResponse(cc.html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Cert-Hash": cc.hash,
      "X-Cert-Signature": cc.signature,
    },
  });
}

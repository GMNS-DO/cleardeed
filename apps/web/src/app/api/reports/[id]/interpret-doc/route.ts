/**
 * GET /api/reports/:id/interpret-doc?docType=igr_ec
 *
 * Server-Sent Events stream that emits AI-generated field interpretations
 * for the document. Plan §3.1 V1: igr_ec only. V1.5 adds bhulekh_back.
 *
 * Wire protocol (SSE):
 *  - event: "field"   data: { field: {...FieldExtraction} }
 *  - event: "done"    data: { summary?: string, fields: FieldExtraction[], costUsdCents, warnings }
 *  - event: "error"   data: { message: string }
 *
 * The stream also emits a 0-byte heartbeat every 5s to keep proxies
 * (Vercel, Cloudflare) from timing out the connection.
 */

import { NextRequest, NextResponse } from "next/server";
import { getReport } from "@/lib/db";
import {
  interpretDocumentWithDeps,
  makeDefaultClient,
} from "@cleardeed/document-interpreter";
import { fetchIgrEcInput } from "@/lib/ai-doc/igr-ec-input";
import { fetchBhulekhBackInput } from "@/lib/ai-doc/bhulekh-back-input";
import { fetchUserUploadInput } from "@/lib/ai-doc/user-upload-input";
import { makeSupabaseCostStore } from "@/lib/ai-doc/cost-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 5_000;
const SUPPORTED_DOC_TYPES = new Set([
  "igr_ec",
  "bhulekh_back",
  "user_upload_ec",
  "user_upload_ror",
  "mutation_order_3g",
]);

type DocType = "igr_ec" | "bhulekh_back" | "user_upload_ec" | "user_upload_ror" | "mutation_order_3g";

async function fetchInputForDocType(
  docType: DocType,
  reportId: string,
): Promise<Awaited<ReturnType<typeof fetchIgrEcInput>> | null> {
  switch (docType) {
    case "igr_ec":
      return fetchIgrEcInput(reportId);
    case "bhulekh_back":
      return fetchBhulekhBackInput(reportId);
    case "user_upload_ec":
    case "user_upload_ror":
    case "mutation_order_3g":
      return fetchUserUploadInput(reportId, docType);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: reportId } = await params;
  const docType = req.nextUrl.searchParams.get("docType");
  if (!docType || !SUPPORTED_DOC_TYPES.has(docType)) {
    return NextResponse.json(
      { error: "docType must be one of: igr_ec, bhulekh_back" },
      { status: 400 }
    );
  }

  // V1.5: both doc types are live. igr_ec uses Sonnet; bhulekh_back uses
  // Haiku (selected by modelForDocType in cost-tracker.ts).
  const typedDocType = docType as DocType;

  const reportResult = await getReport(reportId);
  if (!reportResult.report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const input = await fetchInputForDocType(typedDocType, reportId);
  if (!input) {
    return NextResponse.json(
      { error: "Document not available for this report" },
      { status: 404 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(":heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, HEARTBEAT_MS);

      try {
        const result = await interpretDocumentWithDeps(
          {
            reportId,
            orgId: null,
            docType: typedDocType,
            input,
          },
          {
            client: makeDefaultClient(),
            costStore: makeSupabaseCostStore(),
          },
          Date.now()
        );

        // Emit per-field events.
        for (const f of result.fields) {
          controller.enqueue(
            encoder.encode(
              `event: field\ndata: ${JSON.stringify(f)}\n\n`
            )
          );
        }

        // Emit done event with summary + meta.
        controller.enqueue(
          encoder.encode(
            `event: done\ndata: ${JSON.stringify({
              fields: result.fields,
              warnings: result.warnings,
              costUsdCents: result.costUsdCents,
              model: result.model,
              durationMs: result.durationMs,
              cacheHit: result.cacheHit,
            })}\n\n`
          )
        );

        controller.close();
      } catch (err: any) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ message: err?.message ?? "unknown" })}\n\n`
          )
        );
        controller.close();
      } finally {
        clearInterval(heartbeat);
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

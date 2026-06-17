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
import { interpretDocument } from "@cleardeed/document-interpreter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 5_000;
const SUPPORTED_DOC_TYPES = new Set(["igr_ec", "bhulekh_back"]);

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

  // V1 only supports igr_ec; bhulekh_back is V1.5.
  if (docType !== "igr_ec") {
    return NextResponse.json(
      { error: "bhulekh_back is V1.5 — not yet enabled" },
      { status: 503 }
    );
  }

  const reportResult = await getReport(reportId);
  if (!reportResult.report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }
  const report = reportResult.report;

  const input = await fetchIgrEcInput(report);
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
        const result = await interpretDocument({
          reportId,
          // orgId is a future column; until it lands, the agent
          // stores rows with orgId = null and the cost-tracker
          // falls back to the global default quota.
          orgId: null,
          docType: "igr_ec",
          input,
        });

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

/**
 * Fetch the IGR EC document for the report. The pipeline stores the
 * raw HTML in `report.sources.igrSroData` (or similar). V1 returns
 * the HTML; V2 may also return a PDF for certified copy.
 */
async function fetchIgrEcInput(report: any): Promise<{ kind: "html"; content: string } | null> {
  const igr = report.sources?.igrSroData ?? report.sources?.igrEcData;
  if (typeof igr === "string" && igr.length > 0) {
    return { kind: "html", content: igr };
  }
  return null;
}

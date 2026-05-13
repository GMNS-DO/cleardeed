import { NextRequest, NextResponse } from "next/server";
import { renderPdf } from "@cleardeed/pdf-renderer";
import { getReport } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ReportRecord = {
  html?: string | null;
  report_html?: string | null;
  title?: string | null;
  report_title?: string | null;
};

function safeFilenamePart(value: string): string {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "report";
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  try {
    const { report } = await getReport(id) as { report?: ReportRecord | null };
    const html = report?.report_html ?? report?.html ?? null;

    if (!html) {
      return NextResponse.json(
        { error: "Report HTML is not available for PDF download." },
        { status: 404 }
      );
    }

    const pdfBuffer = await renderPdf({ html });
    const title = report?.report_title ?? report?.title ?? id;
    const filename = `ClearDeed-${safeFilenamePart(title)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate PDF.";
    console.error(`[/api/report/${id}/pdf]`, message);
    return NextResponse.json(
      { error: "Failed to generate PDF. Please try again." },
      { status: 500 }
    );
  }
}

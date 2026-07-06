import { NextRequest, NextResponse } from "next/server";
import { renderPdf } from "@cleardeed/pdf-renderer";
import { getReport, getReportHtml, getReportTitle } from "@/lib/db";
import { isReportViewAuthorized } from "@/lib/report-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeFilenamePart(value: string): string {
  return value.replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "report";
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const token = req.nextUrl.searchParams.get("token");

  if (!isReportViewAuthorized(id, token)) {
    return NextResponse.json(
      { error: "This PDF link is missing or has an invalid access token." },
      { status: 401 }
    );
  }

  try {
    const { report } = await getReport(id);
    const html = getReportHtml(report);

    if (!html) {
      return NextResponse.json(
        { error: "Report HTML is not available for PDF download." },
        { status: 404 }
      );
    }

    const pdfBuffer = await renderPdf({ html });
    const title = getReportTitle(report) ?? id;
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

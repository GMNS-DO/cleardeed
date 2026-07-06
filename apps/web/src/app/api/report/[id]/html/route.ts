/**
 * GET /api/report/[id]/html
 *
 * Returns the report HTML + title for a given reportId.
 * Used as a backup when the pre-generated report can't be retrieved from DB
 * via the standard /api/payment/success flow.
 */
import { NextRequest, NextResponse } from "next/server";
import { getReport, getReportErrorMessage, getReportHtml, getReportStatus, getReportTitle } from "@/lib/db";
import { isReportViewAuthorized } from "@/lib/report-access";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id: reportId } = await params;
  const token = req.nextUrl.searchParams.get("token");

  if (!isReportViewAuthorized(reportId, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await getReport(reportId);
    const report = result?.report;
    return NextResponse.json({
      html: getReportHtml(report),
      title: getReportTitle(report),
      status: getReportStatus(report),
      errorMessage: getReportErrorMessage(report),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

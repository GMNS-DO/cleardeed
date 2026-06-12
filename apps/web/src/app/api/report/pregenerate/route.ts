/**
 * POST /api/report/pregenerate
 *
 * Pre-generates a report during the checkout flow (while buyer is completing payment).
 * The report HTML is stored in the database. On payment success, the client passes
 * the preGeneratedReportId to /api/payment/success, which returns the already-
 * generated HTML instead of regenerating.
 *
 * This eliminates the 45-60s wait after payment by running Bhulekh fetch in
 * parallel with the payment flow.
 *
 * Input: { tehsil, tehsilValue, village, villageCode, searchMode, identifier, claimedOwnerName?, email? }
 * Output: { reportId }
 */
import { NextRequest, NextResponse } from "next/server";
import { generateReportV11 } from "@/lib/pipeline";
import { createReport, updateReportResults } from "@/lib/db";
import { addReportAccessTokensToHtml } from "@/lib/report-access";
import { validateInputPrePayment } from "@/lib/validation/pre-payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: Record<string, string | undefined>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const {
    tehsil,
    tehsilValue,
    village,
    villageCode: _villageCode,
    searchMode,
    identifier,
    claimedOwnerName,
    email,
  } = body;

  const tehsilVal = tehsil ?? "";
  const villageVal = village ?? "";
  const villageCodeVal = _villageCode ?? "";

  if (!tehsilVal || !villageVal || !villageCodeVal || !searchMode || !identifier) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // ── Sprint V4: pre-payment validation gate ───────────────────────────────
  // Pure input validation, no live portal calls. Runs before pipeline + DB
  // writes so the buyer sees an actionable error at the cheapest possible
  // moment, not after a 45-60s Bhulekh call.
  const validation = validateInputPrePayment({
    tehsil: tehsilVal,
    tehsilValue: tehsilValue ?? tehsilVal,
    village: villageVal,
    villageCode: villageCodeVal,
    searchMode,
    identifier,
    email,
  });
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error, code: "invalid_input" },
      { status: 400 }
    );
  }

  // Create report record first (needed for token-scoped URL)
  let reportId: string | undefined;
  let persistenceEnabled = false;
  try {
    const dbResult = await createReport({
      gpsLat: 0,
      gpsLon: 0,
      claimedOwnerName: claimedOwnerName || identifier,
    });
    reportId = dbResult.reportId;
    persistenceEnabled = true;
  } catch (dbError) {
    console.warn("[/api/report/pregenerate] DB create failed:", dbError);
    // Continue without persistence - report can still be generated
  }

  // Generate the report
  let pipelineOutput: Awaited<ReturnType<typeof generateReportV11>> | null = null;
  let reportError: string | null = null;

  try {
    pipelineOutput = await generateReportV11({
      reportId,
      tehsil: tehsilVal,
      tehsilValue: tehsilValue ?? tehsilVal,
      village: villageVal,
      villageCode: villageCodeVal,
      searchMode: searchMode as "Plot" | "Khatiyan" | "Tenant",
      identifier,
      claimedOwnerName: claimedOwnerName?.trim() || undefined,
    });
    reportId = pipelineOutput.reportId;
  } catch (pipelineError) {
    reportError = pipelineError instanceof Error ? pipelineError.message : String(pipelineError);
    console.error(`[/api/report/pregenerate] Report generation failed for ${reportId}:`, reportError);
  }

  // ── Log Bhulekh source data for debugging ────────────────────────────────
  console.info(`[/api/report/pregenerate] Bhulekh summary: ${pipelineOutput?.sourceSummary?.bhulekh ?? "none"}`);
  console.info(`[/api/report/pregenerate] Bhunaksha polygon: ${pipelineOutput?.bhunakshaPolygon ? `found (${pipelineOutput.bhunakshaPolygon.coordinates[0].length} points)` : "NULL"}`);

  // Build the report HTML
  const reportHtml = pipelineOutput && reportId
    ? addReportAccessTokensToHtml(pipelineOutput.html, reportId)
    : (pipelineOutput?.html ?? "");

  // Persist results to DB if persistence is available
  if (persistenceEnabled && reportId && reportHtml) {
    try {
      await updateReportResults({
        reportId,
        reportHtml,
        reportTitle: pipelineOutput?.title ?? "ClearDeed Report",
        bhulekhStatus: pipelineOutput?.sourceSummary?.bhulekh,
        validationFindings: pipelineOutput?.validationFindings,
        sourceSummary: pipelineOutput?.sourceSummary,
        errorMessage: reportError ?? undefined,
      });
    } catch (dbError) {
      console.warn("[/api/report/pregenerate] DB update failed:", dbError);
    }
  }

  const htmlReady = Boolean(reportHtml.trim());
  if (!htmlReady) {
    console.warn(`[/api/report/pregenerate] No usable HTML for ${reportId}:`, reportError ?? "pipeline returned empty HTML");
  }

  console.info(`[/api/report/pregenerate] Finished for ${village} / ${searchMode} / ${identifier} — reportId: ${reportId} status=${htmlReady ? "generated" : "failed"}`);
  console.info(`[/api/report/pregenerate] HTML length: ${reportHtml.length}`);

  return NextResponse.json({
    reportId: htmlReady ? reportId : undefined,
    status: htmlReady ? "generated" : "failed",
    error: htmlReady ? undefined : reportError ?? "Report generation did not produce HTML",
    title: pipelineOutput?.title ?? null,
    html: htmlReady ? reportHtml : undefined,
    bhunakshaPolygon: htmlReady ? (pipelineOutput?.bhunakshaPolygon ?? null) : null,
  });
}
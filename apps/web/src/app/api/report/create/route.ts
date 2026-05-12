/**
 * POST /api/report/create
 *
 * Creates a report record in Supabase, runs the ClearDeed pipeline,
 * and persists results. Returns reportId + HTML.
 *
 * Pipeline: Tier 1 (Nominatim + Bhunaksha + Bhulekh + eCourts + RCCMS)
 *           → Tier 2 (A5 OwnershipReasoner, A6 LandClassifier, A7 EncumbranceReasoner, A8 RegulatoryScreener)
 *           → Tier 3 (A10 ConsumerReportWriter)
 *           → Tier 4 (A11 OutputAuditor)
 *
 * Database: Creates report record, runs pipeline, updates with results.
 *           Falls back to demo mode if Supabase is not configured.
 */
import { NextRequest, NextResponse } from "next/server";
import { generateReport } from "@/lib/pipeline";
import { createReport, updateReportResults, upsertSourceResult } from "@/lib/db";
import type { SourceResult } from "@cleardeed/orchestrator";
import { validateKhordhaGPS } from "@cleardeed/schema";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authFailure = validateReportCreateAuth(req);
    if (authFailure) return authFailure;

    const body = await req.json();
    const { lat, lon, claimedOwnerName, fatherHusbandName, plotDescription } = body as {
      lat: number;
      lon: number;
      claimedOwnerName: string;
      fatherHusbandName?: string;
      plotDescription?: string;
    };

    if (lat == null || lon == null || !claimedOwnerName) {
      return NextResponse.json(
        { error: "Missing required fields: lat, lon, claimedOwnerName" },
        { status: 400 }
      );
    }

    const gpsValidation = validateKhordhaGPS(Number(lat), Number(lon));
    if (gpsValidation.blocked) {
      return NextResponse.json(
        {
          error: gpsValidation.message,
          code: "GPS_OUTSIDE_KHORDHA",
          validation: gpsValidation,
        },
        { status: 400 }
      );
    }

    // ── Create durable report row first when Supabase is configured ───────────
    // The generated HTML then uses the same report ID as the shareable URL.
    let reportId: string | undefined;
    let persistenceEnabled = false;
    try {
      const dbResult = await createReport({
        gpsLat: lat,
        gpsLon: lon,
        claimedOwnerName,
        fatherHusbandName,
        plotDescription,
      });
      reportId = dbResult.reportId;
      persistenceEnabled = true;
    } catch (dbError) {
      // Supabase may be absent in local/demo environments. The pipeline can
      // still return a report, but the report link will not be durable.
      console.warn("[api/report/create] Supabase create_report failed:", dbError);
    }

    // ── Run pipeline ───────────────────────────────────────────────────────────
    let pipelineOutput: Awaited<ReturnType<typeof generateReport>>;
    try {
      pipelineOutput = await generateReport({
        reportId,
        gps: { lat, lon },
        claimedOwnerName,
        fatherHusbandName,
        plotDescription,
      });
      reportId = pipelineOutput.reportId;
    } catch (pipelineError) {
      const errorMessage = pipelineError instanceof Error ? pipelineError.message : String(pipelineError);
      if (persistenceEnabled && reportId) {
        await updateReportResults({
          reportId,
          reportHtml: buildFailedReportHtml(reportId, errorMessage),
          reportTitle: "ClearDeed report held for review",
          validationFindings: [],
          sourceSummary: {},
          errorMessage,
        });
      }
      throw pipelineError;
    }

    // ── Persist pipeline results to Supabase (if configured) ─────────────────
    if (persistenceEnabled && reportId) {
      try {
        await updateReportResults({
          reportId,
          reportHtml: pipelineOutput.html,
          reportTitle: pipelineOutput.title,
          nominatimStatus: pipelineOutput.sourceSummary.nominatim,
          bhunakshaStatus: pipelineOutput.sourceSummary.bhunaksha,
          bhulekhStatus: pipelineOutput.sourceSummary.bhulekh,
          ecourtsStatus: pipelineOutput.sourceSummary.ecourts,
          rccmsStatus: pipelineOutput.sourceSummary.rccms,
          validationFindings: pipelineOutput.validationFindings,
          sourceSummary: pipelineOutput.sourceSummary,
        });

        await Promise.all(
          pipelineOutput.sources.map((source) =>
            upsertSourceResult({
              reportId,
              sourceName: source.source,
              status: source.status as "success" | "partial" | "failed" | "error" | "not_covered",
              fetchedAt: source.fetchedAt,
              parsedData: serializeSourceResult(source),
              rawResponse: source.rawResponse,
              errorMessage: source.error,
            })
          )
        );
      } catch (dbError) {
        // Pipeline ran successfully; mark response degraded instead of hiding
        // the generated report from the caller.
        console.warn("[api/report/create] Supabase persistence failed:", dbError);
      }
    }

    return NextResponse.json(
      {
        reportId,
        title: pipelineOutput.title,
        html: pipelineOutput.html,
        validationFindings: pipelineOutput.validationFindings,
        sourceSummary: pipelineOutput.sourceSummary,
      },
      { status: 200 }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/report/create]", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

function validateReportCreateAuth(req: NextRequest): NextResponse | null {
  const expectedToken = process.env.REPORT_CREATE_TOKEN ?? process.env.ADMIN_VIEW_TOKEN;
  if (!expectedToken) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Report creation is not configured for concierge launch." },
        { status: 503 }
      );
    }
    return null;
  }

  const authorization = req.headers.get("authorization") ?? "";
  const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  const headerToken = req.headers.get("x-cleardeed-admin-token");
  const providedToken = bearerToken ?? headerToken;

  if (providedToken !== expectedToken) {
    return NextResponse.json(
      { error: "Unauthorized report creation request." },
      { status: 401 }
    );
  }

  return null;
}

function buildFailedReportHtml(reportId: string, errorMessage: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ClearDeed report held for review</title>
</head>
<body style="font-family: system-ui, sans-serif; margin: 32px; color: #17231d;">
  <main style="max-width: 760px;">
    <h1>Report held for review</h1>
    <p>ClearDeed could not complete report generation for <strong>${escapeHtml(reportId)}</strong>.</p>
    <p>This report has not been sent to the buyer. A team member should review the pipeline error and rerun the report.</p>
    <pre style="white-space: pre-wrap; background: #f7f7f2; border: 1px solid #d9ddd4; padding: 16px;">${escapeHtml(errorMessage)}</pre>
    <p style="font-size: 13px; color: #5b665f;">This internal failure page is not a legal opinion and must not be shared as a consumer report.</p>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function serializeSourceResult(source: SourceResult): Record<string, unknown> {
  const {
    rawResponse: _rawResponse,
    error: _error,
    ...rest
  } = source as SourceResult & { rawResponse?: string; error?: string };

  return {
    ...rest,
    rawResponseStoredSeparately: Boolean(_rawResponse),
    error: _error,
  };
}

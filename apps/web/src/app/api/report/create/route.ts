/**
 * POST /api/report/create
 *
 * V1.1: Accepts Bhulekh dropdown-based inputs (tehsil + village + identifier).
 * V1.0 legacy: Still accepts GPS-based inputs (lat/lon + claimedOwnerName).
 *
 * Pipeline: Bhulekh fetcher → A5 OwnershipReasoner → A6 LandClassifier
 *           → A7 EncumbranceReasoner → A10 ConsumerReportWriter → A11 OutputAuditor
 *
 * Database: Creates report record, runs pipeline, updates with results.
 *           Falls back to demo mode if Supabase is not configured.
 */
import { NextRequest, NextResponse } from "next/server";
import { generateReport, generateReportV11 } from "@/lib/pipeline";
import { createReport, updateReportResults, upsertSourceResult } from "@/lib/db";
import { sendReportEmail } from "@/lib/email";
import type { SourceResult } from "@cleardeed/orchestrator";
import { validateKhordhaGPS } from "@cleardeed/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface V10Input {
  /** Legacy GPS-based inputs */
  lat: number;
  lon: number;
  claimedOwnerName: string;
  fatherHusbandName?: string;
  plotDescription?: string;
}

interface V11Input {
  /** V1.1 Bhulekh dropdown-based inputs */
  tehsil: string;
  tehsilValue: string;
  village: string;
  villageCode: string;
  searchMode: "Plot" | "Khatiyan" | "Tenant";
  identifier: string;
  claimedOwnerName?: string;
  whatsapp?: string;
  email?: string;
}

type ReportInput = V10Input | V11Input;

export async function POST(req: NextRequest) {
  try {
    // Report creation is open for concierge launch (no token gate in launch phase)
    // Admin token is only required for /admin routes.

    const body = await req.json() as ReportInput;
    const isV11 = "tehsil" in body && body.tehsil && "village" in body && body.village && "identifier" in body;

    // ── V1.1 flow: Bhulekh dropdown inputs ───────────────────────────────────
    if (isV11) {
      const v11 = body as V11Input;

      if (!v11.tehsil || !v11.village || !v11.villageCode || !v11.searchMode || !v11.identifier) {
        return NextResponse.json(
          { error: "Missing required V1.1 fields: tehsil, village, villageCode, searchMode, identifier" },
          { status: 400 }
        );
      }

      // Create report record in Supabase if configured
      let reportId: string | undefined;
      let persistenceEnabled = false;
      try {
        const dbResult = await createReport({
          gpsLat: 0, // V1.1 doesn't use GPS
          gpsLon: 0,
          claimedOwnerName: v11.claimedOwnerName ?? v11.identifier,
        });
        reportId = dbResult.reportId;
        persistenceEnabled = true;
      } catch (dbError) {
        console.warn("[api/report/create] Supabase create failed:", dbError);
      }

      // Run V1.1 pipeline
      let pipelineOutput: Awaited<ReturnType<typeof generateReportV11>>;
      try {
        pipelineOutput = await generateReportV11({
          reportId,
          tehsil: v11.tehsil,
          tehsilValue: v11.tehsilValue,
          village: v11.village,
          villageCode: v11.villageCode,
          searchMode: v11.searchMode,
          identifier: v11.identifier,
          claimedOwnerName: v11.claimedOwnerName,
        });
        reportId = pipelineOutput.reportId;
      } catch (pipelineError) {
        const errorMessage = pipelineError instanceof Error ? pipelineError.message : String(pipelineError);
        if (persistenceEnabled && reportId) {
          await updateReportResults({
            reportId,
            reportHtml: buildFailedReportHtml(reportId, errorMessage),
            reportTitle: "Report held for review",
            errorMessage,
          });
        }
        throw pipelineError;
      }

      // Persist results and auto-deliver
      let reportPersisted = false;
      if (persistenceEnabled && reportId) {
        try {
          await updateReportResults({
            reportId,
            reportHtml: pipelineOutput.html,
            reportTitle: pipelineOutput.title,
            bhulekhStatus: pipelineOutput.sourceSummary.bhulekh,
            validationFindings: pipelineOutput.validationFindings,
            sourceSummary: pipelineOutput.sourceSummary,
          });
          reportPersisted = true;
        } catch (dbError) {
          console.warn("[api/report/create] V1.1 persistence failed:", dbError);
        }
      }

      // Auto-send email on successful generation — no founder review gate
      if (reportPersisted && reportId) {
        sendReportOnDelivery({
          reportId,
          reportTitle: pipelineOutput.title,
          reportHtml: pipelineOutput.html,
          buyerEmail: v11.email,
          buyerWhatsApp: v11.whatsapp,
        }).catch((e) =>
          console.warn("[api/report/create] Email delivery failed:", e)
        );
      }

      const responseHtml = reportPersisted
        ? pipelineOutput.html
        : removePdfDownloadAction(pipelineOutput.html);

      return NextResponse.json(
        {
          reportId,
          title: pipelineOutput.title,
          html: responseHtml,
          validationFindings: pipelineOutput.validationFindings,
          sourceSummary: pipelineOutput.sourceSummary,
        },
        { status: 200 }
      );
    }

    // ── V1.0 legacy flow: GPS-based inputs ─────────────────────────────────────
    const v10 = body as V10Input;
    const { lat, lon, claimedOwnerName, fatherHusbandName, plotDescription } = v10;

    if (v10.lat == null || v10.lon == null || !v10.claimedOwnerName) {
      return NextResponse.json(
        { error: "Missing required fields: lat, lon, claimedOwnerName" },
        { status: 400 }
      );
    }

    const gpsValidation = validateKhordhaGPS(Number(v10.lat), Number(v10.lon));
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
    let reportPersisted = false;
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
        reportPersisted = true;

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
    const responseHtml = reportPersisted
      ? pipelineOutput.html
      : removePdfDownloadAction(pipelineOutput.html);

    return NextResponse.json(
      {
        reportId,
        title: pipelineOutput.title,
        html: responseHtml,
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
  // If no token is configured at all, allow open access (concierge launch phase)
  if (!expectedToken) {
    return null;
  }
  // If token is set as empty string (not configured in Vercel), treat as no token
  if (expectedToken === "") {
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

function removePdfDownloadAction(html: string): string {
  return html.replace(/\s*<div class="report-actions">\s*<a href="\/api\/report\/[^"]+\/pdf" class="pdf-button" download>Download PDF<\/a>\s*<\/div>/, "");
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

async function sendReportOnDelivery(params: {
  reportId: string;
  reportTitle: string;
  reportHtml: string;
  buyerEmail?: string;
  buyerWhatsApp?: string;
}): Promise<void> {
  const { reportId, reportTitle, reportHtml, buyerEmail } = params;

  if (!buyerEmail) {
    console.info(`[api/report/create] No buyer email for ${reportId} — skipping email delivery`);
    return;
  }

  const result = await sendReportEmail({
    to: buyerEmail,
    reportId,
    reportTitle,
    reportHtml,
  });

  if (result.success) {
    console.info(`[api/report/create] Report email sent to ${buyerEmail} (${result.messageId})`);
  } else {
    console.warn(`[api/report/create] Email delivery failed for ${reportId}: ${result.error}`);
  }
}

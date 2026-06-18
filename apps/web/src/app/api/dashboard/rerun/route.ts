/**
 * POST /api/dashboard/rerun
 *
 * Re-executes the report pipeline for a previous report's inputs and creates
 * a NEW report record. Does not mutate the existing row — the lawyer gets a
 * fresh report ID they can share.
 *
 * Auth: requires ADMIN_VIEW_TOKEN (header or Bearer). Fails closed when unset.
 *
 * Body: { reportId: string }
 *   - Fetches the original report from Supabase.
 *   - For V1.0 (GPS-based) reports: re-runs /api/report/create with the same
 *     lat/lon/owner.
 *   - For V1.1 (Bhulekh dropdown) reports: only gps_lat/lon are 0; the
 *     plot_description holds the Bhulekh identifier. In that case the caller
 *     should use the same tehsil/village inputs directly via /api/report/create
 *     and we return a 400 explaining how to re-run.
 */
import { NextRequest, NextResponse } from "next/server";
import { getReport, supabaseAdmin } from "@/lib/db";
import { isDashboardAuthorized } from "@/lib/dashboard-auth";
import { generateReport } from "@/lib/pipeline";
import { updateReportResults } from "@/lib/db";
import { addReportAccessTokensToHtml, buildReportUrl } from "@/lib/report-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface RerunBody {
  reportId?: string;
}

export async function POST(req: NextRequest) {
  const expectedToken = process.env.ADMIN_VIEW_TOKEN;
  if (!expectedToken) {
    return NextResponse.json(
      { error: "ADMIN_VIEW_TOKEN is not configured; dashboard re-run is disabled." },
      { status: 503 }
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  const headerToken = req.headers.get("x-cleardeed-admin-token");
  const providedToken = bearer ?? headerToken;

  if (!isDashboardAuthorized(providedToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RerunBody;
  try {
    body = (await req.json()) as RerunBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.reportId) {
    return NextResponse.json({ error: "Missing reportId" }, { status: 400 });
  }

  // ── Fetch the original report ──────────────────────────────────────────────
  let original;
  try {
    const result = await getReport(body.reportId);
    original = result.report;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to load original report: ${msg}` },
      { status: 500 }
    );
  }

  if (!original) {
    return NextResponse.json({ error: "Original report not found" }, { status: 404 });
  }

  // ── V1.1 reports can't be re-run from GPS alone ────────────────────────────
  // V1.1 inputs (tehsil, village, villageCode, searchMode, identifier) are not
  // stored in the reports table — only the resolved identifier is in
  // plot_description. Re-running these requires the dropdown inputs to be
  // supplied explicitly via /api/report/create.
  const isLegacyGps = original.gps_lat !== 0 || original.gps_lon !== 0;
  if (!isLegacyGps) {
    return NextResponse.json(
      {
        error:
          "This report was created with the V1.1 Bhulekh dropdown flow. Re-run is not supported from the dashboard yet — open the report and use 'Generate a fresh report' on the report page.",
        code: "V11_RERUN_UNSUPPORTED",
      },
      { status: 400 }
    );
  }

  // ── Create a new report row, run the pipeline, persist results ────────────
  let newReportId: string;
  try {
    const { data, error } = await supabaseAdmin()
      .from("reports")
      .insert({
        gps_lat: original.gps_lat,
        gps_lon: original.gps_lon,
        claimed_owner_name: original.claimed_owner_name,
        father_husband_name: original.father_husband_name,
        plot_description: original.plot_description,
        report_status: "processing",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    newReportId = (data as { id: string }).id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to create new report row: ${msg}` },
      { status: 500 }
    );
  }

  try {
    const output = await generateReport({
      reportId: newReportId,
      gps: { lat: original.gps_lat, lon: original.gps_lon },
      claimedOwnerName: original.claimed_owner_name,
      fatherHusbandName: original.father_husband_name ?? undefined,
      plotDescription: original.plot_description ?? undefined,
    });

    const html = addReportAccessTokensToHtml(output.html, newReportId);

    await updateReportResults({
      reportId: newReportId,
      reportHtml: html,
      reportTitle: output.title,
      nominatimStatus: output.sourceSummary.nominatim,
      bhunakshaStatus: output.sourceSummary.bhunaksha,
      bhulekhStatus: output.sourceSummary.bhulekh,
      ecourtsStatus: output.sourceSummary.ecourts,
      rccmsStatus: output.sourceSummary.rccms,
      validationFindings: output.validationFindings,
      sourceSummary: output.sourceSummary,
    });

    const baseUrl = process.env.CLEARDEED_BASE_URL ?? new URL(req.url).origin;
    const reportUrl = buildReportUrl(newReportId, baseUrl);

    return NextResponse.json({
      ok: true,
      reportId: newReportId,
      reportUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Pipeline failed for new report: ${msg}` },
      { status: 500 }
    );
  }
}

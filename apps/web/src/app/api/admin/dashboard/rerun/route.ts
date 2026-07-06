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
import { getReport, supabaseAdmin, setReportV11Inputs } from "@/lib/db";
import { isDashboardAuthorized } from "@/lib/dashboard-auth";
import { generateReport, generateReportV11 } from "@/lib/pipeline";
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

  // ── V1.1 vs V1.0 dispatch (T-009 follow-up) ───────────────────────────────
  // Migration 020 stores the V1.1 dropdown inputs on the reports row. If they
  // are present, we re-run via the V1.1 pipeline (Bhulekh dropdown mode). If
  // they are absent, we fall back to V1.0 GPS mode. If neither is present
  // (legacy V1.1 reports created before migration 020), we return the same
  // V11_RERUN_UNSUPPORTED error as before.
  const v11Inputs = (original as { v11Inputs?: { tehsil?: string; tehsilCode?: string; village?: string; villageCode?: string; plotNo?: string; searchMode?: string } | null }).v11Inputs ?? null;
  const hasV11Inputs = !!(
    v11Inputs?.tehsil && v11Inputs.village && v11Inputs.villageCode && v11Inputs.plotNo
  );
  const isLegacyGps = original.gps_lat !== 0 || original.gps_lon !== 0;
  const originalPaidTier = (original as { paidTier?: string | null; paid_tier?: string | null }).paidTier
    ?? (original as { paidTier?: string | null; paid_tier?: string | null }).paid_tier
    ?? undefined;

  if (!hasV11Inputs && !isLegacyGps) {
    return NextResponse.json(
      {
        error:
          "This report was created with the V1.1 Bhulekh dropdown flow but its dropdown inputs were not persisted (predates migration 020). Open the report and use 'Generate a fresh report' on the report page.",
        code: "V11_RERUN_UNSUPPORTED",
      },
      { status: 400 }
    );
  }

  // ── Create a new report row, run the pipeline, persist results ────────────
  let newReportId: string;
  try {
    const insertRow: Record<string, unknown> = {
      report_status: "processing",
    };
    if (isLegacyGps) {
      insertRow.gps_lat = original.gps_lat;
      insertRow.gps_lon = original.gps_lon;
      insertRow.claimed_owner_name = original.claimed_owner_name;
      insertRow.father_husband_name = original.father_husband_name;
      insertRow.plot_description = original.plot_description;
    } else {
      insertRow.gps_lat = 0;
      insertRow.gps_lon = 0;
      insertRow.claimed_owner_name = original.claimed_owner_name;
    }
    const { data, error } = await supabaseAdmin()
      .from("reports")
      .insert(insertRow)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    newReportId = (data as { id: string }).id;

    // Persist V1.1 dropdown inputs on the new row before the pipeline runs.
    if (hasV11Inputs && v11Inputs) {
      await setReportV11Inputs({
        reportId: newReportId,
        tehsil: v11Inputs.tehsil,
        tehsilCode: v11Inputs.tehsilCode,
        village: v11Inputs.village,
        villageCode: v11Inputs.villageCode,
        plotNo: v11Inputs.plotNo,
        searchMode: v11Inputs.searchMode,
        tier: originalPaidTier,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to create new report row: ${msg}` },
      { status: 500 }
    );
  }

  try {
    let reportTitle: string;
    let responseHtml: string;
    let sourceSummary: Record<string, unknown>;
    let validationFindings: unknown[];

    if (hasV11Inputs && v11Inputs) {
      const output = await generateReportV11({
        reportId: newReportId,
        tehsil: v11Inputs.tehsil!,
        tehsilValue: v11Inputs.tehsilCode ?? "",
        village: v11Inputs.village!,
        villageCode: v11Inputs.villageCode!,
        searchMode: (v11Inputs.searchMode as "Plot" | "Khatiyan" | "Tenant") ?? "Khatiyan",
        identifier: v11Inputs.plotNo!,
        claimedOwnerName: original.claimed_owner_name ?? undefined,
      });
      reportTitle = output.title;
      responseHtml = output.html;
      sourceSummary = output.sourceSummary as unknown as Record<string, unknown>;
      validationFindings = output.validationFindings;
    } else {
      const output = await generateReport({
        reportId: newReportId,
        gps: { lat: original.gps_lat, lon: original.gps_lon },
        claimedOwnerName: original.claimed_owner_name,
        fatherHusbandName: original.father_husband_name ?? undefined,
        plotDescription: original.plot_description ?? undefined,
      });
      reportTitle = output.title;
      responseHtml = output.html;
      sourceSummary = output.sourceSummary as unknown as Record<string, unknown>;
      validationFindings = output.validationFindings;
    }

    const html = addReportAccessTokensToHtml(responseHtml, newReportId);

    await updateReportResults({
      reportId: newReportId,
      reportHtml: html,
      reportTitle,
      bhulekhStatus: (sourceSummary as { bhulekh?: string }).bhulekh,
      validationFindings,
      sourceSummary,
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

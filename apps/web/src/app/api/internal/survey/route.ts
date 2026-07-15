import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/internal/survey
 *
 * Idempotent follow-up survey trigger. Stores a row in survey_triggers so
 * the Vercel cron runner (vercel.json: /api/internal/survey/cron 06:00 UTC)
 * can pick it up and dispatch the email.
 *
 * Fail-closed: only ADMIN_VIEW_TOKEN bearer may schedule surveys.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.ADMIN_VIEW_TOKEN}`;
  if (authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    reportId?: string;
    stage?: "30d" | "90d" | "180d" | "365d";
    reason?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { reportId, stage } = body;
  if (!reportId || !stage) {
    return NextResponse.json(
      { error: "missing_fields", required: ["reportId", "stage"] },
      { status: 400 }
    );
  }
  if (!["30d", "90d", "180d", "365d"].includes(stage)) {
    return NextResponse.json({ error: "invalid_stage", allowed: ["30d", "90d", "180d", "365d"] }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // Verify the report exists — refuse to schedule surveys for missing reports.
  const { data: report, error: reportErr } = await supabase
    .from("reports")
    .select("id, pipeline_status")
    .eq("id", reportId)
    .maybeSingle();
  if (reportErr || !report) {
    return NextResponse.json({ error: "report_not_found" }, { status: 404 });
  }
  if (report.pipeline_status !== "success") {
    return NextResponse.json(
      { error: "report_not_ready", status: report.pipeline_status },
      { status: 409 }
    );
  }

  // Compute due_at. 30d → +30 days, etc.
  const days = Number.parseInt(stage, 10);
  const dueAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  // Idempotency guard: same (reportId, stage) already scheduled.
  const { data: existing } = await supabase
    .from("survey_triggers")
    .select("id, due_at, status")
    .eq("report_id", reportId)
    .eq("stage", stage)
    .maybeSingle();
  if (existing && existing.status === "pending") {
    return NextResponse.json(
      { error: "already_scheduled", scheduledFor: existing.due_at },
      { status: 409 }
    );
  }

  const { error: insertErr } = await supabase.from("survey_triggers").insert({
    report_id: reportId,
    stage,
    status: "pending",
    due_at: dueAt,
    triggered_at: null,
    delivered_at: null,
    reason: body.reason ?? "manual_trigger",
  });
  if (insertErr) {
    console.error("[/api/internal/survey] insert failed:", insertErr);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ scheduled: true, scheduledFor: dueAt }, { status: 200 });
}

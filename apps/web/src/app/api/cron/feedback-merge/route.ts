/**
 * GET /api/cron/feedback-merge
 *
 * Plan §2.1 P1 P4: Vercel cron route that runs the auto-merge logic
 * nightly. Schedule via vercel.json:
 *   "crons": [{ "path": "/api/cron/feedback-merge", "schedule": "0 20 * * *" }]
 *   (02:00 IST = 20:00 UTC the previous day)
 *
 * Auth: requires CRON_SECRET in the Authorization header (Vercel cron
 * secret pattern). If the secret is not configured, the route is
 * disabled (returns 503).
 *
 * Process:
 *   1. Fetch all feedback rows with status in ('pending', 'approved')
 *      from the last 30 days.
 *   2. Run runAutoMergeCron() with the rows.
 *   3. Update the merged feedback rows with status='approved' and
 *      merged_version = new dict version.
 *   4. Return diagnostic summary.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";
import {
  runAutoMergeCron,
  FeedbackRow,
} from "@cleardeed/consumer-report-writer/translit/feedback-cron";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Auth: Vercel cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured; cron disabled" },
      { status: 503 }
    );
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Invalid cron secret" },
      { status: 401 }
    );
  }

  // Fetch feedback rows from the last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows, error } = await supabaseAdmin()
    .from("odia_name_feedback")
    .select("id, user_id, odia_input, current_output, suggested_output, status, created_at")
    .in("status", ["pending", "approved"])
    .gte("created_at", thirtyDaysAgo);

  if (error || !rows) {
    return NextResponse.json(
      { error: "Failed to fetch feedback rows" },
      { status: 500 }
    );
  }

  // Map snake_case DB rows to camelCase FeedbackRow for the agent
  const feedbackRows: FeedbackRow[] = rows.map((r: {
    id: number;
    user_id: string;
    odia_input: string;
    current_output: string;
    suggested_output: string;
    status: string;
    created_at: string;
  }) => ({
    id: r.id,
    userId: r.user_id,
    odiaInput: r.odia_input,
    currentOutput: r.current_output,
    suggestedOutput: r.suggested_output,
    status: r.status as FeedbackRow["status"],
    createdAt: r.created_at,
  }));

  // Run the auto-merge
  const result = runAutoMergeCron(feedbackRows, { dryRun: false });

  // Mark auto-approved rows in the database
  if (result.merged.added.length > 0) {
    const addedKeys = new Set(
      result.merged.added.map((e) => `${e.odia}::${e.latin}`)
    );
    const approvedIds = feedbackRows
      .filter((r) => addedKeys.has(`${r.odiaInput}::${r.suggestedOutput}`))
      .map((r) => r.id);
    if (approvedIds.length > 0) {
      await supabaseAdmin()
        .from("odia_name_feedback")
        .update({
          status: "approved",
          merged_version: result.merged.newVersion,
          reviewed_at: new Date().toISOString(),
        })
        .in("id", approvedIds);
    }
  }

  return NextResponse.json({
    ok: true,
    autoApprovedCount: result.autoApprovedCount,
    stillPendingCount: result.stillPendingCount,
    blockedByRejectionCount: result.blockedByRejectionCount,
    added: result.merged.added.length,
    conflicts: result.merged.conflicts.length,
    skipped: result.merged.skipped.length,
    newVersion: result.merged.newVersion,
  });
}

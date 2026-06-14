/**
 * POST /api/feedback
 *
 * In-report panel feedback. Thumbs up/down per section + optional text.
 * Stored against the report ID in Supabase if configured.
 *
 * Input: { reportId, section, vote: "up" | "down", comment?: string }
 * Output: { ok: true }
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";
import { trackEvent } from "@/lib/track";

export const runtime = "nodejs";

interface FeedbackInput {
  reportId: string;
  section: string;
  vote: "up" | "down";
  comment?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as FeedbackInput;

    if (!body.reportId || !body.section || !body.vote) {
      return NextResponse.json(
        { error: "Missing required fields: reportId, section, vote" },
        { status: 400 }
      );
    }

    if (!["up", "down"].includes(body.vote)) {
      return NextResponse.json(
        { error: "Vote must be 'up' or 'down'" },
        { status: 400 }
      );
    }

    // report_feedback.report_id is UUID NOT NULL; demo / non-UUID URLs (e.g.
    // CLD-DEMO-...) cannot be stored as-is. Skip the insert for non-UUID IDs
    // rather than failing silently — track them via the funnel event below.
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUuid = uuidRe.test(body.reportId);

    // Store feedback in Supabase if configured
    if (isUuid) {
      try {
        const { error } = await supabaseAdmin()
          .from("report_feedback")
          .insert({
            report_id: body.reportId,
            section: body.section,
            vote: body.vote,
            comment: body.comment?.slice(0, 1000) ?? null,
            created_at: new Date().toISOString(),
          });
        if (error && error.code !== "PGRST204") {
          // Table may not exist yet — log and continue
          console.warn("[/api/feedback] Supabase insert failed:", error.message);
        }
      } catch {
        // Feedback storage failure does not block the response
      }
    } else {
      console.log(
        `[/api/feedback] non-UUID reportId (${body.reportId}); feedback not stored, only tracked as funnel event`
      );
    }

    // Funnel: in-report panel feedback
    await trackEvent({
      eventName: "feedback_submitted",
      reportId: body.reportId,
      metadata: { section: body.section, vote: body.vote },
    });

    // Add PID-specific logging for synthesis section
    if (body.section === "synthesis") {
      console.log(
        `[pid/feedback] reportId=${body.reportId} vote=${body.vote} comment=${body.comment || "(none)"}`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/feedback]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
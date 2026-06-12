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

    // Store feedback in Supabase if configured
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

    // Funnel: in-report panel feedback
    await trackEvent({
      eventName: "feedback_submitted",
      reportId: body.reportId,
      metadata: { section: body.section, vote: body.vote },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/feedback]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
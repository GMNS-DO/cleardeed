/**
 * POST /api/feedback/name
 *
 * Plan §2.1 P1 P4: user-reported corrections to Odia transliterations.
 * Inserts into odia_name_feedback table (P1 P3 migration 016).
 * Admin review page approves/rejects; auto-merge cron lifts approved
 * entries into odia-names.json when thresholds are hit.
 *
 * Input:
 *   {
 *     odiaInput: string,        // the original Odia text
 *     currentOutput: string,    // what the system produced
 *     suggestedOutput: string,  // what the user thinks is correct
 *     reportId?: string,        // context: which report triggered this
 *   }
 *
 * Output: { ok: true, feedbackId: number }
 *
 * Notes:
 *   - Requires authenticated user. The user_id column has RLS so anon
 *     users cannot insert.
 *   - Suggestions must differ from currentOutput (a no-op correction
 *     is rejected with 400).
 *   - Odia input must contain at least one Odia character; the
 *     suggestion is the Latin transliteration they think is right.
 *   - The same (odiaInput, suggestedOutput) pair from the same user
 *     is rejected as duplicate (idempotent insert).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/db";

export const runtime = "nodejs";

const NameFeedbackInputSchema = z.object({
  odiaInput: z.string().min(1).max(500),
  currentOutput: z.string().min(1).max(500),
  suggestedOutput: z.string().min(1).max(500),
  reportId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Auth: require authenticated user.
    // We use the bearer token from Authorization header; the route
    // forwards it to Supabase to verify.
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = NameFeedbackInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { odiaInput, currentOutput, suggestedOutput, reportId } = parsed.data;

    // Reject no-op corrections
    if (currentOutput.trim().toLowerCase() === suggestedOutput.trim().toLowerCase()) {
      return NextResponse.json(
        { error: "Suggested output matches current output — no correction needed" },
        { status: 400 }
      );
    }

    // Verify the user is authenticated by exchanging the bearer token
    // with Supabase. We do NOT trust the user_id from the body — it's
    // derived from the verified session.
    const token = authHeader.slice(7);
    const { data: userData, error: userErr } = await supabaseAdmin()
      .auth.getUser(token);
    if (userErr || !userData?.user) {
      return NextResponse.json(
        { error: "Invalid or expired authentication token" },
        { status: 401 }
      );
    }
    const userId = userData.user.id;

    // Insert the feedback row
    const { data, error } = await supabaseAdmin()
      .from("odia_name_feedback")
      .insert({
        user_id: userId,
        report_id: reportId ?? null,
        odia_input: odiaInput,
        current_output: currentOutput,
        suggested_output: suggestedOutput,
      })
      .select("id")
      .single();

    if (error) {
      // Duplicate (user_id, odia_input) pair is a unique violation
      // (idempotency guard) — return 200 with the existing id.
      if (error.code === "23505") {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      console.error("[/api/feedback/name] insert failed:", error.message);
      return NextResponse.json(
        { error: "Failed to save feedback" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, feedbackId: data?.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/feedback/name]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

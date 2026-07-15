/**
 * POST /api/internal/survey/dispatch
 *
 * Sweeps paid reports whose 30 / 90 / 180 / 365-day anniversary falls today
 * and creates a survey_send row for each. Caller is the Vercel cron job
 * (or the manual "dispatch now" button in /admin).
 *
 * Idempotency:
 *   A unique index on (report_id, day) on `survey_sends` makes the upsert
 *   safe to re-run on the same day — second invocation no-ops.
 *
 * Auth:
 *   Either the INTERNAL_CRON_SECRET header (Vercel Cron) or a Supabase
 *   service-role signature. Never callable without one.
 *
 * Output:
 *   JSON { dispatched: number, skipped: number, day: number, date: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CRON_HEADER = "x-cron-secret";
const SURVEY_DAYS = [30, 90, 180, 365] as const;

export async function POST(req: NextRequest) {
  const provided = req.headers.get(CRON_HEADER) ?? "";
  const expected = process.env.INTERNAL_CRON_SECRET ?? "";
  if (!expected) {
    return NextResponse.json({ error: "internal_misconfigured", message: "INTERNAL_CRON_SECRET is not set." }, { status: 500 });
  }
  if (provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await safeJson(req);
  const explicitDay = body && typeof body.day === "number" ? body.day : null;

  const today = new Date();
  const todayIso = today.toISOString();
  const daysToSweep = explicitDay ? [explicitDay] : [...SURVEY_DAYS];

  const dispatched: Array<{ reportId: string; day: number }> = [];
  const skipped: Array<{ reportId: string; reason: string }> = [];

  for (const day of daysToSweep) {
    const lower = new Date(today);
    lower.setUTCDate(lower.getUTCDate() - day - 1); // inclusive lower bound
    const upper = new Date(today);
    upper.setUTCDate(upper.getUTCDate() - day + 1); // inclusive upper bound

    const { data: paidReports, error } = await supabaseAdmin()
      .from("reports")
      .select("id, paid_at")
      .not("paid_at", "is", null)
      .gte("paid_at", lower.toISOString())
      .lte("paid_at", upper.toISOString())
      .limit(500);

    if (error) {
      return NextResponse.json({ error: "db_query_failed", message: error.message }, { status: 500 });
    }

    for (const report of paidReports ?? []) {
      const reportId = (report as { id: string }).id;
      const { data: existing, error: exErr } = await supabaseAdmin()
        .from("survey_sends")
        .select("report_id, day")
        .eq("report_id", reportId)
        .eq("day", day)
        .maybeSingle();

      if (exErr) {
        skipped.push({ reportId, reason: "dedup_query_failed" });
        continue;
      }
      if (existing) {
        skipped.push({ reportId, reason: "already_dispatched" });
        continue;
      }

      const { error: insErr } = await supabaseAdmin()
        .from("survey_sends")
        .insert({
          report_id: reportId,
          day,
          sent_at: todayIso,
          delivery_status: "queued",
        });
      if (insErr) {
        skipped.push({ reportId, reason: "insert_failed" });
        continue;
      }
      dispatched.push({ reportId, day });
    }
  }

  return NextResponse.json({
    dispatched: dispatched.length,
    skipped: skipped.length,
    details: { dispatched, skipped },
    days: daysToSweep,
    date: todayIso,
  });
}

async function safeJson(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

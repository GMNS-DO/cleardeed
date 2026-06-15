/**
 * POST /api/user/delete
 *
 * DPDP Act Section 12 — right to erasure.
 *
 * Identifies a user by phone (the only PII on lead_requests today) and
 * soft-deletes their records:
 * - lead_requests matching the phone
 * - reports tied to those leads (via user_id == lead_id, the convention
 *   for now; we have no auth yet so user_id is the lead id when set)
 * - report_feedback for those reports
 * - anonymizes feedback comment text (PII removal even pre-30-day)
 *
 * Hard-delete is handled by hard_delete_expired_user_data() in
 * infra/supabase/migrations/009_dpdp_user_deletion.sql after 30 days.
 *
 * Input: { phone: string, reason?: string }
 * Output: { ok: true, deletedCounts: { leads, reports, feedback } }
 *
 * Note: this is a side-effecting operation, exposed as POST (not DELETE)
 * so the request body can carry identifying info — phones are PII and
 * URLs leak through server logs.
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db";
import { trackEvent } from "@/lib/track";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DeleteInput {
  phone?: string;
  reason?: string;
}

const PHONE_RE = /^[0-9+\-\s()]{7,20}$/;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DeleteInput;

    const phone = body.phone?.trim();
    const reason = body.reason?.slice(0, 200);

    if (!phone) {
      return NextResponse.json(
        { error: "phone is required" },
        { status: 400 }
      );
    }
    if (!PHONE_RE.test(phone)) {
      return NextResponse.json(
        { error: "Phone format invalid" },
        { status: 400 }
      );
    }

    // Find non-deleted leads matching this phone
    const { data: leads, error: leadsErr } = await supabaseAdmin()
      .from("lead_requests")
      .select("id")
      .eq("phone", phone)
      .is("deleted_at", null);

    if (leadsErr) {
      console.error("[/api/user/delete] lead lookup failed:", leadsErr.message);
      return NextResponse.json(
        { error: "Deletion request failed" },
        { status: 500 }
      );
    }

    const leadIds = (leads ?? []).map((l) => l.id);
    const deletedAt = new Date().toISOString();

    // Soft-delete matching leads
    let deletedLeads = 0;
    if (leadIds.length > 0) {
      const { error: softErr } = await supabaseAdmin()
        .from("lead_requests")
        .update({ deleted_at: deletedAt, deletion_reason: reason ?? null })
        .in("id", leadIds)
        .is("deleted_at", null);
      if (softErr) {
        console.error("[/api/user/delete] lead soft-delete failed:", softErr.message);
        return NextResponse.json({ error: "Deletion request failed" }, { status: 500 });
      }
      deletedLeads = leadIds.length;
    }

    // Find reports tied to these leads via user_id == lead_id convention
    let deletedReports = 0;
    let deletedFeedback = 0;
    if (leadIds.length > 0) {
      const { data: reports } = await supabaseAdmin()
        .from("reports")
        .select("id")
        .in("user_id", leadIds)
        .is("deleted_at", null);

      const reportIds = (reports ?? []).map((r) => r.id);

      if (reportIds.length > 0) {
        const { error: repSoftErr } = await supabaseAdmin()
          .from("reports")
          .update({ deleted_at: deletedAt, deletion_reason: reason ?? null })
          .in("id", reportIds)
          .is("deleted_at", null);
        if (repSoftErr) {
          console.error("[/api/user/delete] report soft-delete failed:", repSoftErr.message);
        } else {
          deletedReports = reportIds.length;
        }

        // Soft-delete + anonymize feedback for these reports.
        // comment is set to NULL on every report_feedback row for these reports,
        // regardless of prior text content, so PII does not survive soft-delete.
        const { error: fbErr } = await supabaseAdmin()
          .from("report_feedback")
          .update({ deleted_at: deletedAt, comment: null })
          .in("report_id", reportIds)
          .is("deleted_at", null);
        if (fbErr) {
          console.error("[/api/user/delete] feedback anonymize failed:", fbErr.message);
        } else {
          const { count } = await supabaseAdmin()
            .from("report_feedback")
            .select("id", { count: "exact", head: true })
            .in("report_id", reportIds)
            .not("deleted_at", "is", null);
          deletedFeedback = count ?? 0;
        }
      }
    }

    // Funnel: deletion request — for product analytics, NOT for re-identification
    await trackEvent({
      eventName: "user_deletion_request",
      metadata: {
        deleted_leads: deletedLeads,
        deleted_reports: deletedReports,
        deleted_feedback: deletedFeedback,
      },
    });

    return NextResponse.json({
      ok: true,
      deletedCounts: {
        leads: deletedLeads,
        reports: deletedReports,
        feedback: deletedFeedback,
      },
      retentionPolicy: "Records are hard-deleted 30 days after this request.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/user/delete]", message);
    return NextResponse.json({ error: "Deletion request failed" }, { status: 500 });
  }
}

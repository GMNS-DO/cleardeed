/**
 * /admin/name-review server actions.
 *
 * Plan §2.1 P1 P4: admin review page. The plan calls for:
 *   - approve / reject buttons per pending feedback row
 *   - on approve, run the same mergeApprovedFeedback utility that
 *     the auto-merge cron uses
 *   - on reject, mark the row as rejected
 *
 * This file contains the SERVER ACTIONS. The page itself is in
 * page.tsx and renders the pending feedback table.
 *
 * Server actions are gated by:
 *   1. Authenticated user (must have a session)
 *   2. Admin tier check (the user must be in the admin allowlist)
 *
 * Admin allowlist: a small set of user IDs hard-coded in env.
 * For production, this would come from a Supabase role or a
 * separate auth provider; the env-based check is sufficient for
 * P1 P4 and matches the existing project pattern.
 */
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/db";
import { mergeApprovedFeedback, ApprovedFeedback } from "@cleardeed/consumer-report-writer/translit/feedback-merge";

const APPROVE_INPUT = z.object({
  feedbackIds: z.array(z.number().int().positive()).min(1).max(100),
});

const REJECT_INPUT = z.object({
  feedbackId: z.number().int().positive(),
  reason: z.string().max(500).optional(),
});

function isAdminUser(userId: string): boolean {
  // Hard-coded admin allowlist. In production this would be a
  // Supabase role check or a separate auth provider.
  const allowlist = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);
  return allowlist.includes(userId);
}

export async function approveFeedbackAction(formData: FormData): Promise<void> {
  // FormData: feedbackIds (multi-value) — get all checked values
  const ids = formData.getAll("feedbackIds").map((v) => Number(v));
  const parsed = APPROVE_INPUT.safeParse({ feedbackIds: ids });
  if (!parsed.success) {
    console.warn("[/admin/name-review] approve: invalid input", parsed.error.flatten());
    return;
  }

  // Auth check
  const adminId = process.env.CURRENT_ADMIN_USER_ID;
  if (!adminId || !isAdminUser(adminId)) {
    console.warn("[/admin/name-review] approve: non-admin user", adminId);
    return;
  }

  // Fetch the feedback rows
  const { data: rows, error } = await supabaseAdmin()
    .from("odia_name_feedback")
    .select("id, user_id, odia_input, suggested_output, status")
    .in("id", parsed.data.feedbackIds);
  if (error || !rows) {
    console.error("[/admin/name-review] approve: fetch failed", error);
    return;
  }

  // Group by (odia_input, suggested_output) — one merge entry per pair
  const pairs = new Map<string, ApprovedFeedback>();
  for (const row of rows) {
    const key = `${row.odia_input}::${row.suggested_output}`;
    if (!pairs.has(key)) {
      pairs.set(key, {
        odiaInput: row.odia_input,
        suggestedOutput: row.suggested_output,
        reportedBy: [row.user_id],
        firstReportedAt: new Date().toISOString(),
      });
    } else {
      const existing = pairs.get(key)!;
      if (!existing.reportedBy.includes(row.user_id)) {
        existing.reportedBy.push(row.user_id);
      }
    }
  }

  // Run the merge
  const mergeResult = mergeApprovedFeedback([...pairs.values()], { dryRun: false });

  // Mark the feedback rows as approved
  await supabaseAdmin()
    .from("odia_name_feedback")
    .update({
      status: "approved",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
      merged_version: mergeResult.newVersion,
    })
    .in("id", parsed.data.feedbackIds);

  revalidatePath("/admin/name-review");
}

export async function rejectFeedbackAction(formData: FormData): Promise<void> {
  const feedbackIdStr = formData.get("feedbackId");
  const reason = formData.get("reason");
  const parsed = REJECT_INPUT.safeParse({
    feedbackId: Number(feedbackIdStr),
    reason: typeof reason === "string" ? reason : undefined,
  });
  if (!parsed.success) {
    console.warn("[/admin/name-review] reject: invalid input", parsed.error.flatten());
    return;
  }

  const adminId = process.env.CURRENT_ADMIN_USER_ID;
  if (!adminId || !isAdminUser(adminId)) {
    console.warn("[/admin/name-review] reject: non-admin user", adminId);
    return;
  }

  const { error } = await supabaseAdmin()
    .from("odia_name_feedback")
    .update({
      status: "rejected",
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.feedbackId);

  if (error) {
    console.error("[/admin/name-review] reject: update failed", error);
    return;
  }

  revalidatePath("/admin/name-review");
}

/**
 * feedback-cron.ts — Auto-merge logic for the P1 P4 feedback loop.
 *
 * Plan §2.1 P1 P4:
 *   - Vercel cron runs this nightly.
 *   - For each (odia, suggested) pair in odia_name_feedback:
 *     - Count distinct user_id values
 *     - Count rejections (status = 'rejected')
 *     - If unique_users >= 3 AND rejections == 0, auto-approve
 *     - Otherwise, leave as pending
 *   - After auto-approve, merge into the pending dict and update
 *     merged_version in odia_name_feedback.
 *
 * In production this is invoked by a Vercel cron route:
 *   /api/cron/feedback-merge  (run nightly at 02:00 IST)
 *
 * For test purposes, the function takes an in-memory `feedbackStore`
 * so we can verify the threshold logic without DB access.
 */

import {
  meetsAutoMergeThreshold,
  mergeApprovedFeedback,
  ApprovedFeedback,
  MergeResult,
} from "./feedback-merge";

/** A row from odia_name_feedback, abstracted for testability. */
export interface FeedbackRow {
  id: number;
  userId: string;
  odiaInput: string;
  currentOutput: string;
  suggestedOutput: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

/** Group feedback rows by (odiaInput, suggestedOutput) pair. */
export function groupFeedbackByPair(
  rows: FeedbackRow[]
): Map<string, { approved: FeedbackRow[]; rejected: number; pending: FeedbackRow[] }> {
  const groups = new Map<string, { approved: FeedbackRow[]; rejected: number; pending: FeedbackRow[] }>();
  for (const row of rows) {
    const key = `${row.odiaInput}::${row.suggestedOutput}`;
    if (!groups.has(key)) {
      groups.set(key, { approved: [], rejected: 0, pending: [] });
    }
    const g = groups.get(key)!;
    if (row.status === "approved") g.approved.push(row);
    else if (row.status === "rejected") g.rejected++;
    else g.pending.push(row);
  }
  return groups;
}

/**
 * Run the auto-merge cron logic.
 *
 * @param feedbackStore - All feedback rows (typically from Supabase)
 * @param options.dryRun - If true, return what would be merged without
 *                         writing the pending dict
 * @returns merge result + diagnostic counts
 */
export interface CronResult {
  /** Entries that were auto-approved and merged */
  merged: MergeResult;
  /** Number of (odia, suggestion) pairs that met the threshold */
  autoApprovedCount: number;
  /** Number of (odia, suggestion) pairs still pending (not enough unique users) */
  stillPendingCount: number;
  /** Number of (odia, suggestion) pairs blocked by rejections */
  blockedByRejectionCount: number;
}

export function runAutoMergeCron(
  feedbackStore: FeedbackRow[],
  options: { dryRun?: boolean } = {}
): CronResult {
  const groups = groupFeedbackByPair(feedbackStore);

  const approvedEntries: ApprovedFeedback[] = [];
  let autoApprovedCount = 0;
  let stillPendingCount = 0;
  let blockedByRejectionCount = 0;

  for (const [, group] of groups) {
    // Determine the suggested output from any approved row
    const sample = group.approved[0] ?? group.pending[0];
    if (!sample) continue;

    // Compute the unique-user set across approved AND pending (the
    // unique-user count is the strongest signal).
    const allUserIds = new Set<string>();
    for (const row of [...group.approved, ...group.pending]) {
      allUserIds.add(row.userId);
    }
    const approved: ApprovedFeedback = {
      odiaInput: sample.odiaInput,
      suggestedOutput: sample.suggestedOutput,
      reportedBy: [...allUserIds],
      firstReportedAt: sample.createdAt,
    };

    const meets = meetsAutoMergeThreshold(approved, group.rejected);
    if (meets) {
      approvedEntries.push(approved);
      autoApprovedCount++;
    } else if (group.rejected > 0) {
      blockedByRejectionCount++;
    } else {
      stillPendingCount++;
    }
  }

  const merged = mergeApprovedFeedback(approvedEntries, { dryRun: options.dryRun });
  return {
    merged,
    autoApprovedCount,
    stillPendingCount,
    blockedByRejectionCount,
  };
}

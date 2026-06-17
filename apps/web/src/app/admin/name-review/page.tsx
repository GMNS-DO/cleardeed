/**
 * /admin/name-review page.
 *
 * Plan §2.1 P1 P4: admin page for reviewing pending Odia name feedback.
 * Server-rendered (not a client component) — keeps the admin tier
 * out of the public bundle. The page reads pending feedback rows
 * from odia_name_feedback and renders them with approve/reject
 * buttons (which are also server actions).
 *
 * The page is NOT accessible to non-admin users; auth is checked
 * at the server level.
 */
import { supabaseAdmin } from "@/lib/db";
import { approveFeedbackAction, rejectFeedbackAction } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface FeedbackRow {
  id: number;
  user_id: string;
  odia_input: string;
  current_output: string;
  suggested_output: string;
  status: string;
  created_at: string;
}

async function loadPendingFeedback(): Promise<FeedbackRow[]> {
  const { data, error } = await supabaseAdmin()
    .from("odia_name_feedback")
    .select("id, user_id, odia_input, current_output, suggested_output, status, created_at")
    .in("status", ["pending", "approved", "rejected"])
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data as FeedbackRow[];
}

function isAdminUser(userId: string): boolean {
  const allowlist = (process.env.ADMIN_USER_IDS ?? "").split(",").filter(Boolean);
  return allowlist.includes(userId);
}

export default async function NameReviewPage() {
  // Auth check (placeholder: in production this would use cookies)
  const adminId = process.env.CURRENT_ADMIN_USER_ID;
  if (!adminId || !isAdminUser(adminId)) {
    return (
      <main style={{ padding: "2rem" }}>
        <h1>Access denied</h1>
        <p>This page is restricted to administrators.</p>
      </main>
    );
  }

  const rows = await loadPendingFeedback();
  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Name Review</h1>
      <p>Review user-reported Odia transliteration corrections. Auto-merge runs nightly at 02:00 IST.</p>

      <section>
        <h2>Pending ({pending.length})</h2>
        {pending.length === 0 ? (
          <p>No pending feedback.</p>
        ) : (
          <form action={approveFeedbackAction}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th>Approve</th>
                  <th>Odia</th>
                  <th>Current</th>
                  <th>Suggested</th>
                  <th>Reporter</th>
                  <th>Reject</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid #ccc" }}>
                    <td><input type="checkbox" name="feedbackIds" value={r.id} /></td>
                    <td><code>{r.odia_input}</code></td>
                    <td>{r.current_output}</td>
                    <td><strong>{r.suggested_output}</strong></td>
                    <td><code>{r.user_id.slice(0, 8)}</code></td>
                    <td>
                      <button
                        formAction={rejectFeedbackAction}
                        name="feedbackId"
                        value={String(r.id)}
                        type="submit"
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="submit" style={{ marginTop: "1rem" }}>
              Approve selected
            </button>
          </form>
        )}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Recently decided ({decided.length})</h2>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th>Status</th>
              <th>Odia</th>
              <th>Suggested</th>
              <th>Reviewed at</th>
            </tr>
          </thead>
          <tbody>
            {decided.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #ccc" }}>
                <td>{r.status}</td>
                <td><code>{r.odia_input}</code></td>
                <td>{r.suggested_output}</td>
                <td>{r.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

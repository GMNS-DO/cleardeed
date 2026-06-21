/**
 * Client component — per-row actions for the lawyer dashboard:
 *   • View report (link to /report/[id])
 *   • Re-run (POSTs to /api/report/create to re-execute the fetcher pipeline)
 *   • Export PDF (links to /api/report/[id]/pdf with the auth token)
 */
"use client";

import { useState } from "react";

interface ReportRowActionsProps {
  reportId: string;
  token: string;
  filename: string;
}

export function ReportRowActions({ reportId, token, filename }: ReportRowActionsProps) {
  const [busy, setBusy] = useState<null | "rerun" | "export">(null);
  const [message, setMessage] = useState<string | null>(null);

  const viewHref = `/report/${encodeURIComponent(reportId)}?token=${encodeURIComponent(token)}`;
  const pdfHref = `/api/report/${encodeURIComponent(reportId)}/pdf?token=${encodeURIComponent(token)}`;

  async function handleRerun() {
    setBusy("rerun");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/dashboard/rerun", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cleardeed-admin-token": token,
        },
        body: JSON.stringify({ reportId }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        reportId?: string;
        reportUrl?: string | null;
        error?: string;
      };
      if (!response.ok || !data.ok) {
        setMessage(data.error ?? `Re-run failed (${response.status})`);
      } else {
        setMessage(
          data.reportUrl
            ? `Re-run complete. New report: ${data.reportUrl}`
            : `Re-run complete. Refresh to see new row.`
        );
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <a
          href={viewHref}
          className="rounded border border-stone-300 bg-white px-3 py-1 text-xs font-semibold text-[#1d6f5b] hover:bg-stone-50"
        >
          View
        </a>
        <button
          type="button"
          onClick={handleRerun}
          disabled={busy !== null}
          className="rounded border border-[#1d6f5b] bg-[#1d6f5b] px-3 py-1 text-xs font-semibold text-white hover:bg-[#155a48] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "rerun" ? "Re-running…" : "Re-run"}
        </button>
        <a
          href={pdfHref}
          download={filename}
          onClick={() => setBusy("export")}
          className="rounded border border-stone-700 bg-stone-700 px-3 py-1 text-xs font-semibold text-white hover:bg-stone-900"
        >
          Export PDF
        </a>
      </div>
      {message ? (
        <p className="max-w-[20rem] break-words text-right text-xs text-stone-700">{message}</p>
      ) : null}
    </div>
  );
}

/**
 * ClearDeed — ReportExpired
 *
 * Fallback view rendered when a paid report's 60-day access window has
 * ended or the report was explicitly revoked. Offers a ₹299 refresh path.
 *
 * Converted from inline `style={{ ... }}` to Tailwind utility classes so
 * it shares the brand palette and typography with the rest of the app
 * (PI-0 T5 / Sprint 1).
 */

import RefreshButtonClient from "./RefreshButtonClient";

const REFRESH_PRICE_INR = 299;
const REFRESH_WINDOW_DAYS = 60;

export interface ReportExpiredProps {
  reportId: string;
  expiresAt: string | null;
  revokedAt: string | null;
}

function formatIndianDate(iso: string | null): string {
  if (!iso || iso === "—") return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function ReportExpired({
  reportId,
  expiresAt,
  revokedAt,
}: ReportExpiredProps) {
  const isRevoked = Boolean(revokedAt);
  const expiredOnLabel = isRevoked ? formatIndianDate(revokedAt) : formatIndianDate(expiresAt);
  const refreshUrl = `/api/reports/${encodeURIComponent(reportId)}/refresh`;

  return (
    <main
      data-testid="report-expired"
      className="min-h-screen bg-[#f7f7f2] p-8 font-[system-ui,sans-serif] text-[#17231d]"
    >
      <section className="mx-auto max-w-[640px] rounded border border-[#d9ddd4] bg-white p-7">
        <p className="m-0 text-[13px] font-bold uppercase text-[#8a5f1d]">
          ClearDeed report
        </p>
        <h1 className="mt-2 mb-3 text-[26px] leading-snug">
          Your 60-day report access has ended
        </h1>
        <p className="mt-0 text-[#3b4a3f] text-[14px]">
          {isRevoked ? (
            <>
              This report was revoked on <strong className="text-[#17231d]">{expiredOnLabel}</strong>.
              The underlying cached report body is no longer served. If you believe
              this is a mistake, contact support.
            </>
          ) : (
            <>
              This report was paid for and its {REFRESH_WINDOW_DAYS}-day access window
              ended on <strong className="text-[#17231d]">{expiredOnLabel}</strong>.
              Government records change — to keep using this report, refresh it for
              another {REFRESH_WINDOW_DAYS} days.
            </>
          )}
        </p>

        <div className="my-5 rounded border border-[#d9ddd4] bg-[#f7f7f2] p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <strong className="text-[15px]">Refresh this report</strong>
            <span className="text-[22px] font-bold">₹{REFRESH_PRICE_INR}</span>
          </div>
          <p className="m-0 text-[#3b4a3f] text-[14px]">
            Re-runs the same checks against current public records and re-validates
            ownership, encumbrance, and zoning signals.
          </p>
          <p className="mt-2 text-[13px] text-[#3b4a3f]">
            Report ID:{" "}
            <code className="rounded border border-[#d9ddd4] bg-white px-1 py-0.5 font-mono">
              {reportId}
            </code>
          </p>
        </div>

        <RefreshButtonClient reportId={reportId} refreshUrl={refreshUrl} />

        <p className="mt-5 text-[#6b7770] text-[12px]">
          Already paid? Hard-refresh this page (Cmd/Ctrl + Shift + R) after
          payment — your access window resets the moment the webhook fires.
        </p>
        <p className="mt-3 text-[#6b7770] text-[12px]">
          Direct link: <code className="font-mono">{`/report/${reportId}`}</code>
        </p>
      </section>
    </main>
  );
}
/**
 * ClearDeed — ReportUnavailable
 *
 * Fallback view rendered when the report row exists but the body cannot be
 * served: unauthorized access token, report not yet generated, persistence
 * not configured, or a runtime error during fetch.
 *
 * Converted from inline `style={{ ... }}` to Tailwind utility classes so
 * it shares the brand palette and typography with the rest of the app
 * (PI-0 T5 / Sprint 1).
 */

export interface ReportUnavailableProps {
  reportId: string;
  status: string;
  message?: string;
}

export default function ReportUnavailable({
  reportId,
  status,
  message,
}: ReportUnavailableProps) {
  return (
    <main
      data-testid="report-unavailable"
      className="min-h-screen bg-[#f7f7f2] p-8 font-[system-ui,sans-serif] text-[#17231d]"
    >
      <section className="mx-auto max-w-[720px] rounded border border-[#d9ddd4] bg-white p-6">
        <p className="text-[13px] font-bold uppercase text-[#8a5f1d]">
          ClearDeed report
        </p>
        <h1 className="mt-2 mb-3 text-[28px] leading-tight">
          Report not available yet
        </h1>
        <p className="text-[#3b4a3f]">
          Report <strong className="text-[#17231d]">{reportId}</strong> is currently{" "}
          <strong className="text-[#17231d]">{status}</strong>. It may still be
          generating, held for review, or unavailable because report persistence
          is not configured.
        </p>
        {message ? (
          <pre className="mt-4 whitespace-pre-wrap rounded border border-[#d9ddd4] bg-[#f7f7f2] p-3 font-mono text-[12px] text-[#3b4a3f]">
            {message}
          </pre>
        ) : null}
      </section>
    </main>
  );
}
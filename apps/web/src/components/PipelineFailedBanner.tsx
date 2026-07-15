"use client";

/**
 * Banner shown at the top of the report view when the underlying Bhulekh
 * pipeline returned `failed` / `manual_required` after a successful payment.
 *
 * The user has already paid, so this is not a free-funnel error. We owe them
 * a clear status: the report is partially built but not from a verified
 * Bhulekh source, and we are refunding or crediting.
 */

interface PipelineFailedBannerProps {
  reportId: string;
  statusReason: string | null;
  bhulekhStatus: string | null;
}

export function PipelineFailedBanner({
  reportId,
  statusReason,
  bhulekhStatus,
}: PipelineFailedBannerProps) {
  const shortId = reportId.slice(0, 8);
  return (
    <section
      role="alert"
      data-testid="pipeline-failed-banner"
      className="mb-4 rounded border-2 border-[#e8a29a] bg-[#fff0ee] px-4 py-3 text-sm text-[#8d2118]"
    >
      <p className="font-semibold">We could not verify your report against the land records.</p>
      <p className="mt-1">
        The Bhulekh site returned no usable data for this plot/khata right now. Your report is
        not yet complete and should not be used for a purchase decision.
      </p>
      <p className="mt-2 text-xs">
        We are auto-processing a refund for report <code>{shortId}</code>. You will receive it within
        5–7 working days. If you would like to retry once the government site recovers, reply to
        the email confirmation and we will re-run the report at no charge.
      </p>
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-[#5b665f]">Technical details</summary>
        <pre className="mt-1 whitespace-pre-wrap text-[#5b665f]">
{`Report id: ${reportId}
Bhulekh status: ${bhulekhStatus ?? "unknown"}
Pipeline status reason: ${statusReason ?? "unknown"}
Time: ${new Date().toISOString()}`}
        </pre>
      </details>
    </section>
  );
}

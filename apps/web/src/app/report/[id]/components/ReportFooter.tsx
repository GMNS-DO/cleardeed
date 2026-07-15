/**
 * ClearDeed — ReportFooter (React)
 *
 * Renders the 18-month correctness guarantee footer block for Guaranteed-tier
 * reports. Hidden on all other tiers. Shows the optional lawyer co-sign
 * block (T3) when a lawyer has signed the report.
 *
 * PI-3 T2 — guarantee tier checkout consent + report footer.
 */

interface ReportFooterProps {
  paidTier?: string | null;
  guaranteeAcceptedAt?: string | null;
  lawyerName?: string | null;
  lawyerFirm?: string | null;
  signedAt?: string | null;
}

function formatDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export function ReportFooter({
  paidTier,
  guaranteeAcceptedAt,
  lawyerName,
  lawyerFirm,
  signedAt,
}: ReportFooterProps) {
  if (paidTier !== "guaranteed" || !guaranteeAcceptedAt) {
    return null;
  }

  const formattedSignedAt = formatDate(signedAt);
  const showLawyerBlock = Boolean(lawyerName);

  return (
    <div
      data-testid="guarantee-footer"
      className="mt-8 border-t-2 border-[#1d6f5b] bg-[#f4faf7] p-4"
    >
      <p className="font-semibold text-[#1d6f5b]">18-month correctness guarantee</p>
      <p className="mt-1 text-sm text-[#17231d]">
        This report carries a correctness guarantee for "verified clear" claims only.
        If a claim labeled "verified clear" is proven wrong within 18 months of report
        generation, you are entitled to a full refund plus complimentary panel-lawyer
        review.{" "}
        <a
          href="https://cleardeed.in/guarantee-terms"
          target="_blank"
          rel="noopener"
          className="underline"
        >
          Full terms
        </a>
        .
      </p>
      {showLawyerBlock ? (
        <div className="guarantee-lawyer-block mt-2 text-sm text-[#17231d]">
          <strong>Signed by:</strong> {lawyerName}
          {lawyerFirm ? `, ${lawyerFirm}` : ""}
          {formattedSignedAt ? (
            <>
              <br />
              <time>{formattedSignedAt}</time>
            </>
          ) : null}
        </div>
      ) : null}
      <p className="mt-2 text-xs text-[#5b665f]">
        ClearDeed is an information aggregator, not a legal opinion. Consult a lawyer
        before transacting.
      </p>
    </div>
  );
}

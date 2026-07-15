import React from "react";

/**
 * FinancialExposureSummary
 *
 * Top-of-fold financial-exposure panel. Three rows:
 *   1. Verified-clear exposure — explicit ₹0 with the categories that
 *      were verified clean.
 *   2. At-risk exposure — sum of quantified exposure across all
 *      CRITICAL / HIGH insights, with the categories it covers.
 *   3. Unquantified items — items that need manual verification and
 *      therefore cannot be priced.
 *
 * This is arithmetic on quantified exposures, not a buy/sell verdict.
 */

export interface FinancialExposureSummaryProps {
  verifiedClearExposure: number;
  verifiedClearCategories: string[];
  atRiskExposure: number;
  atRiskCategories: string[];
  unquantifiedItems: string[];
  className?: string;
}

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatRupees(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return INR.format(Math.max(0, Math.round(value)));
}

export function FinancialExposureSummary(
  props: FinancialExposureSummaryProps,
): React.ReactElement {
  const {
    verifiedClearExposure,
    verifiedClearCategories,
    atRiskExposure,
    atRiskCategories,
    unquantifiedItems,
    className,
  } = props;

  const rootClass = `max-w-3xl mx-auto p-6 rounded-lg border border-[#d9ddd4] bg-white ${className ?? ""}`;

  return (
    <section
      style={{ fontFamily: "system-ui, sans-serif" }}
      className={rootClass.trim()}
      data-component="FinancialExposureSummary"
    >
      <h2 className="text-xs uppercase tracking-wider text-[#5b665f] mb-4">
        Financial Exposure Summary
      </h2>

      <div className="space-y-4">
        {/* Verified-clear row */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-l-4 border-[#1d6f5b] pl-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#5b665f]">
              Verified clear exposure
            </div>
            <div className="text-2xl font-semibold text-[#17231d]">
              {formatRupees(verifiedClearExposure)}
            </div>
          </div>
          <ul className="text-xs text-[#5b665f] flex flex-wrap gap-x-3 gap-y-1">
            {verifiedClearCategories.length === 0 ? (
              <li>none disclosed</li>
            ) : (
              verifiedClearCategories.map((c) => <li key={c}>{c}</li>)
            )}
          </ul>
        </div>

        {/* At-risk row */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-l-4 border-[#b91c1c] pl-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-[#5b665f]">
              At-risk exposure
            </div>
            <div className="text-2xl font-semibold text-[#17231d]">
              {formatRupees(atRiskExposure)}
            </div>
          </div>
          <ul className="text-xs text-[#5b665f] flex flex-wrap gap-x-3 gap-y-1">
            {atRiskCategories.length === 0 ? (
              <li>none quantified</li>
            ) : (
              atRiskCategories.map((c) => <li key={c}>{c}</li>)
            )}
          </ul>
        </div>

        {/* Unquantified row */}
        <div className="border-l-4 border-[#8a5f1d] pl-3">
          <div className="text-xs uppercase tracking-wider text-[#5b665f] mb-1">
            Unquantified items requiring manual verification
          </div>
          {unquantifiedItems.length === 0 ? (
            <p className="text-sm text-[#5b665f]">none flagged</p>
          ) : (
            <ul className="text-sm text-[#17231d] list-disc list-inside space-y-1">
              {unquantifiedItems.map((u, idx) => (
                <li key={`${u}-${idx}`}>{u}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

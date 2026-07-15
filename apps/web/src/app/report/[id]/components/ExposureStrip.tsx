/**
 * ClearDeed — ExposureStrip
 *
 * High-level "what's at risk" strip, shown at the top of the buyer-layer
 * report below the VerdictCard. Summarises the worst-case quantified
 * exposure across all CRITICAL/HIGH insights surfaced for this plot.
 *
 * When `exposure` is missing or zero, renders a benign placeholder rather
 * than an empty strip. Stub-on-missing-data: never invents amounts.
 *
 * PI-0 T6 (Sprint 1).
 */

export type ExposureStripSeverity = "redFlag" | "high" | "watchout" | "positive" | "info";

export interface ExposureStripProps {
  exposure: {
    amountINR: number | null;
    categories: string[];
    severity: ExposureStripSeverity;
    summaryLine: string;
  } | null;
}

const SEVERITY_CLASS: Record<ExposureStripSeverity, { border: string; bg: string; text: string }> = {
  redFlag: { border: "border-rose-200", bg: "bg-rose-50", text: "text-rose-800" },
  high: { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-800" },
  info: { border: "border-sky-200", bg: "bg-sky-50", text: "text-sky-800" },
};

export function ExposureStrip({ exposure }: ExposureStripProps) {
  if (!exposure) {
    return (
      <div
        className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500"
        role="status"
      >
        Exposure analysis pending — source data not yet available for this report.
      </div>
    );
  }

  const { border, bg, text } = SEVERITY_CLASS[exposure.severity] ?? SEVERITY_CLASS.info;
  const amountLabel = exposure.amountINR
    ? `₹${exposure.amountINR.toLocaleString("en-IN")}`
    : "Amount pending";

  return (
    <div className={`rounded-lg border ${border} ${bg} ${text} p-4`}>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-lg font-semibold">{amountLabel}</span>
        {exposure.categories.map((cat) => (
          <span
            key={cat}
            className="rounded-full border border-current/20 px-2 py-0.5 text-xs font-medium"
          >
            {cat}
          </span>
        ))}
      </div>
      {exposure.summaryLine ? (
        <p className="mt-2 text-sm opacity-80">{exposure.summaryLine}</p>
      ) : null}
    </div>
  );
}
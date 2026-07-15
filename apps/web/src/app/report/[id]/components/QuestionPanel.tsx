import React from "react";

import { ProvenanceButton } from "./ProvenanceButton";

/**
 * ClearDeed — QuestionPanel
 *
 * Collapsible expanded body for a single buyer question (Q1–Q6). Wraps
 * the tiles that compose an answer into a card with the question's source
 * provenance, data table, and verdict strip.
 *
 * PI-0 T6 (Sprint 1). Provenance button added PI-3 T1.
 *
 * Prop shape is intentionally loose because Q1–Q6 have different shape:
 * Q1 (ownership) wants OwnerSection + PlotMap, Q2 (buildability) wants
 * LandClassCard, Q3 (loss-after-buy) wants VerdictCards, etc. Callers
 * compose what they need and pass it as `children`.
 */

export interface QuestionPanelProps {
  id: string;
  question: string;
  verdict: "clear" | "watchout" | "redFlag" | "partial" | "manual_required" | null;
  verdictHeadline?: string;
  sourceSummary?: string;
  lastUpdated?: string;
  children?: React.ReactNode;
  /** Provenance — PI-3 T1 */
  sourceUrl?: string;
  sourceLabel?: string;
  fetchedAt?: string;
}

const VERDICT_CLASS: Record<NonNullable<QuestionPanelProps["verdict"]>, string> = {
  clear: "border-emerald-200 bg-emerald-50 text-emerald-800",
  watchout: "border-amber-200 bg-amber-50 text-amber-800",
  redFlag: "border-rose-200 bg-rose-50 text-rose-800",
  partial: "border-sky-200 bg-sky-50 text-sky-800",
  manual_required: "border-stone-200 bg-stone-50 text-stone-800",
};

export function QuestionPanel({
  id,
  question,
  verdict,
  verdictHeadline,
  sourceSummary,
  lastUpdated,
  children,
  sourceUrl,
  sourceLabel,
  fetchedAt,
}: QuestionPanelProps) {
  const verdictClass = verdict ? VERDICT_CLASS[verdict] ?? "border-neutral-200 bg-neutral-50 text-neutral-700" : undefined;

  // Provenance button: show for actionable verdicts (not "clear").
  const showProvenance = sourceUrl && verdict && verdict !== "clear";

  return (
    <div
      data-testid={`question-panel-${id}`}
      className="rounded-lg border border-[#d9ddd4] bg-white"
    >
      {/* Header */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[#d9ddd4] px-4 py-3">
        <h3 className="text-sm font-semibold text-[#17231d]">{question}</h3>
        {lastUpdated ? (
          <span className="text-xs text-neutral-500">Updated {lastUpdated}</span>
        ) : null}
      </div>

      {/* Verdict banner */}
      {verdict && verdictHeadline ? (
        <div className={`m-3 rounded border px-3 py-2 text-sm font-medium ${verdictClass}`}>
          {verdictHeadline}
        </div>
      ) : null}

      {/* Composable body: caller passes what they need */}
      <div className="px-4 py-3">{children}</div>

      {/* Provenance button — bottom-right of the header area */}
      {showProvenance && (
        <div className="px-4 pb-2 flex justify-end">
          <ProvenanceButton
            href={sourceUrl}
            label={sourceLabel ?? "source"}
            fetchedAt={fetchedAt}
          />
        </div>
      )}

      {/* Source provenance */}
      {sourceSummary ? (
        <div className="border-t border-[#d9ddd4] px-4 py-2 text-xs text-neutral-500">
          {sourceSummary}
        </div>
      ) : null}
    </div>
  );
}
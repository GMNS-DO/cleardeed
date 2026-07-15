import React from "react";

/**
 * QuestionTile
 *
 * One of the six buyer questions (Q1–Q6) in the top-of-fold summary.
 * When collapsed, shows the question title, a short summary, and tally
 * chips for critical / watchout / positive findings. When expanded, the
 * parent provides the list of VerdictCard children via the standard
 * React children prop — this component does not render the verdict cards
 * directly. The parent controls expansion via the `expanded` flag and
 * reacts to user clicks via `onToggle`.
 */

export interface Tally {
  critical: number;
  watchout: number;
  positive: number;
  total: number;
}

export interface QuestionTileProps {
  id: string;
  title: string;
  summary: string;
  tally: Tally;
  expanded?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function QuestionTile(props: QuestionTileProps): React.ReactElement {
  const {
    id,
    title,
    summary,
    tally,
    expanded = false,
    onToggle,
    children,
    className,
  } = props;

  const rootClass = `max-w-3xl mx-auto p-4 rounded-lg border border-[#d9ddd4] bg-white ${className ?? ""}`;

  return (
    <section
      style={{ fontFamily: "system-ui, sans-serif" }}
      className={rootClass.trim()}
      data-component="QuestionTile"
      data-question-id={id}
      data-expanded={expanded ? "true" : "false"}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left flex items-baseline justify-between gap-2"
        aria-expanded={expanded}
        aria-controls={`${id}-panel`}
      >
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs uppercase tracking-wider text-[#5b665f] font-mono">
              {id}
            </span>
            <h3 className="text-base font-semibold text-[#17231d]">
              {title}
            </h3>
          </div>
          <p className="text-sm text-[#5b665f] mt-1">{summary}</p>
        </div>
        <div className="flex flex-wrap gap-1 items-center">
          {tally.critical > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-[#b91c1c] text-white">
              {tally.critical} critical
            </span>
          )}
          {tally.watchout > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-[#8a5f1d] text-white">
              {tally.watchout} watchout
            </span>
          )}
          {tally.positive > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-[#1d6f5b] text-white">
              {tally.positive} positive
            </span>
          )}
          {tally.total === 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-[#5b665f] text-white">
              no findings
            </span>
          )}
          <span
            aria-hidden="true"
            className="text-xs text-[#5b665f] ml-1"
          >
            {expanded ? "▾" : "▸"}
          </span>
        </div>
      </button>

      {expanded && (
        <div
          id={`${id}-panel`}
          className="mt-4 space-y-3"
        >
          {children}
        </div>
      )}
    </section>
  );
}

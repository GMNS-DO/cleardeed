import React from "react";

import { ProvenanceButton } from "./ProvenanceButton";
import { SourceLinkResolver, SourceStatus } from "./SourceLinkResolver";

/**
 * VerdictCard
 *
 * Generic verdict / insight card used throughout the buyer-layer report.
 * A left-border stripe is color-coded by severity (positive = green,
 * watchout = amber/gold, redFlag = red). The headline is the short
 * statement, the body is the explanation, and an optional action item
 * appears in italic. The rule ID (when present) renders in monospace
 * at the bottom so a reviewer can trace the card back to its rule.
 *
 * Provenance props (PI-3 T1): when sourceUrl is provided and the verdict
 * is CRITICAL / HIGH (redFlag / watchout), a "Verify yourself" link is
 * rendered at the bottom of the card. Positive / info signals skip the
 * link to reduce noise.
 */

export type Severity = "positive" | "watchout" | "redFlag";

export interface VerdictCardProps {
  severity: Severity;
  headline: string;
  body: string;
  actionItem?: string;
  ruleId?: string;
  className?: string;
  /** Provenance — PI-3 T1 */
  sourceUrl?: string;
  sourceLabel?: string;
  fetchedAt?: string;
  /** Source key for the resolver — when status is no_go/not_run/failed for rccms, the link is suppressed. */
  sourceKey?: string;
  sourceStatus?: SourceStatus;
  /** Manual-verification text rendered when the source is unavailable */
  fallbackAction?: string;
}

const SEVERITY_BORDER: Record<Severity, string> = {
  positive: "#1d6f5b",
  watchout: "#8a5f1d",
  redFlag: "#b91c1c",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  positive: "Positive signal",
  watchout: "Watch-out",
  redFlag: "Red flag",
};

const SEVERITY_CHIP: Record<Severity, string> = {
  positive: "bg-[#1d6f5b] text-white",
  watchout: "bg-[#8a5f1d] text-white",
  redFlag: "bg-[#b91c1c] text-white",
};

export function VerdictCard(props: VerdictCardProps): React.ReactElement {
  const {
    severity,
    headline,
    body,
    actionItem,
    ruleId,
    className,
    sourceUrl,
    sourceLabel,
    fetchedAt,
    sourceKey,
    sourceStatus,
    fallbackAction,
  } = props;

  const rootClass = `max-w-3xl mx-auto p-4 border-l-4 rounded-r bg-white border border-[#d9ddd4] ${className ?? ""}`;

  // Provenance: render for actionable (redFlag / watchout) severities only.
  // Priority order:
  //  1. fallbackAction prop → custom italic helper text.
  //  2. sourceKey + sourceStatus blocked (e.g. rccms no_go) → generic
  //     italic helper text ("data unavailable; verify manually").
  //  3. sourceUrl present → ProvenanceButton.
  // Positive / info signals render nothing provenance-related.
  const provenanceSeverity = severity === "redFlag" || severity === "watchout";

  // Ask the resolver when a sourceKey is available; this blocks the button
  // for sources that return null (e.g. rccms in no_go / not_run / failed).
  const resolverResult =
    sourceKey && sourceStatus ? SourceLinkResolver(sourceKey, sourceStatus) : null;
  const sourceBlocked = resolverResult === null && sourceKey !== undefined;
  const effectiveUrl = resolverResult?.url ?? sourceUrl;

  // Source status-level blocking: if the caller signals a status that the
  // resolver marks as unusable, treat the card as "data unavailable" even
  // when no fallbackAction was explicitly supplied.
  const statusBlocked =
    !!sourceStatus &&
    ["no_go", "not_run", "failed"].includes(sourceStatus) &&
    !fallbackAction;

  const showProvenanceButton =
    provenanceSeverity && effectiveUrl && !sourceBlocked && !statusBlocked && !fallbackAction;

  return (
    <article
      style={{
        fontFamily: "system-ui, sans-serif",
        borderLeftColor: SEVERITY_BORDER[severity],
      }}
      className={rootClass.trim()}
      data-component="VerdictCard"
      data-severity={severity}
    >
      <div className="flex items-baseline gap-2 mb-2">
        <span
          className={`inline-block text-xs px-2 py-0.5 rounded ${SEVERITY_CHIP[severity]}`}
        >
          {SEVERITY_LABEL[severity]}
        </span>
      </div>

      <h3 className="text-base font-semibold text-[#17231d] mb-1">
        {headline}
      </h3>
      <p className="text-sm text-[#17231d]">{body}</p>

      {actionItem && (
        <p className="text-sm italic text-[#5b665f] mt-2">
          Action: {actionItem}
        </p>
      )}

      {provenanceSeverity && (fallbackAction || statusBlocked) && (
        <p
          className="text-sm italic text-[#5b665f] mt-2"
          data-component="ProvenanceFallback"
        >
          {sourceLabel ? `${sourceLabel} — ` : ""}data unavailable;{" "}
          {fallbackAction ?? "Ask your lawyer to verify manually."}
        </p>
      )}

      {showProvenanceButton && (
        <ProvenanceButton
          href={effectiveUrl!}
          label={sourceLabel ?? "source"}
          fetchedAt={fetchedAt}
        />
      )}

      {ruleId && (
        <div className="mt-2">
          <code className="text-xs font-mono text-[#5b665f]">{ruleId}</code>
        </div>
      )}
    </article>
  );
}

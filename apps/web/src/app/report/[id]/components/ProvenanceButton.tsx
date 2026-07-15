import React from "react";

export interface ProvenanceButtonProps {
  /** Destination URL (must be non-empty for the button to render). */
  href: string;
  /** Human-readable source name, e.g. "Bhulekh RoR". */
  label: string;
  /** ISO date string from the source fetch. Rendered as "DD MMM YYYY". */
  fetchedAt?: string;
  /** Additional CSS class names. */
  className?: string;
}

/**
 * ProvenanceButton
 *
 * A small, visually-subtle "Verify yourself" link that points the buyer to
 * the authoritative source portal. Appears below insight cards and question
 * panels so the buyer (or their lawyer) can independently confirm any
 * CRITICAL / HIGH claim.
 */

export function ProvenanceButton({
  href,
  label,
  fetchedAt,
  className = "",
}: ProvenanceButtonProps): React.ReactElement | null {
  if (!href) return null;

  const dateLabel = fetchedAt
    ? (() => {
        try {
          const d = new Date(fetchedAt);
          if (Number.isNaN(d.getTime())) return null;
          return d.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
        } catch {
          return null;
        }
      })()
    : null;

  return (
    <div
      className={`mt-3 pt-2 border-t border-[#d9ddd4] ${className}`}
      data-component="ProvenanceButton"
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Verify this claim on ${label}`}
        className="text-xs text-[#5b665f] hover:text-[#17231d] underline underline-offset-2 transition-colors"
      >
        Verify yourself ↗
      </a>
      {dateLabel && (
        <time
          className="block text-xs text-[#5b665f] opacity-75 mt-0.5"
          dateTime={fetchedAt}
        >
          Data from {label}, fetched {dateLabel}
        </time>
      )}
    </div>
  );
}

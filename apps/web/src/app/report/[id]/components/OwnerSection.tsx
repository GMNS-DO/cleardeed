import React from "react";

/**
 * OwnerSection
 *
 * Displays ownership of the plot. Primary owner is rendered with both the
 * original Odia text and a Latin transliteration, plus guardian name and
 * residence where the RoR surfaced them. Co-owners appear as a compact
 * list. The name-match verdict chip reports how the buyer's claimed
 * seller name relates to the official RoR owner (or "no claimed name"
 * when the buyer did not provide one).
 */

export type NameMatchState =
  | "ror_available"
  | "ror_unavailable"
  | "claimed_name_mismatch"
  | "no_claimed_name"
  | "unknown";

export interface OwnerMatchInfo {
  state: NameMatchState;
  claimedName: string | null;
  officialName: string | null;
  confidence: number;
  explanation: string;
}

export interface PrimaryOwner {
  odia: string;
  latin: string;
  guardianOdia?: string;
  guardianLatin?: string;
  casteOdia?: string;
  residenceOdia?: string;
}

export interface OwnerSectionProps {
  primaryOwner: PrimaryOwner | null;
  coOwners: Array<{ latin: string; odia: string }>;
  nameMatch: OwnerMatchInfo;
  className?: string;
}

const MATCH_STATE_LABEL: Record<NameMatchState, string> = {
  ror_available: "RoR owner found",
  ror_unavailable: "RoR owner not available",
  claimed_name_mismatch: "Claimed name does not match",
  no_claimed_name: "No claimed name provided",
  unknown: "Match status unknown",
};

const MATCH_STATE_CHIP: Record<NameMatchState, string> = {
  ror_available: "bg-[#1d6f5b] text-white",
  ror_unavailable: "bg-[#5b665f] text-white",
  claimed_name_mismatch: "bg-[#b91c1c] text-white",
  no_claimed_name: "bg-[#8a5f1d] text-white",
  unknown: "bg-[#5b665f] text-white",
};

export function OwnerSection(props: OwnerSectionProps): React.ReactElement {
  const { primaryOwner, coOwners, nameMatch, className } = props;

  const rootClass = `max-w-3xl mx-auto p-6 rounded-lg border border-[#d9ddd4] bg-white ${className ?? ""}`;

  return (
    <section
      style={{ fontFamily: "system-ui, sans-serif" }}
      className={rootClass.trim()}
      data-component="OwnerSection"
    >
      <h2 className="text-xs uppercase tracking-wider text-[#5b665f] mb-3">
        Owner
      </h2>

      {/* Match verdict chip */}
      <div className="mb-4">
        <span
          className={`inline-block text-xs px-2 py-1 rounded ${MATCH_STATE_CHIP[nameMatch.state]}`}
          title={nameMatch.explanation}
        >
          {MATCH_STATE_LABEL[nameMatch.state]}
          {typeof nameMatch.confidence === "number" &&
            nameMatch.confidence > 0 && (
              <span className="ml-2 opacity-80">
                {Math.round(nameMatch.confidence * 100)}%
              </span>
            )}
        </span>
        <p className="text-sm text-[#5b665f] mt-2">{nameMatch.explanation}</p>
      </div>

      {/* Primary owner */}
      {primaryOwner ? (
        <div className="mb-4">
          <div className="text-lg font-semibold text-[#17231d]">
            {primaryOwner.latin || primaryOwner.odia}
          </div>
          {primaryOwner.latin && primaryOwner.odia ? (
            <div className="text-sm text-[#5b665f] font-odia">
              {primaryOwner.odia}
            </div>
          ) : null}

          {/* Guardian */}
          {(primaryOwner.guardianLatin || primaryOwner.guardianOdia) && (
            <div className="mt-2 text-sm text-[#5b665f]">
              <span className="uppercase tracking-wider text-xs mr-2">
                Guardian
              </span>
              <span>
                {primaryOwner.guardianLatin || primaryOwner.guardianOdia}
              </span>
              {primaryOwner.guardianLatin && primaryOwner.guardianOdia ? (
                <span className="ml-2 opacity-75">
                  ({primaryOwner.guardianOdia})
                </span>
              ) : null}
            </div>
          )}

          {/* Caste / community */}
          {primaryOwner.casteOdia && (
            <div className="mt-1 text-sm text-[#5b665f]">
              <span className="uppercase tracking-wider text-xs mr-2">
                Caste / community
              </span>
              <span>{primaryOwner.casteOdia}</span>
            </div>
          )}

          {/* Residence */}
          {primaryOwner.residenceOdia && (
            <div className="mt-1 text-sm text-[#5b665f]">
              <span className="uppercase tracking-wider text-xs mr-2">
                Residence
              </span>
              <span>{primaryOwner.residenceOdia}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-[#5b665f] mb-4">
          No primary owner recorded in the RoR for this plot.
        </p>
      )}

      {/* Co-owners */}
      {coOwners.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-[#5b665f] mb-2">
            Co-owners ({coOwners.length})
          </h3>
          <ul className="space-y-1">
            {coOwners.map((c, idx) => (
              <li key={`${c.odia}-${idx}`} className="text-sm text-[#17231d]">
                <span>{c.latin || c.odia}</span>
                {c.latin && c.odia ? (
                  <span className="ml-2 text-[#5b665f] text-xs">
                    ({c.odia})
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

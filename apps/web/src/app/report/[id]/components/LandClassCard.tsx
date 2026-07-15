import React from "react";

/**
 * LandClassCard
 *
 * Land-classification block. Renders the raw Odia kisam alongside its
 * English translation, a conversion-required badge (yes / no / unknown),
 * and any restrictions surfaced for this land class. Restrictions are
 * color-coded by severity (info, watchout, redFlag).
 */

export type RestrictionSeverity = "info" | "watchout" | "redFlag";

export interface LandRestriction {
  flag: string;
  severity: RestrictionSeverity;
  description: string;
  recommendedAction?: string;
}

export interface LandClassCardProps {
  odia: string;
  english: string;
  conversionRequired: boolean | null;
  restrictions: LandRestriction[];
  className?: string;
}

const RESTRICTION_CHIP: Record<RestrictionSeverity, string> = {
  info: "bg-[#1d6f5b] text-white",
  watchout: "bg-[#8a5f1d] text-white",
  redFlag: "bg-[#b91c1c] text-white",
};

function conversionBadge(value: boolean | null): {
  text: string;
  classes: string;
} {
  if (value === true) {
    return { text: "Conversion required", classes: "bg-[#8a5f1d] text-white" };
  }
  if (value === false) {
    return {
      text: "No conversion required",
      classes: "bg-[#1d6f5b] text-white",
    };
  }
  return { text: "Conversion status unknown", classes: "bg-[#5b665f] text-white" };
}

export function LandClassCard(props: LandClassCardProps): React.ReactElement {
  const { odia, english, conversionRequired, restrictions, className } = props;

  const rootClass = `max-w-3xl mx-auto p-6 rounded-lg border border-[#d9ddd4] bg-white ${className ?? ""}`;

  const conv = conversionBadge(conversionRequired);

  return (
    <section
      style={{ fontFamily: "system-ui, sans-serif" }}
      className={rootClass.trim()}
      data-component="LandClassCard"
    >
      <h2 className="text-xs uppercase tracking-wider text-[#5b665f] mb-3">
        Land Classification
      </h2>

      <div className="mb-3">
        <div className="text-lg font-semibold text-[#17231d]">{english}</div>
        {odia && odia !== english && (
          <div className="text-sm text-[#5b665f] font-odia">{odia}</div>
        )}
      </div>

      <div className="mb-4">
        <span
          className={`inline-block text-xs px-2 py-1 rounded ${conv.classes}`}
        >
          {conv.text}
        </span>
      </div>

      {restrictions.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-[#5b665f] mb-2">
            Restrictions ({restrictions.length})
          </h3>
          <ul className="space-y-3">
            {restrictions.map((r, idx) => (
              <li
                key={`${r.flag}-${idx}`}
                className="border-l-4 border-[#d9ddd4] pl-3"
                style={{ borderLeftColor: severityColor(r.severity) }}
              >
                <div className="flex items-baseline gap-2 mb-1">
                  <span
                    className={`inline-block text-xs px-2 py-0.5 rounded ${RESTRICTION_CHIP[r.severity]}`}
                  >
                    {r.flag}
                  </span>
                </div>
                <p className="text-sm text-[#17231d]">{r.description}</p>
                {r.recommendedAction && (
                  <p className="text-sm italic text-[#5b665f] mt-1">
                    Action: {r.recommendedAction}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function severityColor(s: RestrictionSeverity): string {
  switch (s) {
    case "info":
      return "#1d6f5b";
    case "watchout":
      return "#8a5f1d";
    case "redFlag":
      return "#b91c1c";
  }
}

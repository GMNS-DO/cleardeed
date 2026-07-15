import React from "react";

/**
 * PropertyHeader
 *
 * Plot-identity block at the top of the buyer-layer report. Displays the
 * location breadcrumb (village → tahasil → district), plot number + area
 * in acres (with decimal precision), the GPS coordinates that were used
 * to locate the plot, and source-status chips for each upstream fetcher
 * (Bhulekh, Bhunaksha, Nominatim).
 *
 * Color coding for source chips:
 *   - success  → green
 *   - partial  → amber
 *   - failed   → red
 *   - not_run  → gray
 */

export type SourceStatusValue =
  | "success"
  | "partial"
  | "failed"
  | "not_run";

export interface PropertyHeaderProps {
  village: string;
  tahasil: string;
  district: string;
  plotNo: string;
  areaAcres: number | null;
  areaDecimal: number | null;
  gpsLat: number;
  gpsLon: number;
  sourceStatus: {
    bhulekh: SourceStatusValue;
    bhunaksha: SourceStatusValue;
    nominatim: SourceStatusValue;
  };
  className?: string;
}

const STATUS_CHIP_CLASSES: Record<SourceStatusValue, string> = {
  success: "bg-[#1d6f5b] text-white",
  partial: "bg-[#8a5f1d] text-white",
  failed: "bg-[#b91c1c] text-white",
  not_run: "bg-[#5b665f] text-white",
};

const STATUS_LABEL: Record<SourceStatusValue, string> = {
  success: "verified",
  partial: "partial",
  failed: "failed",
  not_run: "not run",
};

function formatArea(areaAcres: number | null, areaDecimal: number | null): string {
  if (areaAcres == null && areaDecimal == null) return "—";
  if (areaAcres != null && areaDecimal != null) {
    return `${areaAcres.toFixed(4)} ac (${areaDecimal.toFixed(2)} dec)`;
  }
  if (areaAcres != null) return `${areaAcres.toFixed(4)} ac`;
  return `${(areaDecimal as number).toFixed(2)} dec`;
}

export function PropertyHeader(props: PropertyHeaderProps): React.ReactElement {
  const {
    village,
    tahasil,
    district,
    plotNo,
    areaAcres,
    areaDecimal,
    gpsLat,
    gpsLon,
    sourceStatus,
    className,
  } = props;

  const rootClass = `max-w-3xl mx-auto p-6 rounded-lg border border-[#d9ddd4] bg-white ${className ?? ""}`;

  return (
    <header
      style={{ fontFamily: "system-ui, sans-serif" }}
      className={rootClass.trim()}
      data-component="PropertyHeader"
    >
      {/* Location breadcrumb */}
      <div className="text-xs uppercase tracking-wider text-[#5b665f] mb-2">
        {[village, tahasil, district].filter(Boolean).join(" · ")}
      </div>

      {/* Plot identity row */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-[#5b665f]">
            Plot
          </div>
          <div className="text-2xl font-semibold text-[#17231d]">{plotNo}</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-[#5b665f]">
            Area
          </div>
          <div className="text-2xl font-semibold text-[#17231d]">
            {formatArea(areaAcres, areaDecimal)}
          </div>
        </div>
      </div>

      {/* GPS row */}
      <div className="text-sm text-[#5b665f] mb-4">
        <span className="font-mono">
          {gpsLat.toFixed(6)}, {gpsLon.toFixed(6)}
        </span>
      </div>

      {/* Source-status chips */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(sourceStatus) as Array<keyof typeof sourceStatus>).map(
          (key) => {
            const value = sourceStatus[key];
            return (
              <span
                key={key}
                className={`text-xs px-2 py-1 rounded ${STATUS_CHIP_CLASSES[value]}`}
                title={`${key}: ${STATUS_LABEL[value]}`}
              >
                {key} · {STATUS_LABEL[value]}
              </span>
            );
          },
        )}
      </div>
    </header>
  );
}

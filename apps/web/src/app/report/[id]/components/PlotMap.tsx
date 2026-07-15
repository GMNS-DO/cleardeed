import React from "react";

/**
 * PlotMap
 *
 * Renders an interactive Mapbox polygon of the plot when Bhunaksha
 * returned one. Falls back to a center-only placeholder when only a
 * GPS fallback center is available. The underlying `MapboxBoundaryMap`
 * lives under `src/components/` and is imported via the `@/` alias.
 *
 * Responsive padding — the wrapper card steps down from `p-6` on
 * desktop to `p-2` on phones so the map and adjacent diagrams fit
 * inside a 320 px viewport (PI-4 T1).
 */

import { MapboxBoundaryMap } from "@/components/MapboxBoundaryMap";

export interface PlotMapProps {
  polygon?: number[][][];
  villageName?: string;
  plotNo?: string;
  fallbackCenter?: { lat: number; lon: number };
  /**
   * URL of the Bhulekh plot diagram (SVG/PNG) to render as a real <img>.
   * Alt text is derived from villageName + plotNo and must never be empty.
   */
  plotDiagramUrl?: string;
  className?: string;
}

function MapPlaceholder(props: {
  villageName?: string;
  plotNo?: string;
  center?: { lat: number; lon: number };
}): React.ReactElement {
  const centerLine = props.center
    ? ` at ${props.center.lat.toFixed(4)}°N, ${props.center.lon.toFixed(4)}°E`
    : "";
  return (
    <div
      style={{ fontFamily: "system-ui, sans-serif" }}
      className="mx-auto max-w-3xl rounded-lg border border-[#d9ddd4] bg-white p-2 sm:p-4 md:p-6"
      data-component="PlotMapPlaceholder"
    >
      <h2 className="text-xs uppercase tracking-wider text-[#5b665f] mb-2">
        Map
      </h2>
      <div className="h-40 flex items-center justify-center border border-dashed border-[#d9ddd4] rounded text-sm text-[#5b665f]">
        Map pending — polygon not available{centerLine}
        {props.villageName ? ` · ${props.villageName}` : ""}
        {props.plotNo ? ` · plot ${props.plotNo}` : ""}
      </div>
    </div>
  );
}

export function PlotMap(props: PlotMapProps): React.ReactElement {
  const { polygon, villageName, plotNo, fallbackCenter, plotDiagramUrl, className } = props;

  const rootClass = `max-w-3xl mx-auto rounded-lg overflow-hidden border border-[#d9ddd4] bg-white ${className ?? ""}`;
  const diagramAlt = `Plot diagram for ${villageName ?? "this plot"}${plotNo ? `, plot ${plotNo}` : ""}`;
  const figureClass = "p-2 sm:p-4 md:p-6";

  if (polygon) {
    return (
      <div
        style={{ fontFamily: "system-ui, sans-serif" }}
        className={rootClass.trim()}
        data-component="PlotMap"
      >
        <MapboxBoundaryMap
          polygon={polygon}
          villageName={villageName}
          plotNo={plotNo}
          fallbackCenter={fallbackCenter}
        />
        {plotDiagramUrl ? (
          <figure className={`border-t border-[#d9ddd4] bg-white ${figureClass}`}>
            <img
              src={plotDiagramUrl}
              alt={diagramAlt}
              data-testid="plot-diagram-img"
              loading="lazy"
              className="block h-auto max-w-full rounded border border-[#d9ddd4]"
            />
            <figcaption className="mt-2 text-xs text-[#5b665f]">
              Bhulekh cadastral plot diagram
            </figcaption>
          </figure>
        ) : null}
      </div>
    );
  }

  if (fallbackCenter) {
    return (
      <>
        <MapPlaceholder villageName={villageName} plotNo={plotNo} center={fallbackCenter} />
        {plotDiagramUrl ? (
          <figure className={`mt-3 max-w-3xl mx-auto rounded-lg border border-[#d9ddd4] bg-white ${figureClass}`}>
            <img
              src={plotDiagramUrl}
              alt={diagramAlt}
              data-testid="plot-diagram-img"
              loading="lazy"
              className="block h-auto max-w-full rounded border border-[#d9ddd4]"
            />
            <figcaption className="mt-2 text-xs text-[#5b665f]">
              Bhulekh cadastral plot diagram
            </figcaption>
          </figure>
        ) : null}
      </>
    );
  }

  return <MapPlaceholder villageName={villageName} plotNo={plotNo} />;
}

// Re-export the underlying MapboxBoundaryMap so callers can compose the
// map directly when they already have a polygon in hand.
export { MapboxBoundaryMap };

"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";

interface MapboxMapProps {
  /** GeoJSON polygon coordinates from Bhunaksha WFS */
  polygon: number[][][];
  /** Center the map on this point if polygon fails */
  fallbackCenter?: { lat: number; lon: number };
  /** Village label for the overlay */
  villageName?: string;
  /** Plot number for the overlay */
  plotNo?: string;
}

export function MapboxBoundaryMap({ polygon, fallbackCenter, villageName, plotNo }: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapStyle, setMapStyle] = useState<"streets" | "satellite">("satellite");
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  useEffect(() => {
    if (!containerRef.current || !token) return;
    if (!polygon || !polygon.length || !polygon[0]?.length) return;

    // Compute centroid of the polygon for initial map center
    const coords = polygon[0];
    let sumLat = 0, sumLon = 0;
    const n = coords.length;
    for (let i = 0; i < n; i++) { sumLat += coords[i][1]; sumLon += coords[i][0]; }
    const centerLat = sumLat / n;
    const centerLon = sumLon / n;

    mapboxgl.accessToken = token;

    const existing = mapRef.current;
    if (existing) {
      existing.remove();
      mapRef.current = null;
    }

    const styleUrl =
      mapStyle === "satellite"
        ? "mapbox://styles/mapbox/satellite-streets-v12"
        : "mapbox://styles/mapbox/streets-v12";

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [centerLon, centerLat],
      zoom: 17,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on("load", () => {
      setMapLoaded(true);

      // Add the plot polygon fill
      map.addSource("plot-polygon", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: polygon },
          properties: {},
        },
      });

      // Fill layer — semi-transparent to see satellite underneath
      map.addLayer({
        id: "plot-fill",
        type: "fill",
        source: "plot-polygon",
        paint: {
          "fill-color": "#1d6f5b",
          "fill-opacity": 0.25,
        },
      });

      // Stroke layer — bright outline for visibility
      map.addLayer({
        id: "plot-outline",
        type: "line",
        source: "plot-polygon",
        paint: {
          "line-color": "#1d6f5b",
          "line-width": 2.5,
          "line-opacity": 0.9,
        },
      });

      // Add a label for the plot
      const label = plotNo ? `Plot ${plotNo}` : (villageName ?? "Plot");
      new mapboxgl.Marker({ color: "#1d6f5b" })
        .setLngLat([centerLon, centerLat])
        .setPopup(new mapboxgl.Popup({ offset: 15 }).setText(label))
        .addTo(map);

      // Fit map to polygon bounds
      const bounds = new mapboxgl.LngLatBounds();
      coords.forEach(([lon, lat]) => bounds.extend([lon, lat]));
      map.fitBounds(bounds, { padding: 60, maxZoom: 19 });
    });

    map.on("error", (e) => {
      console.error("[MapboxBoundaryMap] map error:", e.error?.message ?? e);
      setMapError("Map could not load. Please try again.");
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, [polygon, token]);

  // Update style when satellite/streets toggle changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const styleUrl =
      mapStyle === "satellite"
        ? "mapbox://styles/mapbox/satellite-streets-v12"
        : "mapbox://styles/mapbox/streets-v12";

    map.setStyle(styleUrl);

    // Re-add layers after style change
    map.once("style.load", () => {
      if (!map.getSource("plot-polygon")) {
        map.addSource("plot-polygon", {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: { type: "Polygon", coordinates: polygon },
            properties: {},
          },
        });
      }
      if (!map.getLayer("plot-fill")) {
        map.addLayer({
          id: "plot-fill",
          type: "fill",
          source: "plot-polygon",
          paint: { "fill-color": "#1d6f5b", "fill-opacity": 0.25 },
        });
      }
      if (!map.getLayer("plot-outline")) {
        map.addLayer({
          id: "plot-outline",
          type: "line",
          source: "plot-polygon",
          paint: { "line-color": "#1d6f5b", "line-width": 2.5, "line-opacity": 0.9 },
        });
      }
    });
  }, [mapStyle, mapLoaded, polygon]);

  if (!token) {
    return (
      <div className="rounded border border-[#d9ddd4] bg-[#f7f7f2] p-4 text-sm text-[#5b665f]">
        <p>Map requires NEXT_PUBLIC_MAPBOX_TOKEN — not yet configured. Map will appear once the token is added to Vercel environment variables.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-[#5b665f]">
          {villageName && plotNo ? `${villageName} · Plot ${plotNo}` : villageName ? villageName : "Plot boundary"}
        </span>
        <div className="flex rounded border border-[#d9ddd4] overflow-hidden text-xs">
          <button
            type="button"
            onClick={() => setMapStyle("satellite")}
            className={`px-3 py-1 ${mapStyle === "satellite" ? "bg-[#1d6f5b] text-white" : "bg-white text-[#5b665f]"}`}
          >
            Satellite
          </button>
          <button
            type="button"
            onClick={() => setMapStyle("streets")}
            className={`px-3 py-1 border-l border-[#d9ddd4] ${mapStyle === "streets" ? "bg-[#1d6f5b] text-white" : "bg-white text-[#5b665f]"}`}
          >
            Streets
          </button>
        </div>
      </div>

      {/* Map container */}
      <div className="relative rounded border border-[#d9ddd4] overflow-hidden" style={{ height: 320 }}>
        {mapError ? (
          <div className="flex h-full items-center justify-center bg-[#f7f7f2] text-sm text-[#5b665f]">
            {mapError}
          </div>
        ) : (
          <>
            <div ref={containerRef} className="h-full w-full" />
            {!mapLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#f7f7f2]">
                <div className="flex items-center gap-2 text-sm text-[#5b665f]">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#1d6f5b] border-t-transparent" />
                  Loading map…
                </div>
              </div>
            )}
            {/* Attribution */}
            <div className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
              © Mapbox © OpenStreetMap
            </div>
          </>
        )}
      </div>

      {/* Street view link */}
      {fallbackCenter && (
        <a
          href={`https://www.google.com/maps?q=${fallbackCenter.lat},${fallbackCenter.lon}&layer=satellite`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-[#1d6f5b] hover:underline"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
          </svg>
          Open in Google Maps
        </a>
      )}
    </div>
  );
}
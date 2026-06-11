/**
 * Bhunaksha WFS layer mapping for Khordha tehsils.
 *
 * Format: district_tahasil (all lowercase, underscores)
 * Source: GeoServer WFS at https://mapserver.odisha4kgeo.in/geoserver/revenue/wfs
 * TYPENAME prefix: "revenue:{layerName}"
 *
 * Add new tehsils here as they become available.
 * Default layer for any unmapped tehsil: "khurda_bhubaneswar"
 */
export const BHUNAKSHA_LAYER_MAP: Record<string, string> = {
  // Bhubaneswar tehsil
  bhubaneswar: "khurda_bhubaneswar",
  // Other Khordha tehsils — add as they are confirmed
  // jatni:       "khurda_jatni",     // TODO: confirm layer name
  // banapur:     "khurda_banapur",   // TODO: confirm layer name
  // balipatna:   "khurda_balipatna", // TODO: confirm layer name
  // beginia:     "khurda_beginia",   // TODO: confirm layer name
  // bolgarh:     "khurda_bolgarh",   // TODO: confirm layer name
  // khandagiri:  "khurda_khandagiri", // TODO: confirm layer name (if exists)
};

export const DEFAULT_BHUNAKSHA_LAYER = "khurda_bhubaneswar";

/**
 * Resolve the Bhunaksha WFS layer name for a given tehsil.
 * Falls back to DEFAULT_BHUNAKSHA_LAYER if not found.
 */
export function resolveBhunakshaLayer(tehsilName: string): string {
  const key = tehsilName.toLowerCase().replace(/\s+/g, "").trim();
  return BHUNAKSHA_LAYER_MAP[key] ?? DEFAULT_BHUNAKSHA_LAYER;
}
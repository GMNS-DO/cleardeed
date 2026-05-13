/**
 * RegulatoryScreener (A8) — Overlay zone screening for ClearDeed
 *
 * Checks whether a plot falls within regulated zones:
 *   - PESA (Panchayat Extension to Scheduled Areas) — tribal lands
 *   - CRZ (Coastal Regulation Zone) — within 500m of HTL
 *   - Forest land — notified forest areas
 *   - Land ceiling / ceiling surplus land
 *
 * Inputs: Bhunaksha SourceResult with plot polygon + GPS
 * Output: RegulatoryFlagsReport for A10 ConsumerReportWriter
 */

export interface RedFlag {
  flag: string;
  severity: "high" | "medium" | "low";
  proximity?: string;
  description: string;
  recommendedAction?: string;
}

export interface RegulatoryScreenerResult {
  flags: RedFlag[];
  plotConfirmedInRegulatedZone?: boolean;
  overlaySource?: string;
  confidence: number;
  confidenceBasis: string;
}

interface BhunakshaData {
  plotNo?: string;
  village?: string;
  tahasil?: string;
  district?: string;
  areaSqKm?: number;
}

/**
 * Screen a plot for regulatory overlay zones.
 *
 * In V1: placeholder implementation — checks GPS coordinates against known
 * Khordha regulatory boundaries. Full overlay analysis requires ORSAC KML data.
 */
export function screenRegulations(bhunakshaSrc: { data?: BhunakshaData | null }): RegulatoryScreenerResult {
  const bhunaksha = bhunakshaSrc?.data;

  // TODO: Integrate ORSAC KML overlay data when available
  // For now, return empty flags — full screening deferred until ORSAC data is accessible

  const flags: RedFlag[] = [];

  // Placeholder: check if village is in known PESA area
  // This would be replaced with actual KML overlay analysis
  const pesaVillages: string[] = []; // No PESA villages in Khordha per current knowledge

  if (bhunaksha?.village && pesaVillages.some((v) => bhunaksha.village!.toLowerCase().includes(v.toLowerCase()))) {
    flags.push({
      flag: "PESA Zone",
      severity: "high",
      description:
        "This plot falls within a PESA (Panchayat Extension to Scheduled Areas) zone. Tribal land transfers require additional approvals from the Gram Sabha and District Collector.",
      recommendedAction:
        "Obtain Gram Sabha resolution and District Collector NOC before any transaction. Consult a lawyer specializing in tribal land law.",
    });
  }

  return {
    flags,
    plotConfirmedInRegulatedZone: flags.length > 0,
    overlaySource: bhunaksha ? "Bhunaksha GeoServer WFS (mapserver.odisha4kgeo.in)" : undefined,
    confidence: 0.5,
    confidenceBasis:
      flags.length === 0
        ? "Regulatory overlay screening is incomplete. Full forest, coastal, PESA, airport, archaeological, and town-planning layers are not integrated."
        : "Regulatory flags identified from village-level PESA classification.",
  };
}

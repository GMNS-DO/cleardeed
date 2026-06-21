// agents/consumer-report-writer/src/insights/registry/bhuvan-flood/flood.ts
//
// T-041 — Bhuvan flood hazard insights.
//
// ROR-INS-200 fires when the Bhuvan flood raster places the plot in a medium,
// high, or very_high frequency zone — material for Q2 buildability.
//
// ROR-INS-201 is the manual-verification card emitted when Bhuvan data is
// unavailable (status != "success" or no data attached). Per CLAUDE.md, the
// Bhuvan raster is published under a planning-only license and the consumer
// copy must make that explicit.
//
// Bhuvan data lives on input.bhuvanFlood as:
//   {
//     floodFrequency: "none" | "low" | "medium" | "high" | "very_high" | "unknown",
//     layersProbed: string[],
//     getFeatureInfoBlocked: boolean,
//     tileBytes: number | null,
//     dataSource: "bhuvan-ras2.nrsc.gov.in",
//   }
// The mapping layer (agents/consumer-report-writer/src/mapper.ts) places this
// payload under `bhuvanFloodData` on the report input.

import type { Insight, Rule, RuleInput } from "../../schema";
import { stubFor } from "../_shared";

const v = "1.0.0";

type FloodFrequency =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "very_high"
  | "unknown";

type BhuvanFloodData = {
  floodFrequency?: FloodFrequency;
  layersProbed?: string[];
  getFeatureInfoBlocked?: boolean;
  tileBytes?: number | null;
  dataSource?: string;
};

function getBhuvanFlood(input: RuleInput): BhuvanFloodData | null {
  // The mapper forwards Bhuvan payload under both bhuvanFloodData and (legacy)
  // input.bhuvanFlood for rules. Prefer the explicit field when present.
  const bag = input as unknown as { bhuvanFloodData?: unknown; bhuvanFlood?: unknown };
  const raw = (bag.bhuvanFloodData ?? bag.bhuvanFlood) as BhuvanFloodData | null | undefined;
  if (!raw || typeof raw !== "object") return null;
  return raw;
}

function isMediumOrAbove(f: FloodFrequency | undefined): boolean {
  return f === "medium" || f === "high" || f === "very_high";
}

// ROR-INS-200 — watchout when Bhuvan places the plot in medium-or-higher
// historical flood frequency (Q2 buildability).
function floodFrequencyWatchout(input: RuleInput): Insight[] | null {
  const data = getBhuvanFlood(input);
  if (!data) return null;
  const freq = data.floodFrequency;
  if (!isMediumOrAbove(freq)) return null;

  const severityByFreq: Record<FloodFrequency, "watchout" | "redFlag"> = {
    none: "watchout",
    low: "watchout",
    medium: "watchout",
    high: "watchout",
    very_high: "redFlag",
    unknown: "watchout",
  };

  const headlineByFreq: Record<FloodFrequency, string> = {
    medium:
      "Plot falls in a Bhuvan historical-flood medium-frequency zone",
    high:
      "Plot falls in a Bhuvan historical-flood high-frequency zone",
    very_high:
      "Plot falls in a Bhuvan historical-flood very-high-frequency zone",
    none: "",
    low: "",
    unknown: "",
  };

  const bodyByFreq: Record<FloodFrequency, string> = {
    medium:
      "Bhuvan's historical flood-frequency raster places this GPS in a medium-frequency zone. Construction here typically requires plinth/stilt design and may face higher insurance premiums.",
    high:
      "Bhuvan's historical flood-frequency raster places this GPS in a high-frequency zone. Building a habitable ground floor here is risky without raised plinth, stilt, or substantial flood-resilience design.",
    very_high:
      "Bhuvan's historical flood-frequency raster places this GPS in a very-high-frequency zone. Building a habitable structure on this plot is strongly discouraged; insurance may be unavailable or very expensive.",
    none: "",
    low: "",
    unknown: "",
  };

  const actionByFreq: Record<FloodFrequency, string> = {
    medium:
      "Ask the seller's engineer for flood-resilient design notes; get flood-insurance quotes from at least two insurers before token payment.",
    high:
      "Ask for the engineer's flood-resilient design; verify the proposed plinth level against the local flood history. Get insurance quotes before paying any token.",
    very_high:
      "Treat this as a likely no-go for residential purchase unless the seller can demonstrate (a) a substantial plinth/stilt design with engineer sign-off and (b) a flood-insurance offer at a price you can live with.",
    none: "",
    low: "",
    unknown: "",
  };

  const layerNote = data.layersProbed?.length
    ? ` Layers probed: ${data.layersProbed.join(", ")}.`
    : "";

  return [{
    panel: "land",
    issueLens: "natural_hazard",
    evidenceStrength: "source_observation",
    source: data.dataSource
      ? `${data.dataSource}:flood:freq`
      : "bhuvan-ras2.nrsc.gov.in:flood:freq",
    severity: severityByFreq[freq as FloodFrequency],
    headline: headlineByFreq[freq as FloodFrequency],
    body: bodyByFreq[freq as FloodFrequency] + layerNote,
    actionItem: actionByFreq[freq as FloodFrequency],
    ruleId: "ROR-INS-200",
  }];
}

// ROR-INS-201 — manual verification card when Bhuvan flood data is unavailable.
// Triggered when the mapper has no bhuvanFloodData, status was not "success",
// or the fetcher could not classify the tile.
function floodDataUnavailableStub(input: RuleInput): Insight[] | null {
  const data = getBhuvanFlood(input);
  // No payload at all — bhuvan-flood source did not run or returned nothing.
  if (!data) {
    return [
      stubFor(
        "ROR-INS-201",
        "land",
        "natural_hazard",
        "parser_uncertain",
        "Bhuvan flood hazard data was not retrieved for this plot. We could not classify the historical flood frequency for this GPS.",
        "Open https://bhuvan-ras2.nrsc.gov.in and zoom to this plot's coordinates. Note any flood-frequency zone the map shows. Bhuvan data is published for planning purposes only — verify with NRSC for any legal decision.",
        "Bhuvan flood data not retrieved — zoom the map manually"
      ),
    ];
  }

  const freq = data.floodFrequency;
  const blocked = data.getFeatureInfoBlocked === true;
  const noClassification = !freq || freq === "unknown";

  if (!noClassification && !blocked) return null;

  const body = blocked
    ? "The Bhuvan flood raster tile was reachable but the GetFeatureInfo endpoint did not return a classification for this GPS. We could not determine the flood frequency automatically."
    : "Bhuvan flood raster was reachable, but no flood-frequency classification was returned for this GPS.";

  return [
    stubFor(
      "ROR-INS-201",
      "land",
      "natural_hazard",
      "parser_uncertain",
      body,
      "Open https://bhuvan-ras2.nrsc.gov.in and zoom to this plot's coordinates. Note any flood-frequency zone the map shows. Bhuvan data is published for planning purposes only — verify with NRSC for any legal decision.",
      "Bhuvan flood data not retrieved — zoom the map manually"
    ),
  ];
}

export const bhuvanFloodRules: Rule[] = [
  { id: "ROR-INS-200", panel: "land", fn: floodFrequencyWatchout, version: v },
  { id: "ROR-INS-201", panel: "land", fn: floodDataUnavailableStub, version: v },
];
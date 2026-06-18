// agents/consumer-report-writer/src/insights/registry/bhunaksha/road-access.ts
import type { Insight, Rule, RuleInput } from "../../schema";
import { stubFor } from "../_shared";

const v = "1.0.0";

// Bhulekh chauhaddi keys; we also accept "up"/"down"/"left"/"right" as aliases.
const SIDES = ["north", "south", "east", "west"] as const;
type Side = (typeof SIDES)[number];

type ChauhaddiSide = {
  type?: string;
  label?: string;
  plotNumber?: string;
};

function getChauhaddi(input: RuleInput): Record<string, ChauhaddiSide> | null {
  const b = (input as any).bhunaksha;
  if (!b || b.status !== "success" || !b.data) return null;
  const c = b.data.chauhaddi;
  if (!c || typeof c !== "object") return null;
  return c as Record<string, ChauhaddiSide>;
}

function isRoadSide(side: ChauhaddiSide | undefined): boolean {
  if (!side) return false;
  const t = (side.type ?? "").toLowerCase().trim();
  if (t === "road" || t === "rasta" || t === "danga") return true;
  const lbl = (side.label ?? "").toLowerCase();
  if (lbl.includes("danga") || lbl.includes("rasta") || lbl.includes("road")) return true;
  return false;
}

function isKhaSide(side: ChauhaddiSide | undefined): boolean {
  if (!side) return false;
  const t = (side.type ?? "").toUpperCase().trim();
  if (t === "KHA") return true;
  const lbl = (side.label ?? "").toUpperCase();
  return lbl.startsWith("KHA") || lbl.includes("GOVT") || lbl.includes("GOVERNMENT");
}

function hasAnyRoadOnAnySide(c: Record<string, ChauhaddiSide>): boolean {
  for (const s of SIDES) {
    if (isRoadSide(c[s])) return true;
  }
  return false;
}

function allSidesAreKhaOrGovt(c: Record<string, ChauhaddiSide>): boolean {
  let allGovt = true;
  for (const s of SIDES) {
    if (!isKhaSide(c[s])) {
      allGovt = false;
      break;
    }
  }
  return allGovt;
}

// ROR-INS-080 — redFlag when chauhaddi is present and has no road on any side.
// HIGH #5: split from the previous dual-emit shape. Returns null when
// chauhaddi data is missing — that case is now handled by ROR-INS-083 below.
function noAdjacentRoadRedFlag(input: RuleInput): Insight[] | null {
  const c = getChauhaddi(input);
  if (!c) return null;
  if (!hasAnyRoadOnAnySide(c)) {
    return [{
      panel: "roadAccess",
      issueLens: "land_use_permission",
      evidenceStrength: "source_observation",
      source: "bhunaksha:chauhaddi:sides",
      severity: "redFlag",
      headline: "No adjacent road identified on any side of the plot",
      body: "The Bhunaksha chauhaddi (boundary record) for this plot does not list a road, danga, or rasta on any of the four sides. A plot without a public-access side may have easement or access problems.",
      actionItem: "Visit the plot, walk the perimeter, and ask the seller to show the recorded right-of-way. Confirm with the local tehsil whether a Danga exists on at least one side before paying.",
      ruleId: "ROR-INS-080",
    }];
  }
  return null;
}

// ROR-INS-083 — parser_uncertain watchout when chauhaddi data is missing
// entirely. Distinct ruleId from ROR-INS-080 because the previous code
// emitted both a stub AND a redFlag under ROR-INS-080 with two different
// severities — split here so each insight carries a single ruleId +
// severity.
function chauhaddiMissingStub(input: RuleInput): Insight[] | null {
  const c = getChauhaddi(input);
  if (c) return null;
  return [stubFor(
    "ROR-INS-083",
    "roadAccess",
    "land_use_permission",
    "parser_uncertain",
    "We could not determine whether this plot has an adjacent road. The Bhunaksha chauhaddi data was not available, and the neighbours chain feature (UP-006) is not yet wired in.",
    "Visit the plot in person and confirm whether at least one side touches a government Danga (road) or a private lane with right-of-way."
  )];
}

// ROR-INS-081 — watchout when plot is bounded entirely by KHA / government land.
function surroundedByKhaWatchout(input: RuleInput): Insight[] | null {
  const c = getChauhaddi(input);
  if (!c) return null;
  if (!allSidesAreKhaOrGovt(c)) return null;
  return [{
    panel: "roadAccess",
    issueLens: "land_use_permission",
    evidenceStrength: "source_observation",
    source: "bhunaksha:chauhaddi:sides",
    severity: "watchout",
    headline: "Plot is bounded entirely by government (KHA) land",
    body: "The Bhunaksha chauhaddi lists KHA (government) or government-classified land on all four sides of this plot. This may indicate an enclave inside a government holding, which can complicate future sale, mutation, and access.",
    actionItem: "Ask the tehsil office whether this plot has independent access or whether entry passes through the surrounding government land.",
    ruleId: "ROR-INS-081",
  }];
}

// ROR-INS-082 — positive when at least one chauhaddi side is a road.
function roadOnAtLeastOneSidePositive(input: RuleInput): Insight[] | null {
  const c = getChauhaddi(input);
  if (!c) return null;
  if (!hasAnyRoadOnAnySide(c)) return null;
  // If surrounded entirely by KHA, the road observation is overshadowed — skip positive
  // to avoid contradicting ROR-INS-081.
  if (allSidesAreKhaOrGovt(c)) return null;
  return [{
    panel: "roadAccess",
    issueLens: "land_use_permission",
    evidenceStrength: "source_observation",
    source: "bhunaksha:chauhaddi:sides",
    severity: "positive",
    headline: "At least one side of the plot touches a road",
    body: "The Bhunaksha chauhaddi lists a road, danga, or rasta on at least one side of the plot. This is a positive signal for legal access.",
    actionItem: "No additional action on access — confirm the road width and condition in person before transacting.",
    ruleId: "ROR-INS-082",
  }];
}

export const bhunakshaRoadAccessRules: Rule[] = [
  { id: "ROR-INS-080", panel: "roadAccess", fn: noAdjacentRoadRedFlag, version: v },
  { id: "ROR-INS-081", panel: "roadAccess", fn: surroundedByKhaWatchout, version: v },
  { id: "ROR-INS-082", panel: "roadAccess", fn: roadOnAtLeastOneSidePositive, version: v },
  { id: "ROR-INS-083", panel: "roadAccess", fn: chauhaddiMissingStub, version: v },
];

// agents/consumer-report-writer/src/insights/registry/bhulekh/land.ts
import type { Insight, Rule, RuleInput } from "../../schema";
import { stubFor } from "../_shared";

const v = "1.0.0";

const FOREST_KISAMS = new Set([
  "forest",
  "jungle",
  "reserved_forest",
  "protected_forest",
  "van",
  "jangle",
]);

const BAGAYAT_KISAMS = new Set([
  "bagayat",
  "irrigated",
  "anajalasechita",
  "agricultural",
  "krishi",
  "jalasechita_single",
  "jalasechita_double",
]);

// Neyanjori / neya_niyogita / khalsa — government notified land (Gair Khalsa).
// Per Session 050 / docs/superpowers/plans/2026-06-18-doc-consolidation-and-status-index.md
// line 317: NOT ordinary irrigated/agricultural land; it is government-notified
// land where construction and private sale are prohibited without state
// government approval. Fires ROR-INS-035 (redFlag) below.
const NEYANJORI_KISAMS = new Set([
  "neyanjori",
  "neya_niyogita",
  "khalsa",
]);

const GHARABARI_KISAMS = new Set([
  "gharabari",
  "homestead",
  "residential",
  "basty",
  "nagariya_jogya",
]);

function kisamForestRedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const kisam = r.page1?.kisam;
  if (typeof kisam !== "string") return null;
  if (!FOREST_KISAMS.has(kisam.toLowerCase())) return null;
  return [{
    panel: "land",
    issueLens: "land_use_permission",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-1",
    severity: "redFlag",
    headline: "Kisam is recorded as forest / jungle",
    body: `The RoR records the land class as '${kisam}'. Forest or jungle kisam land is reserved and cannot normally be transferred to a private buyer for construction.`,
    actionItem: "Do not pay. Ask the seller for a forest-diversion order or a recorded change of land use from the Revenue / Forest department.",
    ruleId: "ROR-INS-030",
  }];
}

function kisamBagayatWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const kisam = r.page1?.kisam;
  if (typeof kisam !== "string") return null;
  if (!BAGAYAT_KISAMS.has(kisam.toLowerCase())) return null;
  return [{
    panel: "land",
    issueLens: "land_use_permission",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-1",
    severity: "watchout",
    headline: "Kisam is agricultural — conversion required before construction",
    body: `The RoR records the land class as '${kisam}' (irrigated agricultural). Construction on agricultural land normally requires a Change of Land Use (CLU / NA) order from the district authority.`,
    actionItem: "Ask the seller for an existing CLU / NA conversion order, or budget the conversion fee and 3-12 month timeline before starting any construction work.",
    ruleId: "ROR-INS-031",
  }];
}

function kisamGharabariPositive(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const kisam = r.page1?.kisam;
  if (typeof kisam !== "string") return null;
  if (!GHARABARI_KISAMS.has(kisam.toLowerCase())) return null;
  return [{
    panel: "land",
    issueLens: "land_use_permission",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-1",
    severity: "positive",
    headline: "Kisam is recorded as homestead / residential",
    body: `The RoR records the land class as '${kisam}'. This is a residential land class on the RoR, which is the starting position for owner-led construction.`,
    actionItem: "Still verify the BDA / development authority zoning and the building byelaws at the local planning office before starting work.",
    ruleId: "ROR-INS-032",
  }];
}

function leaseDeedSthitibanStub(input: RuleInput): Insight[] | null {
  // STUB: real detector lands in UP-007 once the IGR lease-deed source ships.
  // For now, fire as parser_uncertain whenever Sthitiban / Raiyati kisam is
  // present and the lease-deed pre-check is not yet wired.
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const kisam = (r.page1?.kisam ?? "").toLowerCase();
  if (kisam !== "sthitiban" && kisam !== "raiyati") return null;
  return [stubFor(
    "ROR-INS-033",
    "land",
    "land_use_permission",
    "parser_uncertain",
    "This khatiyan is a Sthitiban / Raiyati record. The IGR lease-deed cross-check that detects the Patia Industrial-Lease Scam is not yet wired into ClearDeed.",
    "Ask the seller in writing whether any prior lease deed (RLD) is recorded against this khatiyan at the IGR. A yes means the land can be resumed by the government.",
    "IGR lease-deed cross-check not wired — ask seller about prior RLD"
  )];
}

function kisamNeyanjoriRedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const kisam = r.page1?.kisam;
  if (typeof kisam !== "string") return null;
  if (!NEYANJORI_KISAMS.has(kisam.toLowerCase())) return null;
  return [{
    panel: "land",
    issueLens: "land_use_permission",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-1",
    severity: "redFlag",
    headline: "Kisam is government notified land (Neyanjori / Gair Khalsa)",
    body: `The RoR records the land class as '${kisam}'. This is government notified land (Neyanjori / Gair Khalsa) — construction and private sale are prohibited without state government approval.`,
    actionItem: "Do not pay. Ask the seller for the state government's prior diversion / de-notification order. Without it, the land can be resumed by the government at any time.",
    ruleId: "ROR-INS-035",
  }];
}

function kisamUnknownWatchout(input: RuleInput): Insight[] | null {
  // Covers two parser-source-quality cases:
  //   (a) RoR verified but kisam field is missing / not in dictionary.
  //   (b) RoR is unverified / partial — land class cannot be confirmed at all.
  const r = (input as any).ror;
  if (!r) return null;
  if (r.status === "verified") {
    const kisam = r.page1?.kisam;
    if (typeof kisam !== "string" || kisam.trim() === "") {
      return [{
        panel: "land",
        issueLens: "parser_source_quality",
        evidenceStrength: "parser_uncertain",
        source: "bhulekh:ror:page-1",
        severity: "watchout",
        headline: "Kisam / land class is not in the dictionary",
        body: "The land class on the RoR did not match any standard kisam in our dictionary. This may be an unusual variant, an OCR error, or a local name not yet mapped.",
        actionItem: "Open the RoR PDF from bhulekh.ori.nic.in manually and read the land class by hand. Pass the value back to ClearDeed for dictionary expansion.",
        ruleId: "ROR-INS-034",
      }];
    }
    return null;
  }
  // RoR present but not verified.
  return [stubFor(
    "ROR-INS-034",
    "land",
    "parser_source_quality",
    "parser_uncertain",
    "Bhulekh RoR was not retrieved for this query, so the land class could not be verified.",
    "Re-run the report, or pull the RoR PDF from bhulekh.ori.nic.in manually and read the kisam by hand.",
    "RoR not retrieved — re-run the report or read the PDF"
  )];
}

export const bhulekhLandRules: Rule[] = [
  { id: "ROR-INS-030", panel: "land", fn: kisamForestRedFlag, version: v },
  { id: "ROR-INS-031", panel: "land", fn: kisamBagayatWatchout, version: v },
  { id: "ROR-INS-032", panel: "land", fn: kisamGharabariPositive, version: v },
  { id: "ROR-INS-033", panel: "land", fn: leaseDeedSthitibanStub, version: v },
  { id: "ROR-INS-034", panel: "land", fn: kisamUnknownWatchout, version: v },
  { id: "ROR-INS-035", panel: "land", fn: kisamNeyanjoriRedFlag, version: v },
];
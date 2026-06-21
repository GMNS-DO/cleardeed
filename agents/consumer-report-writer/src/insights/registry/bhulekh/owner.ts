// agents/consumer-report-writer/src/insights/registry/bhulekh/owner.ts
import type { Insight, Rule, RuleInput } from "../../schema";
import { stubFor } from "../_shared";

const v = "1.0.0";

function multipleCoOwnersRedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const p1 = r.page1;
  if (!p1) return null;
  const coOwners: string[] = Array.isArray(p1.coOwners) ? p1.coOwners : [];
  const total = (p1.owner && p1.owner.trim() !== "" ? 1 : 0) + coOwners.length;
  if (total > 1) {
    return [{
      panel: "owner",
      issueLens: "title_chain",
      evidenceStrength: "document_anchor",
      source: "bhulekh:ror:page-1",
      severity: "redFlag",
      headline: `Khatiyan lists ${total} owners on page 1`,
      body: `The RoR page 1 names ${total} owners for this khatiyan. Each co-owner normally has to consent to a sale.`,
      actionItem: "Ask the seller to produce written consent or no-objection from every co-owner before paying any advance.",
      ruleId: "ROR-INS-020",
    }];
  }
  return null;
}

function ownerAddressMismatchRedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const p1 = r.page1;
  if (!p1 || !p1.ownerAddress || !p1.plotDistrict) return null;
  if (p1.ownerAddress !== p1.plotDistrict && p1.hasPoA !== true) {
    return [{
      panel: "owner",
      issueLens: "title_chain",
      evidenceStrength: "document_anchor",
      source: "bhulekh:ror:page-1",
      severity: "redFlag",
      headline: "RoR owner address is in a different district and no PoA is on record",
      body: "The RoR owner lives in a different district from the plot, and no registered Power of Attorney is recorded for this sale.",
      actionItem: "Demand a registered PoA copy and arrange a video KYC with the recorded owner before paying any advance.",
      ruleId: "ROR-INS-021",
    }];
  }
  return null;
}

function governmentKhatiyanRedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const p1 = r.page1;
  if (!p1) return null;
  if (!p1.owner || p1.owner.trim() === "") {
    return [{
      panel: "owner",
      issueLens: "revenue_record",
      evidenceStrength: "document_anchor",
      source: "bhulekh:ror:page-1",
      severity: "redFlag",
      headline: "RoR page 1 has no personal owner",
      body: "Page 1 of the RoR does not list a personal name. This is most often a government khatiyan, which a private buyer cannot purchase outright.",
      actionItem: "Do not pay any advance. Ask the seller to provide a personal-name khatiyan, or confirm in writing that the land has been formally assigned to a private party.",
      ruleId: "ROR-INS-022",
    }];
  }
  return null;
}

function singleTokenOwnerMatchWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const sellerName = (input as any).sellerName;
  const p1 = r.page1;
  if (!p1 || !p1.owner || !sellerName) return null;
  const tokens = sellerName.trim().split(/\s+/);
  if (tokens.length !== 1) return null;
  const ownerTokens = p1.owner.trim().split(/\s+/);
  if (ownerTokens.length === 0) return null;
  const seller = tokens[0].toLowerCase();
  const matched = ownerTokens.some((t: string) => t.toLowerCase() === seller);
  if (matched) {
    return [{
      panel: "owner",
      issueLens: "title_chain",
      evidenceStrength: "source_observation",
      source: "bhulekh:ror:page-1",
      severity: "watchout",
      headline: "Seller name matched RoR owner on a single token only",
      body: "Only one word of the seller's name was compared against the RoR owner. A single-token match is ambiguous and could be a different person with the same surname.",
      actionItem: "Ask the seller for the full name (including father's / husband's name) and re-verify against the RoR.",
      ruleId: "ROR-INS-023",
    }];
  }
  return null;
}

function sellerNameNotMatchedRedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const sellerName = (input as any).sellerName;
  const p1 = r.page1;
  if (!p1 || !p1.owner || !sellerName) return null;
  // Skip when the input is a single token — handled by ROR-INS-023 instead.
  if (sellerName.trim().split(/\s+/).length === 1) return null;
  const ownerLc = p1.owner.toLowerCase();
  const sellerTokens = sellerName.toLowerCase().split(/\s+/);
  // HIGH #1: ignore single-letter and very short tokens (length < 3).
  // A buyer typing "m" would otherwise match every owner name containing
  // an "m" ("Rama", "Soma", "Mohan", ...) and the rule would fire
  // redFlag on every report. Restrict to tokens of meaningful length.
  const meaningfulTokens = sellerTokens.filter((t: string) => t.length >= 3);
  if (meaningfulTokens.length === 0) return null;
  const anyTokenMatch = meaningfulTokens.some((t: string) => ownerLc.includes(t));
  if (!anyTokenMatch) {
    return [{
      panel: "owner",
      issueLens: "title_chain",
      evidenceStrength: "document_anchor",
      source: "bhulekh:ror:page-1",
      severity: "redFlag",
      headline: "Seller name does not match the RoR owner",
      body: "The seller's name you provided does not match the RoR owner for this khatiyan. The seller may not be the recorded owner of this land.",
      actionItem: "Stop the transaction. Ask the seller to produce the recorded owner's written, registered sale deed or power of attorney.",
      ruleId: "ROR-INS-024",
    }];
  }
  return null;
}

function ownerFieldMissingStub(input: RuleInput): Insight[] | null {
  // Stub fires when the page-1 object is present but no owner / coOwners fields
  // are readable at all (parser-side gap), distinct from ROR-INS-022 which
  // fires on a present-but-empty owner.
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const p1 = r.page1;
  if (!p1) return null;
  if (p1.ownerFieldMissing === true) {
    return [stubFor(
      "ROR-INS-025",
      "owner",
      "title_chain",
      "parser_uncertain",
      "The owner field on RoR page 1 could not be read at all. The RoR may have an unusual layout, or the page failed to render.",
      "Open the RoR PDF from bhulekh.ori.nic.in manually and read the owner name by hand."
    )];
  }
  return null;
}

// POA-001 — Power of Attorney on record. The RoR carries a PoA flag,
// indicating the person signing is not the recorded owner but an
// attorney holder. Per Supreme Court judgment (Suraj Lamp vs. State of
// Haryana, 1 SCC 656), a GPA-based sale does NOT convey title; only a
// registered sale deed executed by the owner conveys title.
function poAOnRecordWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const p1 = r.page1;
  if (!p1) return null;
  if (p1.hasPoA !== true) return null;
  return [{
    panel: "owner",
    issueLens: "title_chain",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-1",
    severity: "watchout",
    headline: "Power of Attorney recorded on RoR",
    body: "The RoR page 1 records that a Power of Attorney is on file for this khatiyan. A GPA holder can sign documents on behalf of the owner, but a sale executed through a GPA does NOT itself convey title — per the Supreme Court's Suraj Lamp judgment, only a registered sale deed by the owner conveys title.",
    actionItem: "Ask the seller to produce the registered PoA document and verify the owner's identity directly. Confirm the sale deed will be executed by the recorded owner, not solely through the GPA.",
    ruleId: "POA-001",
  }];
}

// ROR-INS-026 — Owner residence is >50km from plot AND no PoA.
// Pattern 3 (Malipada Impersonation Scam): the EOW Khordha case
// (2020-2023) involved an impersonator selling property while the
// real owner lived in a different district. Distance amplifies the
// impersonation risk because the owner cannot easily monitor the
// property. T-051 implements this as a distance-aware escalation
// of ROR-INS-021.
//
// NOTE: This rule requires `input.plotGPS` and `input.ownerResidenceGPS`
// to be populated by the orchestrator (a separate Nominatim lookup on
// the owner's residence address from the RoR). In V1, the orchestrator
// does not yet fetch owner residence GPS, so this rule will NOT fire on
// real customer input until the orchestrator is extended to run a
// second Nominatim call on ror.page1.ownerAddress.
function ownerResidenceDistanceRedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const p1 = r.page1;
  if (!p1) return null;
  // T-069 — IGR-EC poaOnRecord is the ground-truth signal. Read it.
  const igrPoA = (input as any).igrEc?.poaOnRecord === true;
  const bhulekhPoA = p1.hasPoA === true;
  if (igrPoA || bhulekhPoA) return null; // PoA present → distance doesn't matter
  const plotGPS = (input as any).plotGPS as { lat: number; lon: number } | undefined;
  const ownerResidenceGPS = (input as any).ownerResidenceGPS as { lat: number; lon: number } | undefined;
  if (!plotGPS || !ownerResidenceGPS) return null;
  const distKm = haversineKm(
    plotGPS.lat,
    plotGPS.lon,
    ownerResidenceGPS.lat,
    ownerResidenceGPS.lon
  );
  if (distKm > 50) {
    return [{
      panel: "owner",
      issueLens: "title_chain",
      evidenceStrength: "document_anchor",
      source: "bhulekh:ror:page-1 + nominatim:owner_residence",
      severity: "redFlag",
      headline: `Owner residence is ${Math.round(distKm)} km from the plot and no Power of Attorney is on record`,
      body: `The RoR owner's recorded residence is ${Math.round(distKm)} km from this plot, and no Power of Attorney authorizing a remote sale is registered at the IGR. Pattern 3 (Malipada Impersonation Scam, EOW Khordha 2020-2023) involved an impersonator selling property while the real owner lived in a different district. Distance amplifies impersonation risk because the owner cannot easily monitor the property.`,
      actionItem: "Arrange a video KYC call with the recorded owner before paying any advance. Confirm the sale is being executed by the owner, not an impersonator.",
      ruleId: "ROR-INS-026",
    }];
  }
  return null;
}

/**
 * Haversine distance in km between two GPS points.
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const bhulekhOwnerRules: Rule[] = [
  { id: "ROR-INS-020", panel: "owner", fn: multipleCoOwnersRedFlag, version: v },
  { id: "ROR-INS-021", panel: "owner", fn: ownerAddressMismatchRedFlag, version: v },
  { id: "ROR-INS-022", panel: "owner", fn: governmentKhatiyanRedFlag, version: v },
  { id: "ROR-INS-023", panel: "owner", fn: singleTokenOwnerMatchWatchout, version: v },
  { id: "ROR-INS-024", panel: "owner", fn: sellerNameNotMatchedRedFlag, version: v },
  { id: "POA-001", panel: "owner", fn: poAOnRecordWatchout, version: v },
  { id: "ROR-INS-025", panel: "owner", fn: ownerFieldMissingStub, version: v },
  { id: "ROR-INS-026", panel: "owner", fn: ownerResidenceDistanceRedFlag, version: v },
];
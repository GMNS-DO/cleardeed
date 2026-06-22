// agents/consumer-report-writer/src/insights/registry/bhulekh/chain.ts
// V1.5 — Title-chain patterns built on the wired `ror` payload.
//
// These rules cover Pattern 5 escalation (sub-of-sub), Malipada
// impersonation (sub-district owner mismatch), Suraj Lamp PoA risk
// (SA/GPA sales do not convey title), Zamindari chain gaps, and
// tenancy-ratio over-claims. All five map to Buyer Q1 ("Does the
// seller actually own this?") and are pure ROR readers — no IGR,
// no EOW, no fetcher calls.
import type { Insight, Rule, RuleInput } from "../../schema";

const v = "1.0.0";

// ROR-INS-070 — Sub-plot of sub-plot. Pattern 5 escalation: a
// plot number with two or more "/" separators (e.g. "415/1/2")
// signals a chain of unapproved sub-divisions. Every level needs
// its own BDA / planning-authority approval, and the chain is
// rarely intact.
function subPlotOfSubPlotRedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const selected =
    typeof r.page2?.selectedPlotNumber === "string" ? r.page2.selectedPlotNumber : null;
  if (!selected) return null;
  // Two or more "/"-separated segments.
  if (!/^[^/]+(\/[^/]+){2,}$/.test(selected.trim())) return null;
  return [{
    panel: "chain",
    issueLens: "title_chain",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-2",
    severity: "redFlag",
    headline: `Plot number "${selected}" is a chain of sub-divisions`,
    body: `The plot number you queried (${selected}) contains a chain of sub-divisions. Pattern 5 (subdivided plot without BDA layout approval) is one of the most common dispute types in Khordha — a chain of unapproved sub-divisions compounds the risk because every level of the split needs its own approval.`,
    actionItem: "Stop the transaction. Ask the seller for the full chain of BDA / planning-authority sub-division orders that cover every level of this plot's split.",
    ruleId: "ROR-INS-070",
  }];
}

// ROR-INS-071 — Owner residence in a different mouza / village
// within Khordha + no PoA. Sub-district impersonation signal —
// the Malipada case (EOW 2023) had the impersonator in a
// different village with the same name as the real owner.
function ownerAddressMouzaMismatchWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const p1 = r.page1;
  if (!p1) return null;
  const ownerAddr = typeof p1.ownerAddress === "string" ? p1.ownerAddress.trim() : "";
  if (!ownerAddr) return null;
  // PoA on record → mitigated; the attorney holder is the legal actor.
  if (p1.hasPoA === true) return null;
  // Plot village / mouza from the target row; fall back to the
  // first plot row. We compare case-insensitive Latin translits.
  const targetVillage = (p1.plotVillage ?? p1.plotMouza ?? "").toString().trim();
  if (!targetVillage) return null;
  // Extract any word from owner address that matches a typical
  // mouza/village token (≥ 3 chars, latin letters). If the
  // owner's address shares no such token with the plot's
  // village/mouza, fire the watchout.
  const tokenize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3);
  const ownerTokens = new Set(tokenize(ownerAddr));
  const targetTokens = tokenize(targetVillage);
  if (targetTokens.length === 0) return null;
  const overlap = targetTokens.some((t) => ownerTokens.has(t));
  if (overlap) return null;
  // Owner address also shares no recognized city token (Bhubaneswar,
  // Khordha, Cuttack, Puri, Bhubaneshwar) — that would otherwise be
  // a normal urban residence. We deliberately do NOT bypass on
  // city tokens: the Malipada pattern (EOW 2023) is exactly an
  // impersonator in the same Bhubaneswar urban area as the real
  // plot, just in a different mouza. Bypassing on city would
  // miss the impersonation signal.
  return [{
    panel: "chain",
    issueLens: "title_chain",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-1",
    severity: "watchout",
    headline: "RoR owner residence is in a different mouza / village",
    body: `The RoR records the owner's residence as "${ownerAddr}", which is in a different mouza / village from the plot (${targetVillage}). Within Khordha, a same-name impersonator in a different village is the signature of the Malipada impersonation pattern (EOW 2023 case).`,
    actionItem: "Demand a video KYC with the recorded owner and a recent utility bill matching the RoR residence before paying any advance.",
    ruleId: "ROR-INS-071",
  }];
}

// ROR-INS-075 — PoA on record + seller ≠ owner → Suraj Lamp risk.
// The Supreme Court held (Suraj Lamp & Industries v. State of
// Haryana, 1 SCC 656) that a sale through GPA does NOT convey
// title; only a registered sale deed does.
//
// T-069 — Signal source priority (in order):
//   1. IGR-EC rollup `igrEc.poaOnRecord === true` — ground truth from
//      registered deed records.
//   2. Bhulekh RoR textual inference `ror.page1.hasPoA === true` —
//      weaker signal, fires on Odia "ପ୍ରାଧିକାର" keywords in the rights
//      field. Used as a fallback when IGR-EC data is unavailable.
//
// Source attribution in the produced Insight reflects whichever
// signal fired so the audit trail tells the buyer what kind of PoA
// evidence the report is resting on.
function poASaleSurajLampRedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const p1 = r.page1;
  if (!p1) return null;
  // T-069 — read the IGR-EC rollup first (registry ground truth),
  // fall back to the Bhulekh textual inference.
  const igrEcPoA = (input as any)?.igrEc?.poaOnRecord === true;
  const bhulekhPoA = p1.hasPoA === true;
  if (!igrEcPoA && !bhulekhPoA) return null;
  const signalSource = igrEcPoA ? "igr-ec:ec_entries" : "bhulekh:ror:page-1";
  const signalNote = igrEcPoA
    ? "Verified against IGR Odisha registered instruments — at least one entry is a GPA sale."
    : "Bhulekh RoR rights text suggests PoA activity; not confirmed against IGR records.";
  // Read the seller's claimed name from the input envelope so we
  // can detect seller ≠ owner. If the rule engine did not pass
  // sellerName, we fall back to firing on PoA alone with a
  // softer body.
  const sellerName = (input as any).claimedOwnerName ?? (input as any).sellerName ?? null;
  const ownerName =
    typeof p1.owner === "string" ? p1.owner.trim() : typeof p1.ownerOdia === "string" ? p1.ownerOdia.trim() : "";
  const sellerMismatch =
    sellerName && ownerName
      ? !ownerName.toLowerCase().includes(sellerName.toLowerCase()) &&
        !sellerName.toLowerCase().includes(ownerName.toLowerCase())
      : false;
  if (!sellerMismatch && !sellerName) {
    // PoA on record, but no seller name was passed in to
    // compare. Don't fire — the engine will surface a generic
    // "PoA on record" watchout elsewhere.
    return null;
  }
  return [{
    panel: "chain",
    issueLens: "title_chain",
    evidenceStrength: "document_anchor",
    source: signalSource,
    severity: "redFlag",
    headline: "Sale by Power of Attorney — Suraj Lamp risk",
    body: sellerMismatch
      ? `The IGR records / Bhulekh RoR indicate a Power of Attorney on record and the seller's name ("${sellerName}") does not match the recorded owner ("${ownerName}"). ${signalNote} Per the Supreme Court's Suraj Lamp judgment (1 SCC 656), a sale executed through a GPA does not, by itself, convey title — only a registered sale deed does. Any title resting on a GPA alone is at risk of being declared void.`
      : `The IGR records / Bhulekh RoR indicate a Power of Attorney on record. ${signalNote} Per the Supreme Court's Suraj Lamp judgment (1 SCC 656), a sale executed through a GPA does not, by itself, convey title — only a registered sale deed does.`,
    actionItem: "Do not accept a GPA-based transfer. Demand a registered sale deed executed by the recorded owner, not the attorney holder.",
    ruleId: "ROR-INS-075",
  }];
}

// ROR-INS-076 — Zamindari khewat present but no mutation chain.
// Post-Zamindari Abolition, the chain of mutation orders is the
// primary evidence the recorded owner inherited / purchased from
// the original khewat holder. A missing chain means the title
// has not been formally traced.
function zamindariChainGapWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const p1 = r.page1;
  if (!p1) return null;
  const zamindar = typeof p1.zamindarKhewatOdia === "string" ? p1.zamindarKhewatOdia.trim() : "";
  if (!zamindar) return null;
  const khewat = typeof p1.khewatNo === "string" ? p1.khewatNo.trim() : "";
  if (!khewat) return null;
  const refs: any[] = Array.isArray(r.mutationReferences) ? r.mutationReferences : [];
  if (refs.length > 0) return null; // chain is present
  return [{
    panel: "chain",
    issueLens: "title_chain",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-1",
    severity: "watchout",
    headline: "Zamindari khewat present but no mutation chain on record",
    body: `The RoR shows a Zamindari-era khewat number (${khewat}) but no recorded mutation case references on the back page. Post-Zamindari Abolition, an unbroken chain of mutation orders is the primary evidence that the recorded owner inherited or purchased from the original khewat holder. A missing chain means the title has not been formally traced since Abolition.`,
    actionItem: "Ask the seller for the chain of succession documents (inheritance / partition / sale deed) covering every transfer from the original khewat holder to the present recorded owner.",
    ruleId: "ROR-INS-076",
  }];
}

// ROR-INS-080 — Tenancy ratio > 1.0. Sum of tenant shares exceeds
// the plot's recorded area — strong signal of an inflated,
// duplicated, or fraudulent tenancy record (sometimes used to
// support parallel sale deeds to multiple buyers).
function tenancyRatioOverClaimRedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const p1 = r.page1;
  if (!p1) return null;
  const tenants: any[] = Array.isArray(p1.tenants) ? p1.tenants : Array.isArray(r.tenants) ? r.tenants : [];
  if (tenants.length === 0) return null;
  let tenantAreaTotal = 0;
  for (const t of tenants) {
    const a = Number(t?.area);
    if (Number.isFinite(a) && a > 0) tenantAreaTotal += a;
  }
  if (tenantAreaTotal <= 0) return null;
  // Plot area from the target row; fall back to first row.
  const targetAreaRaw =
    r.plotTable?.targetRow?.area ??
    r.page2?.plots?.[0]?.area ??
    p1.area ??
    null;
  const plotArea = Number(targetAreaRaw);
  if (!Number.isFinite(plotArea) || plotArea <= 0) return null;
  if (tenantAreaTotal <= plotArea) return null;
  return [{
    panel: "chain",
    issueLens: "title_chain",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-1",
    severity: "redFlag",
    headline: "Tenancy shares exceed the plot's recorded area",
    body: `The RoR records tenancy shares whose total area (${tenantAreaTotal.toFixed(4)}) exceeds the plot's recorded area (${plotArea.toFixed(4)}). An over-claimed tenancy is a strong indicator of an inflated, fraudulent, or duplicated tenancy record — sometimes used to support parallel sale deeds to multiple buyers.`,
    actionItem: "Stop the transaction. Ask the tehsil to re-issue a clean RoR; if the over-claim persists, it is a partition-fraud signal that needs a Revenue Court review.",
    ruleId: "ROR-INS-080",
  }];
}

// ROR-INS-046 — Khewat number ≠ 1. In Odisha RoR records, the khewat
// number identifies the tenancy (how many distinct landholders share
// the recorded tenancy). A khewat > 1 means more than one co-tenant is
// named in the khatiyan — each has an undivided share, and each must
// consent to a sale. Without all consents, the title is not transferable.
function khewatNotOneWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const p1 = r.page1;
  if (!p1) return null;
  const raw = typeof p1.khewatNo === "string" ? p1.khewatNo.trim() : "";
  if (!raw) return null;
  const khewat = Number.parseInt(raw, 10);
  if (!Number.isFinite(khewat) || khewat <= 1) return null;
  return [{
    panel: "chain",
    issueLens: "title_chain",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-1",
    severity: "watchout",
    headline: `Khatiyan shares a khewat (tenancy ID) with ${khewat} co-tenant${khewat === 2 ? "" : "s"}`,
    body: `The RoR records khewat number ${raw} for this khatiyan. In Odisha, a khewat groups co-tenants who share an undivided interest in the tenancy; khewat > 1 means more than one recorded landholder is named in the same tenancy group.`,
    actionItem: "Ask the seller to produce a registered partition deed (if the co-tenants have split) or written consent / no-objection from every co-tenant before paying any advance.",
    ruleId: "ROR-INS-046",
  }];
}

export const bhulekhChainRules: Rule[] = [
  { id: "ROR-INS-046", panel: "chain", fn: khewatNotOneWatchout, version: v },
  { id: "ROR-INS-070", panel: "chain", fn: subPlotOfSubPlotRedFlag, version: v },
  { id: "ROR-INS-071", panel: "chain", fn: ownerAddressMouzaMismatchWatchout, version: v },
  { id: "ROR-INS-075", panel: "chain", fn: poASaleSurajLampRedFlag, version: v },
  { id: "ROR-INS-076", panel: "chain", fn: zamindariChainGapWatchout, version: v },
  { id: "ROR-INS-080", panel: "chain", fn: tenancyRatioOverClaimRedFlag, version: v },
];

// agents/consumer-report-writer/src/insights/registry/bhulekh/back-page.ts
import type { Insight, Rule, RuleInput } from "../../schema";

const v = "1.0.0";

function mutationRefsPresentPositive(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const refs: any[] = Array.isArray(r.page2?.mutationReferences) ? r.page2.mutationReferences : [];
  if (refs.length === 0) return null;
  return [{
    panel: "backPage",
    issueLens: "title_chain",
    evidenceStrength: "case_or_order_anchor",
    source: "bhulekh:ror:page-2",
    severity: "positive",
    headline: `RoR back page lists ${refs.length} mutation case reference${refs.length === 1 ? "" : "s"}`,
    body: `Page 2 of the RoR records ${refs.length} mutation case reference${refs.length === 1 ? "" : "s"}, which is the chain that ties this khatiyan to its sale deeds, partitions, and government orders.`,
    actionItem: "Cross-check each mutation case reference with the corresponding sale deed / order at the SRO or tehsil before paying.",
    ruleId: "ROR-INS-060",
  }];
}

function mutationCountRecentWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const s = r.section6;
  if (!s) return null;
  if (typeof s.mutationCount !== "number" || typeof s.months !== "number") return null;
  if (!(s.mutationCount > 0 && s.months <= 12)) return null;
  return [{
    panel: "backPage",
    issueLens: "title_chain",
    evidenceStrength: "row_count_signal",
    source: "bhulekh:ror:section-6",
    severity: "watchout",
    headline: `${s.mutationCount} mutation${s.mutationCount === 1 ? "" : "s"} recorded in the last ${s.months} months`,
    body: `Section 6 records ${s.mutationCount} mutations in the last ${s.months} months. Frequent recent mutations on a single khatiyan can mean inheritance partition, mortgage closure, or resale — ask for the chain.`,
    actionItem: "Ask the seller for the latest mutation order and the sale-deed chain covering every entry in this period.",
    ruleId: "ROR-INS-061",
  }];
}

function mutationRefDakhalKharajRedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const refs: any[] = Array.isArray(r.page2?.mutationReferences) ? r.page2.mutationReferences : [];
  if (refs.length === 0) return null;
  const hit = refs.some((ref) =>
    typeof ref === "string" && ref.toLowerCase().includes("dakhal kharaj")
  );
  if (!hit) return null;
  return [{
    panel: "backPage",
    issueLens: "title_chain",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-2",
    severity: "redFlag",
    headline: "Mutation reference mentions Dakhal Kharaj",
    body: "A mutation reference on RoR page 2 mentions Dakhal Kharaj (possession rent). This entry is a rent / possession record, not a clean title transfer — the seller may be passing on a lease or tenancy record rather than freehold title.",
    actionItem: "Ask the seller for the written mutation order and the underlying lease / tenancy document. Confirm with the tehsil that no further Dakhal Kharaj is outstanding.",
    ruleId: "ROR-INS-062",
  }];
}

function mutationRefMissingKhatiyanWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const refs: any[] = Array.isArray(r.page2?.mutationReferences) ? r.page2.mutationReferences : [];
  if (refs.length === 0) return null;
  const allHaveKhatiyan = refs.every(
    (ref) => ref && typeof ref === "object" && typeof ref.khatiyan === "string" && ref.khatiyan.trim() !== ""
  );
  if (allHaveKhatiyan) return null;
  return [{
    panel: "backPage",
    issueLens: "title_chain",
    evidenceStrength: "row_count_signal",
    source: "bhulekh:ror:page-2",
    severity: "watchout",
    headline: "Some mutation references have no linked khatiyan",
    body: "One or more mutation references on RoR page 2 do not carry a linked khatiyan. Without a linked khatiyan, the mutation anchor is ambiguous and we cannot tie the entry back to this RoR.",
    actionItem: "Ask the seller or tehsil clerk to identify the khatiyan number for every mutation reference, then re-verify.",
    ruleId: "ROR-INS-063",
  }];
}

function encumbranceStyleEntryRedFlag(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r || r.status !== "verified") return null;
  const enc: any[] = Array.isArray(r.page2?.encumbrances) ? r.page2.encumbrances : [];
  if (enc.length === 0) return null;
  const flagged = enc.some((e) => {
    if (!e || typeof e.type !== "string") return false;
    const t = e.type.toLowerCase();
    return t.includes("bond") || t.includes("sairat") || t.includes("loan") || t.includes("mortgage") || t.includes("charge");
  });
  if (!flagged) return null;
  return [{
    panel: "backPage",
    issueLens: "registry_ec",
    evidenceStrength: "document_anchor",
    source: "bhulekh:ror:page-2",
    severity: "redFlag",
    headline: "Encumbrance-style entry found on RoR page 2",
    body: "RoR page 2 lists an encumbrance-style entry (Bond / Sairat / loan / mortgage / charge). This is a strong follow-up anchor for the Encumbrance Certificate and usually means an outstanding obligation against the khatiyan.",
    actionItem: "Pull the latest Encumbrance Certificate at the SRO and confirm the entry is closed before paying the seller.",
    ruleId: "ROR-INS-064",
  }];
}

function page2UnreadableWatchout(input: RuleInput): Insight[] | null {
  const r = (input as any).ror;
  if (!r) return null;
  if (r.status === "verified") return null;
  if (r.status !== "parser_uncertain") return null;
  return [{
    panel: "backPage",
    issueLens: "parser_source_quality",
    evidenceStrength: "parser_uncertain",
    source: "bhulekh:ror:page-2",
    severity: "watchout",
    headline: "RoR page 2 was not readable",
    body: "Page 2 of the RoR (mutation history / encumbrance / reservation) could not be parsed. Mutation chain, encumbrances, and reservations are not visible to ClearDeed for this khatiyan.",
    actionItem: "Open the RoR PDF from bhulekh.ori.nic.in manually and read the page 2 mutation and encumbrance sections by hand.",
    ruleId: "ROR-INS-065",
  }];
}

export const bhulekhBackPageRules: Rule[] = [
  { id: "ROR-INS-060", panel: "backPage", fn: mutationRefsPresentPositive, version: v },
  { id: "ROR-INS-061", panel: "backPage", fn: mutationCountRecentWatchout, version: v },
  { id: "ROR-INS-062", panel: "backPage", fn: mutationRefDakhalKharajRedFlag, version: v },
  { id: "ROR-INS-063", panel: "backPage", fn: mutationRefMissingKhatiyanWatchout, version: v },
  { id: "ROR-INS-064", panel: "backPage", fn: encumbranceStyleEntryRedFlag, version: v },
  { id: "ROR-INS-065", panel: "backPage", fn: page2UnreadableWatchout, version: v },
];
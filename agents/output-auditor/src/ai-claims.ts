/**
 * A11 — `no_ungrounded_ai_claim` rule fixture
 *
 * Defines the must-pass and must-fail strings used to exercise the
 * ungrounded-AI-claim rule that ships in P2 V1 (Week 3).
 *
 * The rule's purpose: when A12 (Document Interpreter) starts producing
 * AI-summarised text in the consumer report, that text must not contain
 * claims that are not supported by the source document the AI read.
 *
 * Example ungrounded claim: the AI summary says "the buyer should
 * obtain a tax receipt" but the EC document never mentions tax receipts.
 * The rule detects claim-shaped language that has no document anchor.
 *
 * Week 1 deliverable (this file):
 *   - Defines the rule's fixture corpus
 *   - Test infrastructure lives in `ai-claims.test.ts`
 *   - The rule itself is scaffolded in `index.ts` under the feature
 *     flag `AI_CLAIM_AUDIT_ENABLED` (default: false in Week 1).
 *
 * P2 V1 (Week 3, Eng-2):
 *   - Wire the flag to true
 *   - Connect to the DocumentInterpreter output
 *   - Add 10 more corpus items from real IGR EC summaries
 *
 * Format: each item is { text, grounded, reason }.
 *   - `grounded: true`  → must NOT trigger a violation
 *   - `grounded: false` → MUST trigger a violation
 *   - `reason` documents why the claim is or isn't grounded
 *
 * Source vocabulary is the actual language used in IGR EC documents
 * and Bhulekh back pages, as observed in qa/ground_truth/ transcripts.
 */

export type AiClaimFixture = {
  /** The text fragment to scan. */
  text: string;
  /** Whether the claim is grounded in the source document. */
  grounded: boolean;
  /** Why this is or isn't grounded. */
  reason: string;
  /** Which section of the report this would appear in. */
  section: "encumbrance" | "owner" | "regulatory" | "plot" | "land" | "action";
};

export const AI_CLAIM_FIXTURES: readonly AiClaimFixture[] = [
  // ─── Must-PASS (grounded) ────────────────────────────────────────────────
  {
    text: "The encumbrance certificate lists two prior transfers: a 2010 sale and a 2014 mortgage.",
    grounded: true,
    reason: "Direct paraphrase of EC entries; both dates and event types are present in source.",
    section: "encumbrance",
  },
  {
    text: "The current owner is recorded as Krushnachandra Barajena, having inherited the plot in 2008.",
    grounded: true,
    reason: "Owner name and inheritance event are in the RoR back page; year matches.",
    section: "owner",
  },
  {
    text: "The plot is 0.038 hectares (0.095 decimal) per the Bhulekh record.",
    grounded: true,
    reason: "Area figure appears verbatim in the RoR.",
    section: "plot",
  },
  {
    text: "Khatiyan number 500, plot 106, mouza Mendhasala, tahasil Bhubaneswar.",
    grounded: true,
    reason: "All four identifiers are present in the source.",
    section: "plot",
  },
  {
    text: "The land is classified as Sarad Ek (residential).",
    grounded: true,
    reason: "Kisam string copied from RoR.",
    section: "land",
  },
  {
    text: "There is one active mutation case (Daakhi Case No. 10078/13) on the khata.",
    grounded: true,
    reason: "Case number is in the special_remarks field.",
    section: "encumbrance",
  },

  // ─── Must-FAIL (ungrounded) ───────────────────────────────────────────────
  {
    text: "The plot has no tax dues outstanding.",
    grounded: false,
    reason: "Tax status is not in the EC or RoR; an absence-of-tax statement requires the Bhulekh due-amounts field, which is null in this transcript.",
    section: "encumbrance",
  },
  {
    text: "We recommend obtaining a property tax receipt from BMC before transacting.",
    grounded: false,
    reason: "BMC property tax is not in any source. Recommendation implies access to a system the report does not query.",
    section: "action",
  },
  {
    text: "There is no risk of boundary dispute based on the satellite imagery.",
    grounded: false,
    reason: "Satellite imagery does not establish legal boundaries. This is a claim the report is not equipped to make.",
    section: "regulatory",
  },
  {
    text: "The seller has full legal authority to transfer the plot.",
    grounded: false,
    reason: "Seller authority requires PoA / legal-heir verification, not in scope of current fetcher suite.",
    section: "owner",
  },
  {
    text: "Based on market trends, this plot is undervalued at ₹X per decimal.",
    grounded: false,
    reason: "Market valuation is not in any source. Report must not produce price opinions.",
    section: "plot",
  },
  {
    text: "The plot is suitable for a residential building of up to three floors.",
    grounded: false,
    reason: "Buildable height comes from BDA CDP / BMC building bylaws, not from the sources in this report. No claim about floor count is grounded.",
    section: "land",
  },
  {
    text: "We have verified that the owner is not involved in any court case.",
    grounded: false,
    reason: "Negative court-case findings are explicitly disclaimed in the report (per R6 / R13). The AI summary must not contradict that.",
    section: "encumbrance",
  },
  {
    text: "All documents are in order and you may proceed with registration.",
    grounded: false,
    reason: "Final transaction recommendation. Forbidden by Section 3 of PRODUCT.md.",
    section: "action",
  },
  {
    text: "The mutation history shows continuous ownership since 1962.",
    grounded: false,
    reason: "The RoR back page in the fixture does not extend to 1962; the 'continuous since' claim is unprovable from the source.",
    section: "owner",
  },
  {
    text: "There is a 5% chance of fraud on this transaction.",
    grounded: false,
    reason: "Fraud probability is not computed by any agent in the pipeline. The report must not produce a numeric risk.",
    section: "action",
  },

  // ─── Negative test: A11 must still permit the existing report voice ──────
  {
    text: "We could not verify whether the encumbrance certificate covers the last 30 years.",
    grounded: true,
    reason: "A gap-statement is the correct voice. Even if the AI generated it, the absence-of-claim is grounded in the report's own data-quality disclosures.",
    section: "encumbrance",
  },
  {
    text: "We recommend consulting a property lawyer before transacting.",
    grounded: true,
    reason: "This is the standard report footer recommendation, not a per-plot claim.",
    section: "action",
  },
  {
    text: "The mutation history is consistent with the recorded owner name in the RoR.",
    grounded: true,
    reason: "Cross-source consistency is a finding the report is explicitly designed to surface.",
    section: "owner",
  },
  {
    text: "This plot appears to be the same parcel referenced in Bhunaksha GIS code 20021110500.",
    grounded: true,
    reason: "GIS code is a verifiable identifier in the source data; cross-referencing it is grounded.",
    section: "plot",
  },
] as const;

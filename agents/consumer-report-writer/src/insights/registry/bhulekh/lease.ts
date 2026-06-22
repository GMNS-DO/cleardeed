// agents/consumer-report-writer/src/insights/registry/bhulekh/lease.ts
//
// T-050 — IGR lease-deed detection rule (Bhulekh-only signal path).
//
// ROR-INS-180 fires a redFlag when the RoR shows the signatures of a
// prior lease deed:
//   - The Odia "rights" / ଅଧିକାର text contains a lease-tenure word
//     (e.g. "ଲିଜ" / "lease", "ପଟ୍ଟା" / "patta", "ବନ୍ଦୋବସ୍ତ" / "bandobast")
//   - AND the raw kisam (କିସମ) is Sthitiban / Raiyati / ସ୍ଥିତିବାନ / ରାୟତି
//
// This is the Bhulekh-only pre-check for the Patia Industrial-Lease
// Scam (CLAUDE.md Section 8.1, Pattern 1). The full IGR cross-check
// remains a manual verification step the action item points to; the
// purpose of this rule is to surface the lease pre-flag from publicly
// available Bhulekh RoR text alone, before any IGR concierge is
// engaged.
//
// This rule REPLACES the previous ROR-INS-033 stub. The stub is
// preserved in bhulekh/land.ts for backwards compatibility but is
// superseded by ROR-INS-180.
//
// Action item points to IGR manual verification (the concierge task
// T-046) plus a Patia Industrial-Lease specific investigation prompt.

import type { Insight, Rule, RuleInput } from "../../schema";

const v = "1.0.0";

// Odia + English lease-tenure keywords. Match is case-insensitive and
// whitespace-tolerant. The Odia set is the one most commonly seen in
// Khordha RoR rights text; the English set covers transliterated
// variants that show up in some tahasil PDFs.
const LEASE_TENURE_KEYWORDS = [
  "lease",
  "leased",
  "leasing",
  "patta",
  "pattad",
  "pattadar",
  "bandobast",
  "bandobasti",
  "tenancy",
  "tenure",
  "ଲିଜ", // lija (lease)
  "ପଟ୍ଟା", // patta
  "ପଟ୍ଟାଦାର", // pattadar
  "ବନ୍ଦୋବସ୍ତ", // bandobast
];

// Stitiban / Raiyati raw kisam values (English + Odia). We match on the
// raw RoR text rather than the parsed dictionary form so that
// transliteration variants and partial OCR don't cause us to miss the
// signal.
const STHITIBAN_KISAM_KEYWORDS = [
  "sthitiban",
  "raiyati",
  "rayati",
  "raiati",
  "raiyat",
  "rayat",
  "ସ୍ଥିତିବାନ", // sthitiban
  "ରାୟତି", // raiyati
  "ରାୟତ", // rayat
];

type BhulekhRuleInput = {
  ror?: {
    status?: string;
    page1?: {
      kisam?: string;
      rawKisamOdia?: string | null;
      rightsOdia?: string | null;
      rightsText?: string | null;
    };
  };
};

function hasAnyKeyword(haystack: string | null | undefined, keywords: string[]): boolean {
  if (!haystack) return false;
  const lower = haystack.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

/**
 * ROR-INS-180 — Patia Industrial-Lease pre-flag (Bhulekh-only).
 *
 * Fires redFlag when both:
 *   1. The RoR rights text contains a lease-tenure keyword, AND
 *   2. The raw kisam text matches Sthitiban / Raiyati.
 *
 * The IGR lease-deed cross-check (T-046 concierge) is the action-item
 * follow-up; this rule's job is to surface the Bhulekh-only signal
 * without it.
 */
function patiaLeaseDeedRedFlag(input: RuleInput): Insight[] | null {
  const i = input as unknown as BhulekhRuleInput;
  const ror = i.ror;
  if (!ror) return null;
  if (ror.status !== "verified") return null;

  const p1 = ror.page1;
  if (!p1) return null;

  const rightsText = p1.rightsOdia ?? p1.rightsText ?? null;
  const rawKisam = p1.rawKisamOdia ?? p1.kisam ?? null;

  const hasLeaseTenure = hasAnyKeyword(rightsText, LEASE_TENURE_KEYWORDS);
  const hasSthitibanKisam = hasAnyKeyword(rawKisam, STHITIBAN_KISAM_KEYWORDS);

  if (!hasLeaseTenure || !hasSthitibanKisam) return null;

  return [
    {
      panel: "land",
      issueLens: "land_use_permission",
      evidenceStrength: "document_anchor",
      source: "bhulekh:ror:page-1:lease+sthitiban",
      severity: "redFlag",
      headline: "RoR shows signatures of a prior lease on a Sthitiban / Raiyati khatiyan",
      body: `The RoR's rights text (${(rightsText ?? "").trim()}) and raw kisam (${(rawKisam ?? "").trim()}) together indicate a prior lease deed (RLD) on a Sthitiban / Raiyati record. This is the Bhulekh-only signal for the Patia Industrial-Lease Scam — the OGLS Act Section 3B allows the government to resume lease-to-freehold land that was sold without prior state approval.`,
      actionItem:
        "Do not pay any advance. Ask the seller's advocate for a certified copy of any IGR lease deed (RLD) registered against this khatiyan, plus the state government's no-resumption certificate. If a lease deed exists and no freehold conversion order is on file, the land can be resumed by the government at any time and the purchase consideration is at risk. The IGR manual-verification checklist (T-046) covers the full cross-check.",
      ruleId: "ROR-INS-180",
      disclosure: {
        whatWeChecked:
          "Parsed the RoR's rights text and raw kisam for the documented co-occurrence of a lease-tenure keyword and a Sthitiban / Raiyati kisam. This is the Bhulekh-only pre-flag; the IGR lease-deed cross-check is the definitive test and remains a manual verification step.",
        howToVerify:
          "Open the RoR PDF from bhulekh.ori.nic.in manually and read the rights / ଅଧିକାର and kisam / କିସମ fields. Visit igrodisha.gov.in to query the Encumbrance Certificate (EC) for any lease deed (RLD) registered against this khatiyan, or engage the ClearDeed IGR concierge for a paid EC retrieval.",
        limitsOfThisCheck:
          "Bhulekh's text extraction can miss transliterated lease keywords or fail to OCR a Sthitiban / Raiyati kisam. A 'no fire' result does not certify absence of a prior lease — it only means the Bhulekh-only signal did not match the documented pattern. The IGR EC remains the definitive cross-check.",
      },
    },
  ];
}

export const bhulekhLeaseRules: Rule[] = [
  { id: "ROR-INS-180", panel: "land", fn: patiaLeaseDeedRedFlag, version: v },
];

# Scoring Methodology — Consumer Cohort

**Document:** docs/scoring/consumer.md
**Cohort:** Individual land buyers in Odisha (Khordha district)
**Agent:** A10 ConsumerReportWriter, A9 CrossSourceValidator
**Status:** V1 — complete, no score for consumers

---

## Policy

**No numerical score, no composite metric, no traffic-light system.** The consumer report shows dimension-specific findings only. This is the policy from ADR-011.

The rationale: a consumer buying land in India with their life savings will not make a better decision because a number told them to. They will make a better decision because they understand what the records show, what they don't show, and what questions to ask next. A number creates false confidence and exposes ClearDeed to liability. A structured finding does neither.

---

## Finding Types

Every output dimension falls into one of four finding types:

| Finding type | When it applies | How it appears in the report |
|---|---|---|
| **Source-backed / matched** | Source returned data and the applicable validator passed. Use "verified" only for L4 human-reviewed facts or L3 cross-source agreement. | "Bhulekh RoR shows [fact]" or "the completed source returned [fact]." |
| **Discrepancy / not verified** | Source returned data but cross-source validation found discrepancies or the claim is below L3. | "The records show [fact], but [discrepancy]. Ask the seller to explain." |
| **Manual required** | Source unavailable, timed out, or returned partial data | "We could not verify [dimension]. To verify, [specific instructions]." |
| **Not covered** | No integrated source exists for the dimension in V1. | "This was not checked online in this run; manual verification is required." |

---

## Confidence Band Mapping

Tier-2 agents (A5–A8) produce `{value, confidence: 0.0–1.0, basis: "source + reasoning"}`. The confidence score maps to finding type:

| Confidence | Finding type |
|---|---|
| 0.85–1.0 | **Source-backed / matched** — high confidence, but consumer copy still remains source-scoped unless L4 reviewed |
| 0.50–0.84 | **Manual required** — moderate confidence, recommend verification |
| 0.0–0.49 | **Manual required** — low confidence, strong recommendation to verify |
| Source unavailable | **Manual required** — specific instructions provided |

The confidence band is internal to the system. It does not appear in the consumer report. Only the finding type appears.

---

## Per-Dimension Rules

### GPS / Plot Location (A1 GeoFetcher)
- **Source-backed / matched:** GPS passes Khordha numeric bounds, district polygon check, and Bhunaksha WFS returns a containing polygon for the point
- **Manual required / blocked:** GPS coordinates are invalid, outside Khordha, near the district edge, or GeoServer WFS returns no containing polygon

### Owner Name (A5 OwnershipReasoner)
- **Source-backed / matched:** Seller-provided full legal name matches a Bhulekh RoR owner name, with match method and guardian context shown
- **Discrepancy / not verified:** Partial match, mismatch, initials, or surname-only match — discrepancy explained in plain English
- **Manual required:** Bhulekh did not return RoR data, or RoR returned no owner name

### Land Classification (A6 LandClassifier)
- **Source-backed / matched:** Target plot land class is present in Bhulekh RoR and mapped by A6
- **Manual required:** Land class is missing/unknown, target plot is not reconciled, or zoning/buildability overlays are not integrated
- **Not covered:** BDA/BMC/Bhuvan zoning and buildability layers are not integrated in V1

### Court Cases (A3 CourtCases)
- **Source-backed / matched:** Cases returned by eCourts/RCCMS are listed with source and raw status
- **Manual required:** Zero-case output remains source-scoped/manual unless captcha acceptance, raw artifacts, parser metadata, variants, and RCCMS live coverage meet the L3 negative-result gate
- **Not covered:** High Court and DRT searches are not integrated in V1

### Encumbrance (A7 EncumbranceReasoner)
- **Manual required (all cases in V1):** Encumbrance certificate cannot be retrieved automatically in V1. Report shows: "Encumbrance status is not available online. Request the Encumbrance Certificate from the Sub-Registrar office for [plot number] at [nearest SRO]. Instructions: [step-by-step]."
- **Not covered:** Clean encumbrance, transaction-history, and CERSAI charge claims are not available without an EC/IGR/CERSAI artifact.

### Regulatory Flags (A8 RegulatoryScreener)
- **Source-backed / matched:** A completed official overlay source returns a positive flag or completed no-overlap result with layer/timestamp metadata
- **Discrepancy / not verified:** Flag triggered — specific regulation named, proximity/overlap detail, instructions
- **Manual required / not covered:** Overlays unavailable for the village or plot location; no clean no-flag finding is shown

---

## What Does NOT Appear in the Consumer Report

Per PRODUCT.md Section 3, the following are explicitly prohibited:

- Any overall score (0–100, A–F, any numeric or letter grade)
- Any traffic-light system (red/yellow/green dots, boxes, or badges)
- "Safe to buy," "clear title," "good investment," or any language implying a purchase recommendation
- A percentage or confidence number
- The word "certified" or "guaranteed"
- Language suggesting the report substitutes for legal advice

If A11 OutputAuditor detects any of these, it blocks publication and triggers a regeneration cycle.

---

## Version History

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-04-20 | Initial. No score policy. Confidence band mapping. Per-dimension rules. |

---

## Open Questions

1. Should the consumer report show a "last verified" timestamp for each dimension, or just the overall report timestamp? Recommendation: per-dimension timestamp — consumer needs to know how recent each check is.
2. Should "not verified" findings include a suggested action for the seller ("ask the seller to produce X document")? Recommendation: yes, but only for dimensions where the remediation path is clear (e.g., name mismatch → ask for identity proof).

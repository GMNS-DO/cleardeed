# FRAUD_PATTERNS.md — Documented Odisha Property Fraud Patterns

> **Scope:** Real Khordha-district fraud patterns documented in the last 36 months. Each maps to a detection rule that fires in the report.
> **Companion:** Detection rules also referenced in `PRODUCT_SPEC.md` §5.
> **Rule for adding new patterns:** must be a real documented case, not a generic India-wide fraud taxonomy. Source the case (news article, FIR, GA order). Add detection logic. Test against existing reports before going live.

---

## Pattern 1: The Patia Industrial-Lease Scam

**Documented:** September 2024, Patia mouza (Khordha district).

**What happened:** 5,000 decimals in Patia (Plot 309, Khata 493) was leased for 99 years in 1979 to "Allied Industries" for industrial use. The tehsildar prepared Khata 474/5 in Sthitiban (freehold-like) status. A residential apartment is being built on it and sold to homebuyers. The GA Department issued notices in September 2024 ordering resumption under OGLS Act §3B. Buyers may lose everything.

**Why it matters:** The Bhulekh record alone showed the plot as freehold. The fraud was visible only by cross-referencing IGR for prior deed history showing a lease.

**Detection rule:**
```
IF  Bhulekh.satwa ∈ {Sthitiban, Raiyati}
AND IGR.deed_history(village, khata).any(deed_type = 'RLD')
THEN fire CRITICAL flag: "Prior lease deed (RLD) detected on this plot/khata.
                          Plot may be government lease land currently shown as freehold.
                          Government resumption risk — full purchase value at risk."
```

**Exposure:** Full property value.

**Sprint live:** S3 (when IGR EC integration ships).

---

## Pattern 2: The Surya Nirman Multi-Investor Fraud

**Documented:** Bhubaneswar 2017–2023, EOW case.

**What happened:** M/s Surya Nirman Resources Pvt Ltd collected ₹2+ crore from depositors promising "litigation-free plots" in Chandaka and Kantabada (Khordha district). The properties were eventually attached by the Economic Offences Wing under the Odisha Protection of Interests of Depositors (OPID) Act and sold via public auction. Depositors received cents on the rupee.

**Why it matters:** The Bhulekh and IGR records would have shown the property as legitimately owned by the company at the time of sale. The fraud was visible only by cross-referencing the EOW blacklist.

**Detection rule:**
```
IF  (plot, khata, village) ∈ eow_attached_properties.json
THEN fire CRITICAL: "This property appears on the EOW attached-property list under OPID Act.
                     Sale may be void; property may be auctioned by court."

IF  owner_name ∈ eow_arrest_list.json
THEN fire HIGH WATCH-OUT: "Seller name matches an EOW arrest record.
                            Independent verification of identity strongly recommended."
```

**Exposure:** Full property value (attached property) or significant cloud on title (named seller).

**Data source:** `eowodisha.gov.in` — scraped monthly, refreshed into `khordha_eow_blacklist.json`.

**Sprint live:** S11 (PI 3) — manual lookup until then.

---

## Pattern 3: The Malipada Impersonation Scam

**Documented:** Malipada mouza (Bhubaneswar), 2020–2023.

**What happened:** A 2,000 sq ft plot in Malipada was sold to a buyer by impersonators who prepared fake sale deeds in the name of the real owner. The real owner (Lipika Das of Kendrapara) filed a complaint. Eight people were arrested. The buyer's title was void; their money was gone.

**Why it matters:** The fraud worked because the buyer never independently verified that the person signing was the person on the ROR. The impersonators relied on the buyer trusting the broker's identification.

**Detection rule (initial, manual):**
```
IF  seller.aadhaar_address.district ≠ plot.district
AND no PoA registered at the local SRO for this seller-plot combination
THEN fire HIGH WATCH-OUT: "Seller's verified address is in a different district from the plot.
                           No power-of-attorney is registered at the local SRO.
                           Insist on in-person verification with original Aadhaar at sub-registrar."
```

**Exposure:** Full property value if impersonation is successful.

**Sprint live:** S3 (manual instruction in report) → S11 (automated PAN/Aadhaar district inference).

**Note:** This rule has high false-positive potential (genuine owners do live elsewhere). Frame the insight as *"do this verification step,"* not as *"this is suspicious."*

---

## Pattern 4: Industrial-Zone Plot Sold as Residential (CEE DEE Builders pattern)

**Documented:** Jagulaipadar mouza (Khordha district), multiple cases ongoing.

**What happened:** Buyers purchased plots from a builder in Jagulaipadar. Some plots fell under BDA Industrial Zone designation in the master plan. Buyers discovered post-purchase that they could not build residential structures or get building permission. Their plots were technically usable for industrial purposes only.

**Why it matters:** Kisam on the ROR is an agricultural / non-agricultural classification — it doesn't tell you about zoning. Zoning is a separate layer in the BDA/CDA/PDA master plan that buyers almost never check.

**Detection rule:**
```
IF  plot.GPS ∈ BDA_master_plan.industrial_zone OR commercial_only_zone OR green_belt
AND buyer_intent = residential  (assumed by default for consumer flow)
THEN fire CRITICAL: "Plot falls under [zone name] in the BDA Master Plan.
                     Residential construction is not permitted at this location.
                     Building permission will be denied."
```

**Exposure:** Functional total loss — plot exists but cannot be used as buyer intends.

**Sprint live:** S4 (Khordha BDA zoning lookup); S6–S7 (CDA, PDA for other districts).

---

## Pattern 5: The Subdivided Plot Without BDA Layout Approval

**Documented:** Multiple cases across Khordha, ongoing.

**What happened:** Individual landowners or small middlemen subdivide a parent plot into sub-plots (e.g., 415/1, 415/A, D/88-style) and sell them to buyers. The subdivision is not approved as a formal layout by BDA. Buyers find post-purchase that they cannot get building permission because the layout itself is unauthorized.

**Why it matters:** The ROR for a sub-plot looks identical to the ROR for a regular plot — the fraud (or negligence) is invisible at the records layer. It is detectable only by recognizing the sub-plot naming pattern and verifying against the BDA approved-layout registry.

**Detection rule:**
```
IF  plot_number matches regex /^\d+\/[\d\w]+$/ OR /^D\/\d+/
THEN flag plot as potentially subdivided

IF  sub_plot_detected = true
AND parent_plot ∉ BDA_approved_layouts
THEN fire HIGH WATCH-OUT: "This plot appears to be subdivided from a parent plot.
                           No BDA layout approval found for the parent.
                           Building permission risk — verify layout approval before purchase."
```

**Exposure:** Construction permission denied + future regularization costs (₹50K–₹2L depending on case) + 1–3 year delay.

**Sprint live:** S4 (regex detection + warning) → S11 (BDA approved-layouts registry integration).

---

## How new patterns get added

1. **Document the case.** Source it — news article, public FIR, GA Department order, RTI response. No anecdotes.
2. **Identify the data signal.** What in our existing data would have caught this? If nothing, what additional data source would have?
3. **Draft the detection rule.** Concrete, falsifiable, with clear thresholds.
4. **Backtest against existing reports.** Does the rule fire on past reports? Would it have helped or alarmed inappropriately?
5. **Add to this file with a sprint target.** Don't add patterns that can't be implemented within 2 sprints — they age badly.
6. **Reference in `PRODUCT_SPEC.md` §5.**

---

## Patterns under research (not yet implemented)

These are documented but the detection mechanism is unclear or the data source is unavailable. Revisit each quarter.

- **Encroachment-then-regularization scams:** government land informally occupied for 12+ years, then sold via fake mutation entries. *Detection mechanism:* requires title-history depth that Bhulekh does not provide. Possibly cross-referenced with revenue inspector cases over time.
- **Tribal-land transfers in scheduled areas:** under-Article-46 protected lands sold to non-tribal buyers via shell arrangements. *Detection mechanism:* district-level scheduled-area lookup + tribal-status check on owner. Material risk in some districts but not Khordha core.
- **Religious-trust property:** property owned by a math, temple, or trust sold without proper authority. *Detection mechanism:* owner-name pattern matching against trust/religious-institution registry.

---

*Last revised: 2026-05-14. Add patterns as they are documented; do not remove patterns once added (mark as superseded with a date if needed).*

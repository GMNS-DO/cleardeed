# Sub-Agent Brief Result: IGR EC and CERSAI Probe

Parent session: Session 038
Created: 2026-04-30

## Objective
Probe IGR Odisha EC flow and CERSAI public charge search to understand what is buildable as paid add-ons.

## What was produced

Two source documentation files:

1. **docs/sources/igr-ec.md** (106 lines) — IGR Odisha Encumbrance Certificate source documentation covering:
   - What EC does and does not cover (registered transactions only, not CERSAI charges or oral transactions)
   - Identified access URLs: igrodisha.gov.in (IGR portal) and registrationodisha.gov.in (NGDRS-based services)
   - Access level: public search may be available, but certified EC requires login and fee
   - Data returned: transaction list with document type, date, parties, property description, consideration
   - Build assessment: viable as concierge add-on (prep application, guide buyer through SRO process, review EC)
   - Key blockers for full automation: portal auth, fee payment, SRO jurisdiction resolution
   - 6 open questions for next live probe

2. **docs/sources/cersai.md** (110 lines) — CERSAI Central Registry source documentation covering:
   - What CERSAI does: records security interests (mortgages/charges) by FIs under SARFAESI Act
   - Key value: catches equitable mortgages NOT in SRO EC (FI-registered charges that bypass local SRO)
   - Access URL: cersai.org.in, public search interface, no login required for search, no search fee
   - Data returned: charge type, property, borrower/chargor, secured creditor, creation date, amount, status (active/satisfied)
   - Build assessment: more feasible than IGR EC — public, free, name-based, no SRO jurisdiction to navigate
   - Key challenge: name transliteration from Odia script to Roman, name variant handling
   - Recommended build sequence: concierge first (operator runs search with Bhulekh name), then automate
   - 8 open questions for next live probe

## What was attempted and abandoned

- Live URL verification via WebFetch: blocked by permission denial for both igrodisha.gov.in and cersai.org.in
- Multiple web search rounds: returned no useful results — search engine coverage of these specific government portals is minimal, likely because they are not well-indexed
- Without live browser access, exact URL confirmation and form-level details had to be documented as "probe needed"

## Build assessment summary

**IGR EC (concierge add-on)**:
Viable as concierge add-on because: fee payment and document retrieval require human involvement; main ClearDeed value is preparing correct application inputs (property details, search period, owner names) so the buyer arrives at the SRO with correct details. Full automation is harder due to portal auth, fee payment, PDF parsing, and SRO-to-tahasil resolution gaps. This should be the second concierge add-on after CERSAI.

**CERSAI (concierge add-on, then automate)**:
More feasible than IGR EC because: public search is free, no login, name-based, no SRO jurisdiction to navigate, and structured tabular results. The main automation challenge is name transliteration — CERSAI expects Romanized names while Bhulekh owners are in Odia script. A5 (OwnershipReasoner) already produces transliterated names, so the integration point is clear. Recommended as the first paid add-on to build after core source expansion.

## New questions raised

1. What are the exact current live URLs for IGR online EC search and CERSAI public search?
2. Does CERSAI expose any API, or is scraping the only automation path?
3. What is the Odisha-specific SRO jurisdiction map — which SRO covers which villages in Khordha?
4. Can Bhulekh owner names (Odia script) be reliably transliterated and used for CERSAI party name search?
5. What is the CERSAI search terms of service regarding automated queries?
6. Does IGR Odisha have an online EC application flow that accepts pre-filled property details?

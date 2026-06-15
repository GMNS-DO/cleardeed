# External Data Paths Research — eCourts + CERSAI

**Date:** 2026-06-15
**Author:** Research synthesis (5 search angles + 5 adversarial verification passes)
**Context:** Indian property due-diligence startup ClearDeed needs automated access to (1) eCourts pending-case lookup by party name (Khordha/Odisha primary, all-India long-term) and (2) CERSAI borrower-name search for security interests. Current state: eCourts V6 portal 302/403 blocked, dCourts subdomain alive but OCR ~30% accurate; CERSAI V2 Vue SPA blocker (captchaHash reactive state, can't be triggered by automation). Volume: 50–200 reports/month launch. Budget: sub-₹10K/mo comfort, ₹50K/mo hard ceiling. Solo founder, 1–2 month integration timeline.

---

## Executive summary

1. **eCourts has no sanctioned B2B API for startups.** NJDG/eCommittee APIs are government-department-only as of June 2026 (per [eCommittee service page](https://ecommitteesci.gov.in/service/national-judicial-data-grid/) and [PIB PRID 1848425](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=1848425)). The only startup-friendly path is a paid commercial reseller — **eCourtsIndia.com Enterprise Monthly at ₹10,000/mo** is the single concrete option below ₹50K/mo.
2. **CERSAI has no startup-eligible B2B API.** The Feb 2025 SI Registry Search API launch ([Rajat Bindlish, LinkedIn](https://www.linkedin.com/posts/rajat-bindlish-4749538_cersai-india-has-launched-search-apis-in-activity-7296119575522254848-jeAa)) is restricted to "banks, NBFCs, REs." No surveyed aggregator (HyperVerge, Decentro, Perfios/Karza, Signzy, IDfy) resells a true by-name SI encumbrance search to non-FIs. Sub-entity sponsorship via an onboarded Reporting Entity is the only documented path.
3. **The MeitY 9 Jun 2025 probe** of Surepass, Digitap, Zoop, Signzy for "bypassing authorised protocols" sets the live enforcement precedent — captured by [Economic Times](https://m.economictimes.com/tech/startups/id-please-meity-verifies-identity-verification-startups/articleshow/121710520.cms). Any in-house captcha-solver is operating in this attention zone. Captcha-bypass automation (LegiScore's approach) is the technical fallback, with the same legal posture as IGR EC automation (D-035).
4. **For eCourts, pursue the eCourtsIndia.com pilot this week** (signup → free ₹200 credit → 5-call ground-truth test on Khordha/District Court records). If accuracy < 70% on real Odisha cases, fall back to in-house ddddocr scraper with typed degradation. **For CERSAI, do not chase an API** — request a sales intro to Signzy/Checkpost for sub-entity sponsorship, and in parallel build a headless captcha-solver adapter against the public portal (same architecture as D-035).
5. **Net launch readiness:** eCourts = green (vendor path exists, sub-budget). CERSAI = yellow (no clean vendor path; will need captcha-solver or partner with an onboarded RE). Legal risk on both is real but **manageable for a consumer-facing report that summarizes — not republishes — the underlying data.**

---

## Section 1: eCourts

### 1.1 Official API / institutional access

| Attribute | Finding |
|---|---|
| **Path** | NJDG APIs via eCommittee |
| **Eligibility** | Central and State Government departments only (departmental ID + access key). "Institutional litigants" on the roadmap per [Drishti IAS explainer](https://www.drishtiias.com/daily-updates/daily-news-analysis/national-judicial-data-grid) but not yet active. |
| **Lead time** | Not published for non-government; effectively "not available" |
| **Cost** | None published (would be negotiated as a government MoU) |
| **ToS / legal status** | The eCommittee has no published B2B partner program, no rate card, and no third-party redistribution policy. The [e-Committee Digital Courts / Phase III vision](https://ecommitteesci.gov.in/service/digital-courts/) describes OCOD ("One Case One Data") as a 2026 unification scheme, but explicitly notes the records are "too unorganised for digitisation" per [The Print](https://theprint.in/opinion/one-case-one-data-court-records-are-too-unorganised-for-digitisation/2936181/). |

**Verdict:** Closed to startups as of June 2026. The official eCourts Services portal ([ecourts.gov.in](https://ecourts.gov.in/), [services.ecourts.gov.in](https://services.ecourts.gov.in/)) is captcha-gated HTML, not a developer surface. Best framing for any future ask: a "Paid API and Data Access Program via NJDG" analogous to US PACER, as advocated by [Rohan K. George on LinkedIn](https://www.linkedin.com/pulse/moat-should-rethinking-access-judicial-data-rohan-k-george-sky5c). Not a launch-blocker dependency.

### 1.2 Paid vendor options (ranked, top 5)

#### #1 eCourtsIndia.com (Phoenix) — primary recommendation
- **URL:** [ecourtsindia.com/api](https://ecourtsindia.com/api), [pricing](https://ecourtsindia.com/api/pricing), [docs](https://ecourtsindia.com/api/docs)
- **Has eCourts data:** Yes. Claims 27.8 Cr+ case records across SC, 25 HCs, 600+ district courts, NCLT, CAT, Consumer Forums.
- **Pricing:** ₹200 free credit on signup (no card); PAYG from ₹1,000/₹2,500/₹5,000 deposit at **3× base rate** (e.g. headline search ₹0.20 = effective ₹0.60 on PAYG); **Enterprise Monthly ₹10,000/mo for 10,000 credits at base rate** (effective ₹0.20/search); Enterprise Annual ₹1,00,000/yr. Per-call base: case search ₹0.20, case detail ₹0.50, cause list ₹1.00, order PDF ₹1.25, AI summary ₹2.50.
- **ToS status:** Bearer token (HMAC) auth; commercial use requires paid plan. **The vendor is a scraper, not a government-licensee** — see red flags.
- **Lead time:** Same day for signup; 5-call ground-truth pilot can run inside 48 hours.
- **Limitations:** Rate limits 100 req/min, 3,000/hr, 50,000/day; IP allowlisting required on Enterprise; 99.9% SLA claimed (no public status page).
- **Independent reviews / red flags:**
  - **Brand-confusable with official ecourts.gov.in** — the largest single red flag. For a trust product, sourcing from a vendor with a name chosen to mimic the government portal is a brand-risk decision, not just a vendor-selection decision.
  - **New vendor (post-2024 era)** — App Store id `id6755883790`, LinkedIn launch March 2026, MCP marketplace listing recent. No independent enterprise customer logos, no G2/Capterra/SoftwareSuggest reviews. The only third-party coverage is a single Reddit self-review at [r/IndiaLaw](https://www.reddit.com/r/IndiaLaw/comments/1rix1h4/ive_been_using_ecourtsindiacoms_api_about_indias/) (3-month practitioner use, content not directly fetchable). A [privacy-concern thread at r/IndiaLaw](https://www.reddit.com/r/IndiaLaw/comments/1s04vhw/ecourtsindiacom_looks_like_a_privacy_nightmare/) flags data-redistribution risk.
  - "27.8 Cr+ records" exceeds NJDG's official ~15.7 Cr (per [NJA briefing PDF, 2021-22](https://nja.gov.in/Concluded_Programmes/2021-22/P-1261_PPTs/4.eCourts.pdf)) — vendor hasn't disclosed methodology.
  - **SOC 2 is a self-asserted badge**, no audit report PDF linked; SOC 2 Type II audits cost $20K–$50K+ and the sub-₹1L/year pricing wouldn't support one without a much larger enterprise book.
  - **PAYG is 3× headline** — the actual per-search cost on the free/PAYG tier is closer to ₹0.60–₹7.50, not ₹0.20–₹2.50. The ₹10K/mo Enterprise plan is the first tier where headline and effective rates align.
  - Founder's [dev.to writeup](https://dev.to/rchtjn2/building-legal-tech-on-indian-court-data-a-guide-to-apis-and-resources-38ol) is a self-promotion channel, not a neutral review.

#### #2 Surepass eCourts API — quote-on-quote, comparison candidate
- **URL:** [surepass.io/ecourts-api/](https://surepass.io/ecourts-api/), [ecourt-cnr-search-api](https://surepass.io/ecourt-cnr-search-api/)
- **Has eCourts data:** Yes. District + HC + SC + "Judicial bodies across India." Supports name-based search (individual, father, address, court, type, state).
- **Pricing:** **Not public** — proposal-based, typically per-call with enterprise annual contracts.
- **ToS status:** ISO 27001:2013, CIN U72900DL2019PTC349962. Like eCourtsIndia, a scraper/repackager, not a licensee.
- **Lead time:** Sales contacts within 24h per vendor site; contract + integration typically "days" per [ThirdWatch](https://thirdwatch.dev/blog/scrape-mca-india-company-data-for-due-diligence).
- **Limitations:** Pricing opacity makes budget fit unverifiable. No public eCourts-specific case studies.
- **Independent reviews / red flags:**
  - **Named in the 9 Jun 2025 MeitY probe** for "bypassing authorised protocols" — confirmed by [Economic Times](https://m.economictimes.com/tech/startups/id-please-meity-verifies-identity-verification-startups/articleshow/121710520.cms), [Medial](https://medial.app/news/id-please-meity-verifies-identity-verification-startups-41fe221b02a1c), [Mitigata LinkedIn mirror](https://www.linkedin.com/posts/mitigata-full-stack-cyber-resilience_id-please-meity-verifies-identity-verification-activity-7338522865727635456-FNU0). The probe is KYC/identity-focused, not specifically eCourts — but it confirms the regulatory posture toward captcha-bypass aggregators.
  - G2 shows 3 verified reviews (4.3 stars) for the broader platform — thin independent review base.
  - Parent is operational across Aadhaar/PAN/vehicle RC, which makes Surepass more credible on continuity than eCourtsIndia on the eCourts module depth.

#### #3 LegalKart Court Case API — sub-₹10K, but coverage unverified
- **URL:** [legalkart.com/api-services](https://www.legalkart.com/api-services)
- **Has eCourts data:** Claims "all District Courts across India"; 27+ endpoints, JSON, PDF order links.
- **Pricing:** ₹2,000 one-time activation; ₹2.00/hit District Court Case API; Cause Lists ₹2–5/hit; 5 free trial calls. **Cleanly sub-₹10K/mo** at 200 calls/month = ₹400 + activation amortised.
- **ToS status:** Not separately published.
- **Lead time:** Day-of-signup.
- **Limitations:** **Does not explicitly list Odisha** in public docs — load-bearing gap for Khordha.
- **Independent reviews / red flags:** A duplicate/secondary URL `legalkart.wrctpl.com/api-services` exists (third-party host `wrctpl.com`) — unusual for a primary product page. App Store presence is for the lawyer-matching app, not the API. Pricing is realistic; coverage claim is unverified.

#### #4 Indian Kanoon API — judgments-only, not case status
- **URL:** [api.indiankanoon.org](https://api.indiankanoon.org/), [pricing](https://api.indiankanoon.org/pricing/), [terms](https://api.indiankanoon.org/terms/)
- **Has eCourts data:** **No** — judgments and orders corpus, not case status. Explicitly does not cover live case status, CNR, district-court pending cases, or eCourts data.
- **Pricing:** Search ₹0.50, document ₹0.20, fragment ₹0.05, metainfo ₹0.02. ₹500 free on signup; **non-commercial use cases get free ₹10,000/month** subject to use-case verification.
- **ToS status:** Request-signing with public-private key pair. Mandatory "powered by IKanoon" attribution. Jurisdiction: Bangalore. Pre-paid, no balance = no results.
- **Lead time:** Same-day.
- **Limitations:** Wrong product surface for ClearDeed's pending-case need. Useful only as a fallback for "is there any order on this case" text search.
- **Independent reviews / red flags:** Indian Kanoon is itself a scraper (not an authorized licensee) — the legal gray area is real, and the price is set unilaterally by the aggregator.

#### #5 Attestr Court Record Check API — quote-only
- **URL:** [docs.attestr.com/attestr-docs/court-record-check-api](https://docs.attestr.com/attestr-docs/court-record-check-api), [court-cases-search-api](https://docs.attestr.com/attestr-docs/court-cases-search-api), [unified-ecourt-case-details-api](https://docs.attestr.com/attestr-docs/unified-ecourt-case-details-api)
- **Has eCourts data:** Yes. District Civil, Sessions/Magistrate, HCs, SC, Tribunals. ML-score 1–100. Real-time + async.
- **Pricing:** Not public — sales-led.
- **ToS status:** DPDP consent required.
- **Lead time:** Sales onboarding, not documented.
- **Limitations:** Premium features (age/address of respondent) gated "on request." No published enterprise customers.

**Vendors explicitly considered and rejected:**
- **ECIAPI (eciapi.akshit.me → court-api.kleopatra.io)** — 30 free trial, "Pay Per Request" no public rate card. Unofficial scraping-based product. No public enterprise traction.
- **Apify Indian Kanoon wrapper (jungle_synthesizer)** — thin wrapper, not a separate pricing path. Notably states "eCourts uses aggressive captcha and is not in scope for this actor" — independent confirmation of the captcha barrier.
- **bharat-courts (GitHub, MIT)** — open-source async Python SDK with ddddocr (~75% accuracy) for 700+ district courts, 25 HCs, SCI. Orissa HC supported (state code 11). Use this as the **in-house fallback** if vendors fail the ground-truth test.
- **openjustice-in/ecourts (GitHub)** — Python scraping toolkit for party-name/advocate/FIR search. Confirms captcha is the binding constraint.
- **LEEGLE (r/developersIndia)** — explicit "We do not bypass or automate captcha" posture; reduces to 1–3 captchas per state. Different ToS posture from bharat-courts; useful contrast.
- **Niraj Pandkar captcha-bypass writeup (Medium)** — practitioner account; useful evidence that in-house captcha solving is a real industry path.

### 1.3 Recommended path forward (eCourts)

**Step 1 (this week):** Sign up at [ecourtsindia.com/api](https://ecourtsindia.com/api) (no card). Get ₹200 free credit. Run a 5-call ground-truth test:
- 2 party-name searches for known plaintiff/defendant strings in Khordha District Court
- 1 CNR lookup for a known case (use any prior test data)
- 1 case-detail call on a returned CNR
- 1 cause-list call for Khordha for today's date

**Acceptance criteria:** ≥70% match against manually-verified ecourts.gov.in queries. If yes, upgrade to Enterprise Monthly ₹10,000/mo (10,000 credits at base rate). If no, drop and retry the same test with **Surepass** (request quote) and **LegalKart** (use 5 free trial calls).

**Fallback if all vendors fail ground-truth test:** Build the in-house ddddocr-based scraper modeled on bharat-courts, with the same typed-degradation wrapper used for IGR EC (D-035). Expected accuracy 75% per the open-source community; ClearDeed's existing 3-way ddddocr ensemble + adaptive K from D-035 should push this higher. Captcha + adaptive K is **the same architectural pattern that already exists for IGR EC**, not net-new.

**Long-term:** Watch for an eCommittee "Specified User" or commercial partner tier — modelled on the 2022 RBI CICRA expansion ([Lexology](https://www.lexology.com/library/detail.aspx?g=c726afa3-ceb8-4f2b-b28e-0b41f87d6152), [Vinod Kothari](https://vinodkothari.com/2022/01/specified-users/)). No public signal of such a scheme for eCourts as of June 2026.

---

## Section 2: CERSAI

### 2.1 Official API / institutional access

| Attribute | Finding |
|---|---|
| **Path** | SI Registry Search API (launched 14 Feb 2025) + public borrower-name search on cersai.org.in |
| **Eligibility** | **API:** Banks, NBFCs, and Reporting Entities only. Per [Rajat Bindlish LinkedIn](https://www.linkedin.com/posts/rajat-bindlish-4749538_cersai-india-has-launched-search-apis-in-activity-7296119575522254848-jeAa): "All banks, NBFC, REs can now integrate with CERSAI to search assets based on…". Onboarding is regulator-mediated, not signup-based. Sub-entity sponsorship via an onboarded Reporting Entity (Signzy, Checkpost) is the only documented path for a non-FI. **Public portal search:** Anyone — captcha + ₹10 + GST per search. |
| **Lead time** | API: RE-onboarding process is contract + integration + DSC; typically "days to weeks" once an eligible RE is in place. Portal: instant (captcha + payment). |
| **Cost** | API: contract-specific, not published. **Portal: ₹10 + GST per search, ₹50 for SI creation ≤₹5L, ₹100 above ₹₹5L, ₹50 for satisfaction, ₹10 for assignment** (per [cersai.org.in/feestructure.prg](https://www.cersai.org.in/CERSAI/feestructure.prg), confirmed by [TEAL Whitepaper 10](https://tealindia.github.io/research/TEAL%20Whitepaper%2010-Evolution%20of%20CERSAI%2C%20Current%20Status%20and%20Challenges%20in%20Operationalization.pdf), [L&T Finance](https://www.ltfinance.com/blog/home-loan/what-is-cersai), and third-party cross-references). |
| **ToS / legal status** | The CERSAI ToS page ([cersai.org.in/CERSAI/tnc.prg](https://www.cersai.org.in/CERSAI/tnc.prg)) is a Vue/AngularJS i18n SPA shell — substantive ToS text is not in the rendered HTML and the page is captcha-gated. **The ToS is not publicly indexable.** Mandate under SARFAESI Act Chapter IV is "to create a public data base about encumbrances created on properties," but the terms of *programmatic* access are not public. |

**Verdict:** The official API path is closed to a proptech startup. The public portal is open to anyone for ₹10 + GST/search, captcha-gated, with no API surface. Two viable paths exist: (a) sub-entity sponsorship via Signzy/Checkpost, or (b) headless captcha-solver automation against the public portal.

### 2.2 Paid vendor options (ranked, top 5)

**Critical caveat:** No vendor surveyed offers a true by-name CERSAI SI encumbrance search as a self-serve paid API to non-FIs. The vendors below all sell the **CKYC (KYC)** product, not the **SI (encumbrance)** product, and target FI customers. Adjudication: all five are LOW confidence as direct CERSAI SI encumbrance paths; the only one with a documented sub-entity sponsorship route is Signzy.

#### #1 Signzy (sub-entity sponsorship) — primary recommendation
- **URL:** [signzy.com/agentic-ckyc-platform](https://www.signzy.com/agentic-ckyc-platform), [CERSAI access blog](https://www.signzy.com/blogs/how-to-get-cersai-search-api-access-in-2025)
- **Has CERSAI data:** CKYC (KYC) yes; SI Registry encumbrance via sub-entity sponsorship only.
- **Pricing:** Not public — contract + integration. Surepass's leaked proposal (₹35–55/credit report, ₹50K minimum) at [Scribd](https://www.scribd.com/document/844125187/Surepass-Proposal-IDCS-India) suggests volume-tiered per-transaction pricing is the aggregator norm; SI pricing would be a separate discussion.
- **ToS status:** As an FI-or-RE-eligible entity, Signzy is registered with CERSAI directly. Per [IDFC First Bank](https://www.idfcfirstbank.com/blog/finance/cerai-search-api-pricing-benefits-and-features) and [Alphabold](https://www.alphabold.com/blog/what-is-cersai-search-api/): "Banks and HFCs are eligible by default, while other entity types (such as NBFCs, ARCs, fintechs, and fintechs backed by NBFCs) require additional approvals" — Signzy is the documented case.
- **Lead time:** Weeks (entity KYB, agreement, DSC, integration, sandbox → production).
- **Limitations:** CERSAI access is for KYC purposes, not the SI Registry encumbrance search. Sponsor-model pricing is opaque.
- **Independent reviews / red flags:**
  - **Named in the 9 Jun 2025 MeitY probe** for "bypassing authorised protocols." Significant regulatory exposure. Confirmed by [Economic Times](https://m.economictimes.com/tech/startups/id-please-meity-verifies-identity-verification-startups/articleshow/121710520.cms), [Medial](https://medial.app/news/id-please-meity-verifies-identity-verification-startups-41fe221b02a1c), [Mitigata LinkedIn](https://www.linkedin.com/posts/mitigata-full-stack-cyber-resilience_id-please-meity-verifies-identity-verification-activity-7338522865727635456-FNU0).
  - **Signzy data breach (Dec 2024)** — [BiometricUpdate](https://www.biometricupdate.com/202412/signzy-investigating-kyc-customer-data-breach): customer KYC data on dark web, CERT-In confirmed. Signzy serves 600+ financial institutions including India's four largest banks — a breach is a significant counterparty risk.
  - Backed by GIC, Vertex Ventures; $4M+ in funding. Most institutional footprint of the four MeitY-probed vendors.

#### #2 Checkpost (sub-entity sponsorship) — alternative to Signzy
- **URL:** [api.checkpost.in/registration.php](https://api.checkpost.in/registration.php)
- **Has CERSAI data:** Yes, including property mortgage/lien/ownership/encumbrance/pending loans per [DrapCode integration page](https://drapcode.com/integration/hyperverge/cersai-search-api). Gated to "banks, NBFCs, financial institutions performing property verification for lending operations."
- **Pricing:** Not public.
- **ToS status:** Similar to Signzy — onboarding through an eligible sub-entity.
- **Lead time:** Weeks (parallel to Signzy).
- **Limitations:** Eligibility is lender-only, not buyer-side title-vetting.
- **Independent reviews / red flags:** No independent third-party reviews surfaced in adversarial verification. DrapCode listing is a third-party integration page, not vendor's own documentation.

#### #3 HyperVerge (Government KYC Record Search API) — LOW confidence for SI
- **URL:** [hyperverge.co/in/integrations-marketplace/government-kyc-record-search-api/](https://hyperverge.co/in/integrations-marketplace/government-kyc-record-search-api/)
- **Has CERSAI data:** Bundles CERSAI/CKYC/UIDAI/DigiLocker. **Does NOT break out SI encumbrance endpoint separately** — the product is KYC-class, not encumbrance-class.
- **Pricing:** Not public; standard HyperVerge flow (entity KYB, agreement, sandbox keys, production).
- **ToS status:** Standard HyperVerge aggregator contract.
- **Lead time:** Standard HyperVerge onboarding.
- **Limitations:** Confounds CKYC with SI Registry — classic "KYC-vendor calls it encumbrance" conflation. Treat the encumbrance claim as unverified.
- **Independent reviews / red flags:** G2 reviews are for "HyperVerge Identity Verification" (core KYC), not for a CERSAI SI search. The DrapCode page stating "banks, NBFCs, FIs" eligibility is the only signal.

#### #4 Perfios / Karza (CKYC Search + Download) — CKYC only
- **URL:** [perfios.ai/resources/blogs/streamline-your-ckyc-processes-with-perfios-cutting-edge-solution/](https://perfios.ai/resources/blogs/streamline-your-ckyc-processes-with-perfios-cutting-edge-solution/)
- **Has CERSAI data:** CKYC Search + Download (proxies CERSAI). **Not SI Registry encumbrance.**
- **Pricing:** Not public; sales-team-gated per [ProductGrowth](https://productgrowth.in/tools/kyc-identity/karza/) ("Volume pricing for committed monthly volumes negotiated with Karza's sales team"). 50–200/month buyer likely fails the volume threshold.
- **ToS status:** Perfios has the most defensible regulatory position of the named aggregators (RBI-licensed Account Aggregator framework; ISO 27001 / SOC 2 claims).
- **Lead time:** Standard aggregator onboarding.
- **Limitations:** **CKYC product, not SI.** Use case is "customer onboarding" for FIs.
- **Independent reviews / red flags:** DPDP Suite announced March 2026 — i.e. compliance posture post-dates DPDP Act notification. Mar 2026 product launch is press-led; no third-party benchmark.

#### #5 Decentro (CKYC APIs) — CKYC only
- **URL:** [decentro.tech/resources/ckyc-apis](https://decentro.tech/resources/ckyc-apis)
- **Has CERSAI data:** CKYC (KYC search/download) — **not SI Registry encumbrance.**
- **Pricing:** Consumption-based, not publicly listed; "₹2–50 per API call" per [ProductGrowth](https://productgrowth.in/tools/kyc-identity/decentro/) estimate. Minimal volume tiers usually a few thousand INR/month with KYB.
- **ToS status:** Standard aggregator contract.
- **Lead time:** Standard.
- **Limitations:** Decentro's Feb 2025 positioning is on self-hosted CKYC, not encumbrance search. Gating is tightening, not loosening.
- **Independent reviews / red flags:** G2 reviews cover "payments, KYC, payouts" — not encumbrance.

**Vendors explicitly considered and rejected:**
- **IDfy** — Original research mentioned IDfy as a CERSAI-adjacent aggregator; **adversarial verification found NO evidence** of an IDfy × CERSAI product. Flag and remove from consideration. (See also the [IDfy blog on CKYCRR 2.0](https://www.idfy.com/blog/cersais-ckycrr-2-0-reimagining-ckyc/), which is KYC-focused.)
- **LegiScore (legiscore.in/features/search)** — **Competitor, not vendor.** LegiScore has built browser-automation for the public CERSAI search (not the SI Registry API), and markets "no per-solve fees, OTP interception." This is market evidence that the public-portal automation path is technically viable, and is a competitor watch-item. Same legal posture as ClearDeed's IGR EC automation.
- **Surepass / Signzy / Decentro CKYC streams** — all KYC-class, all target FI customers. Useful as a competitive-watch signal but not as CERSAI SI encumbrance paths for ClearDeed.
- **TeamLease RegTech** — regulatory update feed only; no public API.

### 2.3 Recommended path forward (CERSAI)

**Step 1 (this week):** Send a sales-intro email to **Signzy** and **Checkpost** for sub-entity sponsorship terms. Use the template in §3.3 below. Do not expect a quote inside 7 days; these are enterprise sales cycles.

**Step 2 (parallel):** Build a headless captcha-solver adapter against the [cersai.org.in](https://www.cersai.org.in/CERSAI/home.prg) public portal — same architecture as the IGR EC fetcher (D-035), using the 3-way ddddocr ensemble + adaptive K. The captcha on CERSAI is a Vue/AngularJS SPA with reactive captchaHash state, which is harder than IGR EC's static captcha — expect an initial 2–4 week engineering effort to land reliable automation.

**Acceptance criteria for the captcha-solver path:** ≥85% captcha solve rate, ≥90% successful report fetch, end-to-end cost <₹15/search (₹10 portal fee + captcha compute + amortised engineering).

**Long-term:** Monitor for a CERSAI "Specified User" expansion modelled on the [RBI 2022 CICRA notification](https://www.lexology.com/library/detail.aspx?g=c726afa3-ceb8-4f2b-b28e-0b41f87d6152) and [Vinod Kothari analysis](https://vinodkothari.com/2022/01/specified-users/). RBI precedent shows the door can be opened when data is systemically important — ClearDeed's case strengthens if the proptech-aggregator model reaches a non-trivial scale.

---

## Section 3: Combined recommendation

### 3.1 Which single path to pursue first for eCourts

**eCourtsIndia.com Enterprise Monthly at ₹10,000/mo** (10,000 credits at base rate). The 5-call ground-truth pilot must run on real Khordha cases before the ₹10K/month commitment. If pilot fails (accuracy <70% on real Odisha cases), pivot to Surepass quote + LegalKart 5-trial, then fall back to in-house ddddocr scraper (bharat-courts pattern, modified for the Odisha district-court state code 11).

### 3.2 Which single path to pursue first for CERSAI

**Headless captcha-solver adapter against the public portal** (₹10/search + captcha compute). This is the same architectural pattern as D-035 (IGR EC), and the only path that fits the sub-₹10K/mo budget at 50–200 reports/month. Sub-entity sponsorship via Signzy/Checkpost is the long-term fallback if the captcha-solver path proves unstable — but expect ≥4-week sales cycle and contract negotiation before any test calls.

**Do NOT** pursue direct CERSAI onboarding — it requires Reporting Entity status (i.e. a financial-institution license), which ClearDeed does not have and should not acquire.

### 3.3 Specific actions the founder can take THIS WEEK

#### eCourts — Day 1–2
1. Sign up at [ecourtsindia.com/api](https://ecourtsindia.com/api) (no card). Receive ₹200 free credit.
2. Run 5 ground-truth test calls (see §1.3 acceptance criteria). Document accuracy against manual ecourts.gov.in queries.
3. If accuracy ≥70%: email sales@ecourtsindia.com requesting Enterprise Monthly ₹10,000/mo plan + SOC 2 report PDF + 1 reference customer in B2C proptech. Verify Khordha coverage in writing.
4. If accuracy <70%: email sales@surepass.io requesting an eCourts quote at 200 calls/month, with explicit confirmation of Odisha/Khordha coverage. Email api@legalkart.com requesting 5 trial calls on Odisha district-court records.

#### CERSAI — Day 1–5
1. **Signzy** — email `partnerships@signzy.com`:
   > "ClearDeed is a consumer property-intelligence startup (50–200 reports/month) building automated encumbrance checks for Tier-2 India property buyers. We are evaluating sub-entity sponsorship to access CERSAI's SI Registry Search API. Could you share (1) eligibility requirements for non-FI sub-entities, (2) per-call pricing at our volume, and (3) lead time from NDA to first successful API call? Reference: Rajat Bindlish Feb 2025 LinkedIn announcement on SI Registry Search API launch."
2. **Checkpost** — email `contact@checkpost.in` (or via [api.checkpost.in/registration.php](https://api.checkpost.in/registration.php)) with the same query.
3. **In parallel** — start the captcha-solver adapter spike. Reuse the IGR EC ddddocr ensemble + adaptive K code. The CERSAI SPA captchaHash reactive state is the harder technical problem; budget 2–4 weeks for first stable run.
4. **Legal review** — file a note in `DECISIONS.md` recording that the CERSAI integration operates without a ToS-granted access right (per Bhulekh precedent, no public anti-scraping clause; the captcha-solver approach is a known and monitored risk).

#### Documentation actions
- Add a one-paragraph entry to `DECISIONS.md` capturing: (a) the eCourtsIndia.com vendor decision + accuracy test results, (b) the CERSAI captcha-solver decision + Signzy/Checkpost sales-intro status, (c) the MeitY probe of 9 Jun 2025 as the live regulatory posture.
- Update `CURRENT_FOCUS.md` if the launch blocker for the CERSAI layer shifts (currently concierge → automation per existing pattern).

### 3.4 Risks and unknowns

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| eCourtsIndia.com accuracy on real Khordha cases < 70% | Medium | High | Run 5-call ground-truth test before ₹10K/mo commitment. Fall back to in-house scraper. |
| eCourtsIndia.com is a brand-new vendor that may not survive | Medium | Medium | Do not commit >3 months upfront. Monitor for changes in service quality. |
| eCourtsIndia.com name-confusion damages ClearDeed brand | Low | High | Do not surface "eCourtsIndia" in buyer-facing report copy. Always refer to "court records from official eCourts data" with vendor abstracted. |
| MeitY probe expands to property-data aggregators | Medium | High | Track ET, Medial, and Economic Times coverage weekly. The rebalance trigger is a regulatory action specifically against property-data aggregators (not the generic KYC probe). |
| CERSAI captcha changes break the solver | High | High | Build adaptive K + 3-way ddddocr ensemble (same as D-035). Budget 10% engineering time per month for captcha retraining. |
| Signzy/Checkpost sales cycle is 4+ weeks and quotes > ₹10K/mo | Medium | Medium | The captcha-solver path is the budget fallback. Run it in parallel. |
| Indian Kanoon / eCourtsIndia / Phoenix aggregator legal action | Low | Medium | ClearDeed summarizes in a report; does not republish raw data. The transformative-use argument is defensible. |
| CERSAI's captchaHash reactive state defeats headless automation | Medium | High | First technical spike must validate this within 1 week. If it does, the only path is sub-entity sponsorship, even at >₹10K/mo. |
| Verification gap (Verify 5 failed — web search tools unavailable) | Known | Medium | The Verify 5 report could not independently verify the Vinod Kothari / CIBIL 2022 / Surepass pricing claims. Do not cite these as load-bearing assumptions. Re-run verification before publishing in `DECISIONS.md` at the product-spec level. |
| eCommittee announces a "Specified User" / B2B API tier in 2026 | Low | Low (positive) | Monitor [ecommitteesci.gov.in](https://ecommitteesci.gov.in/) for announcements. Could be a 6–12 month rebalance. |

**Known unknowns:**
- Actual eCourtsIndia.com enterprise customer references (none surfaced in independent research).
- Whether any of the named aggregators (Karza, Perfios, AuthBridge) actually resells CERSAI/eCourts/Bhulekh data, versus just KYC data — the original research conflated these; adversarial verification could not confirm.
- Whether the CERSAI captchaHash state can be deterministically triggered by automation. First spike must validate.

---

## Appendix: Sources

### Government / official
1. [NJDG — eCommittee service page](https://ecommitteesci.gov.in/service/national-judicial-data-grid/) — Official eCommittee NJDG service page.
2. [NJDG portal (live)](https://njdg.ecourts.gov.in/) — Authoritative case-pendency database.
3. [eCourts Services portal (citizen)](https://services.ecourts.gov.in/) — Official public-facing case-status frontend.
4. [eCourts Single Sign-On homepage](https://ecourts.gov.in/) — Unified entry point for the eCourts project.
5. [NJA eCourts briefing PDF (2021-22)](https://nja.gov.in/Concluded_Programmes/2021-22/P-1261_PPTs/4.eCourts.pdf) — Confirms NJDG totals, UMANG integration, government-only APIs.
6. [PIB press release on eCourts (PRID 1907546)](https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=1907546) — Establishes NJDG official mandate.
7. [PIB press release on NJDG API (PRID 1848425)](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=1848425) — Government-only API access.
8. [e-Committee Digital Courts (Phase III)](https://ecommitteesci.gov.in/service/digital-courts/) and [Phase III PDF](https://cdnbbsr.s3waas.gov.in/s35d6646aad9bcc0be55b2c82f69750387/uploads/2024/07/202407161620804267.pdf) — Phase III rollout governance.
9. [CERSAI home / public search](https://www.cersai.org.in/CERSAI/home.prg) — Public search entry (Asset/Debtor/AOR/Search Report).
10. [CERSAI entity registration](https://www.cersai.org.in/CERSAI/entityregn.prg) — Two registration paths for FIs/REs.
11. [CERSAI fee structure](https://www.cersai.org.in/CERSAI/feestructure.prg) — ₹10/search, ₹50–100 creation, etc.
12. [CERSAI ToS page](https://www.cersai.org.in/CERSAI/tnc.prg) — Vue/AngularJS SPA, captcha-gated, substantive text not indexable.
13. [CERSAI Search Report login](https://www.cersai.org.in/CERSAI/searchreport.prg) — Login-gated report download.
14. [CERSAI Apr–June 2023 Newsletter (PDF)](https://www.cersai.org.in/CERSAI/sc/themes/default/files/NEWSLETTER_Apr-June2023.pdf) — SI Registry API on-boarding process.
15. [CERSAI 2.0 API Specs v1.6 (Scribd)](https://www.scribd.com/document/704967447/CERSAI2-0-API-Specifications-Document-v1-6) — Official spec, restated/leaked.
16. [Rajat Bindlish LinkedIn — CERSAI SI Search API launch (Feb 2025)](https://www.linkedin.com/posts/rajat-bindlish-4749538_cersai-india-has-launched-search-apis-in-activity-7296119575522254848-jeAa) — Banks/NBFCs/REs only.
17. [CKYC v1.2 (PDF)](https://www.ckycindia.in/ckyc/assets/doc/Operating-Guidelines-version-1.2.pdf) — RE framework + DSC mTLS pattern.
18. [Bhulekh Odisha home](https://revenue.odisha.gov.in/en/bhulekh) — CC BY 4.0 footer badge.
19. [Bhulekh Odisha Terms & Conditions](https://revenue.odisha.gov.in/en/terms-and-conditions-36) — No anti-scraping clause.
20. [Bhulekh Odisha Disclaimer](https://revenue.odisha.gov.in/en/disclaimer) — Third-party site disclaimer only.
21. [GSTN Standard GSP Agreement (PDF)](https://www.gstn.org.in/assets/mainDashboard/Pdf/Faq/Agreement_GSP_legal_standard_draft.pdf) — Precedent template for empanelled intermediary scheme.
22. [Parivahan Data-Sharing Policy (PDF)](https://parivahan.gov.in/sites/default/files/policy/data-sharing-policy.pdf) — Precedent for government-controlled private API access.
23. [PIB — Account Aggregator framework](https://www.pib.gov.in/PressReleaseIframePage.aspx?PRID=1753713) — RBI-licensed NBFC-AA model.
24. [Sahamati — Account Aggregators](https://sahamati.org.in/account-aggregators-in-india/) — Industry body context for aggregator framework.

### eCourts vendors
25. [eCourtsIndia.com — API pricing](https://ecourtsindia.com/api/pricing) — PAYG/Enterprise pricing.
26. [eCourtsIndia.com — API docs](https://ecourtsindia.com/api/docs) — 11 endpoints.
27. [eCourtsIndia.com — API product page](https://ecourtsindia.com/api) — 27.8 Cr+ records, MCP server.
28. [eCourtsIndia.com — developer's blog](https://blogs.ecourtsindia.com/2026/05/18/how-to-use-ecourtsindia-api/) — Integration walkthrough.
29. [eCourtsIndia founder — DEV.to writeup](https://dev.to/rchtjn2/building-legal-tech-on-indian-court-data-a-guide-to-apis-and-resources-38ol) — Vendor-perspective industry review.
30. [Surepass eCourts API](https://surepass.io/ecourts-api/) — District + HC + SC, name-based.
31. [Surepass eCourt CNR Search API](https://surepass.io/ecourt-cnr-search-api/) — CNR-only lookup.
32. [LegalKart API services](https://www.legalkart.com/api-services) — ₹2,000 activation + ₹2/hit.
33. [Attestr Court Cases Search API docs](https://docs.attestr.com/attestr-docs/court-cases-search-api) — ML-score 1–100.
34. [Attestr Unified Court Cases Details API](https://docs.attestr.com/attestr-docs/unified-ecourt-case-details-api) — Aggregated case details.
35. [Attestr Court Record Check API](https://docs.attestr.com/attestr-docs/court-record-check-api) — Search across all court types.
36. [Indian Kanoon API pricing](https://api.indiankanoon.org/pricing/) — ₹0.02–₹0.50/call, ₹500 free, ₹10K/mo non-commercial.
37. [Indian Kanoon API terms](https://api.indiankanoon.org/terms/) — Signed-auth, attribution requirement.
38. [Indian Kanoon API signup](https://api.indiankanoon.org/signup/) — Non-commercial free ₹10K/mo tier.
39. [Indian Kanoon pricing (members)](https://indiankanoon.org/members/pricing/) — Public pricing.
40. [Apify Indian Kanoon wrapper](https://apify.com/jungle_synthesizer/india-ecourts-judgments-scraper) — Confirms "eCourts captcha is not in scope."
41. [bharat-courts (GitHub, MIT)](https://github.com/iamshouvikmitra/bharat-courts) — ddddocr-based async SDK, Orissa HC supported (state code 11).
42. [openjustice-in/ecourts (GitHub)](https://github.com/openjustice-in/ecourts) — Python scraping toolkit.
43. [LEEGLE write-up on r/developersIndia](https://www.reddit.com/r/developersIndia/comments/1rblrp6/from_3500_searches_to_just_one_per_state_leegle/) — Captcha-compliant posture contrast.
44. [Niraj Pandkar captcha-bypass writeup (Medium)](https://medium.com/@Niraj_pandkar/how-i-broke-the-captcha-barrier-for-a-legal-tech-company-part-1-9eba707b3466) — Practitioner account of OCR captcha solving.
45. [ECIAPI (eciapi.akshit.me → court-api.kleopatra.io)](https://eciapi.akshit.me/) — Independent scraping vendor, redirects.
46. [ECIAPI Postman v17.0](https://documenter.getpostman.com/view/12697154/2sAYXEFe16) — Endpoint documentation.
47. [Drishti IAS — NJDG explainer](https://www.drishtiias.com/daily-updates/daily-news-analysis/national-judicial-data-grid) — Confirms API is departmental-IDs only.

### CERSAI vendors and adjacent
48. [HyperVerge Government KYC Record Search API](https://hyperverge.co/in/integrations-marketplace/government-kyc-record-search-api/) — Bundles CERSAI/CKYC/UIDAI/DigiLocker.
49. [HyperVerge CERSAI Search API (DrapCode)](https://drapcode.com/integration/hyperverge/cersai-search-api) — Third-party integrator listing.
50. [Decentro CKYC APIs](https://decentro.tech/resources/ckyc-apis) — CKYC wrapper, not SI Registry.
51. [Perfios — CKYC solution blog](https://perfios.ai/resources/blogs/streamline-your-ckyc-processes-with-perfios-cutting-edge-solution/) — Perfios/Karza CKYC, not SI.
52. [Signzy Agentic CKYC Platform](https://www.signzy.com/agentic-ckyc-platform) — CKYCRR 2.0 integration.
53. [Signzy — How to Get CERSAI Search API Access in 2025](https://www.signzy.com/blogs/how-to-get-cersai-search-api-access-in-2025) — Sub-entity sponsorship documentation.
54. [IDFC First Bank — CERSAI Search API](https://www.idfcfirstbank.com/blog/finance/cerai-search-api-pricing-benefits-and-features) — Confirms FI-only default.
55. [Alphabold — What is CERSAI Search API?](https://www.alphabold.com/blog/what-is-cersai-search-api/) — Eligibility requirements.
56. [Checkpost — CERSAI Search API registration](https://api.checkpost.in/registration.php) — Sub-entity sponsorship alternative.
57. [IDfy — CERSAI CKYCRR 2.0 blog](https://www.idfy.com/blog/cersais-ckycrr-2-0-reimagining-ckyc/) — KYC-registry only (no SI evidence).
58. [TeamLease RegTech — CERSAI regulatory update](https://www.teamleaseregtech.com/updates/article/50435/cersai-notified-regarding-the-ckyc-api-and-bulk-search-for-account-ope/) — CERSAI notifications tracker.
59. [TEAL Whitepaper 10 — Evolution of CERSAI (PDF)](https://tealindia.github.io/research/TEAL%20Whitepaper%2010-Evolution%20of%20CERSAI%2C%20Current%20Status%20and%20Challenges%20in%20Operationalization.pdf) — Operationalization challenges.
60. [L&T Finance — What is CERSAI?](https://www.ltfinance.com/blog/home-loan/what-is-cersai) — Plain-English public-path explanation (Dec 2024).
61. [Vinod Kothari — CERSAI 2.0 preliminary guide](https://vinodkothari.com/2020/07/cersai-2-0-a-preliminary-guide/) — Asset/Debtor/AOR search via web portal.
62. [Aifise — CERSAI compliance practical guide](https://www.aifise.ai/blog/cersai-compliance-practical-guide-for-banks-nbfcs-hfcs-steps-risks-automation) — DSC requirement, JSON/offline upload.
63. [LegiScore — search features](https://legiscore.in/features/search) — Competitor's public-portal automation, watch-item.

### Legal / regulatory / commentary
64. [Economic Times — MeitY probe (9 Jun 2025)](https://m.economictimes.com/tech/startups/id-please-meity-verifies-identity-verification-startups/articleshow/121710520.cms) — Surepass, Digitap, Zoop, Signzy investigation.
65. [Medial — MeitY probe mirror](https://medial.app/news/id-please-meity-verifies-identity-verification-startups-41fe221b02a1c) — Secondary confirmation.
66. [Mitigata LinkedIn — MeitY probe mirror](https://www.linkedin.com/posts/mitigata-full-stack-cyber-resilience_id-please-meity-verifies-identity-verification-activity-7338522865727635456-FNU0) — Third mirror.
67. [BiometricUpdate — Signzy data breach (Dec 2024)](https://www.biometricupdate.com/202412/signzy-investigating-kyc-customer-data-breach) — Counterparty risk.
68. [AdIdem / Rohan K George — "The Moat that Is and Should Not Be"](https://www.linkedin.com/pulse/moat-should-rethinking-access-judicial-data-rohan-k-george-sky5c) — Industry call for PACER-style NJDG API.
69. [Ikigai Law — Legality of data scraping in India](https://www.ikigailaw.com/article/263/legality-of-data-scraping-in-india) — IT Act §43, OLX v. Padawan, hiQ v. LinkedIn.
70. [Lexology — RBI paves way for FinTech to access credit info](https://www.lexology.com/library/detail.aspx?g=c726afa3-ceb8-4f2b-b28e-0b41f87d6152) — CICRA 2022 expansion precedent.
71. [Vinod Kothari — Specified Users notification 2022](https://vinodkothari.com/2022/01/specified-users/) — RBI 2022 Specified User expansion.
72. [CIBIL Official Partners](https://www.cibil.com/official-partners) — Licensed access framework.
73. [TransUnion CIBIL API Marketplace](https://apimarketplace.transunioncibil.com/) — DTC onboarding requirements.
74. [Surepass Proposal IDCS India (Scribd)](https://www.scribd.com/document/844125187/Surepass-Proposal-IDCS-India) — Leaked pricing: ₹35–55/report, ₹50K minimum (treat as unverified).
75. [Lexology — RBI paves way for FinTech to access credit info](https://www.lexology.com/library/detail.aspx?g=c726afa3-ceb8-4f2b-b28e-0b41f87d6152) — CICRA framework for aggregator access.
76. [Sairam Chaganti LinkedIn — Scaling CAPTCHA solves](https://www.linkedin.com/posts/sairamchaganti_ai-techleadership-legaltech-activity-7436959988813742080-C8Ba) — 18,000+/day in-house solves, "Rs. 0 per solve."
77. [r/IndiaLaw — eCourtsIndia API 3-month review (Reddit)](https://www.reddit.com/r/IndiaLaw/comments/1rix1h4/ive_been_using_ecourtsindiacoms_api_about_indias/) — Independent practitioner review (content not fetchable).
78. [r/IndiaLaw — eCourtsIndia privacy concerns](https://www.reddit.com/r/IndiaLaw/comments/1s04vhw/ecourtsindiacom_looks_like_a_privacy_nightmare/) — Data-redistribution risk.
79. [r/StartUpIndia — APIs for Indian court cause lists](https://www.reddit.com/r/StartUpIndia/comments/1r3ll6y/looking_for_apis_data_sources_for_indian_court/) — Founder consensus on eCourtsIndia as de-facto option.
80. [r/IndiaLaw — "There's a live API for Indian court data"](https://www.reddit.com/r/IndiaLaw/comments/1rh82o1/theres_a_live_api_for_indian_court_data_all/) — eCourtsIndia founder's r/IndiaLaw announcement.
81. [r/LegalAdviceIndia — India's largest case records database eCourtsIndia](https://www.reddit.com/r/LegalAdviceIndia/comments/1rh7umk/indias_largest_case_records_database/) — Third-party price benchmark.
82. [r/indiandevs — How to get access to ecourts API?](https://www.reddit.com/r/indiandevs/comments/1bdkkrw/how_to_get_access_to_ecourts_api/) — Confirms no official path.
83. [r/Indianlaw — Is it legal to web scrape Indian court websites?](https://www.reddit.com/r/Indianlaw/comments/1lgk2bz/is_it_legal_to_web_scrape_indian_court_websites/) — Practitioner consensus on scraping risk.
84. [r/IndiaLaw — eCourts API access (advocate)](https://www.reddit.com/r/LegalAdviceIndia/comments/1k7jrt1/e_courts_api_access/) — Confirms no official pathway.
85. [Google Groups datameet — eCourts scraping](https://groups.google.com/g/datameet/c/n5Eg_LmyV1A/m/pI0bRbF0AwAJ) — Historical scraping discussion; India "unique in using a captcha."
86. [Quora — MCA data API legal way](https://www.quora.com/How-can-I-build-an-API-to-fetch-financial-data-from-the-MCA-website-in-a-legal-way) — Architectural comparator.
87. [Daksh — MCA21 data wizard revamp](https://www.dakshindia.org/Technology-and-Analytics-for-Law-and-Justice/MCA21-Data-Wizard-Revamp) — Policy ask for MCA21 API access.
88. [Karza profile (ProductGrowth)](https://productgrowth.in/tools/kyc-identity/karza/) — Aggregator marketing claim of "850+ public databases."
89. [Perfios due diligence product](https://perfios.ai/in/products/due-diligence/) — 30M+ business records, 15-min–3-hr turnaround.
90. [Decentro MCA Verification API](https://decentro.tech/api-hub/mca-verification-api) — Standard aggregator API contract.
91. [ClearTax — GST API access explainer](https://cleartax.in/s/gst-api-access) — GSTN/GSP precedent.
92. [ClearTax — GST Suvidha Providers list](https://cleartax.in/s/list-gst-suvidha-providers-gsp) — 55 GSPs empanelled.
93. [The Hindu editorial — Data and justice on courts in India and AI tools](https://www.thehindu.com/opinion/editorial/data-and-justice-on-courts-in-india-and-ai-tools/article70970293.ece) — OCOD 2026 unification commentary.
94. [The Print — One Case One Data, court records too unorganised](https://theprint.in/opinion/one-case-one-data-court-records-are-too-unorganised-for-digitisation/2936181/) — Records quality concern.
95. [ET Infra — Road Ministry data-sharing policy](https://infra.economictimes.indiatimes.com/news/roads-highways/revolutionary-data-sharing-policy-by-road-ministry-promises-enhanced-services/123408200) — VAHAN/SARATHI precedent.
96. [Medianama — API vehicle data sharing privacy](https://www.medianama.com/2025/06/223-api-access-vehicle-data-sharing-raising-privacy-concerns/) — Privacy backlash precedent.
97. [Amit Goyal LinkedIn — MCA V3 Master Data restriction](https://www.linkedin.com/posts/amit-goyal-a99431105_mcaupdates-companiesact-mca21-activity-7408563112423120896-qTVr) — Tightening of government data access in 2025–2026.
98. [ThirdWatch — Scrape MCA India data](https://thirdwatch.dev/blog/scrape-mca-india-company-data-for-due-diligence) — India property data not on Datarade.
99. [ProductGrowth — Experian India CICRA framework](https://productgrowth.in/tools/kyc-identity/experian-india/) — Safe-harbor pattern at scale.

### Internal ClearDeed (for cross-reference)
100. `/Users/deekshamohapatra/Documents/cleardeed/CLAUDE.md` — Engineering constitution; sections 7–9 commit to automation over concierge, captcha-bypass is accepted, ₹1 launch price.
101. `/Users/deekshamohapatra/Documents/cleardeed/DECISIONS.md` — D-035 (IGR EC captcha + OCR ensemble), D-036 (Bhunaksha Plot Report fetcher), D-024 (Bhulekh Mirror), D-025 (PID).
102. `/Users/deekshamohapatra/Documents/cleardeed/CURRENT_FOCUS.md` — Active sprint focus.
103. `/Users/deekshamohapatra/Documents/cleardeed/BACKLOG.md` — Parked items including Bhunaksha map-image embedding.
104. `/Users/deekshamohapatra/Documents/cleardeed/PID_CLAUDE_CODE_INSTRUCTIONS.md` — Pattern Intelligence Database build spec.

---

**End of report.**

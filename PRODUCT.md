# ClearDeed — Product Operating Manual (PRODUCT.md)

*This document sits above CLAUDE.md (the engineering operating manual). CLAUDE.md governs how we build. PRODUCT.md governs what we build, for whom, with what liability posture, and through which specialist sub-agents. When the two conflict: CLAUDE.md wins on engineering discipline, PRODUCT.md wins on product scope and cohort decisions.*

Last updated: 2026-05-01
Status: V1 product definition + concierge launch plan + V1.5/Phase 2 staged roadmap

## Section 1 — Product Thesis

**What ClearDeed is:** a one-click property verification product for individual land buyers in India. Given a plot's location and claimed owner, it returns a plain-English report covering legal status, ownership history, encumbrances, court cases, and regulatory flags — so a first-time buyer can walk into a transaction with clarity instead of hope.

**Why this exists:** buying land in India is one of the largest financial decisions an individual ever makes, and today it is catastrophically opaque. The records exist, across Bhulekh, Bhunaksha, eCourts, IGR, and revenue courts — but they're in Odia script, scattered across five portals, written in legal jargon, and require 4–8 hours of expert time to pull together. The typical buyer either skips verification entirely, gets defrauded, or pays a lawyer ₹5k–₹10k to do what should take minutes. ClearDeed compresses that to one click and ₹500–₹2,000.

**Who V1 is for (locked):** individual consumers in Odisha (Khordha district first) who are actively considering a specific plot purchase. Secondary: brokers and builders who purchase reports on their inventory to share with prospective buyers. Same product, same pipeline, different purchasing moment.

**Who V1 is not for:** lawyers (horizontal upsell in V2), NBFCs and banks (enterprise track in V3), investors evaluating areas rather than plots (separate V4 product).

**The liability frame (non-negotiable):** ClearDeed reports structured facts from public records and flags inconsistencies. ClearDeed does not certify title, guarantee against fraud, recommend transactions, or substitute for legal or professional advice. Every report visibly and unambiguously communicates this in consumer-grade language. The product is designed so that a reasonable person cannot mistake a clean report for a purchase recommendation.

**Pricing (V1 working assumption, to be validated):** ₹499–₹999 per consumer report, one-time. Broker/builder volume access at ₹10k–₹25k/month for unlimited reports on declared inventory. Pricing is explicitly positioned as a fraction of the cost of a lawyer's title report, not as a substitute for one.

**Launch mode (accepted 2026-04-29):** V1 starts as a concierge-reviewed product, not a fully self-serve checkout. Users submit plot details, ClearDeed generates the report, the founder manually reviews the output, and the reviewed report is sent back over WhatsApp/PDF with payment collected manually or by Razorpay link. This is intentionally slower than automation because the first 10–25 reports must teach pricing, trust language, missing data, and buyer questions.

**What is out of V1 scope:**
- Lawyer-facing raw-records mode (V2)
- NBFC/bank API and compliance infrastructure (V3)
- Area intelligence / neighborhood growth reports (V4, separate product doc to be written when V1 is revenue-positive)
- Districts outside Khordha
- States outside Odisha
- Fully automated direct encumbrance certificate purchase in the base report. Concierge/manual paid EC and CERSAI add-ons may be tested after source and legal/payment review.
- Mobile app (web-only, mobile-responsive for V1)
- Integration with transaction flow (agreement drafting, registration, payment)

## Section 2 — The Consumer

**Primary user:** a 28–45-year-old first-time or second-time land buyer in Odisha, typically middle-class, often buying for self-use (home) or long-term investment. Technology comfort: WhatsApp-native, Google-search-comfortable, not app-literate. Legal literacy: near zero. Time horizon: weeks to months between considering a plot and transacting. Emotional state at purchase: anxious, trust-seeking, worried about fraud stories they've heard.

**The moment ClearDeed enters their life:** they have identified a specific plot. They have a GPS coordinate (from the broker showing them the plot, from a listing, from their own visit) and a name (seller name from the broker or from the sale agreement draft). They have 1–7 days before a decision. They want to know: *is this real, is this owned by who they say, are there surprises.*

**What they want from the report (the real product, in buyer's own words):**
- "Is this land real and where they say it is?"
- "Is this person actually the owner?"
- "Are there other people who also own this?"
- "Is there a loan or a court case on it?"
- "Is this the kind of land I'm allowed to build on?"
- "Is there anything weird about this that I should ask about?"

**What they don't want:**
- Legal jargon
- A number that tells them what to do (they don't trust a number for a decision this big)
- A 40-page PDF
- Certainty they know isn't real

**Critical insight for report design:** the consumer does not want a verdict. They want *informed anxiety*. A good ClearDeed report reduces uncertainty on verifiable dimensions and explicitly surfaces what cannot be verified, so the buyer knows which questions to ask next. A report that says "everything is clear, go ahead" is a lawsuit. A report that says "the owner name on record matches what the seller told you; the plot boundaries match the GPS you provided; there are no court cases registered against this owner in Khordha courts; encumbrance status is not available online, request from the Sub-Registrar office" is a product.

## Section 3 — The Report (V1 Deliverable)

The single V1 deliverable is a **consumer-grade property verification report**. Everything else is in service of producing this.

**Format:** mobile-responsive web page + downloadable PDF. Generated on a dedicated report URL that can be shared (report link includes a view-only token so the buyer can forward it to family, their lawyer if they have one, or a broker).

**Length:** 4–6 pages PDF, 2–3 scroll-screens mobile.

**Structure (every section answers four questions in plain English):**

1. **The Plot** — what plot did we look at, what's its location, what's its official plot identifier, what does it look like on the revenue map. What we verified, what we couldn't.

2. **The Owner** — who does the official record show as the owner, does that match what the seller told you, when was the record last updated, are there multiple owners. What matched, what didn't.

3. **Land Classification** — is this residential, commercial, agricultural, forest, tribal-protected, or something else. Can you build on it. Does it need conversion. What's flagged.

4. **Encumbrance and Disputes** — any loans, mortgages, or liens showing in public records. Any court cases involving the owner. What we found, what requires a visit to the Sub-Registrar.

5. **Regulatory Flags** — proximity to protected zones (forest, coastal, PESA, airport, archaeological). Not a definitive clearance, but a flag to investigate.

6. **What to Ask Next** — a short checklist of specific questions the buyer should ask the seller, the broker, and a lawyer. This is the report's primary action. It converts anxiety into specific next steps.

**What is *never* on the report:**
- An overall score
- A green/red verdict on buying
- "Safe to buy" or equivalent language
- A recommendation to transact or not transact
- Any quantified confidence percentage

**Every page includes a prominent footer:** "This report summarizes public records as of [timestamp]. It does not certify ownership or guarantee against fraud. Consult a qualified lawyer before transacting."

## Section 3A — Data Source Strategy

The detailed source assessment lives in [`docs/sources/source-roadmap.md`](docs/sources/source-roadmap.md). This section is the product-level summary.

**Do not treat suggested portals as accepted scope until probed.** Government source availability changes, fees move, captchas appear, and "public" pages sometimes require logged-in sessions. A source becomes product coverage only after it has a documented source file, raw artifact capture, parser fixtures, live golden-path validation, and negative-result language.

**Current source reality:**

- **Integrated:** Nominatim, ORSAC GeoServer WFS, Bhulekh RoR including RoR case/reference anchors, report interpretation/writing/audit agents, source provenance fields, report source-audit panel, and source-result persistence.
- **Partial:** eCourts. It submits and parses, but negative results are not high-confidence until captcha retries, double-fetch, and name variants are implemented.
- **Placeholder/manual:** RCCMS is currently a placeholder fetcher despite parser tests. IGR/EC is currently manual instructions only. Regulatory overlays currently do not ingest real forest/flood/airport/ASI layers.
- **High-value next sources:** Bhulekh mutation fields/case status, RCCMS live fetch, Orissa High Court, DRT, IGR Index-II/EC, CERSAI.
- **Current reliability posture:** Bhulekh lookup now uses the cadastral/WFS village when available, with Nominatim only as fallback. Missing/partial/manual sources now create buyer action items instead of clean reassurance.

**Feature-source map for the report:**

| Report feature | Base source now | Next source to add | Product stance |
|---|---|---|---|
| Ownership and mutation history | Bhulekh RoR | Bhulekh mutation case status, IGR Index-II | Surface any RoR mutation/case fields first. Registered transaction history is a paid/concierge add-on until IGR access is proven. |
| Verified encumbrance | Manual EC instruction | IGR EC, CERSAI, MCA charges for companies | Do not claim clean encumbrance from current data. Sell verified EC/CERSAI as optional reviewed add-ons only after legal/payment review. |
| Court/revenue disputes | eCourts partial, RCCMS placeholder | RCCMS live, Orissa High Court, DRT | A "0 cases" sentence must carry confidence context and cannot be reassuring unless captcha/name-variant checks passed. |
| Land classification/buildability | Bhulekh kisam/class | BDA CDP, BMC boundary, unauthorized layout PDFs, Bhuvan flood/soil | Kisam is revenue classification, not zoning or building permission. The report must keep that distinction visible. |
| Regulatory overlays | A8 placeholder | Forest/Chandaka, flood, airport, ASI, CRZ/PESA | Empty flags are not proof of absence until real layers are ingested. |
| Civic/tax dues | Bhulekh dues where present | BMC holding tax, TPCODL/PHED by consumer number | Treat as inherited-cost checks, not title checks. Most require seller-provided identifiers. |
| RERA | None | Odisha RERA project/promoter search | Trigger only for marketed layouts/projects/promoters, not every standalone plot. |
| Identity/seller authority | Claimed name + Bhulekh name match | PAN with consent, MCA DIN/company data, PoA registration, legal-heir checklist | Avoid Aadhaar. PoA verification is high-value when seller is not the RoR owner. |
| Boundary/geospatial intelligence | Plot polygon | Adjacent owners, subdivision pattern, road access, satellite diff | High buyer value; distinguish legal findings from context findings. |

**Validation posture:** ClearDeed's moat is cross-source reconciliation, not source count. Owner, area, dates, plot identity, and negative-result confidence must be validated across sources and surfaced as findings when they disagree.

The per-data-point reliability matrix lives in [`docs/validation/data-point-reliability.md`](docs/validation/data-point-reliability.md). No consumer-facing claim graduates to reassuring language unless it has an entry in that matrix, a claim-readiness state, and explicit fallback/manual-verification behavior.

## Section 4 — The Sub-Agent Council

ClearDeed's report quality comes from a **council of specialist sub-agents**, each with a narrow domain and a strict output contract. The main Claude Code session orchestrates them. Sub-agents do not share context; they share structured artifacts.

**Council principles (non-negotiable):**
- Each sub-agent has a single, crisp responsibility
- Sub-agents never modify CLAUDE.md, PRODUCT.md, or files outside their declared output path
- Sub-agents consume typed inputs and produce typed outputs (Zod schemas)
- Sub-agents run isolated, communicate via artifacts, are independently versioned
- Every sub-agent has a metrics file tracking accuracy, latency, and failure modes
- Every sub-agent has golden-path fixtures gating CI
- Scraped or uploaded text is sanitized before entering any LLM prompt (length cap, injection-pattern strip, structural normalization)

**Tier 1 — Data Fetchers (mostly built):**

- **A1 GeoFetcher** — GPS to location metadata and plot polygon. Sources: Nominatim, GeoServer WFS. Status: built.
- **A2 RevenueRecords** — plot identifier to parsed Record of Rights. Source: Bhulekh. Status: built.
- **A3 CourtCases** — party name to court case history. Sources: eCourts partial, RCCMS placeholder. Status: partial; not enough for confident negative findings.
- **A4 Registry** — IGR deep-links and encumbrance instructions. Status: manual only; no verified EC/Index-II/CERSAI data yet.

**Tier 2 — Domain Interpreters (implemented with source-depth gaps):**

- **A5 OwnershipReasoner** — takes RoR output and seller-claimed owner name, produces `{officialOwner, nameMatch: exact|partial|mismatch, matchConfidence, discrepancyExplanation}`. Handles Odia transliteration, surname variation, joint ownership, father's-name conventions, sub-caste notation variations.
- **A6 LandClassifier** — takes RoR land-class fields + location + (where available) master plan overlays, produces `{currentClassification, permittedUses, conversionRequired, redFlags}`. Current implementation uses limited RoR-driven classification; zoning/buildability overlays remain roadmap.
- **A7 EncumbranceReasoner** — V1: generates instructions for manual EC retrieval and structures user-uploaded EC if provided. V1.5 paid add-ons: IGR EC/Index-II and CERSAI after access/legal/payment review. V3: automated retrieval and parsing where permitted.
- **A8 RegulatoryScreener** — takes plot polygon + location, screens against overlay layers (forest, CRZ, PESA, airport zones, archaeological, environmental). Current implementation is placeholder; real overlay ingestion is required before "no flags found" has strong meaning.

**Tier 3 — Validation and Synthesis (partially built):**

- **A9 CrossSourceValidator** — extends T-020. Runs before any report is written. Checks cross-source consistency (village names match across Nominatim/Bhunaksha/Bhulekh, area reconciles within tolerance, owner names match between claimed and recorded). Produces `ValidationFindings[]`.
- **A10 ConsumerReportWriter** — takes all Tier 1 and Tier 2 outputs and produces the consumer-facing report per Section 3. No score. Plain English. Every fact cited to source. Every gap labeled as requiring manual follow-up. This is the product's voice.

**Tier 4 — Quality Gates (to be built):**

- **A11 OutputAuditor** — reads every generated report before delivery and checks for prohibited language ("safe to buy," any verdict phrasing, any numeric score shown to consumer), missing disclaimers, broken source citations, and factual contradictions within the report. Blocks delivery if violations found. This is the liability guardrail.

**Sub-agent invocation contract (same for every agent):** each agent has `agents/<name>/prompt.md` (role and rules), `agents/<name>/schema.ts` (Zod input/output), `agents/<name>/kb/` (domain knowledge docs), `agents/<name>/fixtures/` (golden-path test cases with known-correct outputs), `docs/metrics/<name>.md` (accuracy, latency, failures tracked over time).

## Section 5 — The Report Generation Pipeline

```
Consumer submits: {GPS coordinates, claimed owner name, (optional) uploaded EC}
  │
  ▼
Orchestrator creates reportId, starts audit log
  │
  ├─► Tier 1 fetchers run in parallel (A1, A2, A3; A4 generates links)
  │     Timeout 30s, partial results allowed
  │     Results stored raw in Postgres with timestamp
  │
  ├─► Tier 2 interpreters run after Tier 1 (sequential where dependent)
  │     A5 OwnershipReasoner depends on A2
  │     A6 LandClassifier depends on A1 + A2
  │     A7 EncumbranceReasoner depends on A4 (and user upload if present)
  │     A8 RegulatoryScreener depends on A1
  │
  ├─► A9 CrossSourceValidator runs, produces ValidationFindings
  │
  ├─► A10 ConsumerReportWriter synthesizes all artifacts into report
  │
  ├─► A11 OutputAuditor reviews report for prohibited language and gaps
  │     If violations: regeneration cycle or explicit failure to consumer
  │
  └─► Report published to /report/<id>, email + WhatsApp delivery
```

Every step logs to the audit trail. Every consumer report is reproducible from the audit trail for 12 months (legal defense requirement).

## Section 6 — Quality Guardrails (How We Get Correct Data Per Point)

**Per-data-point correctness mechanisms:**

1. **Every fact has a named source and timestamp.** The report never synthesizes a claim. If a field isn't in a fetched document, it's labeled "not available" — never inferred. Source results carry status reason, inputs tried, parser/template version, raw artifact hash/ref, warnings, and validators where implemented.

2. **Every interpretation carries a confidence band.** Tier-2 agents produce `{value, confidence, basis}`. Below a confidence threshold, the report shows "requires manual verification" with specific instructions rather than the value.

3. **Cross-source validation is mandatory before synthesis.** A9 runs before A10. If village names don't reconcile across sources, that becomes a surfaced finding, not a silently picked winner.

4. **Golden-path fixtures gate every deploy.** At minimum 10 real Khordha plots with expert-verified correct outputs, committed to `fixtures/golden-plots/`. CI fails if any sub-agent's output diverges from golden.

5. **Scraped text is sanitized before LLM ingestion.** All Odia RoR text, eCourts HTML, user-uploaded documents pass through `lib/sanitize.ts` (length cap, injection-pattern strip, structural normalization) before reaching any Tier 2 agent.

6. **OutputAuditor gate (A11) is non-optional.** Every consumer-facing report is reviewed by A11 for prohibited language and structural compliance before publication. Failed audits either regenerate or fail explicitly.

7. **Domain reviewer sign-off before V1 launch.** 3 independent reviewers — one property lawyer, one consumer advocate, one actual past land buyer — must review 10 real reports and sign off on each dimension. Documented in `docs/qa/consumer-v1.md`. Blocking gate for launch.

8. **Live accuracy monitoring post-launch.** Every consumer report collects an optional "was this accurate?" follow-up 30 days post-transaction. Aggregated monthly into accuracy metrics. Below threshold per dimension triggers sub-agent revision.

9. **Critical negative findings require confidence metadata.** "No cases found," "no encumbrance found," and "no regulatory flag found" are only allowed when the source completed cleanly, search variants were attempted, and the raw result is retained. Otherwise the report says "not verified" or "manual verification required."

10. **Schema-version pinning for every source.** Each fetcher records a structural template hash or parser version with the raw artifact. Parser drift must fail loudly in golden-path CI.

11. **Source-count is not trust.** New sources are prioritized by incremental validation value. A source that repeats an already-known fact without improving confidence is lower priority than one that cross-checks ownership, encumbrance, court risk, or buildability.

12. **Report claims are governed per data point.** A source can be integrated while a data point remains unsafe to phrase cleanly. The data-point reliability matrix is the release gate for report language, especially for owner match, plot identity, area, court negatives, encumbrance negatives, and regulatory negatives.

## Section 7 — Distribution (The Real V1 Problem)

Engineering is well-understood. **Distribution is the V1 problem that has no current solution.** This section exists to make that explicit rather than to solve it.

**Hypotheses to validate, in order of leverage:**

1. **Broker-as-channel:** brokers and builders purchase ClearDeed reports on their inventory and share with prospective buyers as a trust artifact. Every shared report creates consumer-brand exposure. This is the cheapest consumer acquisition channel if it works.

2. **Seller-side verification:** honest sellers who have nothing to hide purchase a ClearDeed report to prove clean title to buyers, shortening their sales cycle. Similar distribution economics to brokers.

3. **Lawyer referral:** property lawyers in Khordha recommend ClearDeed as a pre-screen for their own clients, before engaging for full title work. Low volume but high trust.

4. **Organic search:** SEO against high-intent queries ("how to verify land ownership Odisha," "Bhulekh check online," "is this plot safe to buy"). Long-tail, slow to build, high LTV.

5. **WhatsApp referral:** every delivered report includes a "forward this to your family/your lawyer" button. Referral code on the forwarded link.

**What is explicitly not a V1 distribution strategy:**
- Paid social ads (unit economics don't support it for one-shot consumers)
- Partnership with real estate listing platforms (long sales cycle, misaligned incentives)
- App store listings (V1 is web-only)

**Distribution validation is a blocking gate for V1 scale.** Before spending engineering time on V2, Hypothesis 1 or 2 must be validated with actual paying broker or seller customers in Khordha. If neither works, pricing or positioning needs rethinking before scaling consumer acquisition.

**Concierge launch experiments (next 10–25 reports):**

1. **Buyer direct:** landing page lead form → WhatsApp follow-up → reviewed report → manual payment link. Success: 5 completed reports, at least 3 buyers say the report changed what they asked the seller/lawyer.

2. **Seller proof:** honest seller/broker buys report to share before site visits. Success: 3 sellers/brokers agree to share a ClearDeed report with buyers and one pays for a repeat report.

3. **Broker trust artifact:** broker offers ClearDeed report as a transparency artifact on selected plots. Success: one broker gives 5 inventory plots and agrees to co-branded/shareable reports.

4. **Lawyer referral:** property lawyer uses ClearDeed as a pre-screen before full title work. Success: one lawyer forwards a lead or reviews one generated report with corrections.

Each experiment must record: source of lead, buyer/seller/broker role, input quality, report generation time, manual-review changes, payment status, and the exact customer language used to describe value.

## Section 8 — Regulatory and Legal

**Blocking pre-launch gates (cannot ship V1 without these):**

1. Legal counsel review of consumer disclaimers, consent language, and liability framing. Budget ₹50k–₹1.5L. Deliverable: signed-off `legal/disclaimers/consumer.md` and `legal/terms/consumer.md`.

2. DPDP Act compliance review. Deliverable: `docs/compliance/dpdp.md` covering consent capture, data retention policy (default 90 days, user can request erasure within 30 days), data fiduciary obligations, grievance officer designation if applicable.

3. Consumer protection review. Deliverable: `docs/compliance/consumer-protection.md` covering Consumer Protection Act 2019 exposure, misleading advertisement rules, product description accuracy.

**Ongoing obligations:**

- Audit trail retention of every report for 12 months minimum (longer if legal holds arise)
- Data-breach notification procedure
- User-accessible data deletion flow
- Annual disclaimer and accuracy review

## Section 9 — Build Sequence

**V1 — Consumer product, Khordha only (estimated 15–20 sessions from today):**

- Session 013 (thinking mode): produce ADR-009 through ADR-013 (see Section 10)
- Build Tier 2 agents A5, A6, A7, A8
- Build A10 ConsumerReportWriter and A11 OutputAuditor
- Complete Tier 1: RCCMS (T-011) and Registry links (T-012)
- Consumer report UI (mobile-first)
- Payment integration (Razorpay one-time)
- Legal reviews (blocking)
- 10-report domain reviewer QA (blocking)
- Launch with 5 friends-and-family buyers
- First paid consumer transaction

**Concierge V1.0 — immediate build sequence (accepted 2026-04-29):**

- Rotate Supabase service role key and update Vercel
- Run `002_lead_requests.sql` in Supabase
- Verify landing page lead form writes to `lead_requests`
- Verify `/api/report/create` persists generated reports
- Add founder/admin view or Supabase saved view for new leads
- Improve report top summary: matched / not matched / unavailable / questions to ask next
- Produce 3 sample reports: clean, mismatch, partial-unavailable
- Run first 5 manually reviewed Khordha reports
- Collect payment manually or by Razorpay link before automating checkout

**Source expansion sequence — assessed 2026-04-29:**

- Render Bhulekh RoR mutation/case reference anchors with "anchor only" caveat, then cross-check via mutation-status/IGR before claiming ownership history.
- Replace RCCMS placeholder with live public-flow fetcher.
- Finish eCourts negative-result confidence: 10+ captcha runs, retry policy, spelling/name variants, double-fetch.
- Add Orissa High Court and DRT party-name searches.
- Probe IGR Index-II and EC flows; keep as concierge paid add-ons until automation and payment handling are reviewed.
- Add CERSAI paid public search as the highest-value encumbrance upgrade.
- Add Bhuvan/forest/flood plus Chandaka/airport/ASI overlays before claiming meaningful regulatory screening.
- Add RERA lookup for marketed layouts/projects and promoter cases.
- Add adjacent-plot ownership, subdivision-pattern, and road-access checks from existing WFS/OSM data.

**V1.5 — Broker/builder channel (parallel to V1 tail, ~8 sessions):**

- Broker signup and billing (subscription)
- Broker dashboard (report history, inventory management)
- Broker-branded report co-header
- Broker referral tracking for consumer attribution

**V2 — Lawyer upsell (after V1 revenue-positive, scope TBD)**

**V3 — NBFC/bank enterprise (after V2, scope TBD, requires compliance build-out)**

**V4 — Area intelligence (separate product doc, post-V3, will be documented in its own AREA_INTELLIGENCE.md when the time comes)**

## Section 10 — Staged Roadmap: What to Build When

*Added 2026-05-01 based on deep research across IGR/Index II, government GIS APIs, paid data providers, and LARR acquisition tracking.*

### Research Summary

**No automated API exists for IGR/Index II anywhere in India.** Landeed (YC-backed) and Zapkey use field agent networks and/or scraping — not clean programmatic access. Government portals have no documented REST APIs. IT Act Section 43 creates legal risk for government portal scraping at scale. IGR/Index II data is a **concierge paid add-on only** in V1-V2; the operational moat is field execution, not technical automation.

**Circle rates (benchmark valuation):** IGR Odisha has a web-form portal at `igrodisha.gov.in/viewfeevalue.aspx`. Pre-populated deep-link is the path, not scraping. Some districts publish downloadable PDF benchmark charts.

**Bhuvan (ISRO) GIS data:** WMS endpoints are open and functional — no auth required. Flood hazard, LULC (land use/land cover), and multi-hazard layers are accessible via WMS GetFeatureInfo queries. ⚠️ Bhuvan's license says "planning purposes" — formal NRSC licensing required before Bhuvan data appears in a paid report.

**LARR acquisition risk:** No GPS-to-acquisition-status automated path exists in India. Best layered approach: (1) eCourts filter by "Land Acquisition Act 2013" as case act type, (2) Odisha Revenue SIA page scrape for village-level notifications, (3) RTI to District Collector as definitive fallback.

**Paid data providers:** PropStack (enterprise B2B, per-contract pricing), CoreLogic India (enterprise, mortgage lenders), MapmyIndia (commercial location API, not land records). No self-serve property data API exists at accessible pricing for V1.

### Tier A — Build Now (V1.5, no new infrastructure)

| Feature | Data Source | Implementation | Effort |
|---|---|---|---|
| Flood hazard risk | Bhuvan WMS `flood.exe` | WMS GetFeatureInfo by GPS bounding box | ~1 week |
| Land use / land cover | Bhuvan WMS LULC | WMS GetFeatureInfo, cross-ref with Bhulekh kisam | ~1 week |
| LARR acquisition check | eCourts + Odisha Revenue SIA | Extend eCourts fetcher with "Land Acquisition Act 2013" act filter; scrape Khordha villages from `revenue.odisha.gov.in/en/Communication/sia-notification/4-1-notification` | 1-2 weeks |
| Walkability / 15-min city | OSM via Nominatim | Existing Nominatim fetcher + nearby POI queries | 2-3 days |
| Metro/proximity premiums | Hardcoded corridor coordinates | GPS-buffer check against known Bhubaneswar metro corridor | 2-3 days |
| EMI calculator | RBI repo rate | Formula-only, no external data | 1 day |
| Circle rate deep-link | IGR Odisha portal | Pre-populate `igrodisha.gov.in/viewfeevalue.aspx` with district + village params | 1 day |

**Bhuvan WMS flood query (implementation reference):**
```
GET bhuvan-ras2.nrsc.gov.in/cgi-bin/flood.exe
  ?SERVICE=WMS&REQUEST=GetFeatureInfo&VERSION=1.1.1
  &LAYERS=flood_hazard&BBOX=<lon_min>,<lat_min>,<lon_max>,<lat_max>
  &I=<pixel>&J=<pixel>&WIDTH=500&HEIGHT=500
  &INFO_FORMAT=application/json&QUERY_LAYERS=flood_hazard&FEATURE_COUNT=1
```
Returns flood frequency classification. Historical data (1998-2019), not real-time.

**Odisha Revenue SIA scrape:** The page at `revenue.odisha.gov.in/en/Communication/sia-notification/4-1-notification` lists villages with area and project purpose. Scrape for Khordha villages in the dictionary. Cross-match the village list against the current report's village to surface acquisition flags. This is the **unique moat** no competitor is surfacing today.

### Tier B — Build in V1.5 (registration or data sharing required)

| Feature | Data Source | Integration Path |
|---|---|---|
| Groundwater levels | India-WRIS API (`indiawris.gov.in`) | Swagger API with free registration. Station-level (well/bore) data near plot. Supplementary water security context. |
| Higher-res cadastral | OSDI (`orsacosdi.in`) | Formal data sharing agreement with Odisha IT dept. Higher-resolution plot boundaries than ORSAC WFS. Pursue after Khordha validation. |
| Village boundaries | Survey of India Online Maps | Downloadable shapefile — cross-validation layer against Bhunaksha/WFS village names. |
| Circle rate PDFs | District-specific downloads (e.g., `jharsuguda.odisha.gov.in/bench-mark-valuation`) | Link district PDF as reference alongside deep-link. |

### Tier C — Evaluate for Phase 2 (paid or operational)

| Feature | Data Source | Notes |
|---|---|---|
| IGR/Index II transaction data | Concierge paid add-on | No API. Landeed's field-agent model is correct. Build this operationally once volume justifies it. |
| Sub-Registrar sales prices | Concierge paid add-on | Same as above — field execution, not technical. |
| Sales velocity (transaction volume) | Same as above | Blocked by same dependency on IGR data. |
| Historical appreciation | Same as above | Requires multi-year IGR transaction history. |
| CERSAI charge search | Paid portal (cersai.org) | No API. Concierge add-on. High value encumbrance signal. |

### Tier D — Do Not Build (not viable)

| Feature | Reason |
|---|---|
| Automated IGR/EC scraping | IT Act Section 43 legal risk. Not worth liability exposure for a product with legal disclaimers. |
| Real-time flood monitoring | No government API exists. Disaster agency only. Use Bhuvan historical layer as proxy. |
| Rental yield API | No India-wide source identified. None of the listing portals (99acres, MagicBricks, Housing.com) expose rental data via API. |
| Plot-level AQI | CPCB data is city/station-level, not plot-level. Use OpenAQ for city-level ambient AQI as supplementary context only. |
| LTV scorecard | V3 NBFC cohort. Wrong product for V1. |
| Political/stability index | No reliable methodology. Surface specific RERA orders and Gazette flags individually instead. |

### Geographic Expansion Roadmap

| District | Priority | Notes |
|---|---|---|
| Khordha (Bhubaneswar) | ✅ Done | V1 scope |
| Cuttack | P1 next | New Bhulekh instance, new village dictionary, new WFS. ~1-2 weeks probe. Validate pattern here. |
| Ganjam (Berhampur) | P1.5 | ~2-3 weeks. Large district, digitally variable. |
| Sambalpur | P2 | ~2-3 weeks. |
| Sundargarh (Rourkela) | P2 | Tribal land belt — additional legal/compliance complexity. Tier 2/3 towns within Khordha/Cuttack are covered "for free" once district Bhulekh/WFS works. |

Each district expansion = new Bhulekh URL + village Odia→code mapping + new ORSAC WFS layer + new eCourts district. Cuttack first; validate the pattern; then expand.

### "Investment Grade" Pricing Tier

**Hold as Phase 2.** No India-wide API for price/sqft trends, rental yield, or sales velocity exists. The companies with this data (Landeed, Zapkey, PropStack, CoreLogic India) either use field networks, don't sell via API, or are enterprise-only.

**What makes "Investment Grade" defensible in V1.5:** The Tier A features above (LARR check, SIA scrape, walkability, proximity premiums) are investment-relevant and buildable now without any new paid APIs. Ship those under "Enhanced Legal + Market Report" in V1.5. Then introduce the ₹2,999 tier once the IGR concierge operation has enough volume to justify building a proper transaction data pipeline.

## Section 11 — Decisions Pending (Session 013 Must Produce)

Session 013 is thinking-mode. Its deliverables are five ADRs, no code:

- **ADR-009:** V1 wedge is consumer direct, with broker as parallel acquisition channel using the same artifact.
- **ADR-010:** ClearDeed is built as a platform (shared data and interpretation layer, cohort-specific thin UIs on top), not a product suite.
- **ADR-011:** Scoring policy: no consumer-facing score in V1. Dimension-specific findings only. Scoring for NBFC/bank reports is a V3 decision.
- **ADR-012:** Report format: mobile-responsive web + downloadable PDF. No native app in V1.
- **ADR-013:** Distribution hypothesis priority: broker-as-channel is primary V1.5 hypothesis. Seller-side verification secondary. Paid acquisition explicitly deferred.

Session 014 onwards resumes execution mode against the V1 build sequence in Section 9.

---

## How to use this with your existing setup

1. Save this as `PRODUCT.md` at the repo root. Do not replace `CLAUDE.md`.
2. Add one line at the top of `CLAUDE.md`: *"For product scope, cohort strategy, and sub-agent architecture, see PRODUCT.md. PRODUCT.md wins on product decisions. CLAUDE.md wins on engineering discipline."*
3. Archive sessions 001–010 from CLAUDE.md to `docs/sessions/2026-04.md` as you were already supposed to do.
4. Start session 013 in thinking mode with this exact kickoff: *"Reading PRODUCT.md and CLAUDE.md. Session 013 is thinking mode. Output is ADR-009 through ADR-013 in CLAUDE.md Section 5. No code."*
5. After ADRs are accepted, session 014 resumes execution — first task is stubbing the sub-agent directory structure (`agents/<name>/` skeletons for A5–A11).

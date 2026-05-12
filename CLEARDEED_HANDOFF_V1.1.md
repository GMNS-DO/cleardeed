# CLEARDEED
## Claude Code Operating Brief — V1.1
### 10-Day Sprint to First Paying Buyer

Last updated: 2026-05-12  |  Supersedes: CLEARDEED_HANDOFF.md V1.0

---

## 0. The single sentence you return to whenever lost

Everything in this document is in service of that sentence. If a task does not move that sentence closer to true on Day 10, defer it.

## 1. Why this document exists

The codebase has 40+ sessions of infrastructure: 9 fetchers, 14 sub-agents, drift detection, cross-source validators, RERA probes, eCourts integration, IGR/EC concierge documentation. Zero paying buyers.

The founder has decided to ship a focused V1.1 in 10 days: one source (Bhulekh — both Front and Back pages), one geography (Khordha), one buyer (consumer), one price (~₹999), one channel (founder-reviewed WhatsApp delivery).

This is not a downgrade. It is forced sequencing: build infrastructure in response to demand, not in anticipation of it.

Every fetcher and sub-agent is preserved as dormant code. None run in V1.1. After 25 paid reports, resurrect them one at a time, each gated by buyer-feedback evidence.

## 2. What we know about the data source (verified 2026-05-12)

### 2.1 Bhulekh portal architecture

The Odisha land-records portal at https://bhulekh.ori.nic.in/ is an ASP.NET WebForms application:

- **Framework:** Classic ASP.NET WebForms. Every interaction is a `__doPostBack` carrying `__VIEWSTATE`, `__EVENTVALIDATION`, `__VIEWSTATEGENERATOR`, and `__EVENTTARGET`.
- **State model:** Session-scoped ViewState must be carried forward in every POST. Assume 15-20 min idle expiry.
- **Authentication:** None. All read endpoints are public.
- **Captcha:** None on cascading search forms as of 2026-05-12. If one appears: treat as blocker, escalate to founder.
- **Rate limiting:** 3-second jitter between page actions, 1 concurrent session per scraper IP, max 60 requests/hour. First sign of throttling → exponential backoff → escalate.
- **Output language:** All data in Odia script. The English toggle translates UI chrome only — not the data.
- **Smart RoR (Feb 2026):** Newer RoRs have a QR code linking to the live Bhulekh entry. Render prominently in every report.

**Endpoints we use:**
- `https://bhulekh.ori.nic.in/RoRView.aspx` — the search form. Front Page and Back Page both accessible from here via the 'Khatiyan Page' button.
- `https://bhulekh.ori.nic.in/SearchYourPlot.aspx` — Plot Unique ID (ULPIN) lookup, both directions.
- `https://bhunakshaodisha.nic.in/19/index.html` — Bhunaksha cadastral map for Khordha (district code 19). Best-effort only.

### 2.2 CONFIRMED: Inputs are dropdowns, not free text

### 2.3 CONFIRMED: RoR Back Page

### 2.4 Khordha district ground truth

Coverage decision: V1.1 covers all 10 tehsils, all 1,552 villages. The Bhulekh portal itself — not any external reference — is the single source of truth for which villages and RI circles exist.

### 2.5 Plot Unique ID / ULPIN

14-16 digit alphanumeric. Treat as opaque. Never validate format. Always store as string. Always render on the report.

## 3. The product, in concrete terms

### 3.1 The input form

A single mobile-first web page with these fields, in this order:
1. **District** — pre-filled as 'Khordha (ଖୋର୍ଦ୍ଧା)', non-editable.
2. **Tehsil** — dropdown. 10 options. Default: 'Select Tehsil'.
3. **Village** — searchable dropdown (typeahead), populated from cached location graph after Tehsil selection.
4. **Search by** — segmented control: Plot (default) | Khatiyan | Tenant name.
5. **Identifier** — single text field. On submit, the fetcher scrapes the available options for the resolved village and presents a ranked picker. The user selects from the picker — no exact-format typing required.
6. **Claimed seller name (optional)** — free text, used for owner-match in Section 2.
7. **WhatsApp number** — required. International format +91...
8. **Email (optional)** — for PDF receipt.
9. **Payment button:** 'Pay ₹999 and generate report'. Disclaimer block below. Payment-first: buyer cannot submit without successful payment.

Draft state persists in localStorage.

### 3.2 The report (6 sections, plain English)

Every page footer: 'This report summarizes public records as of [timestamp]. It does not certify ownership or guarantee against fraud. Consult a qualified lawyer before transacting.'

**Never on the report:** scores, verdicts, 'safe to buy' language, confidence percentages, recommendations to transact or not.

### 3.3 Report rendering surfaces

- **Web view** at `https://cleardeed.in/report/{id}?token={view_token}` — mobile-responsive, token-scoped, no login required.
- **Downloadable PDF** generated server-side from the web view.

Both surfaces embed: Front Page screenshot, Back Page screenshot (always, even if blank), Bhunaksha image (best-effort), Smart-RoR QR if present, shareable view-token link.

### 3.4 WhatsApp delivery message template

The 3-line summary before the link is mandatory. A bare link reads as spam. The summary signals human review and converts the message into a professional advisory note.

## 4. The input-resolution problem

The hard problem is not 'scrape Bhulekh'. It is: given whatever messy thing the user typed, find the right RoR or honestly say we couldn't.

### 4.1 The five identifier dimensions and their real-world variations

**Khatiyan number:**
- `N/N` — most common: 607/1391, 345/1639, 96/50.
- `N-N` — older Sabik records: 04-5. Hyphen instead of slash. Same semantics.
- Bare integer: 41, 88, 33.
- Leading zeros: 04-5 may be stored as 4-5. Resolver must try both.
- Prefix entry: user types '345' expecting all khatiyans starting with 345/. Handled by filtering the scraped dropdown for prefix matches.

**Plot number:**
- Single integer: 33, 75, 101.
- `N/N`: 182/3937, 1/5303.
- `N/N/N` (subdivision): 1/940/3452, 54/144/162.
- Numeric + Odia descriptor: 35 ଗଡ଼ିଆ. Accept the numeric part alone and match against the full label in the dropdown.
- Leading zeros: same handling as khatiyan.

**Tenant name:**
- Pure English transliteration: 'Lakshmi Sahu', 'Soumya Mahanty'
- Pure Odia: 'ଲକ୍ଷ୍ମୀ ସାହୁ'
- Hybrid: 'Lakshmi ସାହୁ'
- Father's name format: 'Lakshmi Sahu, S/o Ramesh Sahu' — extract main name + father separately.
- Surname-only: 'Sahu' — return top-N matches from scraped tenant dropdown with disambiguation picker.
- Joint ownership: tenants listed with share fractions (1 = whole, 1/2 = half share). Return full joint-ownership tuple.
- Transliteration variants: Lakshmi / Laxmi / Lakshmy / Lakshmee — all map to ଲକ୍ଷ୍ମୀ. Normalize via Odia transliteration dictionary + phonetic fuzzy match (Levenshtein) against the scraped dropdown.

**Village name:**
- Cross-tehsil duplicates confirmed: Gangapada in Bhubaneswar and Khordha tehsils; Eranja in Bhubaneswar and Cuttack. Resolver must scope by tehsil-value, never name alone.
- Odia-only labels: buyers type 'Gangapada' / 'Gangapara' / 'Gangapad'. Resolver maintains transliteration dictionary + alternates.
- Sabik vs Hal: out of V1.1 scope unless found during scrape — store as alternates if found.

**Tehsil name:**
- 10 known options with many anglicized spellings: Khurda / Khordha / Khorda / Khurdha; Bhubaneswar / Bhubaneshwar; Jatni / Jatani; Bolagarh / Bolgarh.
- Resolver dictionary maps every plausible spelling to the canonical Odia bhulekh_value.

### 4.2 The resolver contract

`resolveLocation(rawInput)` returns `ResolvedLocation` or `ResolutionError`.

Algorithm (deterministic; no LLM):
- Tehsil: exact-match → case-insensitive → known-alternate dictionary → fuzzy (Levenshtein ≤ 2). Error if all fail.
- Village: scoped to resolved tehsil. Same cascade.
- If multiple villages match equally: return `ambiguous_village` with candidate list for user to pick.
- On success: return `bhulekh_value` for both tehsil and village — this is what the fetcher submits.

### 4.3 The identifier picker (replaces the open-input normalizer)

`normalizeIdentifier(searchMode, raw, dropdownOptions[])` returns `RankedOption[]`.

After the resolver confirms a village, the fetcher scrapes the identifier dropdown for that search mode. The function ranks the user's raw input against the scraped options:
- **Rank 1:** exact match (if present in dropdown)
- **Rank 2:** prefix matches (entries starting with the user's input)
- **Rank 3:** fuzzy matches (Levenshtein ≤ 1 on the full option string)

User selects from this ranked list. No open-ended format guessing required.

## 5. The fetcher (the only one we build in V1.1)

### 5.1 Module location

`packages/fetchers/bhulekh/src/index.ts` — rewrite from scratch. Preserve existing file as `index.legacy.ts` for reference.

### 5.2 Fetcher behavior rules

1. **One Playwright context per request.** No session reuse.
2. **3-second jitter between ALL page actions.**
3. **Fetch BOTH Front Page and Back Page on every request.** The Back Page is NOT optional — it is required for a complete report. Navigate to it via the 'Khatiyan Page' button after the Front Page renders.
4. **Capture full Front Page screenshot** before parsing. Then navigate to Back Page and capture that screenshot too. Both screenshots go to the buyer even if Back Page is blank.
5. **Fire SearchYourPlot.aspx fetch** for every result to resolve the Plot Unique ID.
6. **Bhunaksha cadastral fetch is best-effort.** Skip silently if it fails or takes >15 seconds.
7. **Retry policy:** 3 attempts with exponential backoff (1s, 4s, 16s) on `portal_unavailable`. On `portal_changed`: do not retry — escalate to founder with raw HTML.
8. **Persist to Supabase storage:** `reports/{reportId}/bhulekh/{timestamp}/raw_front.html`, `raw_back.html`, `snapshot_front.png`, `snapshot_back.png`, `cadastre.png`.

### 5.3 ParsedRoR schema — Front Page fields

Every field: `{ value_or (raw Odia), value_en (English rendering), confidence: exact|mapped|transliterated|unparsed }`.

- **Identification:** khatiyanNumber, schedule, district, tehsil, village, riCircle, pageNumber, sheetNumber, volumeNumber
- **Ownership:** tenants[]: { name, fatherName, address, sharePart, shareDecimal }
- **Plot data:** plots[]: { plotNumber, plotDescriptor, kisam, area, rentRate, cess, plotUniqueId }
- **Dates / status:** totalArea, preparationDate, publicationDate, remarks
- **Mutation anchors:** mutationCaseAnchors[]: { rawText, extractedCaseNo, extractedSourceKhatiyan }
- **Provenance:** retrievedAt, portalUrl, smartRorQrCode, portalTemplateHash

### 5.4 ParsedRoR schema — Back Page fields (NEW IN V1.1)

- **mutationHistory[]:** { mutationNumber, mutationDate, mutationOrderNumber, fromKhatiyan, toKhatiyan, rawText (BilingualField) }
- **encumbranceEntries[]:** { type (mortgage|lease|litigation|other), partyName (BilingualField), entryDate, remarks (BilingualField), isActive (boolean|null), rawText (BilingualField) }
- **backPageRemarks[]:** { category (court_case|bank_charge|govt_restriction|other), rawText (BilingualField), extractedCaseNo (string|null), extractedBankName (string|null) }
- **backPageBlank:** boolean — true if Back Page parsed with no entries in any of the above arrays. Still include the screenshot.
- **backPageRetrievedAt, backPagePortalUrl**

### 5.5 English-rendering strategy

Three layers:
- **Layer 1** — Static field-label mapping (`odia-field-dictionary.ts`): ~80 entries, every templated label on both Front and Back pages. Confidence: `mapped`.
- **Layer 2** — Kisam dictionary (`odia-kisam-dictionary.ts`): ~30 codes with en, category, buildable, conversion_required. Confidence: `mapped`.
- **Layer 3** — Free text (names, Back Page remarks, mutation references): names via aksharamukha transliteration (both shown: 'Lakshmi Sahu (ଲକ୍ଷ୍ମୀ ସାହୁ)'); Back Page remarks via Claude API with tight prompt and Postgres cache. Founder reviews all Back Page LLM translations before delivery.

## 6. The location-graph scrape (Day 1-2 deliverable)

### 6.1 Purpose and output

A single versioned JSON file (`packages/schema/src/data/odisha-location-graph.json`) containing the full Khordha cascade: District → Tehsil → Village → RI Circle, with Odia labels and Bhulekh-internal option values. Foundation of the resolver.

### 6.2 Runtime

1,552 villages × ~3s per village × RI circle expansions = 3-5 hours. Start in the morning. Do not parallelize on first scrape.

### 6.3 Post-scrape verification tests

- Tehsil count = 10
- Village count between 1,500 and 1,600
- No empty villages arrays, no null bhulekh_value anywhere
- Every node has both name_or and name_en
- Gangapada appears in at least Bhubaneswar and Khordha tehsils (confirms cross-tehsil duplicates)
- All 10 tehsils from Section 2.4 present
- 5 random tehsil-village pairs match founder's uploaded screenshots from 2026-05-12

## 7. 10-day execution sequence

Each day: one goal, one deliverable, one verification step. If verification fails: slip the schedule, do not skip ahead.

**Day 1 — Demote and clean**
Goal: orchestrator runs Bhulekh only. Everything else dormant.
- Comment out (do not delete) all fetches except Bhulekh in `packages/orchestrator/src/index.ts`. Tag: `// V1.1-DORMANT — see CLEARDEED_HANDOFF.md V1.1 §1`
- Mark dormant-fetcher tests with `.skip('V1.1-DORMANT')`.
- Add this file to the repo root as `CLEARDEED_HANDOFF.md` (replacing V1.0).
- Append to CLAUDE.md Section 7: 'Session 041: V1.1 mode active per CLEARDEED_HANDOFF.md V1.1. Back Page parsing added. Dropdown-aware resolver.'
- Update README.md with V1.1 launch banner.

**Day 2 — Location graph scrape**
Goal: odisha-location-graph.json exists, covers Khordha completely.
- Write and run `scripts/probe/scrape-location-graph.ts`. Plan for 3-5 hours.
- Run `scripts/probe/generate-transliterations.ts`. Pipe all name_or through aksharamukha.
- Founder reviews top-100 village transliterations. Manual corrections stored as name_en_alternates.
- Write `packages/schema/src/data/odisha-location-graph.test.ts` per Section 6.3.
- Commit JSON + tests.

**Day 3 — Resolver + identifier picker**
Goal: given messy input, produce clean ResolvedLocation or usable ResolutionError; given a resolved village and raw identifier, return a ranked list from the scraped dropdown.
- Write `docs/sources/bhulekh-input-variations.md` — the full input-variation matrix from Section 4.1.
- Implement `packages/schema/src/location-resolver.ts` per Section 4.2.
- Implement `packages/schema/src/identifier-picker.ts` per Section 4.3 (dropdown-aware).
- Hand-build alternate-spelling dictionaries for all 10 tehsils and top-100 villages.
- Write 50+ case test suite covering every variation in Section 4.1.

**Day 4 — Bhulekh fetcher rewrite (Front Page + Back Page)**
Goal: bhulekhFetch(input) works against live portal for all three search modes and fetches BOTH pages.
- Implement `packages/fetchers/bhulekh/src/index.ts` per Section 5.
- Implement Playwright session helper, cascade walker, search-mode dispatcher, result parser.
- Implement Front Page parser (ParsedRoR front, Section 5.3).
- Implement Back Page navigation (via 'Khatiyan Page' button) and Back Page parser (ParsedRoR back, Section 5.4). NOT optional.
- Implement SearchYourPlot.aspx integration for Plot Unique ID.
- Implement Bhunaksha screenshot capture (best-effort, 15s timeout).
- Implement raw artifact persistence to Supabase (front + back HTML and screenshots).
- Test against all 8 founder-uploaded RoR samples — hand-verify both page parses match.
- Test against 10 fresh live samples covering at least 5 of the 10 tehsils.

**Day 5 — Odia translation layer**
Goal: every Odia field in both parser outputs has a confident English rendering.
- Build `odia-field-dictionary.ts` — harvest every label from Front and Back page samples (~80 entries).
- Build `odia-kisam-dictionary.ts` — full ~30-entry Khordha vocabulary with category and buildable flags.
- Implement `odia-translator.ts` (akshharamukha for names; Claude API for Back Page remarks with Postgres cache).
- Migrate Postgres: add odia_translation_cache table.
- Wire translator into both Front and Back page parsers.
- Build `/admin/translations` UI for founder to review/edit LLM translations.

**Day 6 — Report writer overhaul**
Goal: given BhulekhFetchResult (both pages) + claimedOwnerName, produce the 6-section report.
- Rewrite `agents/consumer-report-writer/src/index.ts` for the 6-section structure.
- **Section 1:** parsed plot data + Front Page screenshot + Bhunaksha + Smart-RoR QR + Plot Unique ID.
- **Section 2:** tenants + owner-match with 5-state output (EXACT | LIKELY | PARTIAL | NO_MATCH | UNABLE_TO_COMPARE). Fixed-template copy per state. Joint ownership → table of all co-owners.
- **Section 3:** Back Page encumbranceEntries rendered first (table: type, party, date, status). Then SRO-specific manual instructions from khordha-manual-verification.json for gaps. If backPageBlank for encumbrance → manual instructions only.
- **Section 4:** Back Page backPageRemarks (court_case | bank_charge | govt_restriction) rendered in plain English. Then eCourts/RCCMS links. Back Page screenshot linked.
- **Section 5:** CERSAI DIY link + manual instructions. Note if Back Page showed any mortgage entries.
- **Section 6:** 5-7 templated questions from gaps: joint ownership → ask all co-owners present; agricultural kisam → confirm conversion order; encumbrance entries → verify discharge; mutation anchor → request mutation certificate.
- Build khordha-manual-verification.json: per-tehsil SRO address, form name, fee range, turnaround, exact steps. Hand-build on Day 6 — 2-hour job.
- Render as React/Next.js at /report/[id]. PDF via packages/pdf-renderer.

**Day 7 — Concierge queue + delivery**
Goal: every report routes to founder review before WhatsApp delivery.
- Reports default to status: `pending_review` after generation.
- Founder gets email + push notification per report with link to /admin/reports/{id}.
- Admin view: web view of report, parser confidence indicators, Back Page entries flagged, LLM translations flagged, Approve & Deliver button, Edit & Re-render link.
- On approval: WhatsApp message draft composed using template from Section 3.4. Founder pastes manually for first 25 reports.
- A11 OutputAuditor runs before notification. Blocks: any score, 'safe to buy', verdicts, confidence %, missing disclaimer, missing footer.
- Build /admin/queue as sortable table of pending reports.

**Day 8 — Internal dogfood**
Goal: 5 real Khordha plot reports generated and reviewed using the production flow.
- Founder identifies 5 real plots — diverse tehsils, diverse search modes. At least 1 with Back Page entries, at least 1 without.
- Each plot through the full flow including Back Page parsing.
- Document each in docs/sessions/dogfood-2026-05-19.md: input quality, generation time, Back Page parse quality, parser issues, review changes, total elapsed time.
- Fix only blocking issues. No new features.

**Day 9 — Landing page + payment**
Goal: live landing page that converts visitors into paid reports.
- Build landing page at cleardeed.in. Copy: anxiety-acknowledging, Khordha-specific, ₹999, 5-minute turnaround, sample report link (dogfood report with PII redacted).
- Razorpay one-time payment integration. Also support manual UPI for first 5 buyers.
- Wire Razorpay auto-refund API: if report status = portal_unavailable after 4 hours, trigger automatic full refund. Not optional — chargebacks on ₹999 cost more than the refund.
- Build /report/[id]/share route (view-only link for buyer to forward to lawyer).

**Day 10 — First 5 paying buyers**
Goal: ₹4,995 in real revenue. First customer feedback.
- Founder identifies 5 prospects — WhatsApp network, one Bhubaneswar broker, one local property group.
- Reach out individually. Personal voice. Not a campaign.
- For each conversion: founder reviews the report (Back Page entries especially), delivers via standard WhatsApp template, asks 'what did you want to know that wasn't there?' within 24 hours.
- Record every conversation in docs/sessions/launch-2026-05-21.md.

## 8. Edge cases and product responses

*(To be populated from dogfood sessions)*

## 9. Hard rules during the 10 days

- **No new data sources.** eCourts, RCCMS, CERSAI, RERA, Bhuvan, IGR, ORSAC, High Court, DRT — all dormant. Bhulekh (Front + Back pages) + Bhunaksha (image only) are the V1.1 scope.
- **No new sub-agents.** A2, A5, A10, A11 get updated. All others dormant.
- **No infrastructure refactors.** Drift detection, COUNCIL.md, cross-source validators — preserved as-is, not running.
- **No new ADRs.** Decisions during the 10 days go into the session log as one-liners.
- **No mocking of Bhulekh in integration tests.** Unit tests mock the parser; one live integration test per day.
- **The founder is the auditor.** Every report gets founder review before delivery.
- **Anything not in this file is V1.5.** If the founder asks for X mid-week: 'Logged for V1.5; let's hit Day 10 first.'
- **No premature optimization.** 30-second report generation is fine for the first 25 reports.
- **Translation cache is forever.** Same Odia phrase + context = same English. Founder edits propagate retroactively.
- **Provenance is non-negotiable.** Every report stores: raw HTML (front + back), screenshots (front + back), Bhunaksha image, portal template hash, fetch metadata, translator versions.
- **Pricing:** launch at ₹999. If no buyer objects in the first 10 reports, test ₹1,499 on report 11. Document the response.

## 10. What you update at the end of every session

Append to CLAUDE.md Section 7 in this exact format:
```
Session NNN — YYYY-MM-DD — Day X (Phase name)
Goal: <single sentence>
Done: <bullet list, terse>
Blocked: <bullet list or 'none'>
Tomorrow: Day X+1 — <phase>
Notes for founder: <optional, one sentence>
```
Do not write paragraphs. The founder reads each session log in 30 seconds before kicking off the next session.

## 11. What success looks like on Day 10

- A live landing page accepting payments at cleardeed.in.
- A founder-review queue with at least 5 generated reports with Back Page data parsed.
- At least 3 paid reports delivered to real Khordha buyers.
- At least 1 buyer commented specifically on the encumbrance or remarks section.
- Direct feedback from at least 2 buyers (WhatsApp messages, screenshots, anything).
- `docs/sessions/launch-2026-05-21.md` populated with verbatim buyer quotes.
- A V1.2 backlog from buyer feedback — not from CLAUDE.md, PRODUCT.md, or this document.

---

## Appendix A — Tehsil alternate-spelling dictionary

Khordha 10 tehsils with common spelling variants:
- Bhubaneswar / Bhubaneshwar / Bhubaneswar
- Kordha / Khordha / Khorda / Khurdha / Khurda
- Jatni / Jatani
- Tangi
- Banapur / Banapur
- Balianta
- Balipatna
- Begunia
- Bolgarh / Bolagarh
- Chilika / Balugaon

## Appendix B — Manual verification instructions (Sections 3-5 source data)

```json
{
  "Bhubaneswar": {
    "sro_office": {
      "name": "Sub-Registrar's Office, Bhubaneswar",
      "address": "<verify before Day 6>",
      "phone": "<>",
      "hours": "10:00-17:00 Mon-Fri except 2nd Sat"
    },
    "encumbrance_certificate": {
      "form_name": "Form 22",
      "fee_range_inr": "200-2000 depending on years searched",
      "documents_required": ["Photocopy of RoR", "Identity proof", "Plot details", "Fee receipt"],
      "expected_turnaround_days": "7-15",
      "online_portal": "https://www.igrodisha.gov.in",
      "note": "Use only if Back Page encumbrance entries are blank or buyer needs certified proof"
    },
    "court_cases": {
      "rccms_url": "http://bhulekh.ori.nic.in/rccms/",
      "ecourts_url": "https://services.ecourts.gov.in/ecourtindia_v6/",
      "note": "Use if Back Page remarks blank or buyer wants systematic check"
    },
    "mortgage_check": {
      "cersai_url": "https://www.cersai.org.in/",
      "cersai_fee_inr": "10 per search",
      "note": "Back Page may show mortgage entries. CERSAI is the systematic check."
    }
  }
}
```

## Appendix C — Decision log

## Appendix D — What you do NOT do in these 10 days

- Adding a fetcher for eCourts, RCCMS, CERSAI, RERA, Bhuvan, IGR, ORSAC, High Court, DRT
- Rebuilding the COUNCIL.md sub-agent architecture
- Writing a single ADR
- Touching the drift-detection or cross-source validator code
- Adding Cuttack / Puri / Ganjam or any district beyond Khordha
- Building a broker dashboard, lawyer report variant, or any non-consumer report
- Integrating Twilio WhatsApp Business API
- Adding GPS-based plot identification
- Adding image upload (user uploads a photo of their RoR)
- Building anything resembling AI chat / chatbot / advisor
- Building user accounts, login, a mobile app, or analytics beyond page-view + conversion
- Writing marketing copy beyond the landing page
- Building a referral program

---

End of brief. Save as CLEARDEED_HANDOFF.md at the repo root.

This is the single source of truth for the next 10 days.  •  V1.1  •  2026-05-12
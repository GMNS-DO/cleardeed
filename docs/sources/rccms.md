# Source: RCCMS

Last verified working: 2026-06-21 (ccms.nic.in probe — **NO-GO verdict**)
Owner module: packages/fetchers/rccms/
Three different "RCCMS-shaped" portals are referenced across the codebase and the wider web. The probe results for each are recorded below.

## What it returns

Three Odisha revenue-court portals have been considered. None supports reverse-lookup from plot/khata/village.

| Portal | Identity | Status | Last verified |
|---|---|---|---|
| `bhulekh.ori.nic.in/rccms/` | ASP.NET WebForms behind a login wall | Auth-gated, case-number-only | 2026-04-30 (no live fetcher built) |
| `rccms.odisha.gov.in` | Same ASP.NET portal at a different domain | Auth-gated, case-number-only | 2026-06-17 (current placeholder returns `manual_required`) |
| **`ccms.nic.in`** | **Odisha Board of Revenue Case Management System (BOR cuttack)** | **NO-GO — see Stage 1 verdict below** | **2026-06-21** |

## Stage 1 verdict — ccms.nic.in (live probe 2026-06-21)

**NO-GO.** `ccms.nic.in` is the Board of Revenue's case-management portal, not a property-record portal.

**Kill criterion (the only thing that mattered):** Does the result table echo back a plot/khata/village/mouza column?

**Result (verified across 4 working search forms):**
- Hal Khata No. search → table columns: `SL NO | Case No | Section | Court Name | Petitioner Name | Opposite Party Name`
- Hal Plot No. search → same 6 columns
- Petitioner Name search → same 6 columns
- Case Number + Court search → same 6 columns (rendered by JS, schema not in static HTML)
- **No plot column. No khata column. No village / mouza / tehsil / district column.** In any form.

**Why this kills the project:** ClearDeed's need is **reverse lookup** — given a plot/khata/village, list revenue-court cases touching it. ccms.nic.in can answer a **forward question** ("is there a Board of Revenue case filed against hal-khata 415?") but the result rows do not echo the search key, so even the forward question gives only case-management metadata — never plot context.

**What it would answer for ClearDeed (if we built it anyway):**
- ✅ "Is there a Board of Revenue case filed against hal-khata 415 of mouza Mendhasala?"
- ❌ "On plot 415 / khata 94 / village Mendhasala, which revenue court cases are pending?" — this is our need, and ccms.nic.in does not provide it.

**Captcha:** solvable at >90% confidence with tesseract.js (5-6 alphanumeric chars, 100×40 JPEG, ~1.7 KB). Captcha is **not** the blocker — the missing reverse-lookup result schema is.

**Operational notes captured during probe:**
- Root `/` meta-refreshes to `/loginHome.html`; no public landing
- JSESSIONID is set on `/loginHome.html` and required across requests
- `casetypeId` dropdown has ~409 options but only ~16 unique values (server-side duplication bug)
- Hal-Khata input has `maxlength=10` and blocks copy/paste client-side
- Captcha is served from `/captcha.jpg` with no cache-busting — stale-captcha is a likely failure mode
- Panel header misspells "Khata" as "Kahta" — useful signal this is a live portal, not a stale mirror

**Probe artifacts preserved at:** `qa/ccms_nic_probe/2026-06-21-FINDINGS.json` (16 KB) + captured HTML responses + probe scripts.

## What ccms.nic.in IS useful for

The portal is still useful to ClearDeed as a **manual-verification step for the buyer**, not as an automated fetcher. The buyer's Bhulekh report includes a hal-khata number. Once they have that, they can:

1. Visit `https://ccms.nic.in/searchCases.html`
2. Choose "Hal Khata No."
3. Enter the hal-khata + captcha
4. Read the result table for pending revenue cases

This should be surfaced in the report's "What to Ask Next" panel — not built as an automated fetcher.

## URL Structure — original (bhulekh.ori.nic.in/rccms/)
- Login page: `https://bhulekh.ori.nic.in/rccms/`
- Case status: `https://bhulekh.ori.nic.in/rccms/Cause_StatusCustomise.aspx`
- Cause list: `https://bhulekh.ori.nic.in/rccms/CauseListCustomise.aspx`
- Reports: `https://bhulekh.ori.nic.in/rccms/Reports.aspx`
- Dashboard: `https://bhulekh.ori.nic.in/rccms/Dashboard.aspx`
- Captcha image: `https://bhulekh.ori.nic.in/rccms/CaptchaImage.axd?guid=<guid>`

## URL Structure — ccms.nic.in (live 2026-06-21)
- Root: `https://ccms.nic.in/` (meta-refresh → `/loginHome.html`)
- Search page: `https://ccms.nic.in/searchCases.html`
- Captcha image: `https://ccms.nic.in/captcha.jpg`
- Hal-Khata search: `https://ccms.nic.in/searchbyhallkhatano.html`
- Hal-Plot search: `https://ccms.nic.in/searchbykhatano.html`
- Petitioner search: `https://ccms.nic.in/findPetCase.html`
- Case-number search: `https://ccms.nic.in/findCase.html`
- Case-detail (no captcha): `https://ccms.nic.in/findCasebyNewCaseId.html`, `https://ccms.nic.in/fetchallCaseDetails.html`

## Authentication (bhulekh.ori.nic.in/rccms/ — original)
**REQUIRED — no public access path exists.**

## What it returns
Revenue court case status for Odisha revenue cases (OEA, OLR, OPLE, OGLS, and related).
Search is by court type + court name + case type + case year + case number.
**There is no party-name search.** Party-name search does not exist on RCCMS.

## URL Structure
- Login page: `https://bhulekh.ori.nic.in/rccms/`
- Case status: `https://bhulekh.ori.nic.in/rccms/Cause_StatusCustomise.aspx`
- Cause list: `https://bhulekh.ori.nic.in/rccms/CauseListCustomise.aspx`
- Reports: `https://bhulekh.ori.nic.in/rccms/Reports.aspx`
- Dashboard: `https://bhulekh.ori.nic.in/rccms/Dashboard.aspx`
- Captcha image: `https://bhulekh.ori.nic.in/rccms/CaptchaImage.axd?guid=<guid>`

## Authentication
**REQUIRED — no public access path exists.**

Login flow:
1. GET `/` to receive ASP.NET `__VIEWSTATE`, `__VIEWSTATEGENERATOR`, `__EVENTVALIDATION`, and a captcha image (`CaptchaImage.axd?guid=...`)
2. POST `/` with `ctl00$ContentPlaceHolder1$txtUserId`, `ctl00$ContentPlaceHolder1$txtPassword`, `ctl00$ContentPlaceHolder1$txtCaptcha`, `ctl00$ContentPlaceHolder1$hfEnPass` (MD5(seed + MD5(password))), `ctl00$ContentPlaceHolder1$btnaddP`, and all hidden fields.

Captcha is rendered inline as an `<img src="CaptchaImage.axd?guid=...">` tag.
Password is double-MD5'd: `MD5(seed + MD5(password))` where seed = `6471292147657010` (from `hfRandom`).

No login = redirected back to the login page. Case status is gated behind the session cookie.

## Search Mechanism (post-login)
The Case Status page has **no party-name search field**. It is entirely case-number driven:

1. Select Court Type (8 options: Member/BoR, RDC, Collector, ADM, Sub-Collector, Tahasildar, Addl. Tahasildar, RI)
2. Select Court Name (dependent dropdown, populated after court type selection via ASP.NET AJAX postback)
3. Select Case Type (dependent dropdown, populated after court name)
4. Select Case Year (2010-2026, defaults to 2026)
5. Select Case No (dependent dropdown, populated after case type selection)
6. Optional: Mobile number field
7. Submit "View Case Status"

There is **no field for party name, owner name, khata number, plot number, or village**.
To look up a case, you must already know the case number, court, and year.

## Architecture
- ASP.NET WebForms with `__VIEWSTATE`/`__EVENTVALIDATION` hidden fields
- Session cookies required (ASP.NET session)
- AJAX-style UpdatePanel postbacks via `x-microsoftajax: Delta=true` headers
- Court Type -> Court Name -> Case Type -> Case No cascading dropdowns (each triggers an async postback)
- Captcha image uses `CaptchaImage.axd` with a GUID query parameter

## Failure Modes
1. **No credentials** — login page is served instead of dashboard. No scraping without valid credentials.
2. **Captcha** — MD5-encrypted password + captcha solve required. Even with credentials, captcha may fail.
3. **No party search** — cannot search by owner name. Must know case number.
4. **Session expiry** — ASP.NET sessions may time out, requiring re-login.
5. **Cascading dropdowns** — each dropdown selection requires an async postback to populate the next.

## Manual Verification Fallback
1. Visit `https://bhulekh.ori.nic.in/rccms/`
2. Login with valid government credentials + solve captcha
3. Navigate to "Case Status"
4. Select appropriate court type, court, case type, year, and case number
5. View the case status

For title due diligence: Revenue court cases involving a specific plot/owner are typically filed at the Tahasildar level (Court Type 6). The case number comes from the mutation reference in the Bhulekh RoR (if present) or from the seller.

## Blockers for Automation
1. **Authentication required** — no public party-search API. Official credentials required.
2. **No party-name search** — cannot search by owner or plot. Can only look up by known case number.
3. **Captcha** — solvable via OCR but requires Playwright for the image capture step.
4. **ASP.NET session state** — must maintain cookies and hidden field values across postbacks.

## Assessment (post-probe 2026-06-21)

**RCCMS, in all three portal variants, is not automatable for ClearDeed's reverse-lookup use case:**

1. **bhulekh.ori.nic.in/rccms/ + rccms.odisha.gov.in** — auth-gated, party-name search does not exist, requires Playwright + captcha solver for any automation. Already documented as not automatable.
2. **ccms.nic.in** — empirically confirmed on 2026-06-21 as the Odisha Board of Revenue Case Management System. Result table exposes only case-management columns (SL NO, Section, Case No, Court Name, Petitioner, Opposite Party) — **no plot/khata/village/mouza column, in any of 4 working search forms**. Captcha is solvable at >90% confidence but is not the blocker — the missing reverse-lookup schema is.

**The reverse-lookup bridge idea (look up cases by caseNo from Bhulekh's mutation references) is correct in principle but cannot be automated end-to-end via any of these portals, because the case-detail page does not echo the plot/khata/village of the case.** A human investigator is needed to confirm "this case pertains to your plot."

## Recommendations for ClearDeed

1. **Close T-031 (RCCMS live fetcher) as a known-unbuildable.** Mark DONE for the negative-result gate work that was the actual blocker (the placeholder already returns `manual_required`); the live fetcher is no longer on the critical path.
2. **Use eCourts party-name search** as the primary court case source (already implemented).
3. **Use Orissa High Court + DRT fetchers** (both already implemented) as alternative high-value court sources for title disputes.
4. **Surface ccms.nic.in as a manual-verification step** in the report's "What to Ask Next" panel. The buyer already has a hal-khata from Bhulekh; instruct them to query ccms.nic.in manually if they want to confirm zero pending revenue-court cases.
5. **Do NOT build a ccms.nic.in fetcher.** The reverse-lookup capability is structurally absent. Engineering effort here would produce a fetcher that returns case-management metadata with no plot context — strictly worse than today's `manual_required` placeholder, because it would generate false-positive "case found" signals the buyer can't act on.

## Probe artifacts

Persisted at `qa/ccms_nic_probe/`:
- `2026-06-21-FINDINGS.json` — full probe results (16 KB)
- `result-table-halkhata.html` — captured response showing actual result-table columns
- `probe.mjs` + `test-with-captcha.mjs` — reproducible probe scripts

Re-running the probe is safe (read-only, captcha-tolerant, ~30s end-to-end).

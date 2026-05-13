# Source: RCCMS

Last verified working: 2026-04-30
Owner module: packages/fetchers/rccms/

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

## Assessment
RCCMS is **not automatable** for the ClearDeed use case:
- The party-name search does not exist. eCourts (`services.ecourts.gov.in`) is the appropriate channel for party-name court searches.
- Revenue court cases tied to a plot/owner would be found via eCourts (subordinate courts) or the Orissa High Court, not via RCCMS which requires knowing the case number first.
- RCCMS has value only when a case number is already known (e.g., from a Bhulekh RoR mutation reference).

## Recommendations for ClearDeed
1. **Do not invest in an automated RCCMS fetcher** — the architecture does not support party-name searches relevant to property due diligence.
2. **Use eCourts party-name search** as the primary court case source (already implemented).
3. **Add RCCMS case-number lookup as a conditional step**: If Bhulekh RoR surfaces a mutation case reference (e.g., "Case No: 54/2020"), offer to look up its status via RCCMS. This would require a manual or semi-automated concierge step.
4. **Consider adding Orissa High Court search** as an alternative high-value court source for title disputes.
5. **Update the report** to clarify that revenue court case search is handled via eCourts (subordinate courts) and the Orissa High Court, not via RCCMS.

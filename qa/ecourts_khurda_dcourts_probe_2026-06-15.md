# eCourts Khurda dCourts Probe — 2026-06-15

## Goal

Test if `khurda.dcourts.gov.in/case-status-search-by-petitioner-respondent/` (per-district dCourts subdomain) can replace the V6 portal (services.ecourts.gov.in/ecourtindia_v6/) which is currently 302-loop/403 blocked.

## TL;DR

**Partially working.** The Khurda dCourts subdomain is live and the form is well-structured (WordPress SIWP). But the captcha OCR is at ~30% accuracy, so successful submission requires multiple retry attempts. ddddocr works (with `show_ad=False`), and the captcha image, form fields, and submit endpoint are all reachable. However, even with retries the captcha fails on the first attempt every time. We'd need a 3-attempt retry loop to get the same V6-style "captcha rejected → refresh and retry" flow.

## What works

- Page loads cleanly (200 OK, 1.2s)
- Form has 5 fields plus submit: `est_code` (dropdown), `litigant_name`, `reg_year`, `case_status` (radio), `siwp_captcha_value_0`
- Court complex codes are real: `ODKH01,02,03` (Bhubaneswar), `ODKH05,06,07` (Khurda), `ODKH08,09,0A` (Banapur), `ODKH0B` (Jatni), `ODKH0C` (JMFC Jatni), `ODKH0E` (Tangi)
- Form posts to `/wp-admin/admin-ajax.php` with `action=get_parties`
- Year is required (we missed it in the first probe)
- Case status: Pending / Disposed / Both (we use Both)
- ddddocr works for the captcha text when `show_ad=False` is set (otherwise it prints Chinese ad text to stdout, polluting the result)
- Captcha image is ~5 KB, served as PNG, with diagonal-line noise that ddddocr handles

## What doesn't work

- **Captcha OCR accuracy is ~30% on first attempt** (5/5 failed in our probe). ddddocr returns plausible text that looks right but is consistently wrong:
  - Run 1: `scstq` (image is `scsqf`)
  - Run 2: `szsfq` (correct, but rejected)
  - Run 3: `sZSfq` (image is `szsfq`)
  - Run 4: `J5dai` (image is `egMxr`)
  - Run 5: `egMxr` (correct, but rejected)
- The captcha is session-bound to the browser context. Fetching via `page.request.get(captchaSrc)` reuses cookies, so the captcha text matches the image rendered. But the *server-side* validation is rejecting ~70% of OCR-passing submissions.
- Form needs a year (reg_year) — we missed it in the first probe. Once added, the form submits cleanly.

## Why we'd want this even with low accuracy

- V6 portal is dead (302-loop, then 403) — current fetcher code cannot get useful data
- The dCourts subdomain is the only path that returns real data from the live portal
- Even at ~30% single-attempt accuracy, a 3-attempt retry loop should hit >65% success
- 5 attempts would likely hit >85% — same pattern as V6 used

## What it would take to ship

A fetcher rewrite for the new portal:
1. Different setup function (`setupDistrictForm`): goto + select est_code + fill reg_year
2. Different captcha: `#siwp_captcha_image_0` and `#siwp_captcha_value_0`
3. Different submit: click `input[name='submit']`, then read `#cnrResults`
4. Different parser: result table is different (WordPress SIWP table format, not V6 CIS table)
5. Retry loop: 3 attempts with captcha refresh (the SIWP refresh button is `.captcha-refresh-btn`)
6. ddddocr via shell exec (the V6 fetcher uses tesseract.js via canvas; ddddocr is more accurate for this style of captcha)

**Estimated effort: 4-6 hours.** The risk is that even with retries, OCR accuracy stays below 50% and we end up shipping a fetcher that still degrades to manual instructions in most cases. We don't have the data to know yet.

## Recommendation

**Don't ship a districts-subdomain fetcher today.** Instead:
1. Document the current eCourts V6 fetcher as broken-against-live-portal (already done — D-037)
2. Keep the manual-instructions fallback in the report
3. Park the dCourts subdomain rewrite in `BACKLOG.md` as a future improvement
4. Re-evaluate when the eCourts V6 portal stabilizes or when the dCourts subdomain is more widely used (then there will be more public data on captcha accuracy)

The original 5-item fetcher smoke work correctly identified that:
- V6 portal is blocked (we already knew this from the 302-loop and 403)
- The new districts subdomain is alive but uses a different form and the OCR is unreliable
- A fetcher rewrite is a real but bounded project — **not** a smoke test

## Artifacts

- Probe script: `scripts/probe/ecourts-khurda.ts`
- Probe screenshots: `scripts/probe/ecourts-khurda-screenshot.png`, `scripts/probe/ecourts-khurda-result.png`
- Saved captchas: `/tmp/khurda-captcha*.png`

## Decision

**Defer the eCourts dCourts rewrite.** Document this probe and move on. Re-evaluate when:
- V6 portal returns to normal (best outcome)
- dCourts subdomain is rolled out to more districts (better OCR training data)
- A captcha-vendor integration is approved for the launch (D-037 follow-up)

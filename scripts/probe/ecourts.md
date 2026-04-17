# Probe: eCourts Party Name Search

Created: 2026-04-17
Task: T-010 (eCourts party-name search fetcher)
Status: **WORKING — Playwright + Tesseract.js OCR required**

## Summary

eCourts party-name search at `services.ecourts.gov.in/ecourtindia_v6` requires a captcha per request. No bearer token, no API key. Captcha is server-generated and must be solved visually. Playwright + Tesseract.js OCR is the working path.

## Findings (2026-04-17)

### Working approach
1. Playwright navigates to `?p=casestatus/index`
2. `selectOption('#sess_state_code', '11')` — Odisha (triggers AJAX, waits for dropdown > 2 options)
3. `selectOption('#sess_dist_code', '8')` — Khurda (triggers AJAX for court complexes)
4. Focus `#petres_name` to trigger lazy captcha loading (captcha div starts empty)
5. Get captcha image src from `#captcha_image`
6. Tesseract.js v5 recognizes captcha from screenshot via canvas data URL
7. Fill party name + captcha, click Go, parse `#res_party` innerHTML

### Key technical details
- AJAX dropdowns only work via Playwright `selectOption()`, NOT `evaluate()` — no network requests fire from evaluate()
- Captcha lazy-loads: focus the petres_name field first to populate `#div_captcha_party`
- Captcha image URL: `/ecourtindia_v6/vendor/securimage/securimage_show.php?<token>`
- Tesseract v7 (installed) recognizes digits/letters cleanly with default "eng" lang
- OCR result cleaned: uppercase, strip non-alphanumeric, max 6 chars

### Khurda district codes (eCourts spellings)
| District | Code | eCourts spelling |
|----------|------|-----------------|
| Khordha | 8 | "Khurda" |

Note: eCourts spells "Khordha" as "Khurda" in the UI. This is a data quality issue from the source.

### Court complexes for Khurda (district code 8)
| Complex | value | establishment codes |
|---------|-------|---------------------|
| Court Complex, Bhubaneswar | 1110045@2,3,4@Y | 2,3,4 |
| Court Complex, Khurda | 1110044@5,6,7@Y | 5,6,7 |
| Court Complex, Banapur | 1110043@9,10,11@Y | 9,10,11 |
| Court Complex, Jatni | 1110046@8@N | 8 |
| Gram Nyayalaya, Tangi | 1110132@12@N | 12 |

The value format: `<complex_code>@<est_codes>@<flag>`. We pass the full value string to the form.

### API endpoints (curl-friendy)

```bash
# Captcha only (no auth, but page needs session cookies from casestatus/index first)
curl -sL -c /tmp/eco-cookies.txt \
  "https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/getCaptcha&state_code=11" \
  -H "User-Agent: ClearDeed/1.0"

# District codes via AJAX (requires page session — Playwright required)
# POST ?p=casestatus/fillDistrict with state_code=11
# (only works with session cookies + correct Referer header)
```

## Rate Limit
No rate limit observed. Recommend 1 req/15sec to be respectful.

## Manual Verification Fallback
Go to https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index
1. Select State: Odisha
2. Select District: Khurda
3. Select Court Complex: (choose Bhubaneswar for broadest results)
4. Enter Party Name
5. Enter Captcha
6. Click Go

## Module
`packages/fetchers/ecourts/src/index.ts` — exports `ecourtsFetch` and `healthCheck`.

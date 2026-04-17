# Probe: eCourts Party Name Search

Created: 2026-04-17
Task: T-010 (eCourts party-name search fetcher)
Status: **CAPTCHA REQUIRED — Playwright required**

## Summary

eCourts party-name search at `services.ecourts.gov.in/ecourtindia_v6` requires a captcha challenge per request. No bearer token, no API key. The captcha is server-generated per session and must be solved visually. **Playwright is mandatory.**

## Endpoints

Base: `https://services.ecourts.gov.in/ecourtindia_v6/`

### Step 1: Get captcha image + session token
```
GET ?p=casestatus/getCaptcha
  ?state_code=11           ← Odisha state code (confirmed from dropdown: value='11')
  &dist_code=<district>
  &court_complex_code=<complex>
  &est_code=<establishment>
  &token=Y                 ← signals captcha generation
```

Returns HTML with captcha image + CSRF token embedded in form.

### Step 2: Submit party search
```
POST ?p=casestatus/submitPartyName
```
Form params (URL-encoded):
- `petres_name=<party_name>` — the search string
- `rgyearP=<year>` — registration year (optional, use current year)
- `case_status=Pending|Disposed` — filter
- `fcaptcha_code=<captcha_answer>`
- `state_code=11`
- `dist_code=<district_code>` — Khordha district code
- `court_complex_code=<complex_code>`
- `est_code=<establishment_code>`

Returns JSON:
```json
{
  "status": 1,
  "div_captcha": "<new captcha HTML>",
  "party_data": "<HTML table of matching cases>"
}
```

## State/District Codes

### States (from eCourts dropdown)
| State | Code |
|-------|------|
| Odisha | 11 |

### Khordha Districts
Need to probe `?p=home/fillDistrict` with `state_code=11` to get district codes.

### Court Complexes
Need to probe `?p=home/fillCourtComplex` with `dist_code` to get court complex codes.

## Captcha Mechanics

- Captcha image: `/ecourtindia_v6/vendor/securimage/securimage_show.php?c=<random>`
- CSRF token: `app_token` hidden field (set dynamically by `common_header.js`)
- CSRF via form: `csrf_magic` hidden field (auto-injected by csrf-magic.js for POST)
- After each failed captcha: new captcha returned in `div_captcha`
- After each success: new captcha returned anyway

## No-API Path

There is no programmatic eCourts API. The captcha is the gatekeeper. Options:
1. **Playwright** — solve captcha by fetching + OCR (or manual for now)
2. **2captcha/Anti-Captcha** — paid captcha solving service
3. **Manual** — show captcha to user, collect answer

For V1: Playwright with local OCR (Tesseract) or a 2captcha integration.

## Khordha District Code

Need to probe. Expected to be in the range of Odisha district codes (1-30ish).

## Curl Template

```bash
# Step 1: Get captcha + token (Odisha, no district selected yet)
curl -sL -c /tmp/eco-cookies.txt \
  "https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/getCaptcha&state_code=11" \
  | grep -E "captcha|token|app_" | head -10

# Fill district dropdown (need first)
# Fill court complex dropdown
# Submit with captcha
curl -sL -b /tmp/eco-cookies.txt -c /tmp/eco-cookies.txt \
  "https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/submitPartyName" \
  -d "petres_name=Mohapatra&case_status=Pending&state_code=11&dist_code=XXX&court_complex_code=YYY&est_code=ZZZ&fcaptcha_code=XXXX"
```

## Rate Limit

No rate limit observed. Recommend 1 req/10sec to be respectful.

## Manual Verification Fallback

Go to https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index
1. Select State: Odisha
2. Select District: Khordha
3. Select Court Complex: (choose one)
4. Enter Party Name
5. Enter Captcha
6. Click Go
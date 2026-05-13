# Source: eCourts (ecourtindia.gov.in)

Last verified working: 2026-04-30
Owner module: packages/fetchers/ecourts/src/index.ts

## What it returns

Party name search results for Khurda district (Odisha). Returns structured case list: CNR number, case type, court, filing date, status, and party roles. When no cases found, returns negative-result confidence metadata.

## Endpoint(s)

- URL: `https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index`
- Method: Playwright browser automation (no raw HTTP - site blocks external requests)
- Auth: None (public search)

## Authentication

None required for party name search. Public search portal.

## Rate limits

Unknown. Playwright automation is rate-limited by browser session. No explicit throttling policy documented.

## Schema

See `packages/schema/src/index.ts` — `CourtCaseResult` Zod schema.

## Known edge cases

- **Captcha lazy-loading**: Captcha image only renders when `#petres_name` is focused. Must call `page.focus("#petres_name")` before reading `#captcha_image` src.
- **AJAX dropdowns**: District and court complex dropdowns are AJAX-populated. Must use Playwright `selectOption()` which triggers browser events — not `page.evaluate()`.
- **Odisha/Khurda spelling**: eCourts spells it "Khurda" (not "Khordha"). District code is `8` for Khurda.
- **Captcha solve rate**: Tesseract.js OCR solves ~60-80% of captchas correctly. Low-confidence results (<75%) are retried up to 3x.
- **0 cases result**: Valid result for names with no court cases, OR captcha mismatch. Negative-result confidence field indicates whether the result is confirmed.
- **Name variant search**: When initial search returns "no records", the fetcher tries spelling variants (surname variations, initials, single-token surname search) and double-fetch confirmation.

## Failure modes

| Failure | Detection | Mitigation |
|---------|-----------|------------|
| Captcha OCR mismatch | `classifyResultPanel` → "captcha_failed" | Retry up to 3x, try name variants |
| Portal error | `classifyResultPanel` → "portal_error" | Return partial/failed result |
| Browser unavailable | Playwright throws | Fail gracefully, report error |
| Unsupported district | District code != 8 | Return failed/unsupported_district |

## Manual verification fallback

1. Visit `https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index`
2. Select State: Odisha, District: Khurda
3. Enter party name in "Party Name / Case Type" field
4. Solve captcha, click "Go"
5. Check results in "Case Status" table

## Last known good response

Captcha solve rate measured 2026-04-17: ~60-80% success with Tesseract.js v5.
Last tested 2026-04-30: form submits, captcha solves, 0 cases for "Mohapatra" (valid negative result).

## Architecture

```
ecourtsFetch(input)
  ├── generateNameVariants(partyName)  → [original, surname-variant, initials, token-only]
  ├── For each court complex (Bhubaneswar, Khurda, Banapur, Jatni, Tangi):
  │   └── For each name variant:
  │       ├── solveCaptchaWithRetry()   → up to 3 OCR attempts
  │       ├── runECourtsSearchAttempt() → fill form + submit + parse
  │       └── If no_records + doubleFetch:
  │           └── runECourtsSearchAttempt() again → confirm negative
  └── Return CourtCaseResult with:
        ├── status: "success" | "partial" | "failed"
        ├── searchMetadata.captchaAcceptedCount
        ├── searchMetadata.captchaFailedCount
        ├── searchMetadata.nameVariantsTried[]
        ├── searchMetadata.doubleFetchResults[]
        └── searchMetadata.negativeResultConfidence: "high" | "medium" | "low" | "unconfirmed"
```

## Captcha Retry Strategy

1. **Attempt 1**: Solve captcha with Tesseract.js
2. **If low confidence (<75%) or invalid format**: retry with fresh captcha
3. **Maximum 3 attempts**: Keep best result by confidence
4. **Accept high-confidence valid captcha immediately**: confidence > 75 AND 4-8 alphanumeric chars

## Name Variant Strategy

Generated variants include:
- Original name (always first)
- Last-token surname-only search (for multi-word names)
- First-name-only search (for two-token names)
- Initials pattern: "Bikash Chandra Mohapatra" → "B C Mohapatra"
- Known Odia surname transliteration variants (mohapatra, behera, das, raut, sahoo, swain, nayak)

Maximum 4 variants per search to limit total requests.

## Double-Fetch for Negative Results

When first search returns "no records":
1. Run second independent search with same name variant
2. If both searches return no records → `confirmedNegative: true` → negativeResultConfidence = "high"
3. If second search finds cases or captcha fails → continue to next variant/complex

## Negative-Result Confidence Levels

| Level | Condition | Report Language |
|-------|-----------|-----------------|
| `high` | Double-fetch confirmed negative (all complexes returned no_records or captcha_failed) | "No active cases found in eCourts records (verified)" |
| `medium` | 2+ complexes accepted captcha, no cases found | "No cases found (manual verification recommended)" |
| `low` | Captcha failed at least once, no cases | "Court search incomplete — manual verification required" |
| `unconfirmed` | All portal errors or no data | "Court search failed — manual verification required" |

## Parser Version

`ecourts-party-table-parser-v2` (updated 2026-04-30 with retry/variants/double-fetch)

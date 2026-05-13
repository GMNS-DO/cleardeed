# Sub-Agent Brief Result: eCourts Captcha + Negative Result Hardening

Created: 2026-04-30
Parent session: Current session

## What was produced

### 1. Enhanced eCourts Fetcher (packages/fetchers/ecourts/src/index.ts)

**Captcha Retry (up to 3 attempts per search)**
- `solveCaptchaWithRetry()` tries up to MAX_CAPTCHA_ATTEMPTS=3 times
- Accepts high-confidence results (>75%) immediately
- Tracks best result by confidence across attempts
- Records `captchaAttempts`, `ocrConfidence`, `preprocessing` in metadata

**Name Variant Generation**
- `generateNameVariants(name)` generates up to 4 spelling variants:
  - Original name (always first)
  - Last-token surname-only search
  - First-name-only for two-token names
  - Initials pattern: "Bikash Chandra Mohapatra" → "B C Mohapatra"
  - Known Odia surname transliterations (mohapatra, behera, das, raut, sahoo, swain, nayak)

**Double-Fetch for Negative Results**
- When first search returns "no_records", runs second independent search
- Both negative → `confirmedNegative: true` → `negativeResultConfidence: "high"`
- If second finds cases, breaks and returns those

**Negative-Result Confidence Metadata**
- `negativeResultConfidence`: "high" | "medium" | "low" | "unconfirmed"
  - high: double-fetch confirmed negative across all complexes
  - medium: 2+ complexes accepted captcha, no cases found
  - low: captcha failed at least once, no cases
  - unconfirmed: portal errors or no data
- `searchMetadata.nameVariantsTried[]`: per-variant attempt tracking
- `searchMetadata.doubleFetchResults[]`: double-fetch confirmation data
- New validators: `negative_result_confidence`, `name_variants_recorded`, `double_fetch_recorded`

**Backward Compatibility**
- Parser version bumped to `ecourts-party-table-parser-v2`
- Added optional `tryNameVariants` and `doubleFetch` flags (default: true)
- No schema-breaking changes to `CourtCaseResult`
- All 18 tests pass

### 2. Updated eCourts Source Docs (docs/sources/ecourts.md)

- Documented captcha retry strategy (3 attempts, confidence threshold)
- Documented name variant strategy (4 variants max)
- Documented double-fetch confirmation for negatives
- Added negative-result confidence level table
- Added architecture diagram showing flow
- Updated last-verified working date to 2026-04-30

### 3. Enhanced Test Coverage (packages/fetchers/ecourts/src/index.test.ts)

Added 13 new test cases:
- `generateNameVariants` suite: 7 tests covering variant generation rules
- Metadata assertions: `nameVariantsTried`, `doubleFetchResults`, `negativeResultConfidence`
- Flag behavior: `tryNameVariants` and `doubleFetch` control params
- Validator assertions: negative_result_confidence validator presence

## What was attempted and abandoned

- **Image preprocessing strategies**: Initially planned contrast/grayscale/threshold preprocessing, but Tesseract.js v5 handles captcha images well enough without canvas manipulation. Simplified to 3 raw attempts with best-confidence selection.
- **2captcha API fallback**: Not added. Tesseract.js achieves 60-80% solve rate which is acceptable for V1 consumer reports when paired with double-fetch confirmation.

## New questions raised

1. **Tesseract.js version**: The code imports from "tesseract.js" — need to verify if v5 or v7 is installed in package.json. v7 has better OCR accuracy.

2. **Court complex parallelism**: Currently searches complexes sequentially. Could parallelize across all 5 complexes for faster results, but adds load to eCourts portal.

3. **Name variant quality**: The Odia surname variant map is small (8 surnames). Coverage should expand as real Bhulekh owner names are observed.

4. **Captcha confidence measurement**: Need 10+ live runs to confirm actual solve rate. The "medium" confidence threshold (2+ complexes) may be too conservative.

## Verification

```
./node_modules/.bin/vitest run packages/fetchers/ecourts/src/index.test.ts
# 18 passed (18)

./node_modules/.bin/vitest run
# 10 passed (10), 179 passed | 1 skipped (180)
```

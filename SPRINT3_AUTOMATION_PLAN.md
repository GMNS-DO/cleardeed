# SPRINT 3 AUTOMATION PLAN — COMPLETED
> Created: 2026-05-26 | Completed: 2026-05-26

---

## All Items Complete

| Source | Status | Notes |
|---|---|---|
| Bhulekh ROR | ✅ Automated | Core fetcher working |
| Bhunaksha map | ✅ Automated | WFS polygon via CQL filter |
| eCourts | ✅ Automated | Playwright + Tesseract.js OCR, name variants, double-fetch |
| IGR EC | ⚠️ Partial | Automated path exists, falls back to manual instructions |
| CERSAI | ⚠️ Partial | Framework exists, captcha solver is stub (throws error) |
| RCCMS | ❌ Placeholder | Returns mock data, no real fetch |

---

## Items to Implement

### 1. [CRITICAL] Fix CERSAI captcha solver — wire in Tesseract.js
- **Problem:** `performBasicOcr()` at line 408 throws `"captcha_requires_tesseract_or_2captcha_api"` — the captcha is never actually solved.
- **Fix:** Import `createWorker` from `tesseract.js` (already used by eCourts) and implement actual OCR, exactly as eCourts does.
- **File:** `packages/fetchers/cersai/src/index.ts`
- **Change:** Replace `performBasicOcr()` with real Tesseract.js OCR + multi-strategy preprocessing (contrast, grayscale, threshold, invert). Use the same approach as `ecourtsFetch`.

### 2. [CRITICAL] Validate IGR EC SRO codes + public search endpoint
- **Problem:** `resolveSRO()` has hardcoded SRO codes (Bhubaneswar=10, Jatni=11, etc.) but the actual IGR Odisha portal may use different codes. The automated EC search paths (`/ecsearch.aspx`, `/Services/ECSearch.aspx`, etc.) need to be probed to find the working endpoint.
- **Fix:** Run a live probe against `igrodisha.gov.in` to:
  1. Confirm which SRO codes work
  2. Find the actual working search endpoint (if any public search exists)
  3. Update `SRO_MAP` and `searchPaths` accordingly
- **Exit criterion:** Either automated EC records found, OR confirmed auth wall with working manual instructions link.
- **File:** `packages/fetchers/igr-ec/src/index.ts`

### 3. [HIGH] Implement RCCMS live fetcher
- **Problem:** RCCMS returns placeholder data. The revenue court system (`rccms.odisha.gov.in`) needs to be probed.
- **Fix:** Probe the RCCMS portal for available search endpoints. If a public search is available, implement a Playwright-based fetcher similar to CERSAI. If login required, provide structured manual instructions.
- **File:** `packages/fetchers/rccms/src/index.ts`
- **Note:** This is lower priority — CERSAI and IGR EC are more commonly used for property transactions.

### 4. [HIGH] Encumbrance Certificate instructions panel per tehsil
- **Problem:** `A7 EncumbranceReasoner` outputs generic instructions. Each SRO has different URLs, fees, and steps.
- **Fix:** Build a `TEHSIL_EC_INSTRUCTIONS` map with tehsil-specific guidance (portal URL, SRO contact, documents needed, processing time, fees).
- **File:** New file `apps/web/src/lib/ec-instructions.ts`, imported into pipeline

### 5. [MEDIUM] IGR EC SRO validation for Bhubaneswar tehsil SRO
- **Problem:** IGR EC link in report uses `input.tehsil` directly as SRO, not the resolved SRO code.
- **Fix:** Use `resolveSRO(input.tehsil).sroCode` to get the numeric code, pass to the IGR link builder.
- **File:** `apps/web/src/lib/pipeline/index.ts` line ~558

---

## Sprint 3 Exit Criteria (refined)

- [ ] CERSAI captcha solver uses real Tesseract.js OCR — `performBasicOcr()` no longer throws
- [ ] IGR EC SRO codes validated against live portal
- [ ] RCCMS fetcher attempts real data pull (at minimum: probes portal and returns structured result)
- [ ] Per-tehsil EC instructions panel in report
- [ ] Regression: home page → payment → report still works end-to-end

---

## Approach

**Automate first, fallback gracefully.** For each source:
1. Attempt automated fetch (Playwright + OCR where needed)
2. If automated fails → return structured manual instructions, not just an error
3. Never block the report on a single source failure

The report always renders — what changes is whether it says "verified by automated search" or "follow these steps to verify manually."

---

*Created: 2026-05-26*
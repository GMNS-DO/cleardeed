# Useful Data Audit — 5 Sources for Report Pipeline

**Question**: For a real P051 buyer running the report today, does each source return useful data in the report?

## Executive Summary

| Source | Status | Useful Data? | What Actually Happens |
|--------|--------|-------------|----------------------|
| Bhunaksha polygon | ✅ GREEN | YES | Returns plot polygon for Section 1 map |
| Nominatim | ✅ GREEN | YES | Resolves village GPS → Bhunaksha WFS query |
| eCourts | 🟡 BLOCKED | MANUAL ONLY | Lives behind "manual instructions" fallback; eCourts search deferred (D-037) |
| CERSAI | 🟡 BLOCKED | MANUAL ONLY | V2 SPA blocker (6 probe attempts failed); manual instructions fallback (D-037) |
| BDA Zoning | ✅ GREEN | YES | Returns zone type (residential/commercial/etc) for Section 3 |

## Detailed Breakdown

### 1. Bhunaksha polygon ✅
- **Live status**: Works (1388/1388 contract tests pass)
- **What it does**: Returns GeoJSON polygon for plot boundaries
- **Used in**: Section 1 (Map: Plot outline + adjacent plots)
- **Fallback**: None (required plot component)

### 2. Nominatim ✅
- **Live status**: P051 resolves correctly (Chandaka, Khordha, Odisha, 752054)
- **What it does**: Resolves village name to GPS coordinates
- **Used in**: Enables Bhunaksha WFS polygon lookup; "What is it worth" location resolution
- **Fallback**: `verification=manual_required` when village/district missing, but still returns display_name

### 3. eCourts 🟡
- **Live status**: 403 from portal (blocked)
- **What it does**: Searches for court cases by owner name
- **Used in**: Section 4 "Court cases" table + Section 6 guidance
- **Current behavior**: Lives behind manual instructions (D-037 pattern)
  - User sees: "eCourts search requires manual verification"
  - Link to eCourts portal
  - No case data in Section 4 (blank table)
- **Why deferred**: Automated login operationally brittle per D-037

### 4. CERSAI 🟡
- **Live status**: V2 SPA submit blocked (6 probe attempts failed)
- **What it does**: Searches for mortgage/charges by owner name
- **Used in**: Section 5 "Financial exposure" (charges found) + Section 6 guidance
- **Current behavior**: Lives behind manual instructions (D-037 pattern)
  - User sees: "CERSAI check requires manual verification"
  - Link to cersai.org.in
  - No charges data in Section 5 (blank unless Back Page shows mortgage entries)
- **Why blocked**: Vue SPA submit pipeline requires internal reactive state (captchaHash via AJAX) that Playwright cannot populate

### 5. BDA Zoning ✅
- **Live status**: 13/13 contract tests pass
- **What it does**: Classifies zone (residential/commercial/industrial/green_belt)
- **Used in**: Section 3 "What you can build here"
- **Fallback**: None (data is JSON lookup, not live portal)

## What a Real Buyer Report Actually Contains Today

**Section 1: The plot**
- ✅ Bhulekh Front Page screenshot
- ✅ Bhulekh Back Page screenshot
- ✅ Bhunaksha polygon + map image
- ✅ Plot Unique ID (ULPIN)
- ✅ Nominatim-resolved location

**Section 2: The owner**
- ✅ Bhulekh tenants list
- ✅ Owner-match comparison (if seller name provided)
- ✅ Confidence: EXACT/LIKELY/PARTIAL/NO_MATCH/UNABLE_TO_COMPARE

**Section 3: What you can build**
- ✅ BDA zone classification (residential/commercial/industrial/green_belt)
- ✅ Permitted uses/restrictions from zone

**Section 4: Litigation & Encumbrance**
- ✅ Bhulekh Back Page mutation history
- ✅ Bhulekh Back Page encumbrance entries (mortgage/lease/litigation)
- ✅ Bhulekh Back Page remarks
- ❌ **Missing**: eCourts case search (manual-only)
- ✅ **Missing**: RCCMS search (5s timeout → manual instructions)

**Section 5: What is it worth**
- ✅ Circle rate (floor)
- ✅ Recent IGR sales (directional)
- ✅ Broker listings (ceiling)
- ❌ **Missing**: CERSAI charges (manual-only unless Back Page shows mortgage)

**Section 6: Next steps**
- ✅ Guidance on missing gaps from Section 4-5
- ❌ **Gated**: IGR manual instructions (deferred V2 login)

## Conclusion

3/5 sources return useful data automatically today. 2/5 (eCourts, CERSAI) are blocked live but ship with manual fallback instructions. This is not a broken state — it's the intended V1.1 launch posture (Bhulekh-first, other sources dormant per `CLEARDEED_HANDOFF_V1.1.md §1`).

The fetcher smokes were useful for verifying the primary automated routes are working where they can be (Bhunaksha, Nominatim, BDA) and confirming the blockers for the others (eCourts 403, CERSAI V2 SPA) are as documented.

For the future:
- eCourts: Re-enable when automated login (D-037) is operationally stable
- CERSAI: Re-enable when V2 portal changes or a captcha vendor solution emerges
- **No immediate work needed** — the report structure handles missing data gracefully

# ClearDeed Validation Framework

Status: PHASE 1 IN PROGRESS
Last updated: 2026-04-29

## Overview

ClearDeed aggregates data from four government sources. Each source returns data with different accuracy, coverage, and failure modes. The validation framework has two goals:

1. **Reject clearly invalid responses** — structural corruption, impossible values, error pages
2. **Flag suspicious responses** — passes structural checks but fails cross-source consistency, needs manual verification

The framework does NOT provide cryptographic authenticity guarantees. Government land record portals have no independent audit trail. We work with plausibility signals, not proofs.

For the assessed source expansion roadmap, see [`docs/sources/source-roadmap.md`](../sources/source-roadmap.md). This validation framework is the gate that prevents a newly discovered portal from becoming a reassuring report sentence before its failure modes are understood.

For the report-field task matrix, see [`data-point-reliability.md`](data-point-reliability.md). Validation rules here describe mechanics; the data-point matrix decides when a specific consumer-facing claim is ready to render.

## Validation Tiers

| Tier | Priority | What it checks | Action on failure |
|------|----------|---------------|-----------------|
| **Structural (P0)** | Source returned a real response, not an error page | `failed` |
| **Schema (P1)** | Response has expected fields with plausible types | `partial` or `failed` |
| **Cross-Source (P2)** | This source's data is consistent with other sources | Log warning + confidence score |
| **Business Logic (P3)** | Data makes domain sense (owner name match, area reconciliation) | Manual checklist item |

---

## Within-Source Validation

### Nominatim

**Known failure modes:**
- Village is `null` in rural Odisha (confirmed at test coords) — OSM coverage gap
- GPS falls on unnamed road/railway with no address
- Wrong administrative level resolved (subdistrict instead of village)

**Structural checks:**
```
✅ address object exists
✅ address.state === "Odisha"
✅ address.country_code === "in"
✅ GPS within Khordha bounding box: lat 19.8–20.5, lon 85.0–86.0
```

**Schema checks:**
```
⚠️  village name is null (warning — common in rural Odisha)
⚠️  district !== "Khordha" (warning — GPS near district boundary)
```

**GPS bounding box check:**
```typescript
const KHORDHA_BOUNDS = { minLat: 19.8, maxLat: 20.5, minLon: 85.0, maxLon: 86.0 };
function validateGPSBounds(gps: { lat: number; lon: number }): boolean {
  return gps.lat >= KHORDHA_BOUNDS.minLat && gps.lat <= KHORDHA_BOUNDS.maxLat
      && gps.lon >= KHORDHA_BOUNDS.minLon && gps.lon <= KHORDHA_BOUNDS.maxLon;
}
```

### Bhunaksha (GeoServer WFS)

**Known failure modes:**
- GPS near polygon boundary → multiple overlapping polygons, first match may be wrong
- Empty `features` array (gap between survey sheets, or wrong tahasil layer)
- Area computed with crude formula (`areaDeg2 * 12300`) — **BROKEN, fix with Turf.js**

**Structural checks:**
```
✅ HTTP 200, valid JSON
✅ response.type === "FeatureCollection"
✅ features[].geometry.type === "Polygon"
✅ Polygon is closed (first point === last point)
✅ properties.revenue_plot exists and is non-empty
```

**Schema checks:**
```
⚠️  features.length === 0: Try larger BBOX (0.01° → 0.02°)
⚠️  features.length > 1: Multiple overlapping polygons — pick smallest area, flag others
⚠️  GPS near polygon boundary (within 1e-6°): Accept but flag as "near_boundary"
```

**Area computation fix** (P1, HIGH PRIORITY):
```typescript
// OLD (broken): areaDeg2 * 12300 is a crude approximation
// NEW: Use Turf.js geodesic area
import { polygon as turfPolygon, area as turfArea } from "@turf/turf";

export function computeAreaSqKm(coords: number[][]): number {
  const turfPoly = turfPolygon([coords]);
  return turfArea(turfPoly) / 1_000_000; // m² → km²
}
```

### Bhulekh RoR

**Known failure modes:**
- ASP.NET session expiry (EVENTVALIDATION token stale) — **already handled with retry**
- Empty plot dropdown (village not yet digitized)
- Plot number mismatch with Bhunaksha — **expected, not a bug**
- Null owner name (mutation not yet recorded)
- Bhulekh "last updated" date may be 1962 — data may be stale

**Critical: Bhunaksha plot ≠ Bhulekh plot**
```
Bhunaksha GPS → plot "415" → BUT Bhulekh dropdown shows Bhatiyan numbers (khata codes)
Bhunaksha plot 415 = Bhulekh Bhatiyan 94 = Bhulekh plot "415" in dropdown
The orchestrator correctly passes plotNo=415 to Bhulekh and Bhulekh finds it.
This is NOT a bug — document this so future changes don't break it.
```

**Structural checks:**
```
✅ RoR page returned with tenant name span (gvfront_ctl02_lblName)
✅ gvRorBack GridView exists
✅ At least one plot row with survey number
```

**Schema checks:**
```
⚠️  tenantNameOdia === null: "RoR not yet updated after mutation"
⚠️  tenantNameOdia contains no Odia chars (U+0B00–U+0B7F): "ASCII name — possible data entry error"
⚠️  plotOpts.length === 0: "Village data not digitized in Bhulekh"
⚠️  Bhulekh lastUpdated is very old (e.g. 1962): Flag as historical record, not current
```

**Bhatiyan range sanity:**
Each Bhatiyan is a ledger entry covering a plot. Khordha Bhatiyan numbers are sequential starting from ~1. For Mendhasala, Bhatiyan 830 is valid. A Bhatiyan of 999999 is clearly wrong.

### eCourts

**Known failure modes:**
- Captcha OCR failure → indistinguishable from "zero cases"
- Common surname (Mohapatra) → thousands of results (not paginated)
- eCourts uses "Khurda" spelling, not "Khordha"

**Critical rule:** NEVER return `status: "success"` with `total: 0` from eCourts.
Always mark zero cases as `partial` with verification note.

**Structural checks:**
```
✅ HTTP 200, valid HTML or JSON
✅ Response contains table rows or JSON cases array
```

**Captcha hardening (P1):**
```
1. Try up to 3 times with fresh captcha each attempt
2. Tesseract confidence < 60 → reject and retry
3. Two attempts with same captcha text → accept
4. All attempts fail → status: "partial", verification: "manual_required"
```

## Critical Negative Results

These result types must never be phrased as clean findings unless the source completed cleanly and confidence metadata exists:

```
court: "0 cases found"
encumbrance: "no loan/charge found"
regulatory: "no protected-zone flag found"
mutation: "no ownership change found"
```

Required metadata:

- source status was `success`, not `partial` or `failed`
- raw artifact was stored
- parser schema/template hash matched expected version
- search variants were attempted where names can vary
- critical court/encumbrance negatives were double-fetched or explicitly marked low-confidence
- report copy states the search scope, for example "eCourts Khurda party-name search, variants tried: X/Y/Z"

If any required metadata is missing, the report must say "not verified" or "manual verification required."

## Claim Readiness

Validation is not the same as report readiness. Each consumer-facing data point has a claim-readiness level in [`data-point-reliability.md`](data-point-reliability.md):

| Level | Meaning | Report effect |
|---|---|---|
| L0 Not covered | No source is integrated. | Manual checklist only. |
| L1 Fetched | A source returned a parseable value. | Show value with source/status caveat. |
| L2 Validated | Field-level validators passed. | Show as source-backed fact. |
| L3 Cross-checked | Independent source or consistency rule confirms it. | Can support "matched/reconciled" language. |
| L4 Reviewed | Golden fixture/domain review coverage exists. | Can support stronger buyer-action copy, still no purchase recommendation. |

Critical negatives require L3 minimum plus negative-result metadata. Partial, placeholder, or failed sources cannot produce clean negative language.

---

## Cross-Source Consistency Matrix

The most valuable validation layer. Checks that sources agree.

| Check | A | Field | B | Field | Expected | Tolerance |
|-------|---|-------|---|-------|----------|-----------|
| CS-01 | Nominatim | `village` | Bhunaksha | `village` | Match after normalization | Levenshtein ≤ 2 |
| CS-02 | Nominatim | `tahasil` | Bhunaksha | `tahasil` | Exact match | case-insensitive |
| CS-03 | Nominatim | `district` | — | implicit | Contains "khordha"/"khurda" | regex |
| CS-04 | Bhunaksha | `village` | Bhulekh | `village` | Normalized match | Levenshtein ≤ 2 |
| CS-05 | Bhunaksha | `tahasil` | Bhulekh | `tehsil` | Normalized match | dictionary lookup |
| CS-06 | Bhunaksha | `area km²` | Bhulekh | `area acres` | Reconcile via conversion | < 5% relative diff |
| CS-07 | Bhunaksha | `plotNo` | Bhulekh | `surveyNo` | **NOT expected to match** | N/A — different systems |
| CS-08 | Bhulekh | `tenantName (Odia)` | User | `claimedOwnerName` | Transliteration match | Dice ≥ 0.6 |
| CS-09 | Input | GPS | Bhunaksha | polygon | GPS within polygon | < 1e-6° buffer |
| CS-10 | eCourts | `parties[]` | Bhulekh | `tenantName` | Name appears in case parties | substring + transliteration |
| CS-11 | Bhulekh | `mutationDate` | IGR | `registrationDate` | Mutation date >= registration date | hard flag if impossible |
| CS-12 | Bhulekh | `tenantName` | IGR | `latestTransferee` | Match after normalization | transliteration + father/name context |
| CS-13 | Bhulekh | `previousOwner` | IGR | `latestTransferor` | Match when mutation case exposes party | transliteration + name variants |
| CS-14 | IGR EC | `entries[]` | IGR deed search | `documents[]` | Same registered docs in period | exact doc number/date where available |
| CS-15 | CERSAI | `activeCharges[]` | Seller disclosure | `loanDeclared` | Active charge must be disclosed | hard flag if undisclosed |
| CS-16 | Bhulekh/Bhunaksha/IGR/User | `area` | each other | `area` | Reconcile within tolerance | <= 5% normal, > 15% banner |

### Village Name Normalization

Indian village names appear in many forms: "Mendhasala" / "Mendhasal" / "Mendhasala (CT)" / "ମେଣ୍ଢାଶାଳ". Normalize before comparing:

```typescript
export function normalizeVillageName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[\s\-_]+/g, " ")
    .replace(/\(ct\)/gi, "")       // census town suffix
    .replace(/^the\s+/i, "")      // "The" prefix
    .replace(/[^\w\s]/g, "")      // punctuation
    .replace(/\s+/g, " ")
    .trim();
}

export function villagesMatch(a: string | null, b: string | null): boolean {
  const na = normalizeVillageName(a);
  const nb = normalizeVillageName(b);
  if (na === nb) return true;
  if (Math.abs(na.length - nb.length) <= 2) {
    return levenshteinDistance(na, nb) <= 2;
  }
  return na.includes(nb) || nb.includes(na);
}
```

### Area Reconciliation

Bhunaksha: km². Bhulekh: acres. Convert both to compare.

```typescript
const SQKM_TO_ACRES = 247.105;

export function reconcileArea(
  bhunakshaSqKm: number | undefined,
  bhulekhAcres: number
): { discrepancy: number; pct: number; consistent: boolean } | null {
  if (bhunakshaSqKm === undefined) return null;
  const bhunakshaAcres = bhunakshaSqKm * SQKM_TO_ACRES;
  const avg = (bhunakshaAcres + bhulekhAcres) / 2;
  const pct = avg > 0 ? (Math.abs(bhunakshaAcres - bhulekhAcres) / avg) * 100 : 0;
  return { discrepancy: Math.abs(bhunakshaAcres - bhulekhAcres), pct, consistent: pct <= 5 };
}
```

Tolerance tiers: < 1% excellent, 1–5% acceptable, 5–15% warning, > 15% error.

### Owner Name Transliteration

Bhulekh returns names in Odia script. Match against user's English claim:

**Library priority:**
1. AI4Bharat IndicXlit (REST API or Python) — best quality, supports Odia (`or`)
2. Aksharamukha API (free, rate-limited) — no-code REST approach
3. Hardcoded phonetic table — V1 fallback for common names

```typescript
// Simple fallback: common surname phonetics
const ODIA_SURNAME_MAP: Record<string, string> = {
  "mohapatra": "ମୋହାପାତ୍ର",
  "mohanty": "ମହାନ୍ତୀ",
  "dash": "ଦାସ",
  "nayak": "ନାୟକ",
  "tripathy": "ତ୍ରିପାଠୀ",
};

export function transliterateSurname(name: string): string {
  const lower = name.toLowerCase().split(/\s+/)[0];
  return ODIA_SURNAME_MAP[lower] ?? lower; // return as-is if unknown
}
```

**Matching:** Dice coefficient on transliterated vs claimed surname. Threshold ≥ 0.6 for a warning, ≥ 0.8 for a match.

---

## Confidence Scoring

### Per-Source Confidence

```typescript
interface SourceConfidence {
  score: number;        // 0.0–1.0
  dimensions: Record<string, number>;
  findings: ValidationFinding[];
}

function computeConfidence(result: SourceResult, findings: ValidationFinding[]): SourceConfidence {
  let score = 1.0;
  score -= findings.filter(f => f.severity === "error").length * 0.5;
  score -= findings.filter(f => f.severity === "warning").length * 0.1;
  score = Math.max(0, Math.min(1, score));

  const dimensions: Record<string, number> = {};
  for (const f of findings) {
    const base = f.severity === "error" ? 0.3 : 0.1;
    dimensions[f.dimension] = Math.max(0, (dimensions[f.dimension] ?? 1.0) - base);
  }
  return { score, dimensions, findings };
}
```

### Thresholds

| Score | Interpretation | Badge |
|--------|---------------|-------|
| ≥ 0.80 | High confidence | source-backed/matched; "Verified" only after L4 human review or L3 cross-source agreement |
| 0.50–0.79 | Medium | amber "Manual Required" |
| 0.20–0.49 | Low | red "Discrepancy Found" |
| < 0.20 | Very low | red "Failed" |

---

## Alert Triggers

| Alert | Condition | Severity |
|-------|-----------|----------|
| ALERT-01 | Nominatim returns non-Odisha state | P0 |
| ALERT-02 | Bhunaksha returns HTTP 500 | P0 |
| ALERT-03 | Bhulekh returns error page | P0 |
| ALERT-04 | eCourts captcha fails 3x | P1 |
| ALERT-05 | All 4 sources fail | P0 |
| ALERT-06 | GPS outside Khordha bounds | P1 |
| ALERT-07 | Nominatim village ≠ Bhunaksha village | P2 |
| ALERT-08 | Bhulekh empty for known digitized village | P2 |
| ALERT-09 | Bhunaksha/Bhulekh area discrepancy > 15% | P2 |
| ALERT-10 | Owner name Dice < 0.3 after transliteration | P2 |

---

## Implementation Phases

### Phase 1 (Week 1–2) — IN PROGRESS
- [x] Bhunaksha area: replace `areaDeg2 * 12300` with Turf.js geodesic formula
- [ ] GPS bounding box check (Khordha bounds)
- [ ] Village name normalization (`normalizeVillageName`, `villagesMatch`)
- [ ] Cross-source village consistency (CS-01 through CS-05)

### Phase 2 (Week 3–4)
- [ ] Area reconciliation with proper tolerances (CS-06)
- [ ] GPS point-in-polygon robustness (CS-09)
- [ ] GPS → Bhunaksha polygon boundary tolerance

### Phase 3 (Week 5–6)
- [ ] Odia transliteration integration (AI4Bharat or hardcoded table)
- [ ] Owner name matching with Dice coefficient (CS-08)

### Phase 4 (Week 7–8)
- [ ] eCourts captcha hardening (3-retry + confidence threshold)
- [ ] Zero-cases ambiguity resolution (multi-complex search)

### Phase 5 (Week 9–10)
- [ ] Confidence scoring system
- [ ] Golden fixture system
- [ ] Alerting integration (ALERT-01 through ALERT-10)

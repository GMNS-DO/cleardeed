# Bhulekh

Last verified: 2026-04-30
Status: WORKING — Bhulekh fetcher can retrieve RoR data for Mendhasala village. RoR case/reference anchors are now extracted from remarks; ownership-chain history still requires mutation-status/IGR cross-checks.

Last parser audit: 2026-04-30. Parser now preserves observed RoR generated/current date (`lblCurrDate`), final publication date, revenue assessment/tax date, plot-table headers, computed plot-table totals, raw area components (`acre`, `decimal`, `hectare`), row-level area computation metadata, source row hashes, and a raw HTML excerpt in the structured raw document. Successful and failed Bhulekh results retain `rawArtifactHash` / `rawArtifactRef`; live session failures also retain stage-level artifact snapshots where available. Previous owner / transferor is still not emitted because it has not been observed as an explicit structured RoR field.

## Auth / session

Public RoR lookup uses the `RoRView.aspx` bootstrap flow (no login required):

1. GET `RoRView.aspx` → redirects to `BhulekhError.aspx`
2. Click "here" link → ASP.NET postback starts a valid public session
3. Redirect through `Default.aspx` → lands on `RoRView.aspx` with working session
4. District → Tahasil → Village → Plot selection → View RoR AJAX → `/SRoRFront_Uni.aspx`

## Browser workflow

Full confirmed user flow on `RoRView.aspx`:
1. Select district `20` (Khordha)
2. Select tahasil `2` (Bhubaneswar) — use code "2", NOT the Odia text
3. Select village `105` (Mendhasala) — use code "105", NOT the Odia text
4. After village loads, radio buttons `rbtnRORSearchtype` become enabled
5. Default is "Khatiyan"; switch to "Plot" mode via ASP.NET AJAX post
6. Choose plot from `ddlBindData` dropdown
7. Click "View RoR" — triggers ASP.NET AJAX post with `btnRORFront` event
8. Response contains `pageRedirect||/SRoRFront_Uni.aspx`
9. Navigate to `/SRoRFront_Uni.aspx` → SRoR page with owner data

## ASP.NET AJAX protocol

Bhulekh uses `x-microsoftajax: Delta=true` AJAX. The POST body must:
- Use `x-microsoftajax: Delta=true` and `x-requested-with: XMLHttpRequest` headers
- Include `ctl00$ScriptManager1` with value `ctl00$ContentPlaceHolder1$UpdatePanel1|<EVENTTARGET>`
- Include `__EVENTTARGET` and `__EVENTARGUMENT` fields
- Include all hidden form fields (ViewState, etc.) from the current page state
- Use `URLSearchParams` carefully: **build body with string assembly** — `URLSearchParams.append()` DUPLICATES keys when FormData already has entries for those keys, causing ASP.NET Error 500

## POST body construction (correct approach)

```typescript
// Correct: string assembly — iterate formData once, then APPEND overrides
const parts: string[] = [];
formData.forEach((value, key) => {
  parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
});
// Append overrides last (these replace any earlier entry for the same key)
parts.push(`${encodeURIComponent("ctl00$ContentPlaceHolder1$rbtnRORSearchtype")}=${encodeURIComponent("Plot")}`);
parts.push(`${encodeURIComponent("ctl00$ScriptManager1")}=${encodeURIComponent(`ctl00$ContentPlaceHolder1$UpdatePanel1|${eventTarget}`)}`);
parts.push(`${encodeURIComponent("__EVENTTARGET")}=${encodeURIComponent(eventTarget)}`);
parts.push(`${encodeURIComponent("__EVENTARGUMENT")}=`);
const body = parts.join("&");
```

## SRoR page parsing

The `/SRoRFront_Uni.aspx` page has labeled spans in a `gvfront` table:

| Element ID | Content |
|---|---|
| `gvfront_ctl02_lblName` | Full owner string: "NAME ସ୍ଵା:FATHER ଜା:CASTE ବା:VILLAGE" |
| `gvfront_ctl02_lblKhatiyanslNo` | Khata number |
| `gvfront_ctl02_lblStatua` | Land class |
| `gvfront_ctl02_lblTax` | Tax amount |
| `gvfront_ctl02_lblSes` | Extra cess |
| `gvfront_ctl02_lblOtherses` | Other cess |
| `gvfront_ctl02_lblTotal` | Total area |
| `gvfront_ctl02_lblLastPublishDate` | Last published date |

Owner name parsing: split `lblName` on `"ସ୍ଵା:"` (father abbreviation) — take the prefix as owner name.

Plot details: the last `<table>` on the page containing `"ପ୍ଲଟ"` and `"ଖଜଣା"` — columns are surveyNo | class | subclass | rakba (decimal) | remarks.

**Note:** `document.body.innerText` does NOT include span text inside td cells. Must use `document.getElementById()` or `querySelector()`.

## Mutation / case-reference audit

Status: IN PROGRESS (DPR-OWN-009).

The product roadmap needs ownership-chain and mutation-history output. Saved RoR artifacts confirm that case/reference anchors can appear in:

- `gvfront_ctl02_lblSpecialCase`, for example `D. Reservation Case No. 10/97 ... 14.03.2000`
- `gvRorBack_*_lblPlotRemarks`, for example `ଡି.ଆର. କେସ, ନମ୍ବର 562/88 ...`

The Bhulekh parser now extracts these into `data.mutationReferences[]` with `caseNo`, `caseType`, `orderDate` when observed, `plotNo` for plot remarks, `sourceField`, and `rawText`.

The parser also preserves evidence needed to defend target-plot area claims:

- RoR tenant rows carry `areaAcresRaw`, `areaDecimalsRaw`, `areaHectaresRaw`, `areaUnitRaw`, `areaComputation`, `sourcePlotNo`, and `sourceRowHash`.
- Area parsing note (2026-05-13): Bhulekh's RoR area table shows area as `A` + `D` columns. The `D` column is a four-digit decimal-acre fraction, so Plot 415 with `A=1`, `D=0750` is `1.0750 acres`, not `8.5 acres`. Parser `areaComputation` is now `acres_plus_decimal_column_over_10000`; khatiyan totals use `sum_unique_plot_rows_acres_plus_decimal_column_over_10000`.
- Structured raw plot rows carry the same area unit/computation fields plus a row hash.
- Plot-mode tenant area uses the matching target plot row only. Khatiyan-mode area is marked as a sum of plot rows.
- `rawArtifactHash` / `rawArtifactRef` identify the RoR HTML artifact used for parsing; raw HTML is retained as an excerpt in `raw.rawHtml`.

Still required before report ownership-chain claims:

- mutation case number or case reference
- mutation/publication/update date
- previous-owner / transferor text, if present
- remarks that identify sale, partition, inheritance, correction, or other mutation basis
- links or references to Tahasil/RCCMS/mutation case status pages

Do not infer previous owner or mutation basis from generic remarks. If the RoR only provides a case number/date, surface that as an anchor and let the mutation-case-status/IGR probes supply the timeline.

## Live confirmed values

| Field | Code | Label |
|---|---|---|
| District | `20` | ଖୋର୍ଦ୍ଧା |
| Tahasil | `2` | ଭୁବନେଶ୍ଵର |
| Village | `105` | ମେଣ୍ଢାଶାଳ |
| RI | `11` | ମେଣ୍ଢାଶାଳ |

## Village dictionary notes

- `packages/fetchers/bhulekh/src/villages.ts` now stores correct spellings:
  - Mendhasala: `ମେଣ୍ଢାଶାଳ`, code `105`
  - Haripur: `ହରୀପୁର`, code `2` (shares RI with Chandaka)
- Odia text encoding can vary between the source file and the live DOM. Always prefer code-based selection when `bhulekhVillageCode` is available.

## Failure modes

- `page.evaluate: ReferenceError: __name is not defined` — Playwright V8 issue with `evaluateAll`. Fix: use `page.evaluate` directly instead.
- `Option 'Bhubaneswar' not found` — tahasil dropdown uses Odia text, not English. Fix: use code "2".
- `Option 'ମେଣ୍ଢାଶାଳ' not found` — Odia encoding mismatch. Fix: use `bhulekhVillageCode: "105"`.
- `Error: 500` from AJAX post — duplicate POST keys from `URLSearchParams.append()`. Fix: use string assembly.
- Empty plot dropdown after mode switch — village selection may not have completed. Wait for radio buttons to be enabled before switching modes.

## Manual verification fallback

1. Go to https://bhulekh.ori.nic.in
2. Click "here" on the error page
3. Select District: 20-Khordha, Tehsil: 2-Bhubaneswar, Village: 105-Mendhasala
4. Click Plot radio, select plot number, click "View RoR"
5. SRoR page shows owner name, khata, area, and plot details

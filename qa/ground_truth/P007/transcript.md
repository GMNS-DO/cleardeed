# P007 — Kordha / Brahmanabilen / D/107 — Verification Transcript

## Steps
1. Open https://bhulekh.ori.nic.in/RoRView.aspx
2. District: Khordha, Tahasil: Kordha (code 3)
3. Village: Brahmanabilen
4. Search Mode: Plot, Identifier: D/107
5. Screenshot the result page
6. Transcribe: tenant name, father name, khata number, area, kisam
7. Repeat for IGR EC at https://igrodisha.gov.in/ecsearch
8. Bhunaksha WFS: https://bhunaksha.ori.nic.in/bhunaksha/rwms/wfs
9. CERSAI: https://cersai.org.in/
10. eCourts: https://services.ecourts.gov.in/
11. RCCMS: https://rccms.odisha.gov.in/
12. BDA zoning lookup in `packages/fetchers/bda-zoning/data/bda_zones.json`
13. Circle rate lookup in `packages/fetchers/circle-rate/data/khordha_circle_rates.json`

## Coverage
- Tahasil: Kordha
- Village: Brahmanabilen
- Pattern: d_prefix
- Kisam: agricultural
- BDA zone: commercial

## Expected (founder to fill)
- All 9 fetcher slices in manifest.json: fill `fetchers.bhulekh`, `fetchers.bhunaksha`, etc.
- Each slice must be a contract envelope (status, data, fetchedAt, sourceUrl, latencyMs).

## Screenshot destination
qa/ground_truth/P007/screenshots/bhulekh.png

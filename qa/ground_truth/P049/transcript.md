# P049 — Tangi / Kantilo / 149A — Verification Transcript

## Steps
1. Open https://bhulekh.ori.nic.in/RoRView.aspx
2. District: Khordha, Tahasil: Tangi (code 7)
3. Village: Kantilo
4. Search Mode: Plot, Identifier: 149A
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
- Tahasil: Tangi
- Village: Kantilo
- Pattern: alphanumeric
- Kisam: commercial
- BDA zone: commercial

## Expected (founder to fill)
- All 9 fetcher slices in manifest.json: fill `fetchers.bhulekh`, `fetchers.bhunaksha`, etc.
- Each slice must be a contract envelope (status, data, fetchedAt, sourceUrl, latencyMs).

## Screenshot destination
qa/ground_truth/P049/screenshots/bhulekh.png

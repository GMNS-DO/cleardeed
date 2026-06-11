# Khordha Circle Rates — Data File

This directory holds `khordha_circle_rates.json`, the per-village benchmark
valuation (circle rate) data consumed by `packages/fetchers/circle-rate`.

## Status: PENDING IGR SCRAPE

As of 2026-06-12, the JSON file does not yet exist. The fetcher falls back to
a 9-row inline seed until the JSON is populated.

## How to populate this file

### Option A — Run the IGR scraper (preferred)

```bash
node scripts/probe/igr-bmv-scraper.ts --probe   # Inspect form structure first
node scripts/probe/igr-bmv-scraper.ts --scrape  # Run full scrape
```

The scraper queries the IGR `ViewFeeValue.aspx` portal for ~22 Khordha
villages × 3 kisams (Bari/Abadi/Bagayat) and writes the result here.

**Run `--probe` first** to verify the form-field selectors match the current
IGR portal (it changes periodically).

### Option B — Manual entry

If scraping fails, query the IGR portal by hand for 5-10 villages and write
the JSON file directly. Format:

```json
[
  {
    "village": "Mendhasala",
    "tahasil": "Bhubaneswar",
    "sro": "Bhubaneswar",
    "kisam": "Bari",
    "ratePerAcre": 5000000,
    "ratePerSqft": 1200,
    "ratePerDecimal": 12000,
    "sourceUrl": "https://igrodisha.gov.in/ViewFeeValue.aspx",
    "sourceDate": "2026-06-12"
  }
]
```

`ratePerAcre` and `ratePerSqft` are the only required fields; the fetcher
auto-converts between them.

## File format

| Field         | Type    | Notes                                       |
|---------------|---------|---------------------------------------------|
| village       | string  | English village/mouza name (matches KHRDHA_VILLAGES) |
| tahasil       | string  | English tehsil name                          |
| sro           | string  | Sub-Registrar Office (Bhubaneswar, Jatni, etc.) |
| kisam         | string  | Bari (residential), Abadi, Bagayat, etc.     |
| ratePerAcre   | number  | INR per acre (0 if not applicable)           |
| ratePerSqft   | number  | INR per square foot (0 if not applicable)    |
| ratePerDecimal| number  | INR per decimal (optional)                   |
| sourceUrl     | string  | URL where this rate was retrieved            |
| sourceDate    | string  | ISO date (YYYY-MM-DD) when the rate was retrieved |

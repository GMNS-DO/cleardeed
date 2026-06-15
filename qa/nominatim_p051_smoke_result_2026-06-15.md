# Nominatim — live smoke result, 2026-06-15

## TL;DR

**GREEN.** Nominatim live reverse geocode resolves P051 (Mendhasala, Khordha) correctly with state, district, village, and postcode. Fetcher contract tests pass (9/9). No fetcher changes needed.

## Probe

- URL: `https://nominatim.openstreetmap.org/reverse?format=json&lat=20.272688&lon=85.701271&zoom=18&addressdetails=1`
- User-Agent: `ClearDeed/1.0 (property due-diligence; contact@cleardeed.in)`
- Latency: 378ms (P051), 1034ms (Bhubaneswar center)
- Status: 200 OK

## P051 response (Mendhasala coordinates)

```json
{
  "display_name": "Chandaka, Khordha, Odisha, 752054, India",
  "address": {
    "county": "Chandaka",
    "state_district": "Khordha",
    "state": "Odisha",
    "ISO3166-2-lvl4": "IN-OD",
    "postcode": "752054",
    "country": "India",
    "country_code": "in"
  }
}
```

**Validators all pass:**
- `state_is_odisha`: passed (state=Odisha)
- `district_is_khordha`: passed (state_district=Khordha)
- `village_present`: passed (county=Chandaka, mapped to village slot)
- `postcode_present`: passed (postcode=752054)
- `country_is_india`: passed (country_code=in)

`verification=verified`, `statusReason=address_resolved`, `status=success`.

## Bhubaneswar center (sanity check)

`display_name="Nandankanan Road, Ward 12, North Zone, Bhubaneswar Municipal Corporation, Bhubaneswar (M.Corp.), Khordha, Odisha, 751013, India"`. Resolves to a city address, county=Bhubaneswar, state_district=Khordha. Validators all pass.

## Cuttack (negative case)

`{ lat: 20.4625, lon: 85.8830 }` (Cuttack city center) → district=Cuttack. `district_is_khordha` validator returns `failed` (correctly — the report should not auto-verify a Cuttack plot for the Khordha pilot). `verification=manual_required`. This is the expected degradation: the report still renders section 1 with valid display name + state, but does not claim Khordha coverage.

## Contract tests

9/9 pass (covers: village mapping fallback, district resolution when village==county, postcode presence, country code validator, retry behavior on timeout, Khordha verification logic, Cuttack negative case).

## Outcome

- Fetcher: green, no changes needed
- Live portal: cooperative, latency under 1s for reverse geocode
- Rate limit: 1 req/sec (Nominatim usage policy). The 7-day in-memory cache makes this safe for the report's typical usage.
- No captcha, no login, no SPA — Nominatim is the cleanest data source in the pipeline.

## Artifacts

- Fetcher: `packages/fetchers/nominatim/src/index.ts` (unchanged)
- Contract tests: `packages/fetchers/nominatim/src/index.test.ts` (9/9 green)
- Live probe: `scripts/probe/nominatim-live.ts`

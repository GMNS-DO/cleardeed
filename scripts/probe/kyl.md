# Probe: ORSAC GeoServer WFS / Bhunaksha

Created: 2026-04-16
Updated: 2026-04-17
Task: T-003 (KYL auth) and T-004 (Bhunaksha ArcGIS)
Status: **WORKING — Bhunaksha via GeoServer WFS**

## Summary

**ORSAC GeoServer WFS is the working path for GPS→plot lookup.**

Bhunaksha (plot polygons from state survey maps) is accessible via:
`https://mapserver.odisha4kgeo.in/geoserver/revenue/wfs?`

No authentication required. Simple BBOX query in EPSG:4326.

## Working Query

```
https://mapserver.odisha4kgeo.in/geoserver/revenue/wfs?
  SERVICE=WFS
  &VERSION=1.0.0
  &REQUEST=GetFeature
  &TYPENAME=revenue:khurda_bhubaneswar
  &BBOX=85.699,20.270,85.703,20.275,EPSG:4326
  &MAXFEATURES=10
  &OUTPUTFORMAT=application/json
```

Returns JSON with FeatureCollection containing polygon geometries and properties:
- `revenue_plot` — plot/khasra number
- `revenue_village_name` — village name (English)
- `revenue_village_code` — village code (Census)
- `grampanchayat_name`, `grampanchayat_code`
- `tehsil_name`, `tehsil_code`
- `block_name`, `block_code`
- `district_name`, `district_code`
- `state_name`, `state_code`
- `shape_area` — area in square degrees
- `shape_length` — perimeter

**CRS**: All results in `urn:ogc:def:crs:EPSG::4326` (WGS84 lat/lon)

## Key Discovery

Test point: 20.272688, 85.701271 (Chandaka area)

BBOX query with 0.01-degree window (≈1km) returns 10 features from nearby villages (Haripur, Mendhasala).

To find the exact plot containing our point: query a smaller BBOX (0.005 degree ≈ 500m), then for each returned polygon, do point-in-polygon test. The polygon that contains our point is the exact plot.

The layer `revenue:khurda_bhubaneswar` has **14,054 features** covering Khordha/Bhubaneswar tehsil.

## Other Layers Available

Full capabilities scan reveals hundreds of layers by district:
- `revenue:baleswar_baleswar` (Baleswar district)
- `revenue:anugul_anugul` (Angul district)
- etc.

For Bhunaksha across all of Odisha, the naming pattern is `revenue:<district_lower>_<tehsil_lower>`.

## ArcGIS Bhunaksha (gis.odisha.nic.in)

Status: **UNREACHABLE** from external network. gis.odisha.nic.in blocks external requests. GeoServer WFS is the confirmed working path.

## KYL Auth Status

Status: **BLOCKED**. No programmatic KYL endpoint found at odisha4kgeo.in. The KYL module requires browser-based session with ViewState. No bearer token, no public API.

Mitigation: GeoServer WFS + Bhulekh Playwright provides GPS→plot→tenant lookup chain without KYL.

## Curl Template

```bash
curl -s "https://mapserver.odisha4kgeo.in/geoserver/revenue/wfs?SERVICE=WFS&VERSION=1.0.0&REQUEST=GetFeature&TYPENAME=revenue:khurda_bhubaneswar&BBOX=85.699,20.270,85.703,20.275,EPSG:4326&MAXFEATURES=10&OUTPUTFORMAT=application/json" \
  -H "User-Agent: ClearDeed/1.0"
```

## Rate Limit Note

No rate limit observed during testing. Geoserver supports standard WFS requests. Recommend 1 req/sec max to be safe.
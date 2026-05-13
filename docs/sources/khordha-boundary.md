# Khordha District Boundary

Last updated: 2026-04-30
Status: integrated as GPS gate input

## Preferred Official Source

Survey of India district boundary item via IUDX/pygeoapi:

`https://geo-soi.iudx.io/collections/district_boundaries/items/KHORDHA?f=html`

Observed metadata:

- Item id: `KHORDHA`
- Feature id: `211`
- District: Khordha
- State: Odisha
- LGD district code: `362`
- LGD state code: `21`
- Published `shape_area`: `2781806247.82`
- Published `shape_leng`: `640351.921239`

The preferred official geometry endpoint timed out from the local shell during implementation and again on retry (`curl` and Node fetch could not establish a usable local connection). The committed operational geometry therefore uses the fallback below while retaining the Survey of India/IUDX source as the preferred reference and metadata authority.

## Committed Geometry Fallback

File: `packages/schema/src/assets/khordha-district-boundary.json`

Source: Wikimedia Commons DataMap backed by DataMeet 2011 census district boundaries:

`https://commons.wikimedia.org/wiki/Data:India/Odisha/Khordha.map?action=raw`

Artifact hash:

`24ad815db8130feea8f3f10e61481bdce83dd3bbce7f3f1549c9145e8e700326`

License: CC-BY-2.5

## Validation Use

The schema validator applies:

- numeric V1 Khordha bounds: `19.8–20.5°N`, `85–86°E`
- district point-in-polygon
- distance-to-boundary warning below `1km`

Outside-polygon coordinates are blocked before report persistence or source fetchers run. Near-boundary coordinates are allowed but produce a manual verification warning.

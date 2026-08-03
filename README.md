# oceanops-data-exports

Central export tooling for the **GOOS Report Card** and **simple-map** globe.  
Run these scripts before each report edition when refreshing OceanOPS platform data.

Repository: [github.com/OceanOPS/oceanops-data-exports](https://github.com/OceanOPS/oceanops-data-exports)

## Layout (local development)

Clone this repo **next to** the app repos:

```text
OceanOPS/
  oceanops-data-exports/    ← this repo
  oceanops-report-card/
  oceanops-simple-map/
```

Output paths are defined in `paths.mjs` (sibling folders).

## Commands

| Script | Description |
|--------|-------------|
| `npm run export:partners` | Partner counts → report-card TS + simple-map JSON |
| `npm run export:geojson` | Map layers → `oceanops-simple-map/public/geojson/` |
| `npm run export:all` | Both exports |
| `*:dry-run` | Print SQL or preview without writing files |

## Partner export outputs

1. **`../oceanops-report-card/src/data/partnerCountries.ts`** — report card (until “View full list” is removed).
2. **`../oceanops-simple-map/public/data/partnerCountries.json`** — globe country metrics (`byGeoCountryName` maps `CANADA` → `CA`, etc.).

Configure edition criteria in:

- `partner-export/exportConfig.mjs` — GO-SHIP / SOT line lists, summary notes
- `partner-export/countryMeta.mjs` — EU and other editorial country metadata
- `geoCountryNames.mjs` — ISO ↔ GeoJSON `country_name` for the map

### Environment (partners)

- `OCEANOPS_API_URL` — default `http://localhost:8080/data`
- `OCEANOPS_DATABASE_URL` — Postgres for GO-SHIP, SOT, platform-location counts
- `PARTNER_EXPORT_EDITION` — label in export summary

Options: `--source=api|arcgis|auto` (default `auto`), `--dry-run`

## GeoJSON export

Writes **`../oceanops-simple-map/public/geojson/{layerId}.geojson`**.

Configure layers in `geojson-export/exportConfig.mjs`.

### Environment (GeoJSON)

- `OCEANOPS_DATABASE_URL` — Postgres (requires `psql` on PATH)
- `GEOJSON_EXPORT_EDITION` — label in summary

Options: `--dry-run`, `--layer=argo`, `--no-densify`, `--no-country-ship`, `--no-country-sensor`

## From app repos

```bash
npm run export:partners   # in oceanops-report-card
npm run export:geojson    # in oceanops-simple-map
```

## Release checklist

1. Update both `exportConfig.mjs` files for the edition.
2. From this folder: `npm run export:all`
3. Commit generated artifacts in report-card and simple-map as needed.

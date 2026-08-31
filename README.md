# oceanops-data-exports

Central export tooling for the **GOOS Report Card** and **simple-map** globe.  
Run these scripts before each report edition when refreshing OceanOPS platform data.

Repository: [github.com/OceanOPS/oceanops-data-exports](https://github.com/OceanOPS/oceanops-data-exports)

## Layout (local development)

Clone this repo **next to** the app repos:

```text
OceanOPS/
  oceanops-data-exports/    ← this repo
    sql/                    ← edition filters + @geojson / @partner (shared)
    geojson-export/         ← layers.manifest.json, densify
    partner-export/         ← country metadata, partner runners
  oceanops-report-card/
  oceanops-simple-map/
```

Output paths default to sibling folders (`paths.mjs`). Override when your clones live elsewhere:

| Variable | CLI flag | Default file / folder |
|----------|----------|------------------------|
| `OCEANOPS_REPORT_CARD_ROOT` | `--report-card-root=` | `src/data/partnerCountries.ts` |
| `OCEANOPS_SIMPLE_MAP_ROOT` | `--simple-map-root=` | `src/data/partnerCountries.json`, `public/geojson/` |
| `PARTNER_COUNTRIES_TS` | `--partner-ts=` | full path to `.ts` |
| `PARTNER_COUNTRIES_JSON` | `--partner-json=` | full path to `.json` |
| `GEOJSON_OUTPUT_DIR` | `--geojson-dir=` | GeoJSON output directory |

Examples:

```bash
# Different parent folder names
OCEANOPS_REPORT_CARD_ROOT=~/work/report-card \
OCEANOPS_SIMPLE_MAP_ROOT=~/work/simple-map \
npm run export:partners

# Write only the map JSON (skip report-card repo check)
npm run export:partners -- --partner-json=/path/to/oceanops-simple-map/src/data/partnerCountries.json

# GeoJSON to a custom directory
npm run export:geojson -- --geojson-dir=/path/to/public/geojson
```

## Commands

| Script | Description |
|--------|-------------|
| `npm run export:partners` | Partner counts → report-card TS + simple-map JSON |
| `npm run export:geojson` | Map layers → `oceanops-simple-map/public/geojson/` |
| `npm run export:all` | Both exports + one combined summary (counts, filters for map + partners) |
| `npm run export:all:dry-run` | Same as `export:all` without writing TS/JSON/GeoJSON files |
| `npm run render:sql -- <file\|all\|geojson\|partners>` | Print SQL with edition values (pgAdmin) |
| `*:dry-run` | Print SQL or preview without writing files |

## Partner export outputs

1. **`../oceanops-report-card/src/data/partnerCountries.ts`** — report card (until “View full list” is removed).
2. **`../oceanops-simple-map/src/data/partnerCountries.json`** — globe country metrics (`byGeoCountryName` maps `CANADA` → `CA`, etc.).

Configure edition **values** in **`edition.values.json`** (dates, line lists).  
Configure **filters and queries** in **`sql/*.sql`** (`-- @where`, `-- @geojson`, `-- @partner` + `{{tokens}}`).  
**Ocean TraX partner counts** are manual: edit **`partner-export/manual/oceantrax.json`** each edition (`"AU": 2`, …).

- `partner-export/countryMeta.mjs` — EU and other editorial country metadata
- `geoCountryNames.mjs` — ISO ↔ GeoJSON `country_name` for the map

### Environment (shared)

Both exports use the same database settings:

- `OCEANOPS_DATABASE_URL` — Postgres (**required**; `psql` on PATH)
- Optional: copy `.env.example` → `.env` in this repo (loaded automatically)
- Edition label: `OCEANOPS_EXPORT_EDITION` (or `PARTNER_EXPORT_EDITION` / `GEOJSON_EXPORT_EDITION`)

**Important:** assign the URL on the **same command** as npm, or `export` it first — otherwise only the first script in `export:all` may see it:

```bash
export OCEANOPS_DATABASE_URL='postgresql://...'
export OCEANOPS_EXPORT_EDITION=isival-test
npm run export:all
```

### Environment (partners)

- `PARTNER_EXPORT_EDITION` — alias for edition label if `OCEANOPS_EXPORT_EDITION` unset

Options: `--dry-run`

## GeoJSON export

Writes **`../oceanops-simple-map/public/geojson/{layerId}.geojson`**.

1. Edit **`edition.values.json`** and SQL files under **`sql/`**.
2. `npm run export:geojson`

### Environment (GeoJSON)

Uses the same `OCEANOPS_DATABASE_URL` as partner export (see above).

- `GEOJSON_EXPORT_EDITION` — alias for edition label if `OCEANOPS_EXPORT_EDITION` unset

Options: `--dry-run`, `--layer=argo`, `--no-densify`

Line densification (manual, after editing `*_undensified.geojson` in simple-map):

```bash
npm run densify:geojson -- ../oceanops-simple-map/public/geojson/goship_undensified.geojson ../oceanops-simple-map/public/geojson/goship.geojson
```

Optional 3rd/4th args: `hybrid` (default), `rhumb`, or `geodesic`, then `stepKm` (default 80). Implementation: `geojson-export/densifyLayer.mjs`.

## From app repos

```bash
npm run export:partners   # in oceanops-report-card
npm run export:geojson    # in oceanops-simple-map
```

## Release checklist

1. Update `edition.values.json` and `sql/*.sql` for the edition.
2. From this folder: `npm run export:all`
3. Commit generated artifacts in report-card and simple-map as needed.

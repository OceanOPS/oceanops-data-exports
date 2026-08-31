# Network SQL — one file per GOOS network / map layer

Shared by **partner export** (`@partner`) and **GeoJSON export** (`@geojson`).  
Map-only metadata (category, densify): `geojson-export/layers.manifest.json`.

Each `*.sql` file holds the edition filter **once** and two runnable queries:

| Section | Purpose |
|---------|---------|
| `-- @where` | Filter fragment (no `WHERE` keyword); injected as `{{WHERE}}` in geojson/partner |
| `-- @geojson` | Map export (`npm run export:geojson`) |
| `-- @partner` | Country counts (`npm run export:partners`) — or **manual JSON** for Ocean TraX |

**Ocean TraX:** partner counts come from `partner-export/manual/oceantrax.json` (ISO → integer), not `@partner` SQL. Map lines still use `@geojson` in `sql/oceantrax.sql`.

## Before each edition

1. **`edition.values.json`** — dates, line lists, shared `ptf_status IN (...)` tokens.
2. **`sql/<layerId>.sql`** — edit `-- @where` (and query shape if needed).
3. Render for pgAdmin:

   ```bash
   npm run render:sql -- sql/argo.sql   # full file, tokens applied
   npm run render:sql -- geojson        # all map queries
   npm run render:sql -- partners       # all partner queries
   npm run render:sql -- all
   ```

4. `npm run export:all` (with `OCEANOPS_DATABASE_URL` set).

**Observations per day (report card stat4):** read-only step queries in `observations-export/queries.mjs` (source hierarchy, `COUNT(*)` per table, sum in Node). Reference single-query: `sql/observations_per_day.sql`. Export: `npm run export:observations` (also writes YoY delta to `editionStats.ts`, per-network breakdown to `observations-network-yoy.json`, included in `export:all`). Skip network YoY with `--skip-network-yoy`.

Copy from `_template_point.sql` or `_template_line.sql` when adding a layer; register in `geojson-export/layers.manifest.json`.

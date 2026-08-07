#!/usr/bin/env node
/** Print SQL with edition.values.json applied (for pgAdmin). */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LAYER_IDS } from './geojson-export/exportConfig.mjs'
import {
  NETWORK_SQL_DIR,
  PARTNER_KEY_TO_LAYER_ID,
  readNetworkSqlSection,
  renderNetworkSqlFileForPgAdmin,
} from './networkSql.mjs'

const repoRoot = path.dirname(fileURLToPath(import.meta.url))

function resolveSqlPath(inputPath) {
  if (fs.existsSync(inputPath)) return path.resolve(inputPath)
  const fromRoot = path.join(repoRoot, inputPath)
  if (fs.existsSync(fromRoot)) return fromRoot
  throw new Error(`SQL file not found: ${inputPath}`)
}

/**
 * @param {'all' | 'geojson' | 'partners'} mode
 */
function renderBatch(mode) {
  const layerIds =
    mode === 'partners' ?
      [...new Set(Object.values(PARTNER_KEY_TO_LAYER_ID))]
    : LAYER_IDS

  for (const layerId of layerIds) {
    const filePath = path.join(NETWORK_SQL_DIR, `${layerId}.sql`)
    const label = path.relative(repoRoot, filePath)
    process.stdout.write(`\n-- ===== ${label} =====\n\n`)
    if (mode === 'geojson') {
      process.stdout.write(`${readNetworkSqlSection(layerId, 'geojson')}\n`)
    } else if (mode === 'partners') {
      process.stdout.write(`${readNetworkSqlSection(layerId, 'partner')}\n`)
    } else {
      process.stdout.write(renderNetworkSqlFileForPgAdmin(filePath))
    }
  }

  process.stderr.write(`Rendered ${layerIds.length} network file(s) (${mode}).\n`)
}

const arg = process.argv[2]
if (!arg) {
  process.stderr.write(`Usage:
  npm run render:sql -- geojson-export/sql/argo.sql
  npm run render:sql -- all          # full file (@where + @geojson + @partner)
  npm run render:sql -- geojson      # map queries only
  npm run render:sql -- partners     # partner count queries only
`)
  process.exit(1)
}

if (arg === 'all' || arg === 'geojson' || arg === 'partners') {
  renderBatch(arg)
} else {
  process.stdout.write(`${renderNetworkSqlFileForPgAdmin(resolveSqlPath(arg))}\n`)
}

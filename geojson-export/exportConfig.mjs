/**
 * GeoJSON export — layer list (layers.manifest.json). SQL: ../sql/*.sql
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NETWORK_KEYS } from '../partner-export/networkFilters.mjs'
import { renderEditionSummary, loadEditionValues } from '../editionValues.mjs'
import {
  writeLineStyleSummaryLines,
  yearFromIsoDate,
} from './lineStyleSummary.mjs'
import {
  formatGeojsonSqlHint,
  GEOJSON_SQL_SOURCE,
  LAYER_ID_TO_PARTNER_KEY,
  NETWORK_SQL_DIR,
  PARTNER_KEY_TO_LAYER_ID,
  readNetworkSqlSection,
} from '../networkSql.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const SQL_DIR = NETWORK_SQL_DIR

/** @type {{ layers: Record<string, ManifestLayerEntry> }} */
const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'layers.manifest.json'), 'utf8'),
)

/**
 * @typedef {Object} ManifestPointLayer
 * @property {'point'} geometryKind
 * @property {string} category
 * @property {string} summary
 * @property {boolean} densify
 */

/**
 * @typedef {Object} ManifestLineLayer
 * @property {'line'} geometryKind
 * @property {string} category
 * @property {string} sourceTable
 * @property {string} summary
 * @property {boolean} densify
 */

/** @typedef {ManifestPointLayer | ManifestLineLayer} ManifestLayerEntry */

export const EXPORT_EDITION_LABEL =
  process.env.GEOJSON_EXPORT_EDITION
  ?? process.env.OCEANOPS_EXPORT_EDITION
  ?? process.env.PARTNER_EXPORT_EDITION
  ?? 'report-card'

export const LAYER_MANIFEST = manifest.layers

/** Same order as partner export (`NETWORK_KEYS`). */
export const LAYER_IDS = NETWORK_KEYS.map((partnerKey) => {
  const layerId = PARTNER_KEY_TO_LAYER_ID[partnerKey]
  if (!layerId || !LAYER_MANIFEST[layerId]) {
    throw new Error(
      `layers.manifest.json must define "${layerId}" for partner network "${partnerKey}"`,
    )
  }
  return layerId
})

for (const layerId of Object.keys(LAYER_MANIFEST)) {
  if (!LAYER_IDS.includes(layerId)) {
    throw new Error(`Layer "${layerId}" is in layers.manifest.json but not in partner NETWORK_KEYS`)
  }
}

export const DENSIFY_LAYER_IDS = LAYER_IDS.filter((id) => LAYER_MANIFEST[id].densify)

/**
 * @param {string} layerId
 * @returns {string}
 */
export function readLayerSql(layerId) {
  if (!LAYER_MANIFEST[layerId]) {
    throw new Error(`Unknown layer "${layerId}" — add it to layers.manifest.json and sql/${layerId}.sql`)
  }
  const filePath = path.join(SQL_DIR, `${layerId}.sql`)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing ${filePath}`)
  }
  return readNetworkSqlSection(layerId, 'geojson')
}

/**
 * @param {Record<string, unknown>} countsByLayer
 * @param {Record<string, import('./lineStyleSummary.mjs').LineStyleSummary>} [lineStyleByLayer]
 * @param {string[]} [layerIds] layers exported this run (defaults to full manifest order)
 */
export function printExportSummary(countsByLayer, lineStyleByLayer = {}, layerIds = LAYER_IDS) {
  process.stderr.write('\n--- GeoJSON export summary ---\n')
  process.stderr.write(`Edition: ${EXPORT_EDITION_LABEL}\n\n`)
  const values = loadEditionValues()

  for (const layerId of layerIds) {
    const entry = LAYER_MANIFEST[layerId]
    const count = countsByLayer[layerId] ?? 0
    const partnerKey = LAYER_ID_TO_PARTNER_KEY[layerId] ?? layerId
    const sqlSource = GEOJSON_SQL_SOURCE[layerId] ?? 'ptf_loc_n'
    process.stderr.write(
      `  ${partnerKey}: ${count} features — ${renderEditionSummary(entry.summary)}\n`,
    )
    const lineStyle = lineStyleByLayer[layerId]
    if (lineStyle) {
      const sinceYear =
        layerId === 'goship'
          ? yearFromIsoDate(values.GOSHIP_EDITION_SINCE)
          : yearFromIsoDate(values.SOOP_XBT_SAMPLED_SINCE)
      writeLineStyleSummaryLines(
        process.stderr,
        lineStyle,
        sinceYear,
        layerId === 'oceantrax'
          ? {
              solidLabel: 'active',
              dashLabel: 'reactivate',
              legendNote: 'legend solid · dash',
            }
          : undefined,
      )
    }
    process.stderr.write(`    SQL hint: ${formatGeojsonSqlHint(layerId, sqlSource)}\n`)
    process.stderr.write(`    SQL: sql/${layerId}.sql\n`)
  }

  process.stderr.write('\nEdit sql/*.sql (@where) and edition.values.json.\n')
}

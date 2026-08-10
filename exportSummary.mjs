/**
 * Combined partner + GeoJSON export summary (single block for export:all).
 */

import { loadEditionValues } from './editionValues.mjs'
import { LAYER_MANIFEST } from './geojson-export/exportConfig.mjs'
import {
  EXPORT_EDITION_LABEL,
  NETWORK_CRITERIA,
} from './partner-export/exportConfig.mjs'
import { NETWORK_KEYS } from './partner-export/networkFilters.mjs'
import { formatGeojsonSqlHint, formatNetworkSqlHint, GEOJSON_SQL_SOURCE } from './networkSql.mjs'

/**
 * @param {Record<string, Record<string, number>>} byNetwork
 * @param {Record<string, number>} countsByLayer
 * @param {{ EXPORT_EDITION_LABEL?: string }} [config]
 */
export function printCombinedExportSummary(byNetwork, countsByLayer, config = {}) {
  const edition = config.EXPORT_EDITION_LABEL ?? EXPORT_EDITION_LABEL
  const values = loadEditionValues()

  process.stderr.write('\n── Export summary (partners + GeoJSON) ──\n')
  process.stderr.write(`Edition: ${edition}\n`)
  process.stderr.write('SQL: sql/*.sql (@where + @geojson / @partner)\n')
  process.stderr.write('Values: edition.values.json\n\n')

  for (const partnerKey of NETWORK_KEYS) {
    const criteria = NETWORK_CRITERIA[partnerKey]
    if (!criteria) continue
    const { layerId, summary, sqlSource } = criteria
    const partnerTotal = Object.values(byNetwork[partnerKey] ?? {}).reduce((a, b) => a + b, 0)
    const geojsonFeatures = countsByLayer[layerId] ?? 0

    process.stderr.write(`${partnerKey} · ${layerId}\n`)
    process.stderr.write(`  Partner total: ${partnerTotal}  |  GeoJSON features: ${geojsonFeatures}\n`)
    process.stderr.write(`  ${summary}\n`)

    const geoSource = GEOJSON_SQL_SOURCE[layerId] ?? 'ptf_loc_n'
    const partnerHint = formatNetworkSqlHint(layerId, sqlSource)
    const mapHint = formatGeojsonSqlHint(layerId, geoSource)
    const isLineLayer = LAYER_MANIFEST[layerId]?.geometryKind === 'line'

    if (isLineLayer || partnerHint !== mapHint) {
      process.stderr.write(`  Partner filter: ${partnerHint}\n`)
      process.stderr.write(`  Map filter: ${mapHint}\n`)
    } else {
      process.stderr.write(`  Filter (@where): ${mapHint}\n`)
    }

    process.stderr.write(`  SQL: sql/${layerId}.sql\n\n`)
  }

  process.stderr.write('Shared edition values\n')
  process.stderr.write(`  LAYER_TABLE_PTF_STATUS_IN: ${values.LAYER_TABLE_PTF_STATUS_IN}\n`)
  process.stderr.write(`  OCEAN_GLIDERS_MIN_LOC_DATE: ${values.OCEAN_GLIDERS_MIN_LOC_DATE}\n`)
  process.stderr.write(`  ANIBOS_MIN_LOC_DATE: ${values.ANIBOS_MIN_LOC_DATE}\n`)
  process.stderr.write(`  FVON_MIN_LOC_DATE: ${values.FVON_MIN_LOC_DATE}\n`)
  process.stderr.write(`  GOSHIP_LINE_NAMES: ${values.GOSHIP_LINE_NAMES.length} lines\n`)
  process.stderr.write(`  SOOP_XBT_LINE_NAMES: ${values.SOOP_XBT_LINE_NAMES.length} lines\n\n`)
}

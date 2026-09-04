/**
 * Combined partner + GeoJSON export summary (single block for export:all).
 */

import { loadEditionValues, renderEditionSummary, resolveObsPeriodBounds, editionValueTokens, resolveExportAsOfDate } from './editionValues.mjs'
import { LAYER_MANIFEST } from './geojson-export/exportConfig.mjs'
import {
  EXPORT_EDITION_LABEL,
  NETWORK_CRITERIA,
} from './partner-export/exportConfig.mjs'
import { NETWORK_KEYS } from './partner-export/networkFilters.mjs'
import { isManualPartnerNetwork, manualPartnerCountsHint } from './partner-export/manualPartnerCounts.mjs'
import { formatGeojsonSqlHint, formatNetworkSqlHint, GEOJSON_SQL_SOURCE } from './networkSql.mjs'
import {
  writeLineStyleSummaryLines,
  yearFromIsoDate,
} from './geojson-export/lineStyleSummary.mjs'

/** @param {string} layerId */
function lineSampledSinceLabel(layerId) {
  if (layerId === 'goship') return 'last 12 months'
  if (layerId === 'oceantrax') return yearFromIsoDate(loadEditionValues().SOOP_XBT_SAMPLED_SINCE)
  return '?'
}

/**
 * @param {Record<string, Record<string, number>>} byNetwork
 * @param {Record<string, number>} countsByLayer
 * @param {Record<string, import('./geojson-export/lineStyleSummary.mjs').LineStyleSummary>} [lineStyleByLayer]
 * @param {{ EXPORT_EDITION_LABEL?: string, obsStats?: Record<string, unknown> }} [config]
 */
export function printCombinedExportSummary(byNetwork, countsByLayer, lineStyleByLayer = {}, config = {}) {
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
    if (isManualPartnerNetwork(partnerKey)) {
      process.stderr.write(`  Partner total: ${partnerTotal}  |  GeoJSON lines: ${geojsonFeatures} (manual counts — not 1:1)\n`)
      process.stderr.write(`  Partner source: ${manualPartnerCountsHint(partnerKey)}\n`)
    } else {
      process.stderr.write(`  Partner total: ${partnerTotal}  |  GeoJSON features: ${geojsonFeatures}\n`)
    }
    process.stderr.write(`  ${renderEditionSummary(summary)}\n`)

    const lineStyle = lineStyleByLayer[layerId]
    if (lineStyle) {
      writeLineStyleSummaryLines(
        process.stderr,
        lineStyle,
        lineSampledSinceLabel(layerId),
        layerId === 'oceantrax'
          ? {
              solidLabel: 'active',
              dashLabel: 'reactivate',
              legendNote: 'legend solid · dash',
            }
          : undefined,
      )
    }

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
  process.stderr.write(`  EXPORT_AS_OF: ${resolveExportAsOfDate()}\n`)
  process.stderr.write(`  LAYER_TABLE_PTF_STATUS_IN: ${values.LAYER_TABLE_PTF_STATUS_IN}\n`)
  const tokens = editionValueTokens()
  process.stderr.write(`  ROLLING_12M_SINCE: ${tokens.ROLLING_12M_SINCE}\n`)
  process.stderr.write(`  SOOP_XBT_SAMPLED_SINCE: ${values.SOOP_XBT_SAMPLED_SINCE}\n`)
  process.stderr.write(`  GOSHIP_RECENT_SINCE: ${values.GOSHIP_RECENT_SINCE}\n`)
  process.stderr.write(`  GOSHIP_DECADAL_SINCE: ${values.GOSHIP_DECADAL_SINCE}\n`)
  process.stderr.write(`  GOSHIP_DECADAL_UNTIL: ${values.GOSHIP_DECADAL_UNTIL}\n`)
  const { since, until } = resolveObsPeriodBounds()
  process.stderr.write(`  OBS_PERIOD_SINCE: ${since}\n`)
  process.stderr.write(`  OBS_PERIOD_UNTIL: ${until}\n`)

  if (config.obsStats) {
    process.stderr.write('\nObservations per day (stat4)\n')
    process.stderr.write(`  Avg (hierarchy): ${config.obsStats.avgObsPerDay}\n`)
    process.stderr.write(`  Period: ${config.obsStats.periodStart} → ${config.obsStats.periodEnd}\n`)
    process.stderr.write(`  Days with data: ${config.obsStats.daysWithData}\n`)
    process.stderr.write(`  Total obs in window: ${config.obsStats.totalObs}\n`)
    process.stderr.write('  Source: observations-export/queries.mjs\n\n')
  }
}

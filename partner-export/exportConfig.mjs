/**
 * Partner export — summaries and edition label.
 *
 * SQL: sql/{layerId}.sql — @partner section (filter in @where).
 */

import { loadEditionValues, renderEditionSummary } from '../editionValues.mjs'
import { formatNetworkSqlHint, PARTNER_KEY_TO_LAYER_ID } from '../networkSql.mjs'
import { NETWORK_KEYS } from './networkFilters.mjs'

export const EXPORT_EDITION_LABEL =
  process.env.PARTNER_EXPORT_EDITION
  ?? process.env.OCEANOPS_EXPORT_EDITION
  ?? process.env.GEOJSON_EXPORT_EDITION
  ?? 'report-card'

/**
 * @type {Record<string, { summary: string, layerId: string, sqlSource: string }>}
 */
export const NETWORK_CRITERIA = {
  driftingBuoys: { summary: 'OPERATIONAL drifting buoys (ptf_family DB)', layerId: 'drifting_buoys', sqlSource: 'ptf_loc_n' },
  argo: { summary: 'OPERATIONAL Argo floats', layerId: 'argo', sqlSource: 'ptf_loc_n' },
  oceanGliders: { summary: 'OceanGliders — layer-table statuses + latest_loc_date cutoff', layerId: 'oceangliders', sqlSource: 'ptf_loc_n' },
  aniBOS: { summary: 'AniBOS — layer-table statuses + latest_loc_date cutoff', layerId: 'anibos', sqlSource: 'ptf_loc_n' },
  fvon: { summary: 'FVON — layer-table statuses + latest_loc_date cutoff', layerId: 'fvon', sqlSource: 'ptf_loc_n' },
  sotVos: { summary: 'OPERATIONAL SOT/VOS ships', layerId: 'vos', sqlSource: 'ptf_loc_n' },
  sotAsap: { summary: 'OPERATIONAL ASAP ships', layerId: 'asap', sqlSource: 'ptf_loc_n' },
  sot: { summary: 'Ocean TraX — line_status active/reactivate; partner counts = cruises since SOOP_XBT_SAMPLED_SINCE via cruise_program lead → program.country', layerId: 'oceantrax', sqlSource: 'cruise_program' },
  goShip: { summary: 'GO-SHIP — line_type <> Associated, name <> P03; partner counts = edition cruises (lead program country) since GOSHIP_EDITION_SINCE', layerId: 'goship', sqlSource: 'cruise_program' },
  gloss: { summary: 'OPERATIONAL GLOSS sea-level gauges', layerId: 'gloss', sqlSource: 'ptf_loc_n' },
  oceanSites: { summary: 'OceanSITES moorings — OPERATIONAL or INACTIVE', layerId: 'oceansites', sqlSource: 'ptf_loc_n' },
  mooredBuoys: { summary: 'OPERATIONAL moored buoys (excl. OceanSITES)', layerId: 'moored_buoys', sqlSource: 'ptf_loc_n' },
  tsunamiBuoys: { summary: 'OPERATIONAL tsunameter buoys', layerId: 'tsunami_buoys', sqlSource: 'ptf_loc_n' },
  hfRadars: { summary: 'All HF radars (no status filter)', layerId: 'hf_radars', sqlSource: 'ptf_loc_n' },
}

/**
 * @param {Record<string, Record<string, number>>} byNetwork
 * @param {{ EXPORT_EDITION_LABEL?: string }} [config]
 */
export function printExportCriteriaSummary(byNetwork, config = {}) {
  const edition = config.EXPORT_EDITION_LABEL ?? EXPORT_EDITION_LABEL
  const values = loadEditionValues()

  process.stderr.write('\n── Export criteria summary ──\n')
  process.stderr.write(`Edition: ${edition}\n`)
  process.stderr.write('SQL: sql/*.sql (@where + @geojson / @partner)\n')
  process.stderr.write('Values: edition.values.json\n\n')

  for (const key of NETWORK_KEYS) {
    const criteria = NETWORK_CRITERIA[key]
    if (!criteria) continue
    const total = Object.values(byNetwork[key] ?? {}).reduce((a, b) => a + b, 0)
    process.stderr.write(`${key} (${total})\n`)
    process.stderr.write(`  ${renderEditionSummary(criteria.summary)}\n`)
    process.stderr.write(`  SQL hint: ${formatNetworkSqlHint(criteria.layerId, criteria.sqlSource)}\n`)
    process.stderr.write(`  SQL: sql/${criteria.layerId}.sql\n`)
  }

  process.stderr.write('\nShared edition values\n')
  process.stderr.write(`  LAYER_TABLE_PTF_STATUS_IN: ${values.LAYER_TABLE_PTF_STATUS_IN}\n`)
  process.stderr.write(`  OCEAN_GLIDERS_MIN_LOC_DATE: ${values.OCEAN_GLIDERS_MIN_LOC_DATE}\n`)
  process.stderr.write(`  ANIBOS_MIN_LOC_DATE: ${values.ANIBOS_MIN_LOC_DATE}\n`)
  process.stderr.write(`  FVON_MIN_LOC_DATE: ${values.FVON_MIN_LOC_DATE}\n`)
  process.stderr.write(`  SOOP_XBT_SAMPLED_SINCE: ${values.SOOP_XBT_SAMPLED_SINCE}\n`)
  process.stderr.write(`  GOSHIP_EDITION_SINCE: ${values.GOSHIP_EDITION_SINCE}\n`)
  process.stderr.write(`  GOSHIP_RECENT_SINCE: ${values.GOSHIP_RECENT_SINCE}\n`)
  process.stderr.write(`  GOSHIP_DECADAL_SINCE: ${values.GOSHIP_DECADAL_SINCE}\n`)
  process.stderr.write(`  GOSHIP_DECADAL_UNTIL: ${values.GOSHIP_DECADAL_UNTIL}\n\n`)
}

export { PARTNER_KEY_TO_LAYER_ID }

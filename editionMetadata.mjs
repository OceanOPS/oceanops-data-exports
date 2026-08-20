/**
 * Edition metadata written beside GeoJSON for map footer / UI copy.
 * Only includes values that appear in sql/*.sql (@where tokens).
 */

import { loadEditionValues } from './editionValues.mjs'

/** @returns {Record<string, string>} */
export function buildEditionMetadata() {
  const v = loadEditionValues()
  return {
    OCEAN_GLIDERS_MIN_LOC_DATE: v.OCEAN_GLIDERS_MIN_LOC_DATE,
    ANIBOS_MIN_LOC_DATE: v.ANIBOS_MIN_LOC_DATE,
    FVON_MIN_LOC_DATE: v.FVON_MIN_LOC_DATE,
    SOOP_XBT_SAMPLED_SINCE: v.SOOP_XBT_SAMPLED_SINCE,
    GOSHIP_EDITION_SINCE: v.GOSHIP_EDITION_SINCE,
    GOSHIP_RECENT_SINCE: v.GOSHIP_RECENT_SINCE,
    GOSHIP_DECADAL_SINCE: v.GOSHIP_DECADAL_SINCE,
    GOSHIP_DECADAL_UNTIL: v.GOSHIP_DECADAL_UNTIL,
    OBS_DAYS_WINDOW: v.OBS_DAYS_WINDOW,
  }
}

/** Full export metadata payload (SQL-backed fields + export run date). */
export function buildExportMetadata(asOfDate) {
  return {
    exportedAt: asOfDate ?? new Date().toISOString().slice(0, 10),
    ...buildEditionMetadata(),
  }
}

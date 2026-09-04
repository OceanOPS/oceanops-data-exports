/**
 * Edition metadata written beside GeoJSON for map footer / UI copy.
 * Only includes values that appear in sql/*.sql (@where tokens).
 */

import fs from 'node:fs'
import path from 'node:path'
import { loadEditionValues, resolveObsPeriodBounds, editionValueTokens, resolveExportAsOfDate } from './editionValues.mjs'

/** @returns {Record<string, string>} */
export function buildEditionMetadata() {
  const v = loadEditionValues()
  const tokens = editionValueTokens()
  const asOf = resolveExportAsOfDate()
  return {
    EXPORT_AS_OF: asOf,
    GOSHIP_EDITION_UNTIL: tokens.GOSHIP_EDITION_UNTIL,
    ROLLING_12M_SINCE: tokens.ROLLING_12M_SINCE,
    OCEAN_GLIDERS_MIN_LOC_DATE: tokens.OCEAN_GLIDERS_MIN_LOC_DATE,
    ANIBOS_MIN_LOC_DATE: tokens.ANIBOS_MIN_LOC_DATE,
    FVON_MIN_LOC_DATE: tokens.FVON_MIN_LOC_DATE,
    SOOP_XBT_SAMPLED_SINCE: v.SOOP_XBT_SAMPLED_SINCE,
    GOSHIP_EDITION_SINCE: tokens.GOSHIP_EDITION_SINCE,
    GOSHIP_RECENT_SINCE: v.GOSHIP_RECENT_SINCE,
    GOSHIP_DECADAL_SINCE: v.GOSHIP_DECADAL_SINCE,
    GOSHIP_DECADAL_UNTIL: v.GOSHIP_DECADAL_UNTIL,
    OBS_PERIOD_SINCE: v.OBS_PERIOD_SINCE,
    OBS_PERIOD_UNTIL: resolveObsPeriodBounds().until,
  }
}

/** Full export metadata payload (SQL-backed fields + export run date). */
export function buildExportMetadata(asOfDate) {
  return {
    exportedAt: asOfDate ?? resolveExportAsOfDate(),
    ...buildEditionMetadata(),
  }
}

/**
 * Merge patch into export-metadata.json (preserves keys not in patch, e.g. OBS_* from observations export).
 * @param {string} metadataPath
 * @param {Record<string, unknown>} patch
 */
export function patchExportMetadata(metadataPath, patch) {
  /** @type {Record<string, unknown>} */
  let metadata = {}
  if (fs.existsSync(metadataPath)) {
    metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'))
  }
  fs.mkdirSync(path.dirname(metadataPath), { recursive: true })
  fs.writeFileSync(
    metadataPath,
    `${JSON.stringify({ ...metadata, ...patch }, null, 2)}\n`,
    'utf8',
  )
}

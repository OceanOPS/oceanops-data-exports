/**
 * Edition knobs only (dates, line lists, shared status lists).
 * SQL files keep the WHERE shape; replace {{TOKENS}} before export / pgAdmin.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const EDITION_VALUES_PATH = path.join(__dirname, 'edition.values.json')

/** @typedef {{ LAYER_TABLE_PTF_STATUS_IN: string, OBS_PERIOD_SINCE: string, OBS_PERIOD_UNTIL?: string, OCEAN_GLIDERS_MIN_LOC_DATE: string, ANIBOS_MIN_LOC_DATE: string, FVON_MIN_LOC_DATE: string, SOOP_XBT_SAMPLED_SINCE: string, GOSHIP_EDITION_SINCE: string, GOSHIP_RECENT_SINCE: string, GOSHIP_DECADAL_SINCE: string, GOSHIP_DECADAL_UNTIL: string, SOOP_XBT_LINE_NAMES: string[] }} EditionValues */

/** @type {EditionValues | null} */
let cache = null

/** ISO date (YYYY-MM-DD) for export-as-of — drives GOSHIP_EDITION_UNTIL and OBS_PERIOD_UNTIL default. */
let exportAsOfDate = null

/** @param {string | null | undefined} isoDate */
export function setExportAsOfDate(isoDate) {
  exportAsOfDate = isoDate ?? null
}

/** @returns {EditionValues} */
export function loadEditionValues() {
  if (!cache) {
    cache = JSON.parse(fs.readFileSync(EDITION_VALUES_PATH, 'utf8'))
  }
  return cache
}

/** @param {string[]} names */
export function sqlQuotedNameList(names) {
  return names.map((n) => `'${n.replace(/'/g, "''")}'`).join(', ')
}

/**
 * Stat4 observation window from edition.values.json.
 * OBS_PERIOD_UNTIL omitted → export as-of (or GOSHIP_EDITION_UNTIL env).
 * OBS_PERIOD_SINCE omitted → Jan 1 of the export-as-of calendar year.
 * @returns {{ since: string, until: string }}
 */
export function resolveObsPeriodBounds() {
  const v = loadEditionValues()
  const asOf =
    exportAsOfDate ??
    process.env.GOSHIP_EDITION_UNTIL ??
    new Date().toISOString().slice(0, 10)
  const since =
    v.OBS_PERIOD_SINCE?.trim() || `${asOf.slice(0, 4)}-01-01`
  const until = v.OBS_PERIOD_UNTIL?.trim() || asOf
  return { since, until }
}

/** @returns {Record<string, string>} */
export function editionValueTokens() {
  const v = loadEditionValues()
  const asOf =
    exportAsOfDate ??
    process.env.GOSHIP_EDITION_UNTIL ??
    new Date().toISOString().slice(0, 10)
  const { since: obsSince, until: obsUntil } = resolveObsPeriodBounds()

  return {
    LAYER_TABLE_PTF_STATUS_IN: v.LAYER_TABLE_PTF_STATUS_IN,
    OBS_PERIOD_SINCE: obsSince,
    OBS_PERIOD_UNTIL: obsUntil,
    OCEAN_GLIDERS_MIN_LOC_DATE: v.OCEAN_GLIDERS_MIN_LOC_DATE,
    ANIBOS_MIN_LOC_DATE: v.ANIBOS_MIN_LOC_DATE,
    FVON_MIN_LOC_DATE: v.FVON_MIN_LOC_DATE,
    SOOP_XBT_SAMPLED_SINCE: v.SOOP_XBT_SAMPLED_SINCE,
    GOSHIP_EDITION_SINCE: v.GOSHIP_EDITION_SINCE,
    GOSHIP_RECENT_SINCE: v.GOSHIP_RECENT_SINCE,
    GOSHIP_DECADAL_SINCE: v.GOSHIP_DECADAL_SINCE,
    GOSHIP_DECADAL_UNTIL: v.GOSHIP_DECADAL_UNTIL,
    GOSHIP_EDITION_UNTIL: asOf,
    SOOP_XBT_LINE_NAMES_IN: sqlQuotedNameList(v.SOOP_XBT_LINE_NAMES),
  }
}

/**
 * Replace edition token names in manifest / log summaries (keys match SQL {{TOKENS}}).
 * @param {string} text
 */
export function renderEditionSummary(text) {
  let out = text
  const tokens = editionValueTokens()
  const keys = Object.keys(tokens).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    out = out.replaceAll(key, tokens[key])
  }
  const lineNames = loadEditionValues().SOOP_XBT_LINE_NAMES
  if (lineNames?.length) {
    out = out.replaceAll('SOOP_XBT_LINE_NAMES', `${lineNames.length} lines`)
  }
  return out
}

/**
 * @param {string} sqlTemplate
 */
export function renderEditionSql(sqlTemplate) {
  let out = sqlTemplate
  for (const [key, value] of Object.entries(editionValueTokens())) {
    out = out.replaceAll(`{{${key}}}`, value)
  }
  const leftover = out.match(/\{\{[A-Z0-9_]+\}\}/g)
  if (leftover?.length) {
    throw new Error(`Unresolved SQL placeholders: ${leftover.join(', ')}`)
  }
  return out
}

/**
 * @param {string} filePath
 */
export function readAndRenderSqlFile(filePath) {
  return renderEditionSql(fs.readFileSync(filePath, 'utf8'))
}

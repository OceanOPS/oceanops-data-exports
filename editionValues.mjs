/**
 * Edition knobs only (dates, line lists, shared status lists).
 * SQL files keep the WHERE shape; replace {{TOKENS}} before export / pgAdmin.
 *
 * Optional EXPORT_AS_OF (YYYY-MM-DD): fixed as-of date for rolling 12-month windows
 * and GO-SHIP edition until. Omitted → today when the export command runs.
 * Override at runtime: EXPORT_AS_OF or GOSHIP_EDITION_UNTIL env vars.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const EDITION_VALUES_PATH = path.join(__dirname, 'edition.values.json')

/** @typedef {{ PTF_STATUS_OPERATIONAL: string, LAYER_TABLE_PTF_STATUS_IN: string, OBS_PERIOD_SINCE: string, OBS_PERIOD_UNTIL?: string, EXPORT_AS_OF?: string, SOOP_XBT_SAMPLED_SINCE: string, GOSHIP_RECENT_SINCE: string, GOSHIP_DECADAL_SINCE: string, GOSHIP_DECADAL_UNTIL: string }} EditionValues */

/** @param {string} isoDate YYYY-MM-DD */
export function resolveRolling12MonthsSince(isoDate) {
  const d = new Date(`${isoDate}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() - 12)
  return d.toISOString().slice(0, 10)
}

/** @param {string | null | undefined} isoDate */
function normalizeIsoDate(isoDate) {
  const trimmed = isoDate?.trim()
  if (!trimmed) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`Invalid ISO date "${trimmed}" — expected YYYY-MM-DD`)
  }
  return trimmed
}

/**
 * Export as-of date (upper bound for rolling windows and GO-SHIP edition until).
 * Priority: runtime override → edition.values.json EXPORT_AS_OF → EXPORT_AS_OF env
 *   → GOSHIP_EDITION_UNTIL env → today (when the export command runs).
 * @returns {string}
 */
export function resolveExportAsOfDate() {
  const runtime = normalizeIsoDate(exportAsOfDate)
  if (runtime) return runtime

  const v = loadEditionValues()
  const fromEdition = normalizeIsoDate(v.EXPORT_AS_OF)
  if (fromEdition) return fromEdition

  const fromEnv = normalizeIsoDate(process.env.EXPORT_AS_OF)
  if (fromEnv) return fromEnv

  const fromGoshipEnv = normalizeIsoDate(process.env.GOSHIP_EDITION_UNTIL)
  if (fromGoshipEnv) return fromGoshipEnv

  return new Date().toISOString().slice(0, 10)
}

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
  const asOf = resolveExportAsOfDate()
  const since =
    v.OBS_PERIOD_SINCE?.trim() || `${asOf.slice(0, 4)}-01-01`
  const until = v.OBS_PERIOD_UNTIL?.trim() || asOf
  return { since, until }
}

/** @returns {Record<string, string>} */
export function editionValueTokens() {
  const v = loadEditionValues()
  const asOf = resolveExportAsOfDate()
  const { since: obsSince, until: obsUntil } = resolveObsPeriodBounds()
  const rolling12mSince = resolveRolling12MonthsSince(asOf)

  return {
    PTF_STATUS_OPERATIONAL: v.PTF_STATUS_OPERATIONAL,
    LAYER_TABLE_PTF_STATUS_IN: v.LAYER_TABLE_PTF_STATUS_IN,
    OBS_PERIOD_SINCE: obsSince,
    OBS_PERIOD_UNTIL: obsUntil,
    ROLLING_12M_SINCE: rolling12mSince,
    OCEAN_GLIDERS_MIN_LOC_DATE: rolling12mSince,
    ANIBOS_MIN_LOC_DATE: rolling12mSince,
    FVON_MIN_LOC_DATE: rolling12mSince,
    SOOP_XBT_SAMPLED_SINCE: v.SOOP_XBT_SAMPLED_SINCE,
    GOSHIP_EDITION_SINCE: rolling12mSince,
    GOSHIP_RECENT_SINCE: v.GOSHIP_RECENT_SINCE,
    GOSHIP_DECADAL_SINCE: v.GOSHIP_DECADAL_SINCE,
    GOSHIP_DECADAL_UNTIL: v.GOSHIP_DECADAL_UNTIL,
    GOSHIP_EDITION_UNTIL: asOf,
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

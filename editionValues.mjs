/**
 * Edition knobs only (dates, line lists, shared status lists).
 * SQL files keep the WHERE shape; replace {{TOKENS}} before export / pgAdmin.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const EDITION_VALUES_PATH = path.join(__dirname, 'edition.values.json')

/** @typedef {{ LAYER_TABLE_PTF_STATUS_IN: string, OCEAN_GLIDERS_MIN_LOC_DATE: string, ANIBOS_MIN_LOC_DATE: string, FVON_MIN_LOC_DATE: string, SOOP_XBT_SAMPLED_SINCE: string, GOSHIP_SAMPLED_SINCE: string, GOSHIP_LINE_NAMES: string[], SOOP_XBT_LINE_NAMES: string[] }} EditionValues */

/** @type {EditionValues | null} */
let cache = null

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

/** @returns {Record<string, string>} */
export function editionValueTokens() {
  const v = loadEditionValues()
  return {
    LAYER_TABLE_PTF_STATUS_IN: v.LAYER_TABLE_PTF_STATUS_IN,
    OCEAN_GLIDERS_MIN_LOC_DATE: v.OCEAN_GLIDERS_MIN_LOC_DATE,
    ANIBOS_MIN_LOC_DATE: v.ANIBOS_MIN_LOC_DATE,
    FVON_MIN_LOC_DATE: v.FVON_MIN_LOC_DATE,
    SOOP_XBT_SAMPLED_SINCE: v.SOOP_XBT_SAMPLED_SINCE,
    GOSHIP_SAMPLED_SINCE: v.GOSHIP_SAMPLED_SINCE,
    GOSHIP_LINE_NAMES_IN: sqlQuotedNameList(v.GOSHIP_LINE_NAMES),
    SOOP_XBT_LINE_NAMES_IN: sqlQuotedNameList(v.SOOP_XBT_LINE_NAMES),
  }
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

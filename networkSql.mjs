/**
 * Network SQL files: -- @where (once), -- @geojson, -- @partner.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderEditionSql } from './editionValues.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const NETWORK_SQL_DIR = path.join(__dirname, 'geojson-export', 'sql')

/** Partner export key → geojson-export/sql/{layerId}.sql */
export const PARTNER_KEY_TO_LAYER_ID = {
  driftingBuoys: 'drifting_buoys',
  argo: 'argo',
  oceanGliders: 'oceangliders',
  aniBOS: 'anibos',
  fvon: 'fvon',
  sotVos: 'vos',
  sotAsap: 'asap',
  gloss: 'gloss',
  oceanSites: 'oceansites',
  mooredBuoys: 'moored_buoys',
  tsunamiBuoys: 'tsunami_buoys',
  hfRadars: 'hf_radars',
  goShip: 'goship',
  sot: 'ship_oceano',
}

/** @type {Record<string, string>} */
export const LAYER_ID_TO_PARTNER_KEY = Object.fromEntries(
  Object.entries(PARTNER_KEY_TO_LAYER_ID).map(([partnerKey, layerId]) => [layerId, partnerKey]),
)

/** Short table label for GeoJSON SQL hints in export summaries. */
export const GEOJSON_SQL_SOURCE = {
  goship: 'goship_design_goship_1',
  ship_oceano: 'soop_xbt_design',
}

/** @param {string} content */
export function parseNetworkSqlSections(content) {
  const markers = ['where', 'geojson', 'partner']
  /** @type {Record<string, string>} */
  const sections = { header: '' }

  let mode = 'header'
  /** @type {string[]} */
  let buffer = []

  const flush = () => {
    if (mode === 'header') {
      sections.header = buffer.join('\n').trim()
    } else {
      sections[mode] = buffer.join('\n').trim()
    }
    buffer = []
  }

  for (const line of content.split('\n')) {
    const markerMatch = line.match(/^--\s*@(where|geojson|partner)\s*$/i)
    if (markerMatch) {
      flush()
      mode = markerMatch[1].toLowerCase()
      continue
    }
    buffer.push(line)
  }
  flush()

  for (const key of markers) {
    if (!sections[key]) {
      throw new Error(`Missing -- @${key} section in network SQL`)
    }
  }

  return sections
}

/**
 * @param {string} filePath
 * @param {'geojson' | 'partner'} section
 */
export function renderNetworkSqlSection(filePath, section) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const parts = parseNetworkSqlSections(raw)
  let body = parts[section]

  if (section === 'geojson' || section === 'partner') {
    if (body.includes('{{WHERE}}')) {
      const whereRendered = renderEditionSql(parts.where)
      body = body.replaceAll('{{WHERE}}', whereRendered)
    }
  }

  return renderEditionSql(body)
}

/** @param {string} sql */
export function compactSqlHint(sql) {
  const oneLine = sql.replace(/\s+/g, ' ').trim()
  return oneLine.replace(/IN\s*\(([^)]*)\)/gi, (match, inner) => {
    if (inner.length <= 80) return match
    const lineCount = inner.split(',').filter((s) => s.trim()).length
    return `IN (...${lineCount} lines...)`
  })
}

/**
 * @param {string} layerId
 */
export function readRenderedNetworkWhere(layerId) {
  const raw = fs.readFileSync(networkSqlPath(layerId), 'utf8')
  const parts = parseNetworkSqlSections(raw)
  return renderEditionSql(parts.where)
}

/**
 * Human-readable filter for export summaries (partner @partner query when possible).
 * @param {string} layerId
 * @param {string} [sqlSource]
 */
export function formatNetworkSqlHint(layerId, sqlSource = 'ptf_loc_n') {
  const raw = fs.readFileSync(networkSqlPath(layerId), 'utf8')
  const parts = parseNetworkSqlSections(raw)

  if (parts.partner.includes('{{WHERE}}')) {
    return `${sqlSource}: ${compactSqlHint(readRenderedNetworkWhere(layerId))}`
  }

  const partnerRendered = readNetworkSqlSection(layerId, 'partner')
  const whereMatch = partnerRendered.match(/\bWHERE\b([\s\S]+?)(?:\bGROUP BY\b|\bORDER BY\b|$)/i)
  if (whereMatch) {
    return `${sqlSource}: ${compactSqlHint(whereMatch[1])}`
  }

  return `${sqlSource}: ${compactSqlHint(readRenderedNetworkWhere(layerId))}`
}

/**
 * Map export filter (@where section).
 * @param {string} layerId
 * @param {string} [sqlSource]
 */
export function formatGeojsonSqlHint(layerId, sqlSource = 'ptf_loc_n') {
  return `${sqlSource}: ${compactSqlHint(readRenderedNetworkWhere(layerId))}`
}

/**
 * @param {string} layerId
 */
export function networkSqlPath(layerId) {
  return path.join(NETWORK_SQL_DIR, `${layerId}.sql`)
}

/**
 * @param {string} layerId
 * @param {'geojson' | 'partner'} section
 */
export function readNetworkSqlSection(layerId, section) {
  const filePath = networkSqlPath(layerId)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing network SQL: ${filePath}`)
  }
  return renderNetworkSqlSection(filePath, section)
}

/**
 * @param {string} partnerNetworkKey
 */
export function readPartnerNetworkSql(partnerNetworkKey) {
  const layerId = PARTNER_KEY_TO_LAYER_ID[partnerNetworkKey]
  if (!layerId) {
    throw new Error(`No layer SQL mapped for partner network "${partnerNetworkKey}"`)
  }
  return readNetworkSqlSection(layerId, 'partner')
}

/**
 * Full file for pgAdmin (both queries, comments).
 * @param {string} filePath
 */
export function renderNetworkSqlFileForPgAdmin(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const parts = parseNetworkSqlSections(raw)
  const whereRendered = renderEditionSql(parts.where)

  let geojson = parts.geojson.replaceAll('{{WHERE}}', whereRendered)
  let partner = parts.partner
  if (partner.includes('{{WHERE}}')) {
    partner = partner.replaceAll('{{WHERE}}', whereRendered)
  }

  geojson = renderEditionSql(geojson)
  partner = renderEditionSql(partner)

  return `${parts.header}

-- @where (edition filter — edit here)
${whereRendered}

-- @geojson
${geojson}

-- @partner
${partner}
`
}

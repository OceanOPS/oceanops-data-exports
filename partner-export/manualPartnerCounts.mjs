/**
 * Partner counts maintained by hand when PostgreSQL cannot supply them (Ocean TraX / sot).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizePartnerIso } from './countryRollup.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const MANUAL_PARTNER_COUNTS_DIR = path.join(__dirname, 'manual')

/** Partner export key → manual file basename (matches map layer id). */
const MANUAL_PARTNER_FILE_BASENAME = {
  sot: 'oceantrax',
}

/** Partner keys that read partner-export/manual/{layerId}.json instead of sql @partner. */
export const MANUAL_PARTNER_NETWORK_KEYS = Object.keys(MANUAL_PARTNER_FILE_BASENAME)

/** @param {string} networkKey */
function manualFileBasename(networkKey) {
  return MANUAL_PARTNER_FILE_BASENAME[networkKey] ?? networkKey
}

/** @param {string} networkKey */
export function isManualPartnerNetwork(networkKey) {
  return networkKey in MANUAL_PARTNER_FILE_BASENAME
}

/** @param {string} networkKey */
export function manualPartnerCountsPath(networkKey) {
  return path.join(MANUAL_PARTNER_COUNTS_DIR, `${manualFileBasename(networkKey)}.json`)
}

/** @param {string} networkKey */
export function manualPartnerCountsHint(networkKey) {
  return `manual: partner-export/manual/${manualFileBasename(networkKey)}.json`
}

/**
 * @param {string} networkKey
 * @returns {Record<string, number>}
 */
export function loadManualPartnerCounts(networkKey) {
  const filePath = manualPartnerCountsPath(networkKey)
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing manual partner counts for "${networkKey}": ${filePath}\n` +
        'Create the file with ISO 3166-1 alpha-2 keys and integer counts, e.g. { "AU": 2, "US": 5 }',
    )
  }

  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (err) {
    throw new Error(
      `Invalid JSON in ${filePath}: ${err instanceof Error ? err.message : err}`,
    )
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Manual partner counts must be a JSON object in ${filePath}`)
  }

  /** @type {Record<string, number>} */
  const counts = {}

  for (const [code, value] of Object.entries(parsed)) {
    if (code.startsWith('_')) continue

    const iso = normalizePartnerIso(code)
    if (!iso) {
      process.stderr.write(`  ⚠ manual ${networkKey}: skipped invalid ISO "${code}"\n`)
      continue
    }

    const n = Number(value)
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      throw new Error(`Invalid count for "${code}" in ${filePath}: ${value}`)
    }
    if (n === 0) continue

    counts[iso] = (counts[iso] ?? 0) + n
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) {
    process.stderr.write(
      `  ⚠ manual ${networkKey}: ${path.relative(process.cwd(), filePath)} has no counts — fill before edition\n`,
    )
  }

  return counts
}

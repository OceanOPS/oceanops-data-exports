/**
 * Partner counts maintained by hand when PostgreSQL cannot supply them (Ocean TraX).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const MANUAL_PARTNER_COUNTS_DIR = path.join(__dirname, 'manual')

/** ISO codes that must not appear in manual files (see sql/_partner_country_iso.sql). */
const EXCLUDED_REPORTING_ISO = new Set(['AQ', 'UN', 'UNKNOWN', 'U-'])

/** Raw ISO codes that SQL rolls up — use reporting ISO in manual files instead. */
const LEGACY_RAW_ISO = new Set(['HK', 'EN'])

/** Partner export key → manual file basename (matches map layer id). */
const MANUAL_PARTNER_FILE_BASENAME = {
  oceantrax: 'oceantrax',
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
        'Create the file with reporting ISO codes and integer counts, e.g. { "AU": 2, "CN": 3 } (see sql/_partner_country_iso.sql)',
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

    const iso = String(code ?? '').trim().toUpperCase()
    if (!iso || iso === 'NULL' || iso === 'UNDEFINED') {
      process.stderr.write(`  ⚠ manual ${networkKey}: skipped invalid ISO "${code}"\n`)
      continue
    }
    if (LEGACY_RAW_ISO.has(iso)) {
      process.stderr.write(
        `  ⚠ manual ${networkKey}: use reporting ISO (CN not HK, EU not EN) for "${code}" — see sql/_partner_country_iso.sql\n`,
      )
      continue
    }
    if (EXCLUDED_REPORTING_ISO.has(iso)) {
      process.stderr.write(`  ⚠ manual ${networkKey}: excluded ISO "${code}"\n`)
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

#!/usr/bin/env node
/**
 * Build contributing-countries-baseline.json from a partner export file.
 *
 * Use the partnerCountries.json (or .ts) from the **previous report card edition**
 * so YoY compares the same contributing-country rules.
 *
 * Usage:
 *   node bootstrap-contributing-countries-baseline.mjs \
 *     --from ../oceanops-simple-map/src/data/partnerCountries.json \
 *     --year 2025
 *
 *   node bootstrap-contributing-countries-baseline.mjs \
 *     --from ../oceanops-report-card/src/data/partnerCountries.ts \
 *     --year 2025 \
 *     --out ../oceanops-report-card/public/edition/contributing-countries-baseline.json
 *
 * Then re-run: npm run export:partners
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { listContributingCountryIsos } from './partner-export/countContributingCountries.mjs'
import { NETWORK_KEYS } from './partner-export/networkFilters.mjs'
import { REPORT_CARD_ROOT } from './paths.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function usage() {
  process.stderr.write(`Usage: node bootstrap-contributing-countries-baseline.mjs --from PATH --year YYYY [--out PATH]\n`)
  process.exit(1)
}

/** @param {string} inputPath */
function readPartnerCountries(inputPath) {
  const raw = fs.readFileSync(inputPath, 'utf8')
  if (inputPath.endsWith('.json')) {
    const parsed = JSON.parse(raw)
    return parsed.countries ?? parsed
  }
  if (inputPath.endsWith('.ts')) {
    return parsePartnerCountriesTs(raw)
  }
  throw new Error(`Unsupported file type: ${inputPath} (use .json or .ts)`)
}

/** @param {string} ts */
function parsePartnerCountriesTs(ts) {
  /** @type {Array<{ countryCode?: string, networks: Record<string, number> }>} */
  const rows = []
  const blocks = ts.split(/\},\s*\n\s*\{/)
  for (const block of blocks) {
    const code = block.match(/countryCode:\s*"([A-Z]{2})"/)
    const net = block.match(/networks:\s*\{([^}]+)\}/)
    if (!code || !net) continue
    /** @type {Record<string, number>} */
    const networks = {}
    for (const match of net[1].matchAll(/(\w+):\s*(-?\d+)/g)) {
      networks[match[1]] = Number(match[2])
    }
    rows.push({ countryCode: code[1], networks })
  }
  return rows
}

/** @param {Array<{ countryCode?: string, networks: Record<string, number> }>} rows */
function toCountryMap(rows) {
  /** @type {Map<string, Record<string, number>>} */
  const countries = new Map()
  for (const row of rows) {
    if (!row.countryCode) continue
    countries.set(row.countryCode, row.networks)
  }
  return countries
}

/** @param {Map<string, Record<string, number>>} countries @param {string} iso */
function networkBreakdownForIso(countries, iso) {
  const nets = countries.get(iso)
  if (!nets) return []
  return NETWORK_KEYS.filter((key) => (nets[key] ?? 0) > 0).map((key) => ({
    id: key,
    count: nets[key],
  }))
}

/** @param {Map<string, Record<string, number>>} countries @param {string[]} isos */
function buildNetworksByIso(countries, isos) {
  /** @type {Record<string, { id: string, count: number }[]>} */
  const networksByIso = {}
  for (const iso of isos) {
    const networks = networkBreakdownForIso(countries, iso)
    if (networks.length > 0) networksByIso[iso] = networks
  }
  return networksByIso
}

function parseArgs(argv) {
  /** @type {{ from?: string, year?: string, out?: string }} */
  const opts = {}
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--from') opts.from = argv[++i]
    else if (arg.startsWith('--from=')) opts.from = arg.slice('--from='.length)
    else if (arg === '--year') opts.year = argv[++i]
    else if (arg.startsWith('--year=')) opts.year = arg.slice('--year='.length)
    else if (arg === '--out') opts.out = argv[++i]
    else if (arg.startsWith('--out=')) opts.out = arg.slice('--out='.length)
    else usage()
  }
  if (!opts.from || !opts.year) usage()
  return opts
}

function main() {
  const { from, year, out } = parseArgs(process.argv)
  const inputPath = path.resolve(from)
  const outputPath =
    out ??
    path.join(REPORT_CARD_ROOT, 'public/edition/contributing-countries-baseline.json')

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input not found: ${inputPath}`)
  }

  const rows = readPartnerCountries(inputPath)
  const countries = toCountryMap(rows)

  let targetIsos = listContributingCountryIsos(countries)
  let yearNum = Number(year)
  /** @type {Record<string, { id: string, count: number }[]>} */
  let existingNetworksByIso = {}

  if (fs.existsSync(outputPath)) {
    const existing = JSON.parse(fs.readFileSync(outputPath, 'utf8'))
    if (existing.isos?.length) targetIsos = existing.isos
    if (existing.year) yearNum = existing.year
    existingNetworksByIso = existing.networksByIso ?? {}
  }

  const networksByIso = {
    ...existingNetworksByIso,
    ...buildNetworksByIso(countries, targetIsos),
  }

  const payload = {
    year: yearNum,
    isos: targetIsos,
    networksByIso,
    source: path.basename(inputPath),
    generatedAt: new Date().toISOString().slice(0, 10),
    note: 'Auto-generated by bootstrap-contributing-countries-baseline.mjs. Re-run npm run export:partners to refresh YoY.',
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  process.stderr.write(`Wrote ${outputPath}\n`)
  process.stderr.write(`  ${targetIsos.length} contributing ISO codes (year ${yearNum})\n`)
  process.stderr.write(`  ${Object.keys(networksByIso).length} ISO codes with network breakdown\n`)
  process.stderr.write(`Next: npm run export:partners\n`)
}

main()

#!/usr/bin/env node
/**
 * GTS per-network daily obs means — YoY comparison (current year vs previous year).
 * Read-only queries only (obs + obs_gliders_gts_osmc + obs_tsuna_gts_osmc).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatDatabaseUrlForLog, runPsqlQuery } from './geojson-export/db.mjs'
import { loadDotEnv } from './databaseUrl.mjs'
import { resolveExportPaths } from './paths.mjs'
import { mergeDailyCountLines } from './observations-export/queries.mjs'
import {
  GTS_NETWORKS,
  buildGtsNetworkYoySteps,
  computeDelta,
  summarizeDailyCounts,
} from './observations-export/gtsNetworkQueries.mjs'

/** @param {string[]} argv */
function resolveYear(argv) {
  const idx = argv.findIndex((arg) => arg === '--year')
  if (idx >= 0) {
    const year = Number.parseInt(String(argv[idx + 1] ?? ''), 10)
    if (!Number.isFinite(year) || year < 1970 || year > 2100) {
      throw new Error(`Invalid --year "${argv[idx + 1] ?? ''}"`)
    }
    return year
  }
  return new Date().getFullYear()
}

/** @param {Array<{ deltaPct: number | null, deltaAvg: number, label: string, gtsSource: string, current: { avgPerDay: number }, previous: { avgPerDay: number } }>} rows */
function printSummaryTable(rows) {
  process.stderr.write('\n--- GTS networks YoY (avg obs/day) ---\n')
  process.stderr.write(
    `${'Network'.padEnd(28)} ${'Source'.padEnd(9)} ${'Prev avg'.padStart(10)} ${'Curr avg'.padStart(10)} ${'Delta'.padStart(10)} ${'%'.padStart(8)}\n`,
  )
  process.stderr.write(`${'-'.repeat(79)}\n`)
  for (const row of rows) {
    const pct = row.deltaPct === null ? '  n/a' : `${row.deltaPct >= 0 ? '+' : ''}${row.deltaPct}%`
    process.stderr.write(
      `${row.label.padEnd(28)} ${row.gtsSource.padEnd(9)} ${String(row.previous.avgPerDay).padStart(10)} ${String(row.current.avgPerDay).padStart(10)} ${(row.deltaAvg >= 0 ? '+' : '') + String(row.deltaAvg).padStart(9)} ${pct.padStart(8)}\n`,
    )
  }
}

/**
 * @param {string[]} [argv]
 * @param {{ noWrite?: boolean }} [opts]
 */
export async function runGtsNetworkObsExport(argv = [], opts = {}) {
  loadDotEnv()
  const dryRun = argv.includes('--dry-run')
  const year = resolveYear(argv)
  const previousYear = year - 1
  const exportedAt = new Date().toISOString().slice(0, 10)
  const paths = resolveExportPaths(argv)
  const outputPath = path.join(
    paths.REPORT_CARD_ROOT,
    'public/edition/gts-network-obs-yoy.json',
  )

  const { steps, current, previous } = buildGtsNetworkYoySteps(year)

  if (dryRun) {
    process.stderr.write(
      `[dry-run] Would run ${steps.length} read-only GTS network steps (YoY ${previousYear} vs ${year})\n`,
    )
    process.stderr.write(`  Current:  ${current.label}\n`)
    process.stderr.write(`  Previous: ${previous.label}\n`)
    return { year, previousYear, networks: [] }
  }

  process.stderr.write(
    `\nGTS network obs YoY\nDB: ${formatDatabaseUrlForLog()}\n`,
  )
  process.stderr.write(`Current (${year}):  ${current.label}\n`)
  process.stderr.write(`Previous (${previousYear}): ${previous.label}\n\n`)

  /** @type {Map<string, { current: Map<string, number>, previous: Map<string, number> }>} */
  const byNetwork = new Map()
  for (const network of GTS_NETWORKS) {
    byNetwork.set(network.id, { current: new Map(), previous: new Map() })
  }

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i]
    process.stderr.write(`[${i + 1}/${steps.length}] → ${step.label}…\n`)

    const t0 = Date.now()
    const result = runPsqlQuery(step.sql)
    if (!result.ok) {
      throw new Error(`${step.label} failed: ${result.error}`)
    }

    const bucket = byNetwork.get(step.networkId)
    if (!bucket) throw new Error(`Unknown network id: ${step.networkId}`)

    const target = step.period === 'current' ? bucket.current : bucket.previous
    const { lines, added } = mergeDailyCountLines(target, result.stdout)
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
    process.stderr.write(
      `     ${lines} day rows, +${added.toLocaleString('en-US')} obs (${elapsed}s)\n`,
    )
  }

  /** @type {Array<Record<string, unknown>>} */
  const networks = []
  for (const network of GTS_NETWORKS) {
    const bucket = byNetwork.get(network.id)
    if (!bucket) continue
    const currentStats = summarizeDailyCounts(bucket.current)
    const previousStats = summarizeDailyCounts(bucket.previous)
    const { deltaAvg, deltaPct } = computeDelta(currentStats, previousStats)
    networks.push({
      id: network.id,
      label: network.label,
      gtsSource: network.gtsSource,
      current: currentStats,
      previous: previousStats,
      deltaAvg,
      deltaPct,
    })
  }

  networks.sort((a, b) => {
    const ap = a.deltaPct ?? -Infinity
    const bp = b.deltaPct ?? -Infinity
    return ap - bp
  })

  printSummaryTable(networks)

  const payload = {
    exportedAt,
    currentYear: year,
    previousYear,
    currentPeriod: current.label,
    previousPeriod: previous.label,
    note: 'GTS sources only (obs GTS MF + obs_gliders_gts_osmc + obs_tsuna_gts_osmc). Avg = total / days with data in period.',
    networks,
  }

  if (!opts.noWrite && fs.existsSync(paths.REPORT_CARD_ROOT)) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    process.stderr.write(
      `\nWrote ${path.relative(paths.REPORT_CARD_ROOT, outputPath)}\n`,
    )
  }

  return payload
}

async function main() {
  try {
    await runGtsNetworkObsExport(process.argv.slice(2))
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

function isDirectRun() {
  const entry = process.argv[1]
  if (!entry) return false
  return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url))
}

if (isDirectRun()) {
  void main()
}

#!/usr/bin/env node
/**
 * Average observations per day by calendar year (report card methodology).
 *
 * Usage:
 *   npm run export:observations:by-year
 *   npm run export:observations:by-year -- --from-year 2015 --to-year 2025
 *   npm run export:observations:by-year -- --dry-run
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatDatabaseUrlForLog } from './geojson-export/db.mjs'
import { loadDotEnv } from './databaseUrl.mjs'
import { resolveExportAsOfDate, setExportAsOfDate } from './editionValues.mjs'
import { resolveExportPaths } from './paths.mjs'
import { collectObservationStats } from './export-observations-per-day.mjs'
import {
  OBS_FILTER_LABELS,
  buildObservationSteps,
  resolveObsFilter,
  resolveObservationRange,
} from './observations-export/queries.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function parseYearArg(argv, flag, fallback) {
  const idx = argv.findIndex((arg) => arg === flag)
  if (idx < 0) return fallback
  const year = Number.parseInt(String(argv[idx + 1] ?? ''), 10)
  if (!Number.isFinite(year) || year < 1970 || year > 2100) {
    throw new Error(`Invalid ${flag} "${argv[idx + 1] ?? ''}"`)
  }
  return year
}

function parseOutputPath(argv, paths) {
  const hit = argv.find((arg) => arg.startsWith('--output='))
  if (hit) return path.resolve(hit.slice('--output='.length))
  return path.join(paths.REPORT_CARD_ROOT, 'public/edition/observations-by-year.csv')
}

function renderCsvRow(values) {
  return values
    .map((value) => {
      const text = String(value ?? '')
      return text.includes(',') || text.includes('"') ? `"${text.replace(/"/g, '""')}"` : text
    })
    .join(',')
}

async function main() {
  loadDotEnv()
  const argv = process.argv.slice(2)
  const dryRun = argv.includes('--dry-run')
  const obsFilter = resolveObsFilter(argv)
  const exportedAt = resolveExportAsOfDate()
  setExportAsOfDate(exportedAt)

  const endYear = parseYearArg(argv, '--to-year', Number(exportedAt.slice(0, 4)))
  const fromYear = parseYearArg(argv, '--from-year', 2015)
  if (fromYear > endYear) {
    throw new Error(`--from-year (${fromYear}) must be <= --to-year (${endYear})`)
  }

  const paths = resolveExportPaths(argv)
  const outputPath = parseOutputPath(argv, paths)
  const jsonPath = outputPath.replace(/\.csv$/i, '.json')

  process.stderr.write(
    `\nObservations by year (${fromYear}–${endYear}, obs-filter=${obsFilter})\n` +
      `Methodology: ${OBS_FILTER_LABELS[obsFilter]}\n` +
      `DB: ${formatDatabaseUrlForLog()}\n\n`,
  )

  /** @type {Array<{ year: number, periodStart: string, periodEnd: string, avgObsPerDay: number, daysWithData: number, totalObs: number, elapsedSec: number }>} */
  const rows = []

  for (let year = fromYear; year <= endYear; year += 1) {
    const { periodStart, periodEnd, rangeLabel } = resolveObservationRange({ year })

    if (dryRun) {
      const steps = buildObservationSteps({ year, obsFilter })
      process.stderr.write(`[dry-run] ${year}: ${steps.length} steps (${rangeLabel})\n`)
      rows.push({
        year,
        periodStart,
        periodEnd,
        avgObsPerDay: 0,
        daysWithData: 0,
        totalObs: 0,
        elapsedSec: 0,
      })
      continue
    }

    process.stderr.write(`→ ${year} (${periodStart} → ${periodEnd})…\n`)
    const t0 = Date.now()
    const { avgObsPerDay, daysWithData, totalObs } = collectObservationStats(
      { year, obsFilter },
      { quiet: true },
    )
    const elapsedSec = Number(((Date.now() - t0) / 1000).toFixed(1))
    rows.push({
      year,
      periodStart,
      periodEnd,
      avgObsPerDay,
      daysWithData,
      totalObs,
      elapsedSec,
    })
    process.stderr.write(
      `   avg ${avgObsPerDay.toLocaleString('en-US')}/day, total ${totalObs.toLocaleString('en-US')} (${elapsedSec}s)\n`,
    )
  }

  if (dryRun) {
    process.stderr.write('\n[dry-run] No files written.\n')
    return
  }

  const header = [
    'year',
    'period_start',
    'period_end',
    'avg_obs_per_day',
    'days_with_data',
    'total_obs',
  ]
  const csv = [
    renderCsvRow(header),
    ...rows.map((row) =>
      renderCsvRow([
        row.year,
        row.periodStart,
        row.periodEnd,
        row.avgObsPerDay,
        row.daysWithData,
        row.totalObs,
      ]),
    ),
  ].join('\n')

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${csv}\n`, 'utf8')

  const payload = {
    exportedAt,
    obsFilter,
    methodology: OBS_FILTER_LABELS[obsFilter],
    fromYear,
    toYear: endYear,
    rows: rows.map(({ elapsedSec: _e, ...row }) => row),
  }
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  process.stderr.write('\n--- Summary ---\n')
  process.stderr.write(
    `${'Year'.padEnd(6)} ${'Avg/day'.padStart(10)} ${'Days w/ data'.padStart(14)} ${'Total'.padStart(14)}\n`,
  )
  process.stderr.write(`${'-'.repeat(48)}\n`)
  for (const row of rows) {
    process.stderr.write(
      `${String(row.year).padEnd(6)} ${String(row.avgObsPerDay).padStart(10)} ${String(row.daysWithData).padStart(14)} ${String(row.totalObs).padStart(14)}\n`,
    )
  }

  process.stderr.write(`\nWrote ${outputPath}\nWrote ${jsonPath}\n`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

#!/usr/bin/env node
/**
 * Report card edition pipeline (single command before deploy):
 *   1. partner countries → report-card TS + simple-map JSON
 *   2. GeoJSON map layers → simple-map public/geojson
 *   3. observations per day → report-card headline stats
 *   4. GOOS tier subtotals → goosTierCounts.ts (after GeoJSON; reference obs = partner roll-up)
 */
import { loadDotEnv } from './databaseUrl.mjs'
import { runGeojsonExport } from './export-geojson.mjs'
import {
  referenceObservatoriesTotalFromPartner,
  runGoosTierCountsExport,
  writeReportCardTierCountsTs,
} from './export-goos-tier-counts.mjs'
import { runObservationsExport } from './export-observations-per-day.mjs'
import { runPartnerExport } from './export-partner-countries.mjs'
import { printCombinedExportSummary } from './exportSummary.mjs'
import { EXPORT_EDITION_LABEL } from './partner-export/exportConfig.mjs'
import { resolveExportPaths } from './paths.mjs'

loadDotEnv()

const argv = process.argv.slice(2)

try {
  const { byNetwork } = await runPartnerExport(argv, { noSummary: true })
  const { countsByLayer, lineStyleByLayer } = await runGeojsonExport(argv, { noSummary: true })
  const obsStats = await runObservationsExport(argv)
  const exportPaths = resolveExportPaths(argv)
  const tierReport = await runGoosTierCountsExport(argv)
  const referenceObservatories = referenceObservatoriesTotalFromPartner(byNetwork)
  writeReportCardTierCountsTs(tierReport, exportPaths.GOOS_TIER_COUNTS_TS, {
    referenceObservatories,
  })
  process.stderr.write(
    `Wrote ${exportPaths.GOOS_TIER_COUNTS_TS} (referenceObservatories=${referenceObservatories}, geojson tier report=${tierReport.groups.find((g) => g.id === 'referenceObservatories')?.subtotal})\n`,
  )
  printCombinedExportSummary(byNetwork, countsByLayer, lineStyleByLayer, {
    EXPORT_EDITION_LABEL,
    obsStats,
  })
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}

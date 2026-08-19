#!/usr/bin/env node
/**
 * Partner + GeoJSON exports with one combined summary at the end.
 */
import { loadDotEnv } from './databaseUrl.mjs'
import { runGeojsonExport } from './export-geojson.mjs'
import { runObservationsExport } from './export-observations-per-day.mjs'
import { runPartnerExport } from './export-partner-countries.mjs'
import { printCombinedExportSummary } from './exportSummary.mjs'
import { EXPORT_EDITION_LABEL } from './partner-export/exportConfig.mjs'

loadDotEnv()

const argv = process.argv.slice(2)

try {
  const { byNetwork } = await runPartnerExport(argv, { noSummary: true })
  const { countsByLayer } = await runGeojsonExport(argv, { noSummary: true })
  const obsStats = await runObservationsExport(argv)
  printCombinedExportSummary(byNetwork, countsByLayer, { EXPORT_EDITION_LABEL, obsStats })
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
}

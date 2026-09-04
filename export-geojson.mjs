#!/usr/bin/env node
/**
 * Export static GeoJSON map layers from OceanOPS PostgreSQL.
 *
 * Usage:
 *   node export-geojson.mjs [--dry-run] [--no-summary] [--layer=goship] [--layer=oceantrax] [--no-densify]
 *
 * Output: {geojson-dir}/{layerId}.geojson (default: simple-map public/geojson)
 *
 * Environment: OCEANOPS_DATABASE_URL, GEOJSON_EXPORT_EDITION
 *   OCEANOPS_SIMPLE_MAP_ROOT, GEOJSON_OUTPUT_DIR
 * Options: --simple-map-root=, --geojson-dir=
 * Edit sql/*.sql (pgAdmin), then npm run export:geojson.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { formatDatabaseUrlForLog, loadDotEnv } from './databaseUrl.mjs'
import { buildExportMetadata, patchExportMetadata } from './editionMetadata.mjs'
import { setExportAsOfDate, resolveExportAsOfDate } from './editionValues.mjs'
import { assertPsqlAvailable, runPsqlQuery } from './geojson-export/db.mjs'

loadDotEnv()
import { densifyFeatureCollection } from './geojson-export/densifyLayer.mjs'
import { summarizeLineStyles } from './geojson-export/lineStyleSummary.mjs'
import { LAYER_ID_TO_PARTNER_KEY } from './networkSql.mjs'
import {
  DENSIFY_LAYER_IDS,
  EXPORT_EDITION_LABEL,
  LAYER_MANIFEST,
  LAYER_IDS,
  printExportSummary,
  readLayerSql,
} from './geojson-export/exportConfig.mjs'
import {
  assertGeojsonExportTargets,
  resolveExportPaths,
} from './paths.mjs'

const __filename = fileURLToPath(import.meta.url)

/** @param {string[]} argv @returns {string[] | null} */
function parseLayerFilter(argv) {
  /** @type {string[]} */
  const layers = []
  for (const arg of argv) {
    if (!arg.startsWith('--layer=')) continue
    const value = arg.slice('--layer='.length)
    for (const id of value.split(',')) {
      const trimmed = id.trim()
      if (trimmed) layers.push(trimmed)
    }
  }
  return layers.length > 0 ? layers : null
}

/** @param {string[]} argv */
function parseGeojsonArgs(argv) {
  const exportPaths = resolveExportPaths(argv)
  const layerFilter = parseLayerFilter(argv)
  return {
    exportPaths,
    outputDir: exportPaths.GEOJSON_OUTPUT_DIR,
    simpleMapRoot: exportPaths.SIMPLE_MAP_ROOT,
    dryRun: argv.includes('--dry-run'),
    noSummary: argv.includes('--no-summary'),
    noDensify: argv.includes('--no-densify'),
    layerFilter,
  }
}

/** @param {string} filePath @param {unknown} geojson */
function writeGeoJson(filePath, geojson) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(geojson)}\n`, 'utf8')
}

/** @param {string} raw */
function parseFeatureCollection(raw) {
  if (!raw) {
    return { type: 'FeatureCollection', features: [] }
  }

  const parsed = JSON.parse(raw)
  if (parsed?.type !== 'FeatureCollection' || !Array.isArray(parsed.features)) {
    throw new Error('Expected PostgreSQL to return a GeoJSON FeatureCollection')
  }

  return parsed
}

/**
 * @param {string} layerId
 * @param {ReturnType<typeof parseGeojsonArgs>} opts
 */
async function exportLayer(layerId, opts) {
  const { outputDir: OUTPUT_DIR, simpleMapRoot: SIMPLE_MAP_ROOT, dryRun, noDensify } = opts
  const entry = LAYER_MANIFEST[layerId]
  const sql = readLayerSql(layerId)

  if (dryRun) {
    process.stderr.write(`\n--- ${layerId} (sql/${layerId}.sql) ---\n${sql}\n`)
    return { layerId, featureCount: 0, written: [], lineStyle: null }
  }

  const result = runPsqlQuery(sql)
  if (!result.ok) {
    throw new Error(`Export failed for "${layerId}": ${result.error}`)
  }

  const collection = parseFeatureCollection(result.stdout)
  const featureCount = collection.features.length
  const lineStyle =
    entry.geometryKind === 'line' ? summarizeLineStyles(collection) : null
  const written = []

  if (entry.geometryKind === 'line') {
    const undensifiedPath = path.join(OUTPUT_DIR, `${layerId}_undensified.geojson`)
    writeGeoJson(undensifiedPath, collection)
    written.push(undensifiedPath)

    const outputPath = path.join(OUTPUT_DIR, `${layerId}.geojson`)
    const finalCollection =
      noDensify || !DENSIFY_LAYER_IDS.includes(layerId)
        ? collection
        : densifyFeatureCollection(collection)

    writeGeoJson(outputPath, finalCollection)
    written.push(outputPath)
  } else {
    const outputPath = path.join(OUTPUT_DIR, `${layerId}.geojson`)
    writeGeoJson(outputPath, collection)
    written.push(outputPath)
  }

  const partnerKey = LAYER_ID_TO_PARTNER_KEY[layerId] ?? layerId
  process.stderr.write(`  ${partnerKey}: ${featureCount} features\n`)
  for (const filePath of written) {
    process.stderr.write(`    → ${path.relative(SIMPLE_MAP_ROOT, filePath)}\n`)
  }

  return { layerId, featureCount, written, lineStyle }
}

/** @param {string[]} [argv] @param {{ noSummary?: boolean }} [options] */
export async function runGeojsonExport(argv = process.argv.slice(2), options = {}) {
  const opts = parseGeojsonArgs(argv)
  const noSummary = options.noSummary ?? opts.noSummary
  const { exportPaths, outputDir: OUTPUT_DIR, simpleMapRoot: SIMPLE_MAP_ROOT, dryRun, layerFilter } = opts

  assertGeojsonExportTargets(exportPaths)

  if (!assertPsqlAvailable()) {
    throw new Error('psql is required but was not found on PATH')
  }

  const layerIds = (layerFilter ?? LAYER_IDS).filter((layerId) => {
    if (!LAYER_MANIFEST[layerId]) {
      process.stderr.write(`Unknown layer "${layerId}" — skipped\n`)
      return false
    }
    return true
  })

  if (layerIds.length === 0) {
    throw new Error('No layers selected for export')
  }

  const exportedAt = resolveExportAsOfDate()
  setExportAsOfDate(exportedAt)

  process.stderr.write(`GeoJSON export (${EXPORT_EDITION_LABEL})\n`)
  process.stderr.write(`Export as-of: ${exportedAt}\n`)
  process.stderr.write(`Database: ${formatDatabaseUrlForLog()}\n`)
  process.stderr.write(`Layers: ${layerIds.map((id) => LAYER_ID_TO_PARTNER_KEY[id] ?? id).join(', ')}\n`)
  if (dryRun) process.stderr.write('Mode: dry-run (SQL only, no files written)\n')

  /** @type {Record<string, number>} */
  const countsByLayer = {}
  /** @type {Record<string, import('./geojson-export/lineStyleSummary.mjs').LineStyleSummary>} */
  const lineStyleByLayer = {}

  for (const layerId of layerIds) {
    const result = await exportLayer(layerId, opts)
    countsByLayer[layerId] = result.featureCount
    if (result.lineStyle) lineStyleByLayer[layerId] = result.lineStyle
  }

  if (!noSummary) {
    printExportSummary(countsByLayer, lineStyleByLayer, layerIds)
  }

  if (!dryRun) {
    process.stderr.write(`\nWrote GeoJSON to ${path.relative(SIMPLE_MAP_ROOT, OUTPUT_DIR)}/\n`)
    const metadataPatch = buildExportMetadata(exportedAt)
    const metadataPath = path.join(OUTPUT_DIR, 'export-metadata.json')
    patchExportMetadata(metadataPath, metadataPatch)
    process.stderr.write(`  → ${path.relative(SIMPLE_MAP_ROOT, metadataPath)}\n`)

    const reportCardRoot = exportPaths.REPORT_CARD_ROOT
    if (fs.existsSync(reportCardRoot)) {
      const reportCardMetadataPath = path.join(
        reportCardRoot,
        'public/edition/export-metadata.json',
      )
      patchExportMetadata(reportCardMetadataPath, metadataPatch)
      process.stderr.write(
        `  → ${path.relative(reportCardRoot, reportCardMetadataPath)} (report-card)\n`,
      )
    }
  }

  return { countsByLayer, lineStyleByLayer }
}

async function main() {
  await runGeojsonExport()
}

function isDirectRun() {
  const entry = process.argv[1]
  if (!entry) return false
  return path.resolve(entry) === path.resolve(__filename)
}

if (isDirectRun()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  })
}

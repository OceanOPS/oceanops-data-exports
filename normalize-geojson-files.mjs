#!/usr/bin/env node
/**
 * Re-normalize committed GeoJSON under oceanops-simple-map (no DB).
 * Usage: node normalize-geojson-files.mjs [--geojson-dir=path]
 */
import fs from 'node:fs'
import path from 'node:path'
import { normalizeFeatureCollectionForEsri } from './geojson-export/normalizeForEsri.mjs'
import { resolveExportPaths } from './paths.mjs'

const argv = process.argv.slice(2)
const paths = resolveExportPaths(argv)
const dir = paths.GEOJSON_OUTPUT_DIR

if (!fs.existsSync(dir)) {
  console.error(`GeoJSON dir not found: ${dir}`)
  process.exit(1)
}

const files = fs.readdirSync(dir).filter((name) => name.endsWith('.geojson'))
let updated = 0

for (const name of files) {
  const filePath = path.join(dir, name)
  const raw = fs.readFileSync(filePath, 'utf8')
  const collection = JSON.parse(raw)
  if (collection?.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
    continue
  }
  normalizeFeatureCollectionForEsri(collection)
  fs.writeFileSync(filePath, `${JSON.stringify(collection)}\n`, 'utf8')
  updated += 1
  process.stderr.write(`Normalized ${name}\n`)
}

process.stderr.write(`Done: ${updated} file(s) in ${dir}\n`)

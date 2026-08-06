#!/usr/bin/env node
/**
 * Densify line GeoJSON for the 3D globe (GO-SHIP, SOOP XBT, etc.).
 * Implementation: geojson-export/densifyLayer.mjs
 *
 * Usage:
 *   node densify-geojson.mjs <input.geojson> <output.geojson> [rhumb|geodesic] [stepKm]
 *
 * Default: rhumb, 80 km — transects follow loxodromes; geodesic arcs cut over Antarctica.
 */

import fs from 'node:fs'
import path from 'node:path'
import { densifyFeatureCollection } from './geojson-export/densifyLayer.mjs'

const [input, output, modeArg, stepKmArg] = process.argv.slice(2)

if (!input || !output) {
  process.stderr.write(
    'Usage: node densify-geojson.mjs <input.geojson> <output.geojson> [rhumb|geodesic] [stepKm]\n',
  )
  process.exit(1)
}

const mode = modeArg === 'geodesic' ? 'geodesic' : 'rhumb'
const stepKm = stepKmArg !== undefined ? Number(stepKmArg) : 80

if (!Number.isFinite(stepKm) || stepKm <= 0) {
  process.stderr.write('stepKm must be a positive number\n')
  process.exit(1)
}

const src = JSON.parse(fs.readFileSync(input, 'utf8'))
const out = densifyFeatureCollection(src, { mode, stepKm })

fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true })
fs.writeFileSync(output, `${JSON.stringify(out)}\n`, 'utf8')

process.stderr.write(
  `Wrote ${output} (${out.features.length} features, mode=${mode}, stepKm=${stepKm})\n`,
)

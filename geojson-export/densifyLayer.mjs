/**
 * Densify line GeoJSON for 3D globe display.
 * Used by export-geojson.mjs and densify-geojson.mjs (single implementation).
 */

import * as turf from '@turf/turf'

/** @typedef {'geodesic' | 'rhumb' | 'hybrid'} DensifyMode */

/**
 * @param {number} lon
 * @returns {number}
 */
function normalizeLon(lon) {
  return ((((lon + 180) % 360) + 360) % 360) - 180
}

/**
 * Flatten nested coordinate arrays from turf greatCircle antimeridian splits.
 *
 * @param {unknown} coords
 * @returns {[number, number][]}
 */
function flattenCoords(coords) {
  /** @type {[number, number][]} */
  const out = []

  /** @param {unknown} value */
  function walk(value) {
    if (!Array.isArray(value) || value.length === 0) return
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      out.push([normalizeLon(value[0]), value[1]])
      return
    }
    for (const item of value) walk(item)
  }

  walk(coords)
  return out
}

/**
 * Geodesic for mid-latitude transects; rhumb for high-latitude east–west segments
 * (avoids great-circle arcs cutting over Antarctica — prod behaviour).
 *
 * @param {[number, number]} a
 * @param {[number, number]} b
 * @returns {'geodesic' | 'rhumb'}
 */
export function chooseSegmentMode(a, b) {
  const latA = a[1]
  const latB = b[1]
  const maxAbsLat = Math.max(Math.abs(latA), Math.abs(latB))
  const latSpan = Math.abs(latA - latB)

  let lonSpan = Math.abs(a[0] - b[0])
  if (lonSpan > 180) lonSpan = 360 - lonSpan

  const isEastWest = latSpan < 5 && lonSpan > 20
  const isHighLat = maxAbsLat >= 55

  if (isEastWest && isHighLat) return 'rhumb'
  return 'geodesic'
}

/** @param {[number, number]} a @param {[number, number]} b */
function isDatelineContinuation(a, b) {
  const latTol = 0.5
  if (Math.abs(a[1] - b[1]) > latTol) return false
  return Math.abs(a[0]) > 170 && Math.abs(b[0]) > 170
}

/**
 * Collapse MultiLineString parts split at ±180° on the same parallel (e.g. S04P).
 *
 * @param {number[][][]} parts
 * @returns {number[][][]}
 */
export function mergeDatelineParts(parts) {
  if (parts.length <= 1) return parts

  /** @type {number[][][]} */
  const merged = []
  let i = 0

  while (i < parts.length) {
    let start = parts[i][0]
    let end = parts[i][parts[i].length - 1]
    let j = i + 1

    while (j < parts.length) {
      const nextPart = parts[j]
      const nextStart = nextPart[0]
      const nextEnd = nextPart[nextPart.length - 1]

      if (isDatelineContinuation(end, nextStart)) {
        end = nextEnd
        j++
      } else {
        break
      }
    }

    if (j === i + 1) {
      merged.push(parts[i])
    } else {
      merged.push([start, end])
    }

    i = j
  }

  return merged
}

/**
 * @param {[number, number]} a
 * @param {[number, number]} b
 * @param {{ mode?: DensifyMode, stepKm?: number }} [options]
 * @returns {[number, number][]}
 */
function densifyPair(a, b, { mode = 'geodesic', stepKm = 100 } = {}) {
  const segmentMode = mode === 'hybrid' ? chooseSegmentMode(a, b) : mode

  if (segmentMode === 'geodesic') {
    const dist = turf.distance(a, b, { units: 'kilometers' })
    const n = Math.max(0, Math.ceil(dist / stepKm) - 1)
    if (n <= 0) return [b]

    const gc = turf.greatCircle(a, b, { npoints: n + 2 })
    const flat = flattenCoords(gc.geometry.coordinates)
    if (flat.length <= 1) return [b]
    return flat.slice(1)
  }

  const dist = turf.rhumbDistance(a, b, { units: 'kilometers' })
  const n = Math.max(0, Math.ceil(dist / stepKm) - 1)
  if (n <= 0) return [b]

  const bearing = turf.rhumbBearing(a, b)
  /** @type {[number, number][]} */
  const out = []
  for (let i = 1; i <= n; i++) {
    const frac = i / (n + 1)
    const p = turf.rhumbDestination(a, dist * frac, bearing, { units: 'kilometers' })
    out.push([normalizeLon(p.geometry.coordinates[0]), p.geometry.coordinates[1]])
  }
  out.push(b)
  return out
}

/** @param {number[][]} coords @param {{ mode?: DensifyMode, stepKm?: number }} options */
function densifyLineString(coords, options) {
  if (!coords || coords.length < 2) return coords ?? []

  /** @type {[number, number][]} */
  const out = [[normalizeLon(coords[0][0]), coords[0][1]]]

  for (let i = 0; i < coords.length - 1; i++) {
    const a = out[out.length - 1]
    const b = [normalizeLon(coords[i + 1][0]), coords[i + 1][1]]
    out.push(...densifyPair(a, b, options))
  }

  return out
}

/**
 * Split a densified line at antimeridian jumps so 3D dashed line symbols
 * do not draw straight chords over the pole (path tubes tolerate the jump).
 *
 * @param {number[][]} coords
 * @returns {number[][][]}
 */
export function splitAtAntimeridian(coords) {
  if (!coords || coords.length < 2) return coords?.length ? [coords] : []

  /** @type {number[][][]} */
  const parts = []
  /** @type {number[][]} */
  let current = [coords[0]]

  for (let i = 1; i < coords.length; i++) {
    const prev = current[current.length - 1]
    const next = coords[i]
    const dlon = next[0] - prev[0]

    if (Math.abs(dlon) > 180) {
      if (current.length >= 2) parts.push(current)
      current = [next]
    } else {
      current.push(next)
    }
  }

  if (current.length >= 2) parts.push(current)
  return parts
}

/** @param {number[][][]} parts @param {Record<string, unknown>} props */
function pushLineFeature(out, parts, props) {
  const valid = parts.filter((part) => part.length >= 2)
  if (valid.length === 0) return
  if (valid.length === 1) {
    out.features.push(turf.lineString(valid[0], props))
  } else {
    out.features.push(turf.multiLineString(valid, props))
  }
}

/**
 * @param {import('geojson').FeatureCollection} collection
 * @param {{ mode?: DensifyMode, stepKm?: number }} [options]
 * @returns {import('geojson').FeatureCollection}
 */
export function densifyFeatureCollection(collection, options = {}) {
  const mode = options.mode ?? 'hybrid'
  const stepKm = options.stepKm ?? 80
  const out = { type: 'FeatureCollection', features: [] }

  for (const feature of collection.features ?? []) {
    const props = feature.properties ?? {}
    const geometry = feature.geometry
    if (!geometry) continue

    if (geometry.type === 'LineString') {
      const coords = densifyLineString(geometry.coordinates, { mode, stepKm })
      pushLineFeature(out, splitAtAntimeridian(coords), props)
      continue
    }

    if (geometry.type === 'MultiLineString') {
      /** @type {number[][][]} */
      const parts = []
      for (const part of geometry.coordinates) {
        const coords = densifyLineString(part, { mode, stepKm })
        parts.push(...splitAtAntimeridian(coords))
      }
      pushLineFeature(out, parts, props)
      continue
    }

    out.features.push(feature)
  }

  return out
}

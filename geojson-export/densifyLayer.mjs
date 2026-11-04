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
 * Subdivide any remaining edge longer than `maxKm` (polar / great-circle edge cases).
 *
 * @param {number[][]} coords
 * @param {number} maxKm
 * @param {{ mode?: DensifyMode, stepKm?: number }} options
 */
function capSegmentLength(coords, maxKm, options) {
  if (!coords || coords.length < 2) return coords ?? []

  /** @type {[number, number][]} */
  const out = [[normalizeLon(coords[0][0]), coords[0][1]]]

  for (let i = 1; i < coords.length; i++) {
    let a = out[out.length - 1]
    let b = [normalizeLon(coords[i][0]), coords[i][1]]

    for (;;) {
      const dist = turf.distance(a, b, { units: 'kilometers' })
      if (dist <= maxKm) {
        out.push(b)
        break
      }
      const inserted = densifyPair(a, b, {
        mode: options.mode ?? 'hybrid',
        stepKm: Math.min(options.stepKm ?? 80, maxKm * 0.45),
      })
      if (inserted.length === 0) {
        out.push(b)
        break
      }
      for (const p of inserted.slice(0, -1)) out.push(p)
      a = out[out.length - 1]
    }
  }

  return out
}

/**
 * Join MultiLineString parts split at ±180° into one chain with continuous longitude
 * (e.g. 179°E → −181° after −180°) so 3D path tubes do not leave a visible gap.
 *
 * @param {number[][][]} parts
 * @returns {number[][]}
 */
export function stitchMultilineAcrossDateline(parts) {
  if (!parts?.length) return []
  /** @type {number[][]} */
  let out = parts[0].map((c) => [normalizeLon(c[0]), c[1]])
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]
    if (!part.length) continue
    const end = out[out.length - 1]
    let lon = normalizeLon(part[0][0])
    const lat = part[0][1]
    if (isDatelineContinuation(end, [lon, lat]) || Math.abs(lon - end[0]) > 180) {
      if (end[0] < 0 && lon > 0) lon -= 360
      else if (end[0] > 0 && lon < 0) lon += 360
    }
    out.push([lon, lat])
    for (let k = 1; k < part.length; k++) {
      out.push([normalizeLon(part[k][0]), part[k][1]])
    }
  }
  return unwrapLongitudeContinuity(out)
}

/**
 * Remove ±360° jumps between consecutive vertices (post-densify / post-stitch).
 *
 * @param {number[][]} coords
 * @returns {number[][]}
 */
export function unwrapLongitudeContinuity(coords) {
  if (!coords || coords.length < 2) return coords ?? []
  /** @type {number[][]} */
  const out = [[coords[0][0], coords[0][1]]]
  for (let i = 1; i < coords.length; i++) {
    let lon = normalizeLon(coords[i][0])
    const lat = coords[i][1]
    const prevLon = out[out.length - 1][0]
    const dlon = lon - prevLon
    if (dlon > 180) lon -= 360
    else if (dlon < -180) lon += 360
    out.push([lon, lat])
  }
  return out
}

/**
 * Split a densified line at antimeridian jumps (legacy / flat-map workflows).
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
  const stepKm = options.stepKm ?? 50
  const maxSegmentKm = options.maxSegmentKm ?? stepKm * 1.05
  const out = { type: 'FeatureCollection', features: [] }

  for (const feature of collection.features ?? []) {
    const props = feature.properties ?? {}
    const geometry = feature.geometry
    if (!geometry) continue

    if (geometry.type === 'LineString') {
      let coords = densifyLineString(geometry.coordinates, { mode, stepKm })
      coords = capSegmentLength(coords, maxSegmentKm, { mode, stepKm })
      coords = unwrapLongitudeContinuity(coords)
      pushLineFeature(out, [coords], props)
      continue
    }

    if (geometry.type === 'MultiLineString') {
      const stitched = stitchMultilineAcrossDateline(geometry.coordinates)
      let coords = densifyLineString(stitched, { mode, stepKm })
      coords = capSegmentLength(coords, maxSegmentKm, { mode, stepKm })
      coords = unwrapLongitudeContinuity(coords)
      pushLineFeature(out, [coords], props)
      continue
    }

    out.features.push(feature)
  }

  return out
}

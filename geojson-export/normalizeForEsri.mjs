/**
 * Esri GeoJSONLayer warns when property types mix (e.g. null vs string, bool vs null).
 * Normalize features so inference is stable and optional fields are not dropped.
 */

/** @type {ReadonlySet<string>} */
const INTEGER_PROPS = new Set([
  'ptf_id',
  'line_id',
  'stack_mask',
  'soconet_mooring_count',
])

/** Stored as 0/1 so Esri sees one numeric type (GeoJSON booleans confuse inference). */
/** @type {ReadonlySet<string>} */
const BOOLEAN_AS_INT_PROPS = new Set([
  'sampled_in_edition',
  'last_cruise_ship_masked',
  'next_cruise_ship_masked',
])

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function truthy(value) {
  return value === true || value === 1 || value === 'true' || value === '1'
}

/**
 * @param {Record<string, unknown>} props
 * @returns {Record<string, unknown>}
 */
export function normalizeFeatureProperties(props) {
  /** @type {Record<string, unknown>} */
  const out = {}

  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === null || value === undefined) {
      if (INTEGER_PROPS.has(key) || BOOLEAN_AS_INT_PROPS.has(key)) {
        out[key] = 0
      } else {
        out[key] = ''
      }
      continue
    }

    if (BOOLEAN_AS_INT_PROPS.has(key)) {
      out[key] = truthy(value) ? 1 : 0
      continue
    }

    if (INTEGER_PROPS.has(key)) {
      const n = Number(value)
      out[key] = Number.isFinite(n) ? Math.trunc(n) : 0
      continue
    }

    out[key] = value
  }

  return out
}

/**
 * @param {import('geojson').FeatureCollection} collection
 * @returns {import('geojson').FeatureCollection}
 */
export function normalizeFeatureCollectionForEsri(collection) {
  for (const feature of collection.features) {
    if (!feature.properties) continue
    feature.properties = normalizeFeatureProperties(
      /** @type {Record<string, unknown>} */ (feature.properties)
    )
  }
  return collection
}

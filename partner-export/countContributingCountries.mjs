import { geoNamesForIso } from '../geoCountryNames.mjs'
import { NETWORK_KEYS } from './networkFilters.mjs'
import { FILTERABLE_GEO_COUNTRIES } from './filterableGeoCountries.mjs'

/** @param {Record<string, number>} networks */
function countryTotal(networks) {
  return NETWORK_KEYS.reduce((sum, key) => sum + Math.max(0, networks[key] ?? 0), 0)
}

/**
 * Contributing countries for report card + map filter (post-rollup ISO rows).
 * Rules: FILTERABLE_GEO_COUNTRIES whitelist, geoCountryNames mapping, total > 0.
 *
 * @param {Map<string, Record<string, number>>} countries
 */
export function countContributingCountries(countries) {
  /** @type {Record<string, string>} */
  const byGeo = {}

  for (const iso of countries.keys()) {
    for (const geo of geoNamesForIso(iso)) {
      byGeo[geo] = iso
    }
  }

  let count = 0
  for (const geo of FILTERABLE_GEO_COUNTRIES) {
    const iso = byGeo[geo]
    if (!iso || !countries.has(iso)) continue
    if (countryTotal(countries.get(iso)) > 0) count += 1
  }

  return count
}

/**
 * ISO codes for contributing countries (same rules as countContributingCountries).
 * @param {Map<string, Record<string, number>>} countries
 * @returns {string[]}
 */
export function listContributingCountryIsos(countries) {
  /** @type {Record<string, string>} */
  const byGeo = {}

  for (const iso of countries.keys()) {
    for (const geo of geoNamesForIso(iso)) {
      byGeo[geo] = iso
    }
  }

  /** @type {string[]} */
  const isos = []
  for (const geo of FILTERABLE_GEO_COUNTRIES) {
    const iso = byGeo[geo]
    if (!iso || !countries.has(iso)) continue
    if (countryTotal(countries.get(iso)) > 0) isos.push(iso)
  }

  return [...new Set(isos)].sort()
}

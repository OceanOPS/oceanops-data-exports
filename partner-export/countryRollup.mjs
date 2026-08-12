/**
 * Partner country roll-up rules (aligned with stats_country_networks_amelioree.sql).
 * - Merge ISO rows before writing partnerCountries.*
 * - Exclude non-reporting geographies
 */

/** ISO codes dropped from partner export (Unknown, Antarctica, United Nations). */
export const EXCLUDED_PARTNER_ISO = new Set([
  'AQ',
  'UN',
  'UNKNOWN',
])

/** ISO codes merged into a single reporting row (values summed). */
export const PARTNER_ISO_ROLLUP = {
  HK: 'CN',
}

/**
 * @param {string} code
 * @returns {string | null} Target ISO, or null when excluded.
 */
export function normalizePartnerIso(code) {
  const iso = String(code ?? '').trim().toUpperCase()
  if (!iso || iso === 'NULL' || iso === 'UNDEFINED') return null

  const rolled = PARTNER_ISO_ROLLUP[iso] ?? iso
  if (EXCLUDED_PARTNER_ISO.has(rolled) || EXCLUDED_PARTNER_ISO.has(iso)) return null
  return rolled
}

/**
 * @param {Map<string, Record<string, number>>} countries
 * @param {readonly string[]} networkKeys
 * @returns {Map<string, Record<string, number>>}
 */
export function rollupPartnerCountries(countries, networkKeys) {
  /** @type {Map<string, Record<string, number>>} */
  const rolled = new Map()

  for (const [code, networks] of countries) {
    const target = normalizePartnerIso(code)
    if (!target) continue

    if (!rolled.has(target)) {
      rolled.set(
        target,
        Object.fromEntries(networkKeys.map((k) => [k, 0])),
      )
    }

    const bucket = rolled.get(target)
    for (const key of networkKeys) {
      bucket[key] += networks[key] ?? 0
    }
  }

  for (const [code, networks] of rolled) {
    const hasAny = networkKeys.some((k) => (networks[k] ?? 0) > 0)
    if (!hasAny) rolled.delete(code)
  }

  return rolled
}

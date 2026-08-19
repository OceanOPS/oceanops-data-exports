/**
 * Read-only per-source queries for observations-per-day export.
 *
 * Source hierarchy (avoids cross-source dedup — one canonical table per network):
 * - Argo          → obs_argo_gdac (not obs GTS)
 * - OceanGliders  → obs_gliders_gdac + obs_gliders_ioos + obs_gliders_voto (not GTS OSMC, not obs)
 * - Tsunami       → obs_tsuna_gts_osmc (not obs)
 * - AniBOS        → obs_anibos_meop
 * - FVON          → obs_fishingvessel_fishydata
 * - Rest (DBCP, VOS, XBT, …) → obs (filter via obsFilter)
 *
 * obsFilter on oceanops.obs:
 * - all          — no network exclusion, ptf_id IS NOT NULL
 * - exclude-argo — exclude Argo only (network 1000620), ptf_id IS NOT NULL
 * - hierarchy    — exclude Argo/Gliders/Tsunami from obs, ptf_id IS NOT NULL (default)
 *
 * Each step returns day|count (~1 row/day). Node sums per day. No DDL on prod.
 */

/** @see obs_info.compute_obs_stats — same network ids */
export const NETWORK_ARGO = 1000620
export const NETWORK_GLIDERS = 1000640
/** Tsunameter buoys (obs_tsuna_gts_osmc is canonical; exclude from obs). */
export const PTF_TYPE_TSUNAMI = 2000

/** @typedef {'all' | 'exclude-argo' | 'hierarchy'} ObsFilter */

export const OBS_FILTER_LABELS = {
  all: 'obs: all platforms, ptf_id IS NOT NULL',
  'exclude-argo': 'obs: excl. Argo only, ptf_id IS NOT NULL',
  hierarchy: 'obs: excl. Argo/Gliders/Tsunami, ptf_id IS NOT NULL',
}

const OBS_PTF_NOT_NULL = 'AND o.ptf_id IS NOT NULL'

const OBS_EXCLUDE_ARGO = `
AND NOT EXISTS (
  SELECT 1
  FROM oceanops.network_ptf np
  WHERE np.ptf_id = o.ptf_id
    AND np.network_id = ${NETWORK_ARGO}
)`.trim()

const OBS_EXCLUDE_GLIDERS = `
AND NOT EXISTS (
  SELECT 1
  FROM oceanops.network_ptf np
  WHERE np.ptf_id = o.ptf_id
    AND np.network_id = ${NETWORK_GLIDERS}
)`.trim()

const OBS_EXCLUDE_TSUNAMI = `
AND NOT EXISTS (
  SELECT 1
  FROM oceanops.ptf p
  JOIN oceanops.ptf_model pm ON pm.id = p.ptf_model_id
  JOIN oceanops.ptf_type pt ON pt.id = pm.ptf_type_id
  WHERE p.id = o.ptf_id
    AND pt.id = ${PTF_TYPE_TSUNAMI}
)`.trim()

const OBS_EXCLUDE_HIERARCHY = `
${OBS_EXCLUDE_ARGO}
${OBS_EXCLUDE_GLIDERS}
${OBS_EXCLUDE_TSUNAMI}`.trim()

/** @param {ObsFilter} obsFilter */
export function obsWhereClause(obsFilter) {
  switch (obsFilter) {
    case 'all':
      return OBS_PTF_NOT_NULL
    case 'exclude-argo':
      return `${OBS_PTF_NOT_NULL}\n${OBS_EXCLUDE_ARGO}`
    case 'hierarchy':
      return `${OBS_PTF_NOT_NULL}\n${OBS_EXCLUDE_HIERARCHY}`
    default:
      throw new Error(`Unknown obsFilter: ${obsFilter}`)
  }
}

/** @param {ObsFilter} obsFilter */
export function obsChunkLabel(obsFilter) {
  switch (obsFilter) {
    case 'all':
      return 'obs (GTS MF, all, ptf_id NOT NULL)'
    case 'exclude-argo':
      return 'obs (GTS MF, excl. Argo, ptf_id NOT NULL)'
    case 'hierarchy':
      return 'obs (GTS MF, excl. Argo/Gliders/Tsunami, ptf_id NOT NULL)'
    default:
      return 'obs'
  }
}

/** @param {number} daysWindow @returns {{ label: string, fromSql: string, toSql: string }[]} */
export function obsMonthChunks(daysWindow) {
  const since = `(CURRENT_DATE - INTERVAL '${daysWindow} days')`
  const until = `(CURRENT_DATE + INTERVAL '1 day')`

  if (daysWindow <= 31) {
    return [{ label: `${daysWindow}-day window`, fromSql: since, toSql: until }]
  }

  /** @type {{ label: string, fromSql: string, toSql: string }[]} */
  const chunks = []
  const monthSpan = Math.min(12, Math.ceil(daysWindow / 28) + 1)
  for (let m = 0; m < monthSpan; m += 1) {
    const from = `(date_trunc('month', ${since}) + INTERVAL '${m} months')`
    const to = `(date_trunc('month', ${since}) + INTERVAL '${m + 1} months')`
    chunks.push({
      label: `month ${m + 1}/${monthSpan}`,
      fromSql: `GREATEST(${from}, ${since})`,
      toSql: `LEAST(${to}, ${until})`,
    })
  }
  return chunks
}

/**
 * @param {{ daysWindow?: number, year?: number }} range
 * @returns {{ label: string, obsChunks: { label: string, fromSql: string, toSql: string }[], since: string, until: string | null, rangeLabel: string }}
 */
export function resolveObservationRange(range) {
  if (range.year) {
    const year = range.year
    const since = `'${year}-01-01'::timestamp`
    const until = `'${year + 1}-01-01'::timestamp`
    return {
      label: String(year),
      obsChunks: [{ label: String(year), fromSql: since, toSql: until }],
      since,
      until,
      rangeLabel: `calendar year ${year}`,
    }
  }

  const daysWindow = range.daysWindow ?? 365
  return {
    label: `${daysWindow}-day`,
    obsChunks: obsMonthChunks(daysWindow),
    since: `(CURRENT_DATE - INTERVAL '${daysWindow} days')::timestamp`,
    until: null,
    rangeLabel: `rolling ${daysWindow}-day window`,
  }
}

/**
 * @param {string} table
 * @param {string} fromBound
 * @param {string | null} [toBound]
 * @param {string} [extraWhere]
 */
export function sqlDailyCounts(table, fromBound, toBound = null, extraWhere = '') {
  const toClause = toBound ? `AND o.obs_date < ${toBound}` : ''
  return `
SET statement_timeout = 0;
SELECT to_char(date_trunc('day', o.obs_date)::date, 'YYYY-MM-DD') AS day, COUNT(*)::bigint AS cnt
FROM ${table} o
WHERE o.obs_date >= ${fromBound}
  ${toClause}
  ${extraWhere}
GROUP BY date_trunc('day', o.obs_date)::date
ORDER BY 1
`.trim()
}

/**
 * @param {{ daysWindow?: number, year?: number, obsFilter?: ObsFilter }} [opts]
 */
export function buildObservationSteps(opts = {}) {
  const obsFilter = opts.obsFilter ?? 'hierarchy'
  const obsWhere = obsWhereClause(obsFilter)
  const obsLabel = obsChunkLabel(obsFilter)
  const { obsChunks, since, until } = resolveObservationRange(opts)
  /** @type {{ label: string, sql: string }[]} */
  const steps = []

  for (const chunk of obsChunks) {
    steps.push({
      label: `${obsLabel} ${chunk.label}`,
      sql: sqlDailyCounts('oceanops.obs', chunk.fromSql, chunk.toSql, obsWhere),
    })
  }

  const hierarchySources = [
    ['obs_argo_gdac (Argo)', 'oceanops.obs_argo_gdac'],
    ['obs_gliders_gdac (Gliders)', 'oceanops.obs_gliders_gdac'],
    ['obs_gliders_ioos (Gliders)', 'oceanops.obs_gliders_ioos'],
    ['obs_gliders_voto (Gliders)', 'oceanops.obs_gliders_voto'],
    ['obs_tsuna_gts_osmc (Tsunami)', 'oceanops.obs_tsuna_gts_osmc'],
    ['obs_anibos_meop (AniBOS)', 'oceanops.obs_anibos_meop'],
    ['obs_fishingvessel_fishydata (FVON)', 'oceanops.obs_fishingvessel_fishydata'],
  ]

  for (const [label, table] of hierarchySources) {
    steps.push({
      label,
      sql: sqlDailyCounts(table, since, until),
    })
  }

  return steps
}

/** @param {Map<string, number>} byDay */
export function aggregateDailyCounts(byDay) {
  const dailyCounts = [...byDay.values()]
  const daysWithData = dailyCounts.length
  const totalObs = dailyCounts.reduce((sum, n) => sum + n, 0)
  const avgObsPerDay =
    daysWithData > 0 ? Math.round(totalObs / daysWithData) : 0
  return { avgObsPerDay, daysWithData, totalObs }
}

/** @param {Map<string, number>} byDay @param {string} stdout */
export function mergeDailyCountLines(byDay, stdout) {
  let lines = 0
  let added = 0
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const [day, countRaw] = trimmed.split('|')
    const count = Number.parseInt(countRaw, 10)
    if (!day || !Number.isFinite(count)) continue
    lines += 1
    byDay.set(day, (byDay.get(day) ?? 0) + count)
    added += count
  }
  return { lines, added }
}

/** @param {string} value @returns {ObsFilter | null} */
export function parseObsFilter(value) {
  if (value === 'argo-only') return 'exclude-argo'
  if (value === 'all' || value === 'exclude-argo' || value === 'hierarchy') {
    return value
  }
  return null
}

/** @param {string[]} argv @returns {number | null} */
export function resolveObsYear(argv) {
  const idx = argv.findIndex((arg) => arg === '--year')
  if (idx < 0) return null
  const year = Number.parseInt(String(argv[idx + 1] ?? ''), 10)
  if (!Number.isFinite(year) || year < 1970 || year > 2100) {
    throw new Error(`Invalid --year "${argv[idx + 1] ?? ''}" (expected e.g. 2025)`)
  }
  return year
}

/** @param {string[]} argv @returns {ObsFilter} */
export function resolveObsFilter(argv) {
  const idx = argv.findIndex((arg) => arg === '--obs-filter')
  if (idx >= 0) {
    const raw = argv[idx + 1]
    const parsed = parseObsFilter(raw ?? '')
    if (!parsed) {
      throw new Error(
        `Invalid --obs-filter "${raw ?? ''}" (expected: all, exclude-argo, hierarchy)`,
      )
    }
    return parsed
  }
  return 'hierarchy'
}

export const OBS_FILTER_VARIANTS = /** @type {const} */ (['all', 'exclude-argo', 'hierarchy'])

/**
 * GTS-only per-network observation counts (aligned with obs_info.compute_obs_stats).
 * Read-only COUNT(*) grouped by day — no DDL on prod.
 */

import { sqlDailyCounts } from './queries.mjs'

/** @see obs_info.compute_obs_stats */
export const NETWORK_ARGO = 1000620
export const NETWORK_DBCP = 1000621
export const NETWORK_VOS = 1000020
export const NETWORK_XBT = 1000040
export const NETWORK_GLIDERS = 1000640
export const PTF_TYPE_TSUNAMI = 2000

const PTF_NOT_NULL = 'AND o.ptf_id IS NOT NULL'

/** @param {number} networkId */
function networkExists(networkId) {
  return `
AND EXISTS (
  SELECT 1 FROM oceanops.network_ptf np
  WHERE np.ptf_id = o.ptf_id AND np.network_id = ${networkId}
)`.trim()
}

/** @param {string} familyCondition e.g. "pf.id IN (4, 22)" or "pt.id = 2000" */
function ptfTypeExists(familyCondition) {
  return `
AND EXISTS (
  SELECT 1
  FROM oceanops.ptf p
  JOIN oceanops.ptf_model pm ON pm.id = p.ptf_model_id
  JOIN oceanops.ptf_type pt ON pt.id = pm.ptf_type_id
  JOIN oceanops.ptf_family pf ON pf.id = pt.ptf_family_id
  WHERE p.id = o.ptf_id AND ${familyCondition}
)`.trim()
}

/** @typedef {{ id: string, label: string, gtsSource: 'GTS MF' | 'GTS OSMC', table: string, extraWhere: string }} GtsNetworkDef */

/** @type {GtsNetworkDef[]} */
export const GTS_NETWORKS = [
  {
    id: 'argo',
    label: 'Argo',
    gtsSource: 'GTS MF',
    table: 'oceanops.obs',
    extraWhere: `
${PTF_NOT_NULL}
${networkExists(NETWORK_ARGO)}`,
  },
  {
    id: 'dbcp-drifting',
    label: 'DBCP drifting buoys',
    gtsSource: 'GTS MF',
    table: 'oceanops.obs',
    extraWhere: `
${PTF_NOT_NULL}
${networkExists(NETWORK_DBCP)}
${ptfTypeExists('pf.id IN (4, 22)')}`,
  },
  {
    id: 'dbcp-moored',
    label: 'DBCP moored buoys',
    gtsSource: 'GTS MF',
    table: 'oceanops.obs',
    extraWhere: `
${PTF_NOT_NULL}
${networkExists(NETWORK_DBCP)}
${ptfTypeExists('pf.id = 3')}`,
  },
  {
    id: 'vos',
    label: 'VOS (SOT)',
    gtsSource: 'GTS MF',
    table: 'oceanops.obs',
    extraWhere: `
${PTF_NOT_NULL}
${networkExists(NETWORK_VOS)}`,
  },
  {
    id: 'soop-xbt',
    label: 'Ocean TraX (SOT)',
    gtsSource: 'GTS MF',
    table: 'oceanops.obs',
    extraWhere: `
${PTF_NOT_NULL}
${networkExists(NETWORK_XBT)}`,
  },
  {
    id: 'oceangliders',
    label: 'OceanGliders',
    gtsSource: 'GTS OSMC',
    table: 'oceanops.obs_gliders_gts_osmc',
    extraWhere: `
${PTF_NOT_NULL}
${networkExists(NETWORK_GLIDERS)}`,
  },
  {
    id: 'tsunameter',
    label: 'DBCP tsunameter buoys',
    gtsSource: 'GTS OSMC',
    table: 'oceanops.obs_tsuna_gts_osmc',
    extraWhere: `
${PTF_NOT_NULL}
${networkExists(NETWORK_DBCP)}
${ptfTypeExists(`pt.id = ${PTF_TYPE_TSUNAMI}`)}`,
  },
]

/**
 * Period bounds for YoY export.
 * When focusYear is the current calendar year, both periods share the same month-day end.
 * @param {number} targetYear row year to query
 * @param {number} focusYear CLI --year (the "current" side of the comparison)
 * @param {Date} [referenceDate]
 */
export function yoyPeriodForYear(targetYear, focusYear, referenceDate = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  const since = `${targetYear}-01-01`
  let endInclusive

  if (focusYear === referenceDate.getFullYear()) {
    endInclusive = `${targetYear}-${pad(referenceDate.getMonth() + 1)}-${pad(referenceDate.getDate())}`
  } else {
    endInclusive = `${targetYear}-12-31`
  }

  return {
    sinceSql: `'${since}'::timestamp`,
    untilSql: `(('${endInclusive}'::date + INTERVAL '1 day')::timestamp)`,
    label: `${since} → ${endInclusive}`,
  }
}

/**
 * @param {GtsNetworkDef} network
 * @param {{ sinceSql: string, untilSql: string }} period
 */
export function sqlGtsNetworkDailyCounts(network, period) {
  return sqlDailyCounts(
    network.table,
    period.sinceSql,
    period.untilSql,
    network.extraWhere,
  )
}

/** @param {number} year @param {Date} [referenceDate] */
export function buildGtsNetworkYoySteps(year, referenceDate = new Date()) {
  const current = yoyPeriodForYear(year, year, referenceDate)
  const previous = yoyPeriodForYear(year - 1, year, referenceDate)

  /** @type {{ label: string, sql: string, period: 'current' | 'previous', networkId: string }[]} */
  const steps = []

  for (const network of GTS_NETWORKS) {
    steps.push({
      networkId: network.id,
      period: 'current',
      label: `${network.label} (${network.gtsSource}) ${year}`,
      sql: sqlGtsNetworkDailyCounts(network, current),
    })
    steps.push({
      networkId: network.id,
      period: 'previous',
      label: `${network.label} (${network.gtsSource}) ${year - 1}`,
      sql: sqlGtsNetworkDailyCounts(network, previous),
    })
  }

  return { steps, current, previous, previousYear: year - 1 }
}

/** @param {Map<string, number>} byDay */
export function summarizeDailyCounts(byDay) {
  const dailyCounts = [...byDay.values()]
  const daysWithData = dailyCounts.length
  const total = dailyCounts.reduce((sum, n) => sum + n, 0)
  const avgPerDay = daysWithData > 0 ? Math.round(total / daysWithData) : 0
  return { avgPerDay, daysWithData, total }
}

/**
 * @param {{ avgPerDay: number }} current
 * @param {{ avgPerDay: number }} previous
 */
export function computeDelta(current, previous) {
  const deltaAvg = current.avgPerDay - previous.avgPerDay
  const deltaPct =
    previous.avgPerDay > 0
      ? Math.round((deltaAvg / previous.avgPerDay) * 1000) / 10
      : null
  return { deltaAvg, deltaPct }
}

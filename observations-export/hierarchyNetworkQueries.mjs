/**
 * Per-network observation counts aligned with source hierarchy (stat4 methodology).
 * GTS MF networks from obs + GDAC/IOOS/VOTO gliders, AniBOS, FVON, tsunami OSMC.
 */

import { sqlDailyCounts, formatIsoDate, shiftIsoDateYears } from './queries.mjs'
import {
  GTS_NETWORKS,
  yoyPeriodForYear,
  summarizeDailyCounts,
  computeDelta,
  sqlGtsNetworkDailyCounts,
} from './gtsNetworkQueries.mjs'

/** @typedef {{ id: string, label: string, source: string, table: string, extraWhere: string }} HierarchyNetworkDef */

/** GTS MF obs subsets (hierarchy excludes Argo/Gliders/Tsunami from obs). */
const GTS_OBS_NETWORKS = GTS_NETWORKS.filter(
  (n) => n.table === 'oceanops.obs' && !['argo'].includes(n.id),
)

/** @type {HierarchyNetworkDef[]} */
export const HIERARCHY_NETWORKS = [
  ...GTS_OBS_NETWORKS.map((n) => ({
    id: n.id,
    label: n.label,
    source: n.gtsSource,
    table: n.table,
    extraWhere: n.extraWhere,
  })),
  {
    id: 'argo-gdac',
    label: 'Argo (GDAC)',
    source: 'GDAC',
    table: 'oceanops.obs_argo_gdac',
    extraWhere: '',
  },
  {
    id: 'gliders-gdac',
    label: 'OceanGliders (GDAC)',
    source: 'GDAC',
    table: 'oceanops.obs_gliders_gdac',
    extraWhere: '',
  },
  {
    id: 'gliders-ioos',
    label: 'OceanGliders (IOOS)',
    source: 'IOOS',
    table: 'oceanops.obs_gliders_ioos',
    extraWhere: '',
  },
  {
    id: 'gliders-voto',
    label: 'OceanGliders (VOTO)',
    source: 'VOTO',
    table: 'oceanops.obs_gliders_voto',
    extraWhere: '',
  },
  {
    id: 'tsunameter',
    label: 'DBCP tsunameter buoys',
    source: 'GTS OSMC',
    table: 'oceanops.obs_tsuna_gts_osmc',
    extraWhere: GTS_NETWORKS.find((n) => n.id === 'tsunameter')?.extraWhere ?? '',
  },
  {
    id: 'anibos',
    label: 'AniBOS',
    source: 'AniBOS/MEOP',
    table: 'oceanops.obs_anibos_meop',
    extraWhere: '',
  },
  {
    id: 'fvon',
    label: 'FVON (fishing vessels)',
    source: 'FishyData',
    table: 'oceanops.obs_fishingvessel_fishydata',
    extraWhere: '',
  },
]

/**
 * @param {HierarchyNetworkDef} network
 * @param {{ sinceSql: string, untilSql: string }} period
 */
export function sqlHierarchyNetworkDailyCounts(network, period) {
  return sqlDailyCounts(
    network.table,
    period.sinceSql,
    period.untilSql,
    network.extraWhere,
  )
}

/**
 * Edition period vs same calendar span one year earlier.
 * @param {string} periodSince
 * @param {string} periodUntil
 */
export function editionYoyPeriods(periodSince, periodUntil) {
  const prevSince = shiftIsoDateYears(periodSince, -1)
  const prevUntil = shiftIsoDateYears(periodUntil, -1)
  const toPeriod = (start, end) => ({
    sinceSql: `'${start}'::timestamp`,
    untilSql: `(('${end}'::date + INTERVAL '1 day')::timestamp)`,
    label: `${start} → ${end}`,
  })

  return {
    current: toPeriod(periodSince, periodUntil),
    previous: toPeriod(prevSince, prevUntil),
    currentEndDate: new Date(`${periodUntil}T12:00:00`),
    previousEndDate: new Date(`${prevUntil}T12:00:00`),
    previousYear: new Date(`${periodUntil}T12:00:00`).getFullYear() - 1,
  }
}

/**
 * @param {{ periodSince?: string, periodUntil?: string, year?: number, endDate?: Date }} range
 * @param {Date} [referenceDate]
 */
export function buildHierarchyNetworkYoySteps(range, referenceDate = new Date()) {
  let current
  let previous
  let previousYear
  let currentYear

  if (range.year) {
    currentYear = range.year
    previousYear = range.year - 1
    current = yoyPeriodForYear(currentYear, currentYear, referenceDate)
    previous = yoyPeriodForYear(previousYear, currentYear, referenceDate)
  } else {
    const periodSince = range.periodSince
    const periodUntil = range.periodUntil ?? formatIsoDate(referenceDate)
    if (!periodSince) {
      throw new Error('buildHierarchyNetworkYoySteps: periodSince is required')
    }
    const periods = editionYoyPeriods(periodSince, periodUntil)
    current = periods.current
    previous = periods.previous
    currentYear = periods.currentEndDate.getFullYear()
    previousYear = periods.previousYear
  }

  /** @type {{ label: string, sql: string, period: 'current' | 'previous', networkId: string }[]} */
  const steps = []

  for (const network of HIERARCHY_NETWORKS) {
    steps.push({
      networkId: network.id,
      period: 'current',
      label: `${network.label} (${network.source}) current`,
      sql: sqlHierarchyNetworkDailyCounts(network, current),
    })
    steps.push({
      networkId: network.id,
      period: 'previous',
      label: `${network.label} (${network.source}) previous`,
      sql: sqlHierarchyNetworkDailyCounts(network, previous),
    })
  }

  return { steps, current, previous, currentYear, previousYear }
}

export { summarizeDailyCounts, computeDelta, sqlGtsNetworkDailyCounts, GTS_NETWORKS }

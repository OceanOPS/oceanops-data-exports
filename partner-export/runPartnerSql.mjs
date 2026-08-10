/**
 * Run partner section from sql/*.sql.
 */

import { readPartnerNetworkSql } from '../networkSql.mjs'
import { queryCountryCounts } from './lineProgramCounts.mjs'

export { readPartnerNetworkSql }

/**
 * @param {string} partnerNetworkKey
 * @returns {Record<string, number>}
 */
export function fetchPartnerCountsByCountryOrThrow(partnerNetworkKey) {
  const sql = readPartnerNetworkSql(partnerNetworkKey)
  const counts = queryCountryCounts(sql)
  if (counts === null) {
    throw new Error(
      `Partner export failed for "${partnerNetworkKey}" — check OCEANOPS_DATABASE_URL and psql.`,
    )
  }
  return counts
}

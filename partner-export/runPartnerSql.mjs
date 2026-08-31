/**
 * Run partner section from sql/*.sql (or manual JSON for selected networks).
 */

import { readPartnerNetworkSql } from '../networkSql.mjs'
import { isManualPartnerNetwork, loadManualPartnerCounts } from './manualPartnerCounts.mjs'
import { queryCountryCounts } from './lineProgramCounts.mjs'

export { readPartnerNetworkSql }

/**
 * @param {string} partnerNetworkKey
 * @returns {Record<string, number>}
 */
export function fetchPartnerCountsByCountryOrThrow(partnerNetworkKey) {
  if (isManualPartnerNetwork(partnerNetworkKey)) {
    return loadManualPartnerCounts(partnerNetworkKey)
  }

  const sql = readPartnerNetworkSql(partnerNetworkKey)
  const counts = queryCountryCounts(sql)
  if (counts === null) {
    throw new Error(
      `Partner export failed for "${partnerNetworkKey}" — check OCEANOPS_DATABASE_URL and psql.`,
    )
  }
  return counts
}

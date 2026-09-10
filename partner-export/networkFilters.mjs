/**
 * Partner export network keys (line-based networks use cruise_program in PostgreSQL).
 */

export const NETWORK_KEYS = [
  'driftingBuoys',
  'argo',
  'oceanGliders',
  'aniBOS',
  'fvon',
  'sotVos',
  'sotAsap',
  'soconet',
  'soconetMoorings',
  'oceantrax',
  'goShip',
  'gloss',
  'oceanSites',
  'mooredBuoys',
  'tsunamiBuoys',
  'hfRadars',
]

export const LINE_NETWORK_KEYS = ['goShip', 'oceantrax']

export const PLATFORM_NETWORK_KEYS = NETWORK_KEYS.filter(
  (key) => !LINE_NETWORK_KEYS.includes(key),
)

/** Partner export log labels (stderr). */
export const PARTNER_NETWORK_LOG_LABELS = {
  soconet: 'soconet (ships)',
  soconetMoorings: 'soconet (moored buoys)',
}

/** @param {string} networkKey */
export function partnerNetworkLogLabel(networkKey) {
  return PARTNER_NETWORK_LOG_LABELS[networkKey] ?? networkKey
}

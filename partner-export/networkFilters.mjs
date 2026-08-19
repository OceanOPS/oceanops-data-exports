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
  'sot',
  'goShip',
  'gloss',
  'oceanSites',
  'mooredBuoys',
  'tsunamiBuoys',
  'hfRadars',
]

export const LINE_NETWORK_KEYS = ['goShip', 'sot']

export const PLATFORM_NETWORK_KEYS = NETWORK_KEYS.filter(
  (key) => !LINE_NETWORK_KEYS.includes(key),
)

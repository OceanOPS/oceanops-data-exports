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

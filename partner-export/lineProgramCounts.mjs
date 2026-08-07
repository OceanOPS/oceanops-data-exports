/**
 * Execute partner SQL files via psql (comma-separated code2,count rows).
 */

import { spawnSync } from 'node:child_process'
import { loadDotEnv, parseDatabaseUrl, resolveDatabaseUrl } from '../databaseUrl.mjs'

loadDotEnv()

/** @param {string} sql @returns {Record<string, number> | null} */
export function queryCountryCounts(sql) {
  const config = parseDatabaseUrl(resolveDatabaseUrl())
  if (!config) return null

  const result = spawnSync(
    'psql',
    [
      '-h',
      config.host,
      '-p',
      config.port,
      '-U',
      config.user,
      '-d',
      config.database,
      '-t',
      '-A',
      '-F',
      ',',
      '-c',
      sql,
    ],
    {
      encoding: 'utf8',
      env: { ...process.env, PGPASSWORD: config.password },
    },
  )

  if (result.error || result.status !== 0) return null

  /** @type {Record<string, number>} */
  const counts = {}
  for (const line of result.stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const [code, countRaw] = trimmed.split(',')
    if (!code || code === 'null') continue
    const count = Number.parseInt(countRaw, 10)
    if (Number.isFinite(count) && count > 0) counts[code] = count
  }

  return counts
}

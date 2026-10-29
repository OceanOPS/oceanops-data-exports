/**
 * PostgreSQL helpers for GeoJSON export (psql CLI).
 */

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  formatDatabaseUrlForLog,
  loadDotEnv,
  parseDatabaseUrl,
  resolveDatabaseUrl,
} from '../databaseUrl.mjs'

loadDotEnv()

export { formatDatabaseUrlForLog, loadDotEnv, parseDatabaseUrl, resolveDatabaseUrl }

/** Match OceanOPS GIS routines (postgis schema, oceanops_gis views). */
const PSQL_GEOJSON_SESSION = `SET search_path TO oceanops, oceanops_gis, public, postgis;`

/**
 * @param {string} sql
 * @returns {{ ok: true, stdout: string } | { ok: false, error: string }}
 */
export function runPsqlQuery(sql) {
  const config = parseDatabaseUrl(resolveDatabaseUrl())
  if (!config) {
    return { ok: false, error: 'Invalid OCEANOPS_DATABASE_URL' }
  }

  const tmpDir = mkdtempSync(join(tmpdir(), 'oceanops-geojson-'))
  const outFile = join(tmpDir, 'query.out')

  try {
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
        '-v',
        'ON_ERROR_STOP=1',
        '-t',
        '-A',
        '-o',
        outFile,
        '-c',
        sql,
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, PGPASSWORD: config.password },
      },
    )

    if (result.error) {
      return { ok: false, error: result.error.message }
    }

    if (result.status !== 0) {
      const message = [result.stderr, result.stdout].filter(Boolean).join('\n').trim()
      return { ok: false, error: message || `psql exited with code ${result.status}` }
    }

    return { ok: true, stdout: readFileSync(outFile, 'utf8').trim() }
  } finally {
    rmSync(tmpDir, { recursive: true, force: true })
  }
}

/**
 * GeoJSON layer queries (PostGIS in schema `postgis` on isival-prod).
 * @param {string} sql
 */
export function runPsqlGeoJsonQuery(sql) {
  return runPsqlQuery(`${PSQL_GEOJSON_SESSION}\n${sql}`)
}

/** @returns {boolean} */
export function assertPsqlAvailable() {
  const result = spawnSync('psql', ['--version'], { encoding: 'utf8' })
  return result.status === 0
}

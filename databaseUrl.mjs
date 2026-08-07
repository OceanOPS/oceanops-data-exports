/**
 * Shared Postgres URL for partner + GeoJSON exports.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Load `oceanops-data-exports/.env` (does not override variables already in the environment). */
export function loadDotEnv() {
  const envPath = path.join(packageRoot, '.env')
  if (!fs.existsSync(envPath)) return

  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

/** @returns {string} */
export function resolveDatabaseUrl() {
  if (process.env.OCEANOPS_DATABASE_URL) return process.env.OCEANOPS_DATABASE_URL
  if (process.env.OCEANOPS_DB_URL) return process.env.OCEANOPS_DB_URL

  const host = process.env.OCEANOPS_DB_HOST ?? '127.0.0.1'
  const port = process.env.OCEANOPS_DB_PORT ?? '5432'
  const user = process.env.OCEANOPS_DB_USER ?? 'oceanops'
  const password = process.env.OCEANOPS_DB_PASS ?? 'oceanops'
  const database = process.env.OCEANOPS_DB_NAME ?? 'oceanops'

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`
}

/** Safe line for logs (password redacted). */
export function formatDatabaseUrlForLog(url = resolveDatabaseUrl()) {
  try {
    const parsed = new URL(url)
    const user = parsed.username ? decodeURIComponent(parsed.username) : ''
    const host = parsed.hostname
    const port = parsed.port || '5432'
    const database = parsed.pathname.replace(/^\//, '') || '(default)'
    return `postgresql://${user}:***@${host}:${port}/${database}`
  } catch {
    return '(invalid OCEANOPS_DATABASE_URL)'
  }
}

/** @param {string} url @returns {{ host: string, port: string, user: string, password: string, database: string } | null} */
export function parseDatabaseUrl(url) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') return null
    return {
      host: parsed.hostname,
      port: parsed.port || '5432',
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
    }
  } catch {
    return null
  }
}

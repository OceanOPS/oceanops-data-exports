import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = __dirname

/** Monorepo-style layout: sibling app repos next to oceanops-data-exports */
export const REPORT_CARD_ROOT = path.resolve(REPO_ROOT, '../oceanops-report-card')
export const SIMPLE_MAP_ROOT = path.resolve(REPO_ROOT, '../oceanops-simple-map')

export const PARTNER_COUNTRIES_TS = path.join(
  REPORT_CARD_ROOT,
  'src/data/partnerCountries.ts',
)

export const PARTNER_COUNTRIES_JSON = path.join(
  SIMPLE_MAP_ROOT,
  'public/data/partnerCountries.json',
)

export const GEOJSON_OUTPUT_DIR = path.join(SIMPLE_MAP_ROOT, 'public/geojson')

/** @param {string} appRoot @param {string} label */
export function assertAppRepo(appRoot, label) {
  if (!fs.existsSync(appRoot)) {
    throw new Error(
      `${label} not found at ${appRoot}. Clone it next to oceanops-data-exports or set paths in paths.mjs.`,
    )
  }
}

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = __dirname

const DEFAULT_REPORT_CARD_ROOT = path.resolve(REPO_ROOT, '../oceanops-report-card')
const DEFAULT_SIMPLE_MAP_ROOT = path.resolve(REPO_ROOT, '../oceanops-simple-map')

/** @param {string[]} values */
function firstDefined(...values) {
  for (const v of values) {
    if (v != null && String(v).trim() !== '') return String(v).trim()
  }
  return undefined
}

/** @param {string[]} argv @param {string} prefix e.g. `--report-card-root=` */
function argValue(argv, prefix) {
  const hit = argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

/**
 * Resolve export destinations from CLI flags and environment variables.
 *
 * CLI (highest priority):
 *   --report-card-root=   --simple-map-root=
 *   --partner-ts=         --partner-json=
 *   --geojson-dir=
 *
 * Environment:
 *   OCEANOPS_REPORT_CARD_ROOT, OCEANOPS_SIMPLE_MAP_ROOT
 *   PARTNER_COUNTRIES_TS, PARTNER_COUNTRIES_JSON
 *   GEOJSON_OUTPUT_DIR
 *
 * Defaults: sibling repos `../oceanops-report-card` and `../oceanops-simple-map`.
 *
 * @param {string[]} [argv] e.g. process.argv.slice(2)
 */
export function resolveExportPaths(argv = []) {
  const reportCardRootRaw = firstDefined(
    argValue(argv, '--report-card-root='),
    process.env.OCEANOPS_REPORT_CARD_ROOT,
  )
  const simpleMapRootRaw = firstDefined(
    argValue(argv, '--simple-map-root='),
    process.env.OCEANOPS_SIMPLE_MAP_ROOT,
  )

  const partnerTsRaw = firstDefined(
    argValue(argv, '--partner-ts='),
    process.env.PARTNER_COUNTRIES_TS,
  )
  const partnerJsonRaw = firstDefined(
    argValue(argv, '--partner-json='),
    process.env.PARTNER_COUNTRIES_JSON,
  )
  const geojsonDirRaw = firstDefined(
    argValue(argv, '--geojson-dir='),
    process.env.GEOJSON_OUTPUT_DIR,
  )

  const REPORT_CARD_ROOT = path.resolve(reportCardRootRaw ?? DEFAULT_REPORT_CARD_ROOT)
  const SIMPLE_MAP_ROOT = path.resolve(simpleMapRootRaw ?? DEFAULT_SIMPLE_MAP_ROOT)

  const PARTNER_COUNTRIES_TS = path.resolve(
    partnerTsRaw ?? path.join(REPORT_CARD_ROOT, 'src/data/partnerCountries.ts'),
  )
  const PARTNER_COUNTRIES_JSON = path.resolve(
    partnerJsonRaw ?? path.join(SIMPLE_MAP_ROOT, 'src/data/partnerCountries.json'),
  )
  const GEOJSON_OUTPUT_DIR = path.resolve(
    geojsonDirRaw ?? path.join(SIMPLE_MAP_ROOT, 'public/geojson'),
  )

  return {
    REPORT_CARD_ROOT,
    SIMPLE_MAP_ROOT,
    PARTNER_COUNTRIES_TS,
    PARTNER_COUNTRIES_JSON,
    GEOJSON_OUTPUT_DIR,
    partnerTsExplicit: Boolean(partnerTsRaw),
    partnerJsonExplicit: Boolean(partnerJsonRaw),
    geojsonDirExplicit: Boolean(geojsonDirRaw),
  }
}

/** Default paths (sibling layout, no CLI/env). */
const defaultPaths = resolveExportPaths([])
export const REPORT_CARD_ROOT = defaultPaths.REPORT_CARD_ROOT
export const SIMPLE_MAP_ROOT = defaultPaths.SIMPLE_MAP_ROOT
export const PARTNER_COUNTRIES_TS = defaultPaths.PARTNER_COUNTRIES_TS
export const PARTNER_COUNTRIES_JSON = defaultPaths.PARTNER_COUNTRIES_JSON
export const GEOJSON_OUTPUT_DIR = defaultPaths.GEOJSON_OUTPUT_DIR

/** @param {ReturnType<typeof resolveExportPaths>} paths */
export function assertPartnerExportTargets(paths) {
  if (!paths.partnerTsExplicit) {
    assertAppRepo(paths.REPORT_CARD_ROOT, 'oceanops-report-card')
  }
  if (!paths.partnerJsonExplicit) {
    assertAppRepo(paths.SIMPLE_MAP_ROOT, 'oceanops-simple-map')
  }
}

/** @param {ReturnType<typeof resolveExportPaths>} paths */
export function assertGeojsonExportTargets(paths) {
  if (!paths.geojsonDirExplicit) {
    assertAppRepo(paths.SIMPLE_MAP_ROOT, 'oceanops-simple-map')
  }
}

/** @param {string} appRoot @param {string} label */
export function assertAppRepo(appRoot, label) {
  if (!fs.existsSync(appRoot)) {
    throw new Error(
      `${label} not found at ${appRoot}. Clone it next to oceanops-data-exports, or set OCEANOPS_REPORT_CARD_ROOT / OCEANOPS_SIMPLE_MAP_ROOT (or the matching --report-card-root / --simple-map-root flags).`,
    )
  }
}

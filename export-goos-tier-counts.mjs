#!/usr/bin/env node
/**
 * GOOS tier totals for editorial review (#131): global arrays, reference observatories,
 * regional/emerging platforms. Uses map GeoJSON feature counts + DB subcounts for MBN.
 *
 * Usage:
 *   node export-goos-tier-counts.mjs [--geojson-dir=path] [--json-out=path] [--txt-out=path]
 *   npm run export:goos-tier-counts
 *
 * Requires OCEANOPS_DATABASE_URL for tropical/coastal MBN splits (optional with --geojson-only).
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadDotEnv } from './databaseUrl.mjs'
import { resolveExportAsOfDate, renderEditionSql } from './editionValues.mjs'
import { GOOS_TIER_GROUPS, LINE_LAYER_IDS } from './goos-tier-counts.config.mjs'
import { assertPsqlAvailable, runPsqlQuery } from './geojson-export/db.mjs'
import { readRenderedNetworkWhere, renderPartnerCountryIsoTokens } from './networkSql.mjs'
import { resolveExportPaths } from './paths.mjs'

loadDotEnv()

const REPO_ROOT = path.dirname(fileURLToPath(import.meta.url))

/** @param {string[]} argv */
function parseArgs(argv) {
  const exportPaths = resolveExportPaths(argv)
  const geojsonOnly = argv.includes('--geojson-only')
  const jsonOut = argv.find((a) => a.startsWith('--json-out='))?.slice('--json-out='.length)
  const txtOut = argv.find((a) => a.startsWith('--txt-out='))?.slice('--txt-out='.length)
  const geojsonDirArg = argv.find((a) => a.startsWith('--geojson-dir='))?.slice('--geojson-dir='.length)
  return {
    geojsonDir: geojsonDirArg ?? exportPaths.GEOJSON_OUTPUT_DIR,
    geojsonOnly,
    jsonOut,
    txtOut,
  }
}

/** @param {string} filePath */
function countGeoJsonFeatures(filePath) {
  if (!fs.existsSync(filePath)) return null
  const raw = fs.readFileSync(filePath, 'utf8')
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed?.features)) return null
  return parsed.features.length
}

/** @param {string} geojsonDir @param {string} layerId */
function layerFeatureCount(geojsonDir, layerId) {
  const primary = path.join(geojsonDir, `${layerId}.geojson`)
  const count = countGeoJsonFeatures(primary)
  if (count != null) return count
  return null
}

/** @param {string} sqlPath @param {string} mooredWhere */
function renderTierMooredSql(sqlPath, mooredWhere) {
  const template = fs.readFileSync(sqlPath, 'utf8')
  return renderEditionSql(
    renderPartnerCountryIsoTokens(
      template.replaceAll('{{MOORED_BUOYS_WHERE}}', mooredWhere),
    ),
  )
}

/** @param {string} sql */
function queryScalarInt(sql) {
  const result = runPsqlQuery(sql)
  if (!result.ok) {
    throw new Error(result.error)
  }
  const n = Number.parseInt(result.stdout.split('\n')[0]?.trim() ?? '', 10)
  if (Number.isNaN(n)) {
    throw new Error(`Expected integer from query, got: ${result.stdout}`)
  }
  return n
}

/**
 * @param {import('./goos-tier-counts.config.mjs').TierLine} line
 * @param {Record<string, number | null>} layerCounts
 * @param {{ tropical?: number, coastal?: number }} mbn
 */
function resolveLineCount(line, layerCounts, mbn) {
  if (line.id === 'mbnTropical') return mbn.tropical ?? null
  if (line.id === 'mbnCoastal') return mbn.coastal ?? null
  if (!line.layerIds?.length) return null

  if (line.sumLayers) {
    let sum = 0
    let missing = false
    for (const layerId of line.layerIds) {
      const c = layerCounts[layerId]
      if (c == null) {
        missing = true
        break
      }
      sum += c
    }
    return missing ? null : sum
  }

  const layerId = line.layerIds[0]
  return layerCounts[layerId] ?? null
}

/** @param {unknown} report */
function formatTxtReport(report) {
  const lines = []

  for (const group of report.groups) {
    lines.push(group.title.toUpperCase())
    lines.push(`Subtotal (${group.kind}): ${group.subtotal ?? '—'}`)
    lines.push('')
    for (const row of group.lines) {
      if (typeof row.count !== 'number') continue
      lines.push(`  ${row.label}: ${row.count}`)
    }
    lines.push('')
  }

  return `${lines.join('\n').trimEnd()}\n`
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const layerIds = new Set(
    GOOS_TIER_GROUPS.flatMap((g) =>
      g.lines.flatMap((line) => line.layerIds ?? []),
    ),
  )

  /** @type {Record<string, number | null>} */
  const layerCounts = {}
  for (const layerId of layerIds) {
    layerCounts[layerId] = layerFeatureCount(opts.geojsonDir, layerId)
  }

  /** @type {{ tropical?: number, coastal?: number }} */
  const mbn = {}

  if (!opts.geojsonOnly) {
    if (!assertPsqlAvailable()) {
      process.stderr.write(
        'goos-tier-counts: psql not available — tropical/coastal MBN skipped\n',
      )
    } else {
      try {
        const mooredWhere = readRenderedNetworkWhere('moored_buoys')
        const tropicalSql = renderTierMooredSql(
          path.join(REPO_ROOT, 'sql/goos_tier_moored_tropical.sql'),
          mooredWhere,
        )
        const coastalSql = renderTierMooredSql(
          path.join(REPO_ROOT, 'sql/goos_tier_moored_coastal.sql'),
          mooredWhere,
        )
        mbn.tropical = queryScalarInt(tropicalSql)
        mbn.coastal = queryScalarInt(coastalSql)
      } catch (err) {
        process.stderr.write(
          `goos-tier-counts: MBN split failed — ${err instanceof Error ? err.message : err}\n`,
        )
      }
    }
  }

  const report = {
    asOf: resolveExportAsOfDate(),
    geojsonDir: opts.geojsonDir,
    layerCounts,
    mbn,
    groups: GOOS_TIER_GROUPS.map((group) => {
      const rows = group.lines.map((line) => ({
        id: line.id,
        label: line.label,
        count: resolveLineCount(line, layerCounts, mbn),
        note: line.note,
        layerIds: line.layerIds,
        geometryKind: line.layerIds?.some((id) => LINE_LAYER_IDS.has(id))
          ? 'line'
          : line.layerIds
            ? 'point'
            : undefined,
      }))

      const counted = rows.filter((r) => typeof r.count === 'number')
      const subtotal =
        counted.length > 0
          ? counted.reduce((sum, r) => sum + (r.count ?? 0), 0)
          : null

      return {
        id: group.id,
        title: group.title,
        kind: group.kind,
        subtotal,
        lines: rows,
      }
    }),
  }

  const json = JSON.stringify(report, null, 2)
  const txt = formatTxtReport(report)

  process.stdout.write(txt)

  if (opts.jsonOut) {
    fs.mkdirSync(path.dirname(path.resolve(opts.jsonOut)), { recursive: true })
    fs.writeFileSync(opts.jsonOut, `${json}\n`, 'utf8')
    process.stderr.write(`Wrote ${opts.jsonOut}\n`)
  }
  if (opts.txtOut) {
    fs.mkdirSync(path.dirname(path.resolve(opts.txtOut)), { recursive: true })
    fs.writeFileSync(opts.txtOut, txt, 'utf8')
    process.stderr.write(`Wrote ${opts.txtOut}\n`)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

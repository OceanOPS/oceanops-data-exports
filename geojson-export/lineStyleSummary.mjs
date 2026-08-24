/**
 * Summarize line-layer GeoJSON for export logs (matches map legend: solid · dash).
 *
 * @typedef {{ sampled: number, notSampled: number, sampledNames: string[], notSampledNames: string[] }} LineStyleSummary
 */

/**
 * @param {{ features?: Array<{ properties?: Record<string, unknown> }> }} collection
 * @returns {LineStyleSummary | null}
 */
export function summarizeLineStyles(collection) {
  if (!Array.isArray(collection?.features)) return null

  /** @type {string[]} */
  const sampledNames = []
  /** @type {string[]} */
  const notSampledNames = []

  for (const feature of collection.features) {
    const name = String(feature.properties?.line_name ?? '').trim() || '?'
    if (feature.properties?.line_style === 'solid') sampledNames.push(name)
    else notSampledNames.push(name)
  }

  if (sampledNames.length === 0 && notSampledNames.length === 0) return null

  sampledNames.sort((a, b) => a.localeCompare(b))
  notSampledNames.sort((a, b) => a.localeCompare(b))

  return {
    sampled: sampledNames.length,
    notSampled: notSampledNames.length,
    sampledNames,
    notSampledNames,
  }
}

/** @param {string} isoDate */
export function yearFromIsoDate(isoDate) {
  return String(isoDate ?? '').slice(0, 4) || '?'
}

/**
 * @param {import('node:fs').WriteStream | { write: (chunk: string) => void }} out
 * @param {LineStyleSummary} summary
 * @param {string} contextLabel e.g. "2025" or "oceantrax"
 * @param {{ solidLabel?: string, dashLabel?: string, legendNote?: string }} [labels]
 */
export function writeLineStyleSummaryLines(out, summary, contextLabel, labels = {}) {
  const solidLabel = labels.solidLabel ?? 'sampled'
  const dashLabel = labels.dashLabel ?? 'not sampled'
  const legendNote =
    labels.legendNote ?? `since ${contextLabel}, legend solid · dash`
  out.write(
    `  Map lines: ${summary.sampled} ${solidLabel} · ${summary.notSampled} ${dashLabel} (${legendNote})\n`,
  )
  if (summary.sampledNames.length > 0) {
    out.write(`    ${solidLabel[0].toUpperCase()}${solidLabel.slice(1)}: ${summary.sampledNames.join(', ')}\n`)
  }
  if (summary.notSampledNames.length > 0) {
    out.write(`    ${dashLabel[0].toUpperCase()}${dashLabel.slice(1)}: ${summary.notSampledNames.join(', ')}\n`)
  }
}

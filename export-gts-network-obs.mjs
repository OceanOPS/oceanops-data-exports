#!/usr/bin/env node
/**
 * @deprecated Use `npm run export:observations` — includes hierarchy network YoY
 * (GTS MF + GDAC/IOOS/VOTO + AniBOS + FVON) in observations-network-yoy.json.
 *
 * This script re-runs the full observations export for backward compatibility.
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runObservationsExport } from './export-observations-per-day.mjs'

async function main() {
  process.stderr.write(
    'Note: export:gts-network-obs is deprecated — use export:observations (includes network YoY).\n\n',
  )
  try {
    await runObservationsExport(process.argv.slice(2))
  } catch (err) {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

function isDirectRun() {
  const entry = process.argv[1]
  if (!entry) return false
  return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url))
}

if (isDirectRun()) {
  void main()
}

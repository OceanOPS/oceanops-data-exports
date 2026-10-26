/**
 * GOOS Status Report — platform / reference observatory tiers (editorial #131).
 * Counts align with map GeoJSON layers in oceanops-simple-map unless noted.
 */

/** @typedef {{ id: string, label: string, layerIds?: string[], sumLayers?: boolean, dbOnly?: boolean, note?: string }} TierLine */

/** @type {{ id: string, title: string, kind: 'platforms' | 'referenceObservatories', lines: TierLine[] }} */
export const GOOS_TIER_GROUPS = [
  {
    id: 'globalArrays',
    title: 'Total platforms — global arrays',
    kind: 'platforms',
    lines: [
      { id: 'argo', label: 'Profiling floats – Argo', layerIds: ['argo'] },
      { id: 'vos', label: 'Ship based meteorological – VOS', layerIds: ['vos'] },
      { id: 'gda', label: 'Drifting buoys – GDA', layerIds: ['drifting_buoys'] },
      {
        id: 'mbnTropical',
        label: 'Tropical moored buoys – MBN subcomponent',
        dbOnly: true,
      },
    ],
  },
  {
    id: 'referenceObservatories',
    title: 'Total reference observatories',
    kind: 'referenceObservatories',
    lines: [
      { id: 'oceansites', label: 'Time series sites – OceanSITES', layerIds: ['oceansites'] },
      { id: 'gloss', label: 'Sea level gauges – GLOSS', layerIds: ['gloss'] },
      { id: 'goship', label: 'Repeated transects – GO-SHIP', layerIds: ['goship'] },
      {
        id: 'soconet',
        label: 'Surface ocean CO₂ – SOCONET (emerging)',
        layerIds: ['soconet', 'soconet_moorings'],
        sumLayers: true,
      },
      {
        id: 'oceantrax',
        label: 'Ship based oceanographic – OceanTraX (subsurface)',
        layerIds: ['oceantrax'],
      },
    ],
  },
  {
    id: 'regionalEmerging',
    title: 'Total platforms — regional and emerging systems',
    kind: 'platforms',
    lines: [
      { id: 'oceangliders', label: 'Gliders – OceanGliders', layerIds: ['oceangliders'] },
      {
        id: 'mbnCoastal',
        label: 'Coastal / national moored buoys – MBN subcomponent',
        dbOnly: true,
      },
      { id: 'anibos', label: 'Animal borne sensors – AniBOS', layerIds: ['anibos'] },
      { id: 'hfRadars', label: 'High Frequency radars – HF Radar', layerIds: ['hf_radars'] },
      { id: 'tsunami', label: 'Tsunami buoys – TSU', layerIds: ['tsunami_buoys'] },
      { id: 'asap', label: 'Ship based aerological – ASAP', layerIds: ['asap'] },
      { id: 'fvon', label: 'Fishing vessels – FVON (emerging)', layerIds: ['fvon'] },
      {
        id: 'sunFleet',
        label: 'Surface UNcrewed Fleet – SUN Fleet (emerging)',
      },
      {
        id: 'smartCables',
        label: 'SMART subsea cables (emerging)',
      },
    ],
  },
]

/** Map layer id → count uses line features (not points). */
export const LINE_LAYER_IDS = new Set(['goship', 'oceantrax'])

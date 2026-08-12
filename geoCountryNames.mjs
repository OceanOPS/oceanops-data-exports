/**
 * Map ISO 3166-1 alpha-2 (partner export keys) → GeoJSON `country_name` on the globe.
 * Used in partnerCountries.json for simple-map lookups.
 */

/** @type {Record<string, string[]>} */
export const GEO_COUNTRY_NAMES_BY_ISO = {
  AR: ['ARGENTINA'],
  AU: ['AUSTRALIA'],
  BS: ['BAHAMAS'],
  BD: ['BANGLADESH'],
  BE: ['BELGIUM'],
  BM: ['BERMUDA'],
  BR: ['BRAZIL'],
  BG: ['BULGARIA'],
  CA: ['CANADA'],
  CL: ['CHILE'],
  CN: ['CHINA', 'HONG KONG'],
  CO: ['COLOMBIA'],
  CK: ['COOK ISLANDS'],
  HR: ['CROATIA'],
  CU: ['CUBA'],
  DK: ['DENMARK'],
  EU: ['EUROPE'],
  FI: ['FINLAND'],
  FR: ['FRANCE'],
  DE: ['GERMANY'],
  GR: ['GREECE'],
  IS: ['ICELAND'],
  IN: ['INDIA'],
  ID: ['INDONESIA'],
  IE: ['IRELAND'],
  IL: ['ISRAEL'],
  IT: ['ITALY'],
  JP: ['JAPAN'],
  JO: ['JORDAN'],
  KI: ['KIRIBATI'],
  KR: ['SOUTH KOREA'],
  MT: ['MALTA'],
  MH: ['MARSHALL IS.'],
  MU: ['MAURITIUS'],
  MX: ['MEXICO'],
  FM: ['MICRONESIA'],
  NR: ['NAURU'],
  NL: ['NETHERLANDS'],
  NZ: ['NEW ZEALAND'],
  NO: ['NORWAY'],
  PA: ['PANAMA'],
  PG: ['PNG'],
  PE: ['PERU'],
  PH: ['PHILIPPINES'],
  PL: ['POLAND'],
  PT: ['PORTUGAL'],
  PR: ['PUERTO RICO'],
  RU: ['RUSSIA'],
  SG: ['SINGAPORE'],
  SI: ['SLOVENIA'],
  ZA: ['SOUTH AFRICA'],
  ES: ['SPAIN'],
  SE: ['SWEDEN'],
  TH: ['THAILAND'],
  TO: ['TONGA'],
  TV: ['TUVALU'],
  UA: ['UKRAINE'],
  AE: ['UAE'],
  GB: ['UK'],
  US: ['USA'],
  UY: ['URUGUAY'],
  VU: ['VANUATU'],
  VN: ['VIET NAM'],
  WF: ['WALLIS/FUTUNA'],
}

/** @param {string} iso */
export function geoNamesForIso(iso) {
  return GEO_COUNTRY_NAMES_BY_ISO[iso] ?? []
}

/** @param {Map<string, Record<string, number>>} countries @param {Record<string, object>} meta */
export function buildGeoCountryIndex(countries, meta) {
  /** @type {Record<string, string>} geoName → ISO */
  const byGeoCountryName = {}

  for (const code of countries.keys()) {
    const names = geoNamesForIso(code)
    for (const geo of names) {
      byGeoCountryName[geo] = code
    }
  }

  return byGeoCountryName
}

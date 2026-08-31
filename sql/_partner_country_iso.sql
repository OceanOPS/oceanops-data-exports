-- Partner reporting ISO (rollup + exclude). Used via {{PARTNER_COUNTRY_ISO:column}} in @where, @geojson, @partner.
-- Rollup: HK → CN, EN → EU. Exclude: AQ, UN, UNKNOWN, U-, null/blank.
CASE
  WHEN ({{EXPR}}) IS NULL OR TRIM(({{EXPR}})::text) = '' THEN NULL
  WHEN UPPER(TRIM(({{EXPR}})::text)) IN ('NULL', 'UNDEFINED') THEN NULL
  WHEN UPPER(TRIM(({{EXPR}})::text)) IN ('AQ', 'UN', 'UNKNOWN', 'U-') THEN NULL
  WHEN UPPER(TRIM(({{EXPR}})::text)) = 'HK' THEN 'CN'
  WHEN UPPER(TRIM(({{EXPR}})::text)) = 'EN' THEN 'EU'
  ELSE UPPER(TRIM(({{EXPR}})::text))
END


> oceanops-data-exports@1.0.0 render:sql
> node render-sql.mjs sql/soconet.sql

-- Layer: soconet
-- SOCONET UND ships — one point per ship (earliest deployment in ptf_loc_0)
-- Edit filter under @where; edition.values.json for shared tokens.
-- pgAdmin: npm run render:sql -- sql/soconet.sql

-- @geojson
SELECT jsonb_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(t.shape)::jsonb,
      'properties', jsonb_build_object(
        'category', 'soconet',
        'ptf_id', t.ptf_id,
        'ptf_ref', t.ptf_ref,
        'ptf_model', t.ptf_model,
        'ship', t.ship,
        'country_name', t.country,
        'country_iso_reporting', CASE
  WHEN (t.country_iso_code2) IS NULL OR TRIM((t.country_iso_code2)::text) = '' THEN NULL
  WHEN UPPER(TRIM((t.country_iso_code2)::text)) IN ('NULL', 'UNDEFINED') THEN NULL
  WHEN UPPER(TRIM((t.country_iso_code2)::text)) IN ('AQ', 'UN', 'UNKNOWN', 'U-') THEN NULL
  WHEN UPPER(TRIM((t.country_iso_code2)::text)) = 'HK' THEN 'CN'
  WHEN UPPER(TRIM((t.country_iso_code2)::text)) = 'EN' THEN 'EU'
  ELSE UPPER(TRIM((t.country_iso_code2)::text))
END
      )
    )
  ), '[]'::jsonb)
)
FROM (
  SELECT
    p.*,
    ROW_NUMBER() OVER (
      PARTITION BY p.ship
      ORDER BY p.depl_date ASC NULLS LAST
    ) AS rn
  FROM oceanops_gis.ptf_loc_0 AS p
  WHERE p.network LIKE '%SOCONET%'
AND p.ptf_family = 'UND'
AND p.ptf_status >= 2
AND p.country IS NOT NULL
AND TRIM(p.country) <> ''
AND p.country_iso_code2 IS NOT NULL
AND TRIM(p.country_iso_code2) <> ''
AND CASE
  WHEN (p.country_iso_code2) IS NULL OR TRIM((p.country_iso_code2)::text) = '' THEN NULL
  WHEN UPPER(TRIM((p.country_iso_code2)::text)) IN ('NULL', 'UNDEFINED') THEN NULL
  WHEN UPPER(TRIM((p.country_iso_code2)::text)) IN ('AQ', 'UN', 'UNKNOWN', 'U-') THEN NULL
  WHEN UPPER(TRIM((p.country_iso_code2)::text)) = 'HK' THEN 'CN'
  WHEN UPPER(TRIM((p.country_iso_code2)::text)) = 'EN' THEN 'EU'
  ELSE UPPER(TRIM((p.country_iso_code2)::text))
END IS NOT NULL
) AS t
WHERE t.rn = 1;

-- @partner
-- Reporting ISO: sql/_partner_country_iso.sql (HK->CN, EN->EU, exclude AQ/UN/...)
SELECT CASE
  WHEN (t.country_iso_code2) IS NULL OR TRIM((t.country_iso_code2)::text) = '' THEN NULL
  WHEN UPPER(TRIM((t.country_iso_code2)::text)) IN ('NULL', 'UNDEFINED') THEN NULL
  WHEN UPPER(TRIM((t.country_iso_code2)::text)) IN ('AQ', 'UN', 'UNKNOWN', 'U-') THEN NULL
  WHEN UPPER(TRIM((t.country_iso_code2)::text)) = 'HK' THEN 'CN'
  WHEN UPPER(TRIM((t.country_iso_code2)::text)) = 'EN' THEN 'EU'
  ELSE UPPER(TRIM((t.country_iso_code2)::text))
END AS country_iso_code2, COUNT(*)::int
FROM (
  SELECT
    p.*,
    ROW_NUMBER() OVER (
      PARTITION BY p.ship
      ORDER BY p.depl_date ASC NULLS LAST
    ) AS rn
  FROM oceanops_gis.ptf_loc_0 AS p
  WHERE (p.network LIKE '%SOCONET%'
AND p.ptf_family = 'UND'
AND p.ptf_status >= 2
AND p.country IS NOT NULL
AND TRIM(p.country) <> ''
AND p.country_iso_code2 IS NOT NULL
AND TRIM(p.country_iso_code2) <> ''
AND CASE
  WHEN (p.country_iso_code2) IS NULL OR TRIM((p.country_iso_code2)::text) = '' THEN NULL
  WHEN UPPER(TRIM((p.country_iso_code2)::text)) IN ('NULL', 'UNDEFINED') THEN NULL
  WHEN UPPER(TRIM((p.country_iso_code2)::text)) IN ('AQ', 'UN', 'UNKNOWN', 'U-') THEN NULL
  WHEN UPPER(TRIM((p.country_iso_code2)::text)) = 'HK' THEN 'CN'
  WHEN UPPER(TRIM((p.country_iso_code2)::text)) = 'EN' THEN 'EU'
  ELSE UPPER(TRIM((p.country_iso_code2)::text))
END IS NOT NULL)
) AS t
WHERE t.rn = 1
GROUP BY 1
HAVING CASE
  WHEN (t.country_iso_code2) IS NULL OR TRIM((t.country_iso_code2)::text) = '' THEN NULL
  WHEN UPPER(TRIM((t.country_iso_code2)::text)) IN ('NULL', 'UNDEFINED') THEN NULL
  WHEN UPPER(TRIM((t.country_iso_code2)::text)) IN ('AQ', 'UN', 'UNKNOWN', 'U-') THEN NULL
  WHEN UPPER(TRIM((t.country_iso_code2)::text)) = 'HK' THEN 'CN'
  WHEN UPPER(TRIM((t.country_iso_code2)::text)) = 'EN' THEN 'EU'
  ELSE UPPER(TRIM((t.country_iso_code2)::text))
END IS NOT NULL
ORDER BY 1;


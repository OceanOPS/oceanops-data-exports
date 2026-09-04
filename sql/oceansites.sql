-- Layer: oceansites
-- OceanSITES moorings — OPERATIONAL or INACTIVE
-- Edit filter under @where; edition.values.json for shared tokens.
-- pgAdmin: npm run render:sql -- sql/oceansites.sql
--
-- Pending change (colleague request — kept commented below):
--   • Full network (no ptf_status filter)
--   • One point per WMO: latest deployment (ROW_NUMBER per wmo.wmo; wmo IS NULL OR rn = 1)
--   • Geometry from deployment lat/lon (ST_MakePoint), not oceanops_gis.ptf_loc_n.shape
--   • Still filter network via @where: t.network LIKE '%OceanSITES%'
--   • v_ptf_loc_n used inside ranked CTE for country / ptf_model only

-- @where
t.ptf_status IN (4, 6) AND t.network LIKE '%OceanSITES%'
AND t.country IS NOT NULL
AND TRIM(t.country) <> ''
AND t.country_iso_code2 IS NOT NULL
AND TRIM(t.country_iso_code2) <> ''
AND {{PARTNER_COUNTRY_ISO:t.country_iso_code2}} IS NOT NULL

-- @geojson
SELECT jsonb_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(t.shape)::jsonb,
      'properties', jsonb_build_object(
        'category', 'oceansites',
        'ptf_id', t.ptf_id,
        'ptf_ref', t.ptf_ref,
        'ptf_model', t.ptf_model,
        'country_name', t.country,
        'country_iso_reporting', {{PARTNER_COUNTRY_ISO:t.country_iso_code2}},
        'country_ship', rv.ship_country,
        'country_sensor_provider', sp.sensor_country
      )
    )
  ), '[]'::jsonb)
)
FROM oceanops_gis.ptf_loc_n AS t
LEFT JOIN (
  SELECT DISTINCT ON (ptf_id) ptf_id, ship_country
  FROM oceanops.v_ptf_depl_rv
  ORDER BY ptf_id, deployment_date DESC NULLS LAST
) rv ON t.ptf_id = rv.ptf_id
LEFT JOIN (
  SELECT DISTINCT ON (ptf_id) ptf_id, sensor_country
  FROM oceanops.v_sensor_provider
  ORDER BY ptf_id, sensor_model
) sp ON t.ptf_id = sp.ptf_id
WHERE {{WHERE}};

-- @partner
-- Reporting ISO: sql/_partner_country_iso.sql (HK->CN, EN->EU, exclude AQ/UN/...)
SELECT {{PARTNER_COUNTRY_ISO:t.country_iso_code2}} AS country_iso_code2, COUNT(*)::int
FROM oceanops_gis.ptf_loc_n AS t
WHERE ({{WHERE}})
GROUP BY 1
HAVING {{PARTNER_COUNTRY_ISO:t.country_iso_code2}} IS NOT NULL
ORDER BY 1;

-- ── Pending @geojson (latest deployment per WMO) ──────────────────────────────
-- WITH ranked AS (
--   SELECT
--     ptf.id AS ptf_id,
--     ptf.ref,
--     ptf_deployment.depl_date,
--     ptf_deployment.lat,
--     ptf_deployment.lon,
--     wmo.wmo,
--     t.ptf_model,
--     t.country,
--     t.country_iso_code2,
--     ROW_NUMBER() OVER (
--       PARTITION BY wmo.wmo
--       ORDER BY ptf_deployment.depl_date DESC
--     ) AS rn
--   FROM oceanops.ptf
--   JOIN oceanops.ptf_deployment
--     ON ptf.ptf_depl_id = ptf_deployment.id
--   LEFT JOIN oceanops.wmo
--     ON wmo.ptf_id = ptf.id
--   JOIN oceanops.v_ptf_loc_n t
--     ON t.ptf_id = ptf.id
--   WHERE {{WHERE}}
-- )
-- SELECT jsonb_build_object(
--   'type', 'FeatureCollection',
--   'features', COALESCE(jsonb_agg(
--     jsonb_build_object(
--       'type', 'Feature',
--       'geometry', ST_AsGeoJSON(t.shape)::jsonb,
--       'properties', jsonb_build_object(
--         'category', 'oceansites',
--         'ptf_id', t.ptf_id,
--         'ptf_ref', t.ptf_ref,
--         'ptf_model', t.ptf_model,
--         'wmo', t.wmo,
--         'depl_date', to_char(t.depl_date, 'YYYY-MM-DD'),
--         'country_name', t.country,
--         'country_iso_reporting', {{PARTNER_COUNTRY_ISO:t.country_iso_code2}},
--         'country_ship', rv.ship_country,
--         'country_sensor_provider', sp.sensor_country
--       )
--     )
--   ), '[]'::jsonb)
-- )
-- FROM (
--   SELECT
--     r.*,
--     ST_SetSRID(ST_MakePoint(r.lon, r.lat), 4326) AS shape
--   FROM ranked r
--   WHERE r.wmo IS NULL OR r.rn = 1
-- ) AS t
-- LEFT JOIN (
--   SELECT DISTINCT ON (ptf_id) ptf_id, ship_country
--   FROM oceanops.v_ptf_depl_rv
--   ORDER BY ptf_id, deployment_date DESC NULLS LAST
-- ) rv ON t.ptf_id = rv.ptf_id
-- LEFT JOIN (
--   SELECT DISTINCT ON (ptf_id) ptf_id, sensor_country
--   FROM oceanops.v_sensor_provider
--   ORDER BY ptf_id, sensor_model
-- ) sp ON t.ptf_id = sp.ptf_id;

-- ── Pending @where (for ranked query above) ───────────────────────────────────
-- t.network LIKE '%OceanSITES%'
-- AND t.country IS NOT NULL
-- AND TRIM(t.country) <> ''
-- AND t.country_iso_code2 IS NOT NULL
-- AND TRIM(t.country_iso_code2) <> ''
-- AND {{PARTNER_COUNTRY_ISO:t.country_iso_code2}} IS NOT NULL

-- ── Pending @partner (latest deployment per WMO) ──────────────────────────────
-- WITH ranked AS (
--   SELECT
--     ptf.id AS ptf_id,
--     ptf_deployment.depl_date,
--     wmo.wmo,
--     t.country,
--     t.country_iso_code2,
--     ROW_NUMBER() OVER (
--       PARTITION BY wmo.wmo
--       ORDER BY ptf_deployment.depl_date DESC
--     ) AS rn
--   FROM oceanops.ptf
--   JOIN oceanops.ptf_deployment
--     ON ptf.ptf_depl_id = ptf_deployment.id
--   LEFT JOIN oceanops.wmo
--     ON wmo.ptf_id = ptf.id
--   JOIN oceanops.v_ptf_loc_n t
--     ON t.ptf_id = ptf.id
--   WHERE {{WHERE}}
-- )
-- SELECT {{PARTNER_COUNTRY_ISO:t.country_iso_code2}} AS country_iso_code2, COUNT(*)::int
-- FROM (
--   SELECT r.country, r.country_iso_code2
--   FROM ranked r
--   WHERE r.wmo IS NULL OR r.rn = 1
-- ) AS t
-- GROUP BY 1
-- HAVING {{PARTNER_COUNTRY_ISO:t.country_iso_code2}} IS NOT NULL
-- ORDER BY 1;

-- Layer: oceansites
-- OceanSITES moorings — OPERATIONAL or INACTIVE; one point per WMO (latest deployment)
-- country_ship / country_sensor_provider: one row per ptf_id (views may return multiple matches).
-- Edit filter under @where; edition.values.json for shared tokens.
-- pgAdmin: npm run render:sql -- sql/oceansites.sql

-- @where
t.network LIKE '%OceanSITES%'
AND t.ptf_status IN (4, 6)
AND t.country IS NOT NULL
AND TRIM(t.country) <> ''
AND t.country_iso_code2 IS NOT NULL
AND TRIM(t.country_iso_code2) <> ''
AND {{PARTNER_COUNTRY_ISO:t.country_iso_code2}} IS NOT NULL

-- @geojson
WITH ranked AS (
  SELECT
    ptf.id AS ptf_id,
    ptf.ref AS ptf_ref,
    ptf_deployment.depl_date,
    ptf_deployment.lat,
    ptf_deployment.lon,
    wmo.wmo,
    t.ptf_model,
    t.country,
    t.country_iso_code2,
    ROW_NUMBER() OVER (
      PARTITION BY wmo.wmo
      ORDER BY ptf_deployment.depl_date DESC NULLS LAST, ptf.id DESC
    ) AS rn
  FROM oceanops.ptf
  JOIN oceanops.ptf_deployment ON ptf.ptf_depl_id = ptf_deployment.id
  LEFT JOIN oceanops.wmo ON wmo.ptf_id = ptf.id
  JOIN oceanops.v_ptf_loc_n t ON t.ptf_id = ptf.id
  WHERE {{WHERE}}
)
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
        'wmo', COALESCE(t.wmo, ''),
        'depl_date', to_char(t.depl_date, 'YYYY-MM-DD'),
        'country_name', t.country,
        'country_iso_reporting', {{PARTNER_COUNTRY_ISO:t.country_iso_code2}},
        'country_ship', rv.ship_country,
        'country_sensor_provider', sp.sensor_country
      )
    )
    ORDER BY t.ptf_ref
  ), '[]'::jsonb)
)
FROM (
  SELECT
    r.ptf_id,
    r.ptf_ref,
    r.depl_date,
    r.ptf_model,
    r.wmo,
    r.country,
    r.country_iso_code2,
    ST_SetSRID(ST_MakePoint(r.lon, r.lat), 4326) AS shape
  FROM ranked r
  WHERE (r.wmo IS NULL OR TRIM(r.wmo) = '' OR r.rn = 1)
    AND r.lat IS NOT NULL
    AND r.lon IS NOT NULL
) AS t
LEFT JOIN (
  SELECT DISTINCT ON (ptf_id) ptf_id, ship_country
  FROM oceanops.v_ptf_depl_rv
  ORDER BY ptf_id, deployment_date DESC NULLS LAST
) rv ON t.ptf_id = rv.ptf_id
LEFT JOIN (
  SELECT DISTINCT ON (ptf_id) ptf_id, sensor_country
  FROM oceanops.v_sensor_provider
  ORDER BY ptf_id, sensor_model
) sp ON t.ptf_id = sp.ptf_id;

-- @partner
WITH ranked AS (
  SELECT
    ptf.id AS ptf_id,
    t.country_iso_code2,
    wmo.wmo,
    ROW_NUMBER() OVER (
      PARTITION BY wmo.wmo
      ORDER BY ptf_deployment.depl_date DESC NULLS LAST, ptf.id DESC
    ) AS rn
  FROM oceanops.ptf
  JOIN oceanops.ptf_deployment ON ptf.ptf_depl_id = ptf_deployment.id
  LEFT JOIN oceanops.wmo ON wmo.ptf_id = ptf.id
  JOIN oceanops.v_ptf_loc_n t ON t.ptf_id = ptf.id
  WHERE ({{WHERE}})
)
SELECT {{PARTNER_COUNTRY_ISO:country_iso_code2}} AS country_iso_code2, COUNT(*)::int
FROM ranked r
WHERE (r.wmo IS NULL OR TRIM(r.wmo) = '' OR r.rn = 1)
GROUP BY 1
HAVING {{PARTNER_COUNTRY_ISO:country_iso_code2}} IS NOT NULL
ORDER BY 1;

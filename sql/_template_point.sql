-- Template: operational **point** layer
--
-- 1. Copy to `<layerId>.sql` (e.g. fvon.sql)
-- 2. Set `category` in @geojson properties (must match map categories)
-- 3. Edit -- @where before each edition; use {{LAYER_TABLE_PTF_STATUS_IN}} etc. from edition.values.json
-- 4. Register in `geojson-export/layers.manifest.json`
-- 5. pgAdmin: npm run render:sql -- sql/<layerId>.sql
--
-- country_ship / country_sensor_provider: one row per ptf_id (views may return multiple matches).
-- To omit ship or sensor country from popups, comment out JOIN + property lines in @geojson.

-- @where
upper(t.network) LIKE '%ARGO%' AND t.ptf_status = 6

-- @geojson
SELECT jsonb_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(t.shape)::jsonb,
      'properties', jsonb_build_object(
        'category', 'Profiling_floats_Argo',
        'ptf_id', t.ptf_id,
        'ptf_ref', t.ptf_ref,
        'ptf_model', t.ptf_model,
        'country_name', t.country,
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
SELECT t.country_iso_code2, COUNT(*)::int
FROM oceanops_gis.ptf_loc_n AS t
WHERE ({{WHERE}})
  AND t.country_iso_code2 IS NOT NULL
  AND TRIM(t.country_iso_code2) <> ''
GROUP BY t.country_iso_code2
ORDER BY t.country_iso_code2;

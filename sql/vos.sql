-- Layer: vos
-- OPERATIONAL SOT/VOS ships
-- Edit WHERE (or line IN list) here, test in pgAdmin, then: npm run export:geojson
--   psql "$OCEANOPS_DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/vos.sql
-- Edit filter under @where; edition.values.json for dates / line lists.
-- pgAdmin: npm run render:sql -- sql/vos.sql

-- @where
t.ptf_status = 6 AND t.network LIKE '%VOS%' AND (t.ptf_type = 'VOS_MWS' OR t.ptf_type = 'VOS_AWS')

-- @geojson
SELECT jsonb_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(t.shape)::jsonb,
      'properties', jsonb_build_object(
        'category', 'ship_based_meteorological_sot_vos',
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
LEFT JOIN oceanops.v_ptf_depl_rv rv ON t.ptf_id = rv.ptf_id
LEFT JOIN oceanops.v_sensor_provider sp ON t.ptf_id = sp.ptf_id
WHERE {{WHERE}};

-- @partner
SELECT t.country_iso_code2, COUNT(*)::int
FROM oceanops_gis.ptf_loc_n AS t
WHERE ({{WHERE}})
  AND t.country_iso_code2 IS NOT NULL
  AND TRIM(t.country_iso_code2) <> ''
GROUP BY t.country_iso_code2
ORDER BY t.country_iso_code2;

-- Layer: oceangliders
-- OceanGliders — layer-table statuses, latest_loc_date >= 2024-01-01
-- Edit WHERE (or line IN list) here, test in pgAdmin, then: npm run export:geojson
--   psql "$OCEANOPS_DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/oceangliders.sql
-- Edit filter under @where; edition.values.json for dates / line lists.
-- pgAdmin: npm run render:sql -- sql/oceangliders.sql

-- @where
t.ptf_status IN ({{LAYER_TABLE_PTF_STATUS_IN}}) AND t.master_program = 'OceanGliders' AND t.latest_loc_date >= DATE '{{OCEAN_GLIDERS_MIN_LOC_DATE}}'

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
        'country_ship', COALESCE(rv.ship_country, depl_ship_ctry.name_short),
        'country_sensor_provider', sp.sensor_country
      )
    )
  ), '[]'::jsonb)
)
FROM oceanops_gis.ptf_loc_n AS t
LEFT JOIN oceanops.v_ptf_depl_rv rv ON t.ptf_id = rv.ptf_id
LEFT JOIN oceanops.ptf ptf ON t.ptf_id = ptf.id
LEFT JOIN oceanops.ptf_deployment pd ON pd.id = ptf.ptf_depl_id
LEFT JOIN oceanops.ship sh ON sh.id = pd.ship_id
LEFT JOIN oceanops.country depl_ship_ctry ON depl_ship_ctry.id = sh.country_id
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

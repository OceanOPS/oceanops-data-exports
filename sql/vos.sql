-- Layer: vos
-- OPERATIONAL SOT/VOS ships
-- Edit WHERE (or line IN list) here, test in pgAdmin, then: npm run export:geojson
--   psql "$OCEANOPS_DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/vos.sql
-- Edit filter under @where; edition.values.json for dates / line lists.
-- pgAdmin: npm run render:sql -- sql/vos.sql

-- @where
t.ptf_status = {{PTF_STATUS_OPERATIONAL}} AND t.network LIKE '%VOS%' AND (t.ptf_type = 'VOS_MWS' OR t.ptf_type = 'VOS_AWS')
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
        'category', 'ship_based_meteorological_sot_vos',
        'ptf_id', t.ptf_id,
        'ptf_ref', t.ptf_ref,
        'ptf_model', t.ptf_model,
        'country_name', t.country,
        'country_iso_reporting', {{PARTNER_COUNTRY_ISO:t.country_iso_code2}},
        'country_ship', rv.ship_country,
        'country_sensor_provider', sp.sensor_country,
        'ptf_family_name', pf.name,
        'goos_networks', goos.goos_networks
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
  SELECT ptf_id,
    string_agg(DISTINCT sensor_country, ', ' ORDER BY sensor_country) AS sensor_country
  FROM oceanops.v_sensor_provider
  GROUP BY ptf_id
) sp ON t.ptf_id = sp.ptf_id
LEFT JOIN oceanops.ptf p ON p.id = t.ptf_id
LEFT JOIN oceanops.ptf_model pm ON pm.id = p.ptf_model_id
LEFT JOIN oceanops.ptf_type pt ON pt.id = pm.ptf_type_id
LEFT JOIN oceanops.ptf_family pf ON pf.id = pt.ptf_family_id
LEFT JOIN (
  SELECT
    network_ptf.ptf_id,
    string_agg(DISTINCT network.name_short, ', ' ORDER BY network.name_short) AS goos_networks
  FROM oceanops.network_ptf
  JOIN oceanops.network ON network_ptf.network_id = network.id
  WHERE network.goos
  GROUP BY network_ptf.ptf_id
) goos ON goos.ptf_id = t.ptf_id
WHERE {{WHERE}};

-- @partner
-- Reporting ISO: sql/_partner_country_iso.sql (HK->CN, EN->EU, exclude AQ/UN/...)
SELECT {{PARTNER_COUNTRY_ISO:t.country_iso_code2}} AS country_iso_code2, COUNT(*)::int
FROM oceanops_gis.ptf_loc_n AS t
WHERE ({{WHERE}})
GROUP BY 1
HAVING {{PARTNER_COUNTRY_ISO:t.country_iso_code2}} IS NOT NULL
ORDER BY 1;

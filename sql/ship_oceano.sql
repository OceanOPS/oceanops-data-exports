-- Layer: ship_oceano
-- SOOP XBT design lines — line list + sampled since edition date (cruise departure)
-- Edit filter under @where; edition.values.json for dates / line lists.

-- @where
g.shape IS NOT NULL AND g.name IN ({{SOOP_XBT_LINE_NAMES_IN}}) AND EXISTS (
  SELECT 1
  FROM oceanops.cruise_line cl
  JOIN oceanops.cruise c ON c.id = cl.cruise_id
  WHERE cl.line_id = g.line_id
    AND c.departure_date >= DATE '{{SOOP_XBT_SAMPLED_SINCE}}'
)

-- @geojson
SELECT jsonb_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(g.shape)::jsonb,
      'properties', jsonb_build_object(
        'category', 'ship_based_oceanographic_sot',
        'line_id', g.line_id,
        'line_name', g.name
      )
    )
  ), '[]'::jsonb)
)
FROM oceanops_gis.soop_xbt_design_2021_2022 AS g
WHERE {{WHERE}};

-- @partner
SET search_path TO oceanops, oceanops_gis, public;
WITH selected_lines AS (
  SELECT DISTINCT g.line_id
  FROM soop_xbt_design_2021_2022 AS g
  WHERE ({{WHERE}})
    AND g.line_id IS NOT NULL
)
SELECT c.code2, COUNT(DISTINCT lp.line_id)::int AS line_count
FROM selected_lines sl
JOIN line_program lp ON lp.line_id = sl.line_id
JOIN program p ON p.id = lp.program_id
JOIN country c ON c.id = p.country_id
GROUP BY c.code2
ORDER BY c.code2;

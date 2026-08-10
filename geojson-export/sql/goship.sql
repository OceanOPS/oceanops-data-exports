-- Layer: goship
-- GO-SHIP design lines — manual name list
-- Edit WHERE (or line IN list) here, test in pgAdmin, then: npm run export:geojson
--   psql "$OCEANOPS_DATABASE_URL" -v ON_ERROR_STOP=1 -f geojson-export/sql/goship.sql
-- Edit filter under @where; edition.values.json for dates / line lists.
-- pgAdmin: npm run render:sql -- geojson-export/sql/goship.sql

-- @where
t.shape IS NOT NULL AND t.name IN ({{GOSHIP_LINE_NAMES_IN}})

-- @geojson
SELECT jsonb_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(t.shape)::jsonb,
      'properties', jsonb_build_object(
        'category', 'goship',
        'line_id', t.line_id,
        'line_name', t.name
      )
    )
  ), '[]'::jsonb)
)
FROM oceanops_gis.goship_design_goship_1 AS t
WHERE {{WHERE}};

-- @partner
-- Per-country lines: design rows (same names as map) → line_program → program.country
SET search_path TO oceanops, oceanops_gis, public;
WITH selected_lines AS (
  SELECT DISTINCT g.line_id
  FROM goship_design_goship_1 AS g
  WHERE g.shape IS NOT NULL
    AND g.name IN ({{GOSHIP_LINE_NAMES_IN}})
    AND g.line_id IS NOT NULL
)
SELECT c.code2, COUNT(DISTINCT lp.line_id)::int AS line_count
FROM selected_lines sl
JOIN line_program lp ON lp.line_id = sl.line_id
JOIN program p ON p.id = lp.program_id
JOIN country c ON c.id = p.country_id
GROUP BY c.code2
ORDER BY c.code2;

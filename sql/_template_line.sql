-- Template: **line** layer (GO-SHIP, SOOP XBT)
--
-- 1. Copy to `<layerId>.sql`
-- 2. Set FROM table, category, line list tokens in @where
-- 3. Register in `geojson-export/layers.manifest.json` with `"densify": true` for globe display
--
-- Use alias `g` in @where / @geojson / @partner so {{WHERE}} is shared (like point layers with `t`).

-- @where
g.shape IS NOT NULL AND g.name IN ({{GOSHIP_LINE_NAMES_IN}})

-- @geojson
SELECT jsonb_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(g.shape)::jsonb,
      'properties', jsonb_build_object(
        'category', 'goship',
        'line_id', g.line_id,
        'line_name', g.name
      )
    )
  ), '[]'::jsonb)
)
FROM oceanops_gis.goship_design_goship_1 AS g
WHERE {{WHERE}};

-- @partner
-- Per-country lines: same @where as map → cruise → program → country
SET search_path TO oceanops, oceanops_gis, public;
WITH selected_lines AS (
  SELECT DISTINCT g.line_id
  FROM goship_design_goship_1 AS g
  WHERE ({{WHERE}})
    AND g.line_id IS NOT NULL
)
SELECT c.code2, COUNT(DISTINCT sl.line_id)::int AS line_count
FROM selected_lines sl
JOIN cruise_line cl ON cl.line_id = sl.line_id
JOIN cruise_program cp ON cp.cruise_id = cl.cruise_id
JOIN program p ON p.id = cp.program_id
JOIN country c ON c.id = p.country_id
WHERE c.code2 IS NOT NULL
  AND TRIM(c.code2) <> ''
GROUP BY c.code2
ORDER BY c.code2;

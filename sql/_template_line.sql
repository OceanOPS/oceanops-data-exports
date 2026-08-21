-- Template: **line** layer (GO-SHIP, Ocean TraX)
--
-- 1. Copy to `<layerId>.sql`
-- 2. Set FROM table, category, line list tokens in @where
-- 3. Register in `geojson-export/layers.manifest.json` with `"densify": true` for globe display
--
-- Use alias `g` in @where / @geojson / @partner so {{WHERE}} is shared (like point layers with `t`).

-- @where
g.shape IS NOT NULL
-- Example line-list filter: AND g.name IN ({{SOOP_XBT_LINE_NAMES_IN}})

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
-- Per-country lines: cruise_line → cruise → cruise_country
SET search_path TO oceanops, oceanops_gis, public;
WITH selected_lines AS (
  SELECT DISTINCT g.line_id
  FROM goship_design_goship_1 AS g
  WHERE ({{WHERE}})
    AND g.line_id IS NOT NULL
)
SELECT co.code2, COUNT(DISTINCT sl.line_id)::int AS line_count
FROM selected_lines sl
JOIN cruise_line cl ON cl.line_id = sl.line_id
JOIN cruise cr ON cr.id = cl.cruise_id
JOIN cruise_country cc ON cc.cruise_id = cr.id
JOIN country co ON co.id = cc.country_id
WHERE co.code2 IS NOT NULL
  AND TRIM(co.code2) <> ''
GROUP BY co.code2
ORDER BY co.code2;

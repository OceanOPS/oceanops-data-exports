-- Layer: goship
-- GO-SHIP design lines — 53 core lines (line_type <> 'Associated', name <> 'P03', shape not null)
-- Do not COALESCE line_type: NULL line_type must be excluded (matches GIS / colleague query).
-- Map: all design lines; solid = cruise in [GOSHIP_EDITION_SINCE, export date]; dash = all others
-- Edit filter under @where; edition.values.json for date tokens

-- @where
g.shape IS NOT NULL
AND g.line_type <> 'Associated'
AND g.name <> 'P03'

-- @geojson
WITH design_lines AS (
  SELECT g.line_id, g.name, g.shape
  FROM oceanops_gis.goship_design_goship_1 AS g
  WHERE {{WHERE}}
),
latest_cruise AS (
  SELECT DISTINCT ON (cl.line_id)
    cl.line_id,
    c.id AS cruise_id,
    c.departure_date,
    c.ref AS cruise_ref
  FROM oceanops.cruise_line cl
  JOIN oceanops.cruise c ON c.id = cl.cruise_id
  WHERE cl.line_id IN (SELECT line_id FROM design_lines)
  ORDER BY cl.line_id, c.departure_date DESC NULLS LAST, c.id DESC
),
latest_cruise_country AS (
  SELECT DISTINCT ON (lc.line_id)
    lc.line_id,
    co.name AS last_cruise_country
  FROM latest_cruise lc
  JOIN oceanops.cruise_program cp ON cp.cruise_id = lc.cruise_id
  JOIN oceanops.program p ON p.id = cp.program_id
  JOIN oceanops.country co ON co.id = p.country_id
  ORDER BY lc.line_id, cp.lead DESC NULLS LAST, co.name
),
edition_sampled AS (
  SELECT DISTINCT cl.line_id
  FROM oceanops.cruise_line cl
  JOIN oceanops.cruise c ON c.id = cl.cruise_id
  WHERE cl.line_id IN (SELECT line_id FROM design_lines)
    AND c.departure_date >= DATE '{{GOSHIP_EDITION_SINCE}}'
    AND c.departure_date <= DATE '{{GOSHIP_EDITION_UNTIL}}'
),
recent_sampled AS (
  SELECT DISTINCT cl.line_id
  FROM oceanops.cruise_line cl
  JOIN oceanops.cruise c ON c.id = cl.cruise_id
  WHERE cl.line_id IN (SELECT line_id FROM design_lines)
    AND c.departure_date >= DATE '{{GOSHIP_RECENT_SINCE}}'
    AND c.departure_date < DATE '{{GOSHIP_EDITION_SINCE}}'
),
decadal_plan AS (
  SELECT DISTINCT ls.line_id
  FROM oceanops.line_survey ls
  JOIN oceanops.survey s ON s.id = ls.survey_id
  WHERE ls.survey_id = 3
    AND ls.line_id IN (SELECT line_id FROM design_lines)
    AND s.start_date <= DATE '{{GOSHIP_DECADAL_UNTIL}}'
    AND COALESCE(s.end_date, DATE '{{GOSHIP_DECADAL_UNTIL}}') >= DATE '{{GOSHIP_DECADAL_SINCE}}'
)
SELECT jsonb_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(d.shape)::jsonb,
      'properties', jsonb_build_object(
        'category', 'goship',
        'line_id', d.line_id,
        'line_name', d.name,
        'line_style', CASE WHEN es.line_id IS NOT NULL THEN 'solid' ELSE 'dash' END,
        'sampled_in_edition', (es.line_id IS NOT NULL),
        'last_cruise_date', to_char(lc.departure_date, 'YYYY-MM-DD'),
        'last_cruise_ref', lc.cruise_ref,
        'last_cruise_countries', COALESCE(lcc.last_cruise_country, ''),
        'last_cruise_country', COALESCE(lcc.last_cruise_country, ''),
        'last_cruise_display', CASE
          WHEN lc.departure_date IS NULL THEN 'No cruise recorded'
          ELSE to_char(lc.departure_date, 'YYYY-MM-DD')
            || COALESCE(' (' || lc.cruise_ref || ')', '')
        END,
        'last_cruise_by', COALESCE(NULLIF(lcc.last_cruise_country, ''), 'Unknown'),
        'edition_status', CASE
          WHEN es.line_id IS NOT NULL THEN 'Sampled since 2025'
          WHEN rs.line_id IS NOT NULL THEN 'Sampled 2023–2024'
          WHEN lc.departure_date IS NULL THEN 'No cruise recorded'
          WHEN dp.line_id IS NOT NULL THEN 'In 2025–2034 GO-SHIP decadal plan'
          ELSE 'Not sampled since 2023'
        END
      )
    )
    ORDER BY d.name
  ), '[]'::jsonb)
)
FROM design_lines d
LEFT JOIN edition_sampled es ON es.line_id = d.line_id
LEFT JOIN recent_sampled rs ON rs.line_id = d.line_id
LEFT JOIN decadal_plan dp ON dp.line_id = d.line_id
LEFT JOIN latest_cruise lc ON lc.line_id = d.line_id
LEFT JOIN latest_cruise_country lcc ON lcc.line_id = d.line_id;

-- @partner
-- Per-country lines sampled in the edition window (same design filter + cruise dates)
SET search_path TO oceanops, oceanops_gis, public;
WITH selected_lines AS (
  SELECT DISTINCT g.line_id
  FROM goship_design_goship_1 AS g
  WHERE ({{WHERE}})
    AND g.line_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM oceanops.cruise_line cl
      JOIN oceanops.cruise c ON c.id = cl.cruise_id
      WHERE cl.line_id = g.line_id
        AND c.departure_date >= DATE '{{GOSHIP_EDITION_SINCE}}'
        AND c.departure_date <= DATE '{{GOSHIP_EDITION_UNTIL}}'
    )
)
SELECT c.code2, COUNT(DISTINCT sl.line_id)::int AS line_count
FROM selected_lines sl
JOIN cruise_line cl ON cl.line_id = sl.line_id
JOIN cruise c ON c.id = cl.cruise_id
  AND c.departure_date >= DATE '{{GOSHIP_EDITION_SINCE}}'
  AND c.departure_date <= DATE '{{GOSHIP_EDITION_UNTIL}}'
JOIN cruise_program cp ON cp.cruise_id = c.id
JOIN program p ON p.id = cp.program_id
JOIN country c ON c.id = p.country_id
WHERE c.code2 IS NOT NULL
  AND TRIM(c.code2) <> ''
GROUP BY c.code2
ORDER BY c.code2;

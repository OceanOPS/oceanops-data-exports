-- Layer: oceantrax
-- Ocean TraX (SOOP) design lines — line list; solid = sampled since SOOP_XBT_SAMPLED_SINCE
-- Edit filter under @where; edition.values.json for dates / line lists.

-- @where
g.shape IS NOT NULL AND g.name IN ({{SOOP_XBT_LINE_NAMES_IN}})

-- @geojson
WITH design_lines AS (
  SELECT g.line_id, g.name, g.shape
  FROM oceanops_gis.soop_xbt_design_2021_2022 AS g
  WHERE {{WHERE}}
),
latest_cruise AS (
  SELECT DISTINCT ON (cl.line_id)
    cl.line_id,
    c.id AS cruise_id,
    c.departure_date,
    c.ref AS cruise_ref,
    s.name AS ship_name
  FROM oceanops.cruise_line cl
  JOIN oceanops.cruise c ON c.id = cl.cruise_id
  LEFT JOIN oceanops.ship s ON s.id = c.ship_id
  WHERE cl.line_id IN (SELECT line_id FROM design_lines)
  ORDER BY cl.line_id, c.departure_date DESC NULLS LAST, c.id DESC
),
latest_cruise_countries AS (
  SELECT lc.line_id,
    string_agg(DISTINCT co.name, ', ' ORDER BY co.name) AS last_cruise_countries
  FROM latest_cruise lc
  JOIN oceanops.cruise_country cc ON cc.cruise_id = lc.cruise_id
  JOIN oceanops.country co ON co.id = cc.country_id
  WHERE co.code2 IS NOT NULL AND TRIM(co.code2) <> ''
  GROUP BY lc.line_id
),
edition_sampled AS (
  SELECT DISTINCT cl.line_id
  FROM oceanops.cruise_line cl
  JOIN oceanops.cruise c ON c.id = cl.cruise_id
  WHERE cl.line_id IN (SELECT line_id FROM design_lines)
    AND c.departure_date >= DATE '{{SOOP_XBT_SAMPLED_SINCE}}'
),
line_edition_countries AS (
  SELECT cl.line_id,
    string_agg(DISTINCT co.code2, ',' ORDER BY co.code2) AS country_codes
  FROM oceanops.cruise_line cl
  JOIN oceanops.cruise cr ON cr.id = cl.cruise_id
  JOIN oceanops.cruise_country cc ON cc.cruise_id = cr.id
  JOIN oceanops.country co ON co.id = cc.country_id
  WHERE cl.line_id IN (SELECT line_id FROM design_lines)
    AND cr.departure_date >= DATE '{{SOOP_XBT_SAMPLED_SINCE}}'
    AND co.code2 IS NOT NULL
    AND TRIM(co.code2) <> ''
  GROUP BY cl.line_id
)
SELECT jsonb_build_object(
  'type', 'FeatureCollection',
  'features', COALESCE(jsonb_agg(
    jsonb_build_object(
      'type', 'Feature',
      'geometry', ST_AsGeoJSON(d.shape)::jsonb,
      'properties', jsonb_build_object(
        'category', 'ship_based_oceanographic_sot',
        'line_id', d.line_id,
        'line_name', d.name,
        'line_style', CASE WHEN es.line_id IS NOT NULL THEN 'solid' ELSE 'dash' END,
        'sampled_in_edition', (es.line_id IS NOT NULL),
        'last_cruise_date', to_char(lc.departure_date, 'YYYY-MM-DD'),
        'last_cruise_ref', lc.cruise_ref,
        'last_cruise_ship', COALESCE(NULLIF(TRIM(lc.ship_name), ''), ''),
        'last_cruise_countries', COALESCE(lcc.last_cruise_countries, ''),
        'last_cruise_country', COALESCE(lcc.last_cruise_countries, ''),
        'last_cruise_display', CASE
          WHEN lc.departure_date IS NULL THEN 'No cruise recorded'
          ELSE to_char(lc.departure_date, 'YYYY-MM-DD')
            || CASE
              WHEN NULLIF(TRIM(lc.ship_name), '') IS NOT NULL
                THEN ' (' || TRIM(lc.ship_name) || ')'
              WHEN lc.cruise_ref IS NOT NULL
                THEN ' (' || lc.cruise_ref || ')'
              ELSE ''
            END
        END,
        'last_cruise_by', COALESCE(NULLIF(lcc.last_cruise_countries, ''), 'Unknown'),
        'edition_country_codes', COALESCE(lec.country_codes, ''),
        'edition_status', CASE
          WHEN es.line_id IS NOT NULL THEN 'Sampled since ' || to_char(DATE '{{SOOP_XBT_SAMPLED_SINCE}}', 'YYYY')
          WHEN lc.departure_date IS NULL THEN 'No cruise recorded'
          ELSE 'Not sampled since ' || to_char(DATE '{{SOOP_XBT_SAMPLED_SINCE}}', 'YYYY')
        END
      )
    )
    ORDER BY d.name
  ), '[]'::jsonb)
)
FROM design_lines d
LEFT JOIN edition_sampled es ON es.line_id = d.line_id
LEFT JOIN latest_cruise lc ON lc.line_id = d.line_id
LEFT JOIN latest_cruise_countries lcc ON lcc.line_id = d.line_id
LEFT JOIN line_edition_countries lec ON lec.line_id = d.line_id;

-- @partner
-- Per-country lines with edition cruises: cruise_line → cruise (dates) → cruise_country
SET search_path TO oceanops, oceanops_gis, public;
WITH selected_lines AS (
  SELECT DISTINCT g.line_id
  FROM soop_xbt_design_2021_2022 AS g
  WHERE ({{WHERE}})
    AND g.line_id IS NOT NULL
)
SELECT co.code2, COUNT(DISTINCT sl.line_id)::int AS line_count
FROM selected_lines sl
JOIN cruise_line cl ON cl.line_id = sl.line_id
JOIN cruise cr ON cr.id = cl.cruise_id
  AND cr.departure_date >= DATE '{{SOOP_XBT_SAMPLED_SINCE}}'
JOIN cruise_country cc ON cc.cruise_id = cr.id
JOIN country co ON co.id = cc.country_id
WHERE co.code2 IS NOT NULL
  AND TRIM(co.code2) <> ''
GROUP BY co.code2
ORDER BY co.code2;

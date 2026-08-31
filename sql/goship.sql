-- Layer: goship
-- GO-SHIP design lines — 53 core lines (line_type <> 'Associated', name <> 'P03', shape not null)
-- Do not COALESCE line_type: NULL line_type must be excluded (matches GIS / colleague query).
-- Map: all design lines; solid = cruise in [GOSHIP_EDITION_SINCE, export date]; dash = all others
-- Country attribution: cruise_program (lead = 1) → program.country_id (not cruise_country)
-- Ship name/country omitted when ship.hide_metadata = 1 (same rule as v_ptf_depl_rv on point layers).
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
cruise_lead_country AS (
  SELECT
    cp.cruise_id,
    co.name AS country_name,
    co.code2 AS country_code2
  FROM oceanops.cruise_program cp
  JOIN oceanops.program pr ON pr.id = cp.program_id
  JOIN oceanops.country co ON co.id = pr.country_id
  WHERE cp.lead = 1
    AND co.code2 IS NOT NULL
    AND TRIM(co.code2) <> ''
),
latest_cruise AS (
  SELECT DISTINCT ON (cl.line_id)
    cl.line_id,
    c.id AS cruise_id,
    c.departure_date,
    c.ref AS cruise_ref,
    (COALESCE(s.hide_metadata, 0) = 1) AS ship_masked,
    CASE WHEN COALESCE(s.hide_metadata, 0) = 1 THEN NULL ELSE s.name END AS ship_name,
    CASE WHEN COALESCE(s.hide_metadata, 0) = 1 THEN NULL ELSE ship_co.name END AS last_cruise_ship_country
  FROM oceanops.cruise_line cl
  JOIN oceanops.cruise c ON c.id = cl.cruise_id
  LEFT JOIN oceanops.ship s ON s.id = c.ship_id
  LEFT JOIN oceanops.country ship_co ON ship_co.id = s.country_id
  WHERE cl.line_id IN (SELECT line_id FROM design_lines)
    AND c.departure_date <= DATE '{{GOSHIP_EDITION_UNTIL}}'
  ORDER BY cl.line_id, c.departure_date DESC NULLS LAST, c.id DESC
),
next_cruise AS (
  SELECT DISTINCT ON (cl.line_id)
    cl.line_id,
    c.id AS cruise_id,
    c.departure_date,
    c.ref AS cruise_ref,
    (COALESCE(s.hide_metadata, 0) = 1) AS ship_masked,
    CASE WHEN COALESCE(s.hide_metadata, 0) = 1 THEN NULL ELSE s.name END AS ship_name,
    CASE WHEN COALESCE(s.hide_metadata, 0) = 1 THEN NULL ELSE ship_co.name END AS next_cruise_ship_country
  FROM oceanops.cruise_line cl
  JOIN oceanops.cruise c ON c.id = cl.cruise_id
  LEFT JOIN oceanops.ship s ON s.id = c.ship_id
  LEFT JOIN oceanops.country ship_co ON ship_co.id = s.country_id
  WHERE cl.line_id IN (SELECT line_id FROM design_lines)
    AND c.departure_date > DATE '{{GOSHIP_EDITION_UNTIL}}'
  ORDER BY cl.line_id, c.departure_date ASC NULLS LAST, c.id ASC
),
latest_cruise_countries AS (
  SELECT lc.line_id,
    string_agg(DISTINCT clc.country_name, ', ' ORDER BY clc.country_name) AS last_cruise_countries
  FROM latest_cruise lc
  JOIN cruise_lead_country clc ON clc.cruise_id = lc.cruise_id
  GROUP BY lc.line_id
),
next_cruise_countries AS (
  SELECT nc.line_id,
    string_agg(DISTINCT clc.country_name, ', ' ORDER BY clc.country_name) AS next_cruise_countries
  FROM next_cruise nc
  JOIN cruise_lead_country clc ON clc.cruise_id = nc.cruise_id
  GROUP BY nc.line_id
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
),
line_edition_countries AS (
  SELECT cl.line_id,
    string_agg(DISTINCT clc.country_code2, ',' ORDER BY clc.country_code2) AS country_codes
  FROM oceanops.cruise_line cl
  JOIN oceanops.cruise cr ON cr.id = cl.cruise_id
  JOIN cruise_lead_country clc ON clc.cruise_id = cr.id
  WHERE cl.line_id IN (SELECT line_id FROM design_lines)
    AND cr.departure_date >= DATE '{{GOSHIP_EDITION_SINCE}}'
    AND cr.departure_date <= DATE '{{GOSHIP_EDITION_UNTIL}}'
  GROUP BY cl.line_id
),
edition_cruises AS (
  SELECT cl.line_id,
    jsonb_agg(
      jsonb_build_object(
        'cruise_ref', c.ref,
        'cruise_date', to_char(c.departure_date, 'YYYY-MM-DD'),
        'ship_masked', (COALESCE(s.hide_metadata, 0) = 1),
        'ship_name', CASE WHEN COALESCE(s.hide_metadata, 0) = 1 THEN '' ELSE COALESCE(NULLIF(TRIM(s.name), ''), '') END,
        'ship_country', CASE WHEN COALESCE(s.hide_metadata, 0) = 1 THEN '' ELSE COALESCE(NULLIF(TRIM(ship_co.name), ''), '') END,
        'program_country', COALESCE(NULLIF(TRIM(clc.country_name), ''), '')
      )
      ORDER BY c.departure_date DESC NULLS LAST, c.id DESC
    ) AS edition_cruises
  FROM oceanops.cruise_line cl
  JOIN oceanops.cruise c ON c.id = cl.cruise_id
  LEFT JOIN oceanops.ship s ON s.id = c.ship_id
  LEFT JOIN oceanops.country ship_co ON ship_co.id = s.country_id
  LEFT JOIN cruise_lead_country clc ON clc.cruise_id = c.id
  WHERE cl.line_id IN (SELECT line_id FROM design_lines)
    AND c.departure_date >= DATE '{{GOSHIP_EDITION_SINCE}}'
    AND c.departure_date <= DATE '{{GOSHIP_EDITION_UNTIL}}'
  GROUP BY cl.line_id
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
        'last_cruise_ship', COALESCE(NULLIF(TRIM(lc.ship_name), ''), ''),
        'last_cruise_ship_masked', COALESCE(lc.ship_masked, false),
        'last_cruise_ship_country', COALESCE(NULLIF(TRIM(lc.last_cruise_ship_country), ''), ''),
        'last_cruise_countries', COALESCE(lcc.last_cruise_countries, ''),
        'last_cruise_country', COALESCE(lcc.last_cruise_countries, ''),
        'last_cruise_display', CASE
          WHEN lc.departure_date IS NULL THEN 'No cruise recorded'
          ELSE to_char(lc.departure_date, 'YYYY-MM-DD')
            || CASE
              WHEN lc.ship_masked THEN ''
              WHEN NULLIF(TRIM(lc.ship_name), '') IS NOT NULL
                THEN ' (' || TRIM(lc.ship_name) || ')'
              WHEN lc.cruise_ref IS NOT NULL
                THEN ' (' || lc.cruise_ref || ')'
              ELSE ''
            END
        END,
        'last_cruise_by', COALESCE(NULLIF(lcc.last_cruise_countries, ''), 'Unknown'),
        'next_cruise_date', to_char(nc.departure_date, 'YYYY-MM-DD'),
        'next_cruise_ref', nc.cruise_ref,
        'next_cruise_ship', COALESCE(NULLIF(TRIM(nc.ship_name), ''), ''),
        'next_cruise_ship_masked', COALESCE(nc.ship_masked, false),
        'next_cruise_ship_country', COALESCE(NULLIF(TRIM(nc.next_cruise_ship_country), ''), ''),
        'next_cruise_countries', COALESCE(ncc.next_cruise_countries, ''),
        'next_cruise_country', COALESCE(ncc.next_cruise_countries, ''),
        'next_cruise_display', CASE
          WHEN nc.departure_date IS NULL THEN ''
          ELSE to_char(nc.departure_date, 'YYYY-MM-DD')
            || CASE
              WHEN nc.ship_masked THEN ''
              WHEN NULLIF(TRIM(nc.ship_name), '') IS NOT NULL
                THEN ' (' || TRIM(nc.ship_name) || ')'
              WHEN nc.cruise_ref IS NOT NULL
                THEN ' (' || nc.cruise_ref || ')'
              ELSE ''
            END
        END,
        'edition_country_codes', COALESCE(lec.country_codes, ''),
        'edition_cruises', COALESCE(ec.edition_cruises, '[]'::jsonb)::text,
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
LEFT JOIN next_cruise nc ON nc.line_id = d.line_id
LEFT JOIN latest_cruise_countries lcc ON lcc.line_id = d.line_id
LEFT JOIN next_cruise_countries ncc ON ncc.line_id = d.line_id
LEFT JOIN line_edition_countries lec ON lec.line_id = d.line_id
LEFT JOIN edition_cruises ec ON ec.line_id = d.line_id;

-- @partner
-- Per-country edition cruises on GO-SHIP design lines (lead program country; counts cruises, not distinct lines)
-- Reporting ISO: sql/_partner_country_iso.sql (HK→CN, EN→EU, exclude AQ/UN/…)
SET search_path TO oceanops, oceanops_gis, public;
WITH design_lines AS (
  SELECT DISTINCT g.line_id
  FROM goship_design_goship_1 AS g
  WHERE ({{WHERE}})
    AND g.line_id IS NOT NULL
),
cruise_lead_country AS (
  SELECT
    cp.cruise_id,
    co.code2 AS country_code2
  FROM cruise_program cp
  JOIN program pr ON pr.id = cp.program_id
  JOIN country co ON co.id = pr.country_id
  WHERE cp.lead = 1
    AND co.code2 IS NOT NULL
    AND TRIM(co.code2) <> ''
)
SELECT {{PARTNER_COUNTRY_ISO:clc.country_code2}} AS code2, COUNT(DISTINCT cr.id)::int AS line_count
FROM design_lines dl
JOIN cruise_line cl ON cl.line_id = dl.line_id
JOIN cruise cr ON cr.id = cl.cruise_id
  AND cr.departure_date >= DATE '{{GOSHIP_EDITION_SINCE}}'
  AND cr.departure_date <= DATE '{{GOSHIP_EDITION_UNTIL}}'
JOIN cruise_lead_country clc ON clc.cruise_id = cr.id
GROUP BY 1
HAVING {{PARTNER_COUNTRY_ISO:clc.country_code2}} IS NOT NULL
ORDER BY 1;

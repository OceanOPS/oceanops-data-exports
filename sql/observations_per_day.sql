-- Report card stat4 — REFERENCE / pgAdmin only.
-- The export pipeline uses read-only step queries in observations-export/queries.mjs
-- (source hierarchy, COUNT(*) per table, summed in Node — no DDL on prod).
--
-- Source hierarchy:
--   Argo         → obs_argo_gdac
--   Gliders      → obs_gliders_gdac + obs_gliders_ioos + obs_gliders_voto
--   Tsunami      → obs_tsuna_gts_osmc
--   AniBOS       → obs_anibos_meop
--   FVON         → obs_fishingvessel_fishydata
--   Rest         → obs (excl. Argo/Gliders/Tsunami platforms)
--
-- Single-query equivalent (no progress):
--   npm run render:sql -- sql/observations_per_day.sql

SET statement_timeout = 0;

WITH params AS (
  SELECT (CURRENT_DATE - INTERVAL '{{OBS_DAYS_WINDOW}} days')::timestamp AS since
),
daily AS (
  SELECT date_trunc('day', o.obs_date)::date AS obs_day, COUNT(*)::bigint AS cnt
  FROM oceanops.obs o
  CROSS JOIN params p
  WHERE o.obs_date >= p.since
    AND o.ptf_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM oceanops.network_ptf np
      WHERE np.ptf_id = o.ptf_id AND np.network_id IN (1000620, 1000640)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM oceanops.ptf pt
      JOIN oceanops.ptf_model pm ON pm.id = pt.ptf_model_id
      JOIN oceanops.ptf_type pty ON pty.id = pm.ptf_type_id
      WHERE pt.id = o.ptf_id AND pty.id = 2000
    )
  GROUP BY 1

  UNION ALL

  SELECT date_trunc('day', o.obs_date)::date, COUNT(*)::bigint
  FROM oceanops.obs_argo_gdac o
  CROSS JOIN params p
  WHERE o.obs_date >= p.since
  GROUP BY 1

  UNION ALL

  SELECT date_trunc('day', o.obs_date)::date, COUNT(*)::bigint
  FROM oceanops.obs_gliders_gdac o
  CROSS JOIN params p
  WHERE o.obs_date >= p.since
  GROUP BY 1

  UNION ALL

  SELECT date_trunc('day', o.obs_date)::date, COUNT(*)::bigint
  FROM oceanops.obs_gliders_ioos o
  CROSS JOIN params p
  WHERE o.obs_date >= p.since
  GROUP BY 1

  UNION ALL

  SELECT date_trunc('day', o.obs_date)::date, COUNT(*)::bigint
  FROM oceanops.obs_gliders_voto o
  CROSS JOIN params p
  WHERE o.obs_date >= p.since
  GROUP BY 1

  UNION ALL

  SELECT date_trunc('day', o.obs_date)::date, COUNT(*)::bigint
  FROM oceanops.obs_tsuna_gts_osmc o
  CROSS JOIN params p
  WHERE o.obs_date >= p.since
  GROUP BY 1

  UNION ALL

  SELECT date_trunc('day', o.obs_date)::date, COUNT(*)::bigint
  FROM oceanops.obs_anibos_meop o
  CROSS JOIN params p
  WHERE o.obs_date >= p.since
  GROUP BY 1

  UNION ALL

  SELECT date_trunc('day', o.obs_date)::date, COUNT(*)::bigint
  FROM oceanops.obs_fishingvessel_fishydata o
  CROSS JOIN params p
  WHERE o.obs_date >= p.since
  GROUP BY 1
),
by_day AS (
  SELECT obs_day, SUM(cnt)::bigint AS cnt
  FROM daily
  GROUP BY obs_day
)
SELECT
  COALESCE(ROUND(AVG(cnt)), 0)::bigint AS avg_obs_per_day,
  COUNT(*)::int AS days_with_data,
  COALESCE(SUM(cnt), 0)::bigint AS total_obs
FROM by_day;

-- GOOS tier count: tropical moored buoys (network 1000340), same operational filter as moored_buoys map layer.
-- Usage: export-goos-tier-counts.mjs (moored_buoys.sql @where → MOORED_BUOYS_WHERE token)

SELECT COUNT(*)::int
FROM oceanops_gis.ptf_loc_n AS t
WHERE ({{MOORED_BUOYS_WHERE}})
  AND EXISTS (
    SELECT 1
    FROM oceanops.network_ptf np
    WHERE np.ptf_id = t.ptf_id AND np.network_id = 1000340
  );

-- GOOS tier count: operational MBN not in GTMBA (network 1000340) → regional / coastal-national tier.
-- Same operational filter as moored_buoys map layer (inverse of goos_tier_moored_tropical.sql).

SELECT COUNT(*)::int
FROM oceanops_gis.ptf_loc_n AS t
WHERE ({{MOORED_BUOYS_WHERE}})
  AND NOT EXISTS (
    SELECT 1
    FROM oceanops.network_ptf np
    WHERE np.ptf_id = t.ptf_id AND np.network_id = 1000340
  );

EXPLAIN indexes = 1
SELECT
    event_type,
    count() AS events,
    quantileTDigest(0.95)(duration_ms) AS p95_ms
FROM analytics.events
WHERE tenant_id = 'tenant-42'
  AND event_time >= now() - INTERVAL 7 DAY
GROUP BY event_type;

SELECT
    read_rows,
    read_bytes,
    query_duration_ms,
    memory_usage
FROM system.query_log
WHERE type = 'QueryFinish'
  AND query_id = '{query_id}';

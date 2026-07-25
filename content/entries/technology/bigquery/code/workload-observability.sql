-- Replace region-us with the location that owns the jobs.
WITH completed_queries AS (
  SELECT
    COALESCE(reservation_id, 'on-demand') AS workload_pool,
    total_bytes_processed,
    total_slot_ms,
    TIMESTAMP_DIFF(end_time, start_time, MILLISECOND) AS elapsed_ms
  FROM `region-us`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
  WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)
    AND job_type = 'QUERY'
    AND state = 'DONE'
    AND error_result IS NULL
    AND start_time IS NOT NULL
    AND end_time IS NOT NULL
)
SELECT
  workload_pool,
  COUNT(*) AS query_count,
  ROUND(SUM(total_bytes_processed) / POW(1024, 4), 2) AS processed_tib,
  ROUND(SUM(total_slot_ms) / 1000, 0) AS slot_seconds,
  ROUND(
    SAFE_DIVIDE(SUM(total_slot_ms), SUM(elapsed_ms)),
    1
  ) AS average_slots_while_queries_ran,
  ROUND(
    APPROX_QUANTILES(elapsed_ms, 100)[OFFSET(95)] / 1000,
    1
  ) AS approximate_p95_seconds
FROM completed_queries
GROUP BY workload_pool
ORDER BY slot_seconds DESC;

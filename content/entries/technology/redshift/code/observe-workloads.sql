SELECT
  query_id,
  query_type,
  status,
  queue_time,
  execution_time,
  query_text
FROM sys_query_history
WHERE start_time >= dateadd(hour, -1, current_timestamp)
ORDER BY start_time DESC;

SELECT *
FROM svl_auto_worker_action
ORDER BY start_time DESC
LIMIT 20;

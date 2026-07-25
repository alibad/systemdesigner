ANALYZE TABLE learning.events
PARTITION (event_date = '2026-07-21')
COMPUTE STATISTICS;

ANALYZE TABLE learning.events
COMPUTE STATISTICS FOR COLUMNS;

EXPLAIN CBO
SELECT
  event_type,
  COUNT(*) AS event_count
FROM learning.events
WHERE event_date = DATE '2026-07-21'
GROUP BY event_type;

EXPLAIN VECTORIZATION
SELECT event_id, event_type
FROM learning.events
WHERE event_date = DATE '2026-07-21';

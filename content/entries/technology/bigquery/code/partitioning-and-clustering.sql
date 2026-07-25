-- Build the table around a common bounded access path.
CREATE TABLE `my-project.analytics.events` (
  event_id STRING NOT NULL,
  event_date DATE NOT NULL,
  event_timestamp TIMESTAMP NOT NULL,
  customer_id STRING NOT NULL,
  event_type STRING NOT NULL,
  attributes JSON
)
PARTITION BY event_date
CLUSTER BY customer_id, event_type
OPTIONS (
  require_partition_filter = TRUE,
  partition_expiration_days = 365,
  description = 'Customer events with bounded date scans'
);

-- This predicate can prune daily partitions. The customer predicate can
-- also benefit from clustered block pruning inside the selected dates.
SELECT
  event_type,
  COUNT(*) AS event_count
FROM `my-project.analytics.events`
WHERE event_date BETWEEN DATE '2026-07-01' AND DATE '2026-07-07'
  AND customer_id = 'customer-42'
GROUP BY event_type
ORDER BY event_count DESC;

-- With require_partition_filter enabled, a query that omits a usable
-- event_date predicate is rejected instead of scanning the retention window.

USE WAREHOUSE analytics_wh;
USE DATABASE production;
USE SCHEMA analytics;

-- Tag the representative query so its measured profile can be found later.
ALTER SESSION SET QUERY_TAG = 'orders-pruning-pilot-v1';

SELECT
  region,
  SUM(order_total) AS paid_order_total
FROM orders
WHERE order_date >= DATEADD('day', -7, CURRENT_DATE())
  AND order_date < CURRENT_DATE()
  AND region = 'EMEA'
  AND order_status = 'PAID'
GROUP BY region;

-- ACCOUNT_USAGE has delivery latency. Use Snowsight Query Profile for immediate
-- operator-level evidence and this view for a repeatable historical comparison.
SELECT
  query_id,
  warehouse_name,
  warehouse_size,
  total_elapsed_time,
  queued_overload_time,
  bytes_scanned,
  partitions_scanned,
  partitions_total,
  bytes_spilled_to_local_storage,
  bytes_spilled_to_remote_storage
FROM snowflake.account_usage.query_history
WHERE query_tag = 'orders-pruning-pilot-v1'
  AND start_time >= DATEADD('day', -1, CURRENT_TIMESTAMP())
ORDER BY start_time DESC;

-- Examine overlap for the candidate key. Lower depth is not an independent
-- success criterion; the representative query profile remains the decision evidence.
SELECT SYSTEM$CLUSTERING_INFORMATION(
  'PRODUCTION.ANALYTICS.ORDERS',
  '(ORDER_DATE, REGION)'
) AS clustering_information;

-- Only after measured benefit exceeds Automatic Clustering credit and storage cost:
-- ALTER TABLE production.analytics.orders
--   CLUSTER BY (TO_DATE(order_date), region);

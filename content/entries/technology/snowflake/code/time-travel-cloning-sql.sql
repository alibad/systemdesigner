-- Confirm the object's configured recovery window before relying on Time Travel.
SHOW TABLES LIKE 'ORDERS' IN SCHEMA production.sales;

-- Inspect the table as it existed one hour ago. OFFSET is expressed in seconds.
SELECT order_id, customer_id, order_total, order_status
FROM production.sales.orders
  AT (OFFSET => -3600)
WHERE order_status = 'PAID';

-- Replace the value with the QUERY_ID of the statement immediately before the
-- unwanted change. The clone is isolated for validation before any repair.
CREATE OR REPLACE TABLE recovery.sales.orders_before_change
  CLONE production.sales.orders
  BEFORE (STATEMENT => 'REPLACE_WITH_QUERY_ID');

-- Validate counts and business invariants before writing anything back.
SELECT
  order_status,
  COUNT(*) AS order_count,
  SUM(order_total) AS order_total
FROM recovery.sales.orders_before_change
GROUP BY order_status
ORDER BY order_status;

-- A dropped table can be restored only while it remains in Time Travel.
-- UNDROP TABLE production.sales.orders;

-- Clones initially reuse existing micro-partitions. Changes to either side create
-- new storage, so remove the repair object after evidence and retention allow it.
DROP TABLE IF EXISTS recovery.sales.orders_before_change;

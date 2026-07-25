-- 1. Capture the plan with the same account and time range that is slow in production.
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, status, total_cents, created_at
FROM orders
WHERE account_id = $1
  AND created_at >= $2
ORDER BY created_at DESC
LIMIT 50;

-- 2. Test an index that matches the equality filter and requested ordering.
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_account_created_at_idx
  ON orders (account_id, created_at DESC)
  INCLUDE (status, total_cents);

-- 3. Re-run the same EXPLAIN and compare latency, buffers, and rows examined.
-- Also measure write latency: every insert and update now maintains this index.

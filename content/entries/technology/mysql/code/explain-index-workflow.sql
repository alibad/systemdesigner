-- Start with a representative query and inspect actual execution behavior.
EXPLAIN ANALYZE
SELECT id, status, total_cents, created_at
FROM orders
WHERE tenant_id = 42
  AND status = 'pending'
ORDER BY created_at DESC
LIMIT 50;

-- Add an index that follows equality filters before the ordering column.
CREATE INDEX idx_orders_tenant_status_created
  ON orders (tenant_id, status, created_at DESC);

-- Run the same plan again and compare rows examined and elapsed time.
EXPLAIN ANALYZE
SELECT id, status, total_cents, created_at
FROM orders
WHERE tenant_id = 42
  AND status = 'pending'
ORDER BY created_at DESC
LIMIT 50;

-- Columnar optimization in action
SELECT
    customer_id,           -- Only scans customer_id column
    SUM(order_amount)      -- Only scans order_amount column
FROM `dataset.large_orders`
WHERE order_date >= '2024-01-01'  -- Partition pruning
    AND region = 'US'               -- Predicate pushdown
GROUP BY customer_id;

-- Performance benefits:
-- - 10TB table → 500GB scanned (columnar)
-- - Partition pruning reduces scan further
-- - Dremel distributes across 1000+ workers
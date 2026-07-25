-- Establish the source contract before optimizing a query.
DESCRIBE
SELECT *
FROM read_parquet('warehouse/orders/year=2026/month=07/*.parquet');

-- Inspect the physical plan without running the full workload.
EXPLAIN
SELECT
    customer_region,
    count(*) AS paid_orders,
    sum(net_amount) AS net_revenue
FROM read_parquet('warehouse/orders/year=2026/month=07/*.parquet')
WHERE
    order_status = 'paid'
    AND order_date >= DATE '2026-07-01'
    AND order_date < DATE '2026-08-01'
GROUP BY customer_region;

-- Execute on representative data and retain the operator evidence.
EXPLAIN ANALYZE
SELECT
    customer_region,
    count(*) AS paid_orders,
    sum(net_amount) AS net_revenue
FROM read_parquet('warehouse/orders/year=2026/month=07/*.parquet')
WHERE
    order_status = 'paid'
    AND order_date >= DATE '2026-07-01'
    AND order_date < DATE '2026-08-01'
GROUP BY customer_region;

-- Check the active resource settings alongside the captured plan.
SELECT
    current_setting('threads') AS threads,
    current_setting('memory_limit') AS memory_limit,
    current_setting('temp_directory') AS temp_directory;

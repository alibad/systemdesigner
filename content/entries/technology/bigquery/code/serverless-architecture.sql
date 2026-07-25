-- Analyze large dataset with automatic scaling
SELECT
    product_category,
    DATE_TRUNC(order_date, MONTH) as month,
    SUM(revenue) as monthly_revenue,
    COUNT(DISTINCT customer_id) as unique_customers
FROM `company.ecommerce.transactions`
WHERE order_date >= '2023-01-01'
GROUP BY product_category, month
ORDER BY monthly_revenue DESC;

-- BigQuery automatically:
-- 1. Distributes query across 1000+ slots
-- 2. Scans only relevant partitions
-- 3. Optimizes joins and aggregations
-- 4. Returns results in seconds
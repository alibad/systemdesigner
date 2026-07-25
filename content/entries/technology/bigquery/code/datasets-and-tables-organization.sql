-- Create dataset with geographic and access controls
CREATE SCHEMA `my-project.sales_analytics_us`
OPTIONS (
    location = 'US',
    default_table_expiration_days = 365,
    description = 'Sales analytics data for US region'
);

-- Create table with partitioning and clustering
CREATE TABLE `my-project.sales_analytics_us.transactions` (
    transaction_id STRING NOT NULL,
    customer_id STRING NOT NULL,
    product_id STRING NOT NULL,
    order_date DATE NOT NULL,
    revenue NUMERIC NOT NULL,
    region STRING NOT NULL
)
PARTITION BY order_date
CLUSTER BY customer_id, region;
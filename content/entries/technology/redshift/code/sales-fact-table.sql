CREATE TABLE analytics.sales_fact (
  order_id       BIGINT       NOT NULL,
  account_id     BIGINT       NOT NULL,
  product_id     BIGINT       NOT NULL,
  event_time     TIMESTAMP    NOT NULL,
  net_revenue    DECIMAL(18,2) NOT NULL
)
DISTSTYLE AUTO
SORTKEY AUTO;

COPY analytics.sales_fact
FROM 's3://example-ingest/sales/'
IAM_ROLE 'arn:aws:iam::123456789012:role/redshift-copy'
FORMAT AS PARQUET;

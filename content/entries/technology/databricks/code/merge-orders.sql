CREATE TABLE IF NOT EXISTS production.silver.orders (
  order_id STRING NOT NULL,
  customer_id STRING NOT NULL,
  status STRING NOT NULL,
  amount DECIMAL(18, 2) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  source_sequence BIGINT NOT NULL,
  CONSTRAINT valid_amount CHECK (amount >= 0)
)
USING DELTA
CLUSTER BY (customer_id, updated_at);

MERGE INTO production.silver.orders AS target
USING (
  SELECT
    order_id,
    customer_id,
    status,
    amount,
    updated_at,
    source_sequence
  FROM (
    SELECT
      *,
      row_number() OVER (
        PARTITION BY order_id
        ORDER BY source_sequence DESC, ingested_at DESC
      ) AS row_rank
    FROM production.bronze.orders
    WHERE ingested_at >= current_timestamp() - INTERVAL 1 DAY
  )
  WHERE row_rank = 1
) AS source
ON target.order_id = source.order_id
WHEN MATCHED AND source.source_sequence > target.source_sequence THEN
  UPDATE SET
    customer_id = source.customer_id,
    status = source.status,
    amount = source.amount,
    updated_at = source.updated_at,
    source_sequence = source.source_sequence
WHEN NOT MATCHED THEN
  INSERT (
    order_id,
    customer_id,
    status,
    amount,
    updated_at,
    source_sequence
  )
  VALUES (
    source.order_id,
    source.customer_id,
    source.status,
    source.amount,
    source.updated_at,
    source.source_sequence
  );

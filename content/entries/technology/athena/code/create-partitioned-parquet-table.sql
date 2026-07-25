-- Convert raw JSON into a bounded analytical layout.
-- Keep the target prefix separate from the source prefix.
CREATE TABLE analytics.events_parquet
WITH (
  format = 'PARQUET',
  write_compression = 'ZSTD',
  external_location = 's3://example-analytics/events-parquet/',
  partitioned_by = ARRAY['event_date']
)
AS
SELECT
  event_id,
  event_timestamp,
  customer_id,
  event_type,
  attributes,
  CAST(DATE(event_timestamp) AS VARCHAR) AS event_date
FROM raw.events_json
WHERE event_timestamp >= TIMESTAMP '2026-07-01 00:00:00'
  AND event_timestamp < TIMESTAMP '2026-07-08 00:00:00';

-- The partition predicate bounds the S3 prefixes Athena must consider.
SELECT
  event_type,
  COUNT(*) AS event_count
FROM analytics.events_parquet
WHERE event_date BETWEEN '2026-07-01' AND '2026-07-07'
GROUP BY event_type
ORDER BY event_count DESC;

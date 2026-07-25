CREATE TABLE analytics.events
(
    tenant_id LowCardinality(String),
    event_time DateTime64(3, 'UTC'),
    event_date Date MATERIALIZED toDate(event_time),
    event_type LowCardinality(String),
    user_id UUID,
    duration_ms UInt32,
    attributes Map(String, String)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, event_date, event_time)
TTL event_date + INTERVAL 90 DAY DELETE
SETTINGS index_granularity = 8192;

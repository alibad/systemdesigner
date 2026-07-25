-- Example analytical schema. Redirect services publish events to a stream;
-- batch or streaming consumers insert them here outside the request path.
CREATE TABLE redirect_events (
  event_time DateTime64(3),
  short_code String,
  region LowCardinality(String),
  referrer_domain LowCardinality(String),
  country_code FixedString(2),
  device_class LowCardinality(String),
  is_suspected_bot UInt8
)
ENGINE = MergeTree
PARTITION BY toDate(event_time)
ORDER BY (short_code, event_time)
TTL event_time + INTERVAL 90 DAY;

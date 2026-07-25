CREATE TABLE user_events (
  user_id text,
  event_time timestamp,
  event_type text,
  page_url text,
  product_id text,
  value decimal,
  device_type text,
  session_id text,
  PRIMARY KEY (user_id, event_time)
) WITH CLUSTERING ORDER BY (event_time DESC);
CREATE DATABASE IF NOT EXISTS learning;

CREATE TABLE IF NOT EXISTS learning.events (
  event_id STRING,
  user_id STRING,
  event_type STRING,
  payload STRING
)
PARTITIONED BY (event_date DATE)
STORED AS ORC
TBLPROPERTIES ('orc.compress' = 'ZLIB');

INSERT OVERWRITE TABLE learning.events
PARTITION (event_date = '2026-07-21')
SELECT
  event_id,
  user_id,
  event_type,
  payload
FROM learning.events_staging
WHERE event_date = '2026-07-21';

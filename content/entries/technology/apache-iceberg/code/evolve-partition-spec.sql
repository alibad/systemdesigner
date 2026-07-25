-- Spark SQL adapter example. Partition evolution is an Iceberg metadata
-- operation; the exact DDL surface depends on the compute engine.

CREATE TABLE prod.analytics.events (
  event_id BIGINT,
  event_time TIMESTAMP,
  region STRING,
  payload STRING
)
USING iceberg
PARTITIONED BY (day(event_time));

-- Future writers use both hour(event_time) and identity(region).
-- Existing data files remain described by the older day specification.
ALTER TABLE prod.analytics.events
ADD PARTITION FIELD hour(event_time);

ALTER TABLE prod.analytics.events
ADD PARTITION FIELD region;

-- Remove the day transform from the default spec only after checking overwrite
-- behavior and metadata consumers. Existing files are not rewritten.
ALTER TABLE prod.analytics.events
DROP PARTITION FIELD day(event_time);

-- Queries keep filtering source columns. Iceberg projects this predicate
-- through every partition spec represented by the selected snapshot.
SELECT event_id, event_time, region
FROM prod.analytics.events
WHERE event_time >= TIMESTAMP '2026-07-19 11:00:00'
  AND event_time < TIMESTAMP '2026-07-19 12:00:00'
  AND region = 'eu';

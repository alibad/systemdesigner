CREATE TABLE telemetry.events_by_device_day (
  tenant_id text,
  device_id text,
  event_day date,
  event_time timestamp,
  event_id timeuuid,
  reading_type text,
  reading_value double,
  PRIMARY KEY (
    (tenant_id, device_id, event_day),
    event_time,
    event_id
  )
) WITH CLUSTERING ORDER BY (event_time DESC, event_id DESC)
  AND default_time_to_live = 2592000
  AND compaction = {
    'class': 'TimeWindowCompactionStrategy',
    'compaction_window_unit': 'DAYS',
    'compaction_window_size': '1'
  };

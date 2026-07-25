-- Query: list one tenant's devices that emitted a given status on one day.
-- This is a separate projection with its own bounded partition.
CREATE TABLE telemetry.devices_by_tenant_status_day (
  tenant_id text,
  status text,
  event_day date,
  event_time timestamp,
  device_id text,
  PRIMARY KEY (
    (tenant_id, status, event_day),
    event_time,
    device_id
  )
) WITH CLUSTERING ORDER BY (event_time DESC, device_id ASC);

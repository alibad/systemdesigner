CREATE KEYSPACE telemetry
WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'us_east': 3,
  'eu_west': 3
}
AND durable_writes = true;

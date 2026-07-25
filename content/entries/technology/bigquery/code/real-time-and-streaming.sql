-- Create materialized view for real-time aggregations
CREATE MATERIALIZED VIEW `dataset.realtime_metrics`
PARTITION BY DATE(event_timestamp)
AS
SELECT
    DATE(event_timestamp) as event_date,
    DATETIME_TRUNC(event_timestamp, HOUR) as hour,
    device_type,
    COUNT(*) as event_count,
    AVG(temperature) as avg_temperature,
    MAX(temperature) as max_temperature
FROM `dataset.sensor_events`
WHERE event_timestamp >= DATETIME_SUB(CURRENT_DATETIME(), INTERVAL 30 DAY)
GROUP BY event_date, hour, device_type;

-- Query real-time data (automatically refreshed)
SELECT * FROM `dataset.realtime_metrics`
WHERE event_date = CURRENT_DATE()
ORDER BY hour DESC;
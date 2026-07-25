SELECT
  date_bin(INTERVAL '5 minutes', time) AS window_start,
  site,
  avg(temperature_c) AS avg_temperature_c
FROM environment_sensor
WHERE time >= now() - INTERVAL '1 hour'
GROUP BY 1, site
ORDER BY 1, site;

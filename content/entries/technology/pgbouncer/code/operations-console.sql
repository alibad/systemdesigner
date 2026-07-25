-- Run these against PgBouncer's virtual "pgbouncer" admin database.
SHOW POOLS;
SHOW STATS;
SHOW SERVERS;
SHOW DNS_HOSTS;

-- For a planned endpoint change:
PAUSE app;
-- Update pgbouncer.ini or the managed configuration source first.
RELOAD;
WAIT_CLOSE app;
RESUME app;

-- ACCOUNTADMIN creates resource monitors. Delegate ongoing monitoring separately.
USE ROLE ACCOUNTADMIN;

CREATE OR REPLACE RESOURCE MONITOR analytics_credit_guard
  WITH
    CREDIT_QUOTA = 600
    FREQUENCY = MONTHLY
    START_TIMESTAMP = IMMEDIATELY
    TRIGGERS
      ON 70 PERCENT DO NOTIFY
      ON 90 PERCENT DO SUSPEND
      ON 100 PERCENT DO SUSPEND_IMMEDIATE;

-- Multi-cluster warehouses require Enterprise Edition or higher.
-- MEDIUM is only a pilot starting point; benchmark the representative workload.
CREATE OR REPLACE WAREHOUSE analytics_wh
  WITH
    WAREHOUSE_TYPE = 'STANDARD'
    WAREHOUSE_SIZE = 'MEDIUM'
    MIN_CLUSTER_COUNT = 1
    MAX_CLUSTER_COUNT = 3
    SCALING_POLICY = 'STANDARD'
    AUTO_SUSPEND = 300
    AUTO_RESUME = TRUE
    INITIALLY_SUSPENDED = TRUE
    STATEMENT_QUEUED_TIMEOUT_IN_SECONDS = 120
    STATEMENT_TIMEOUT_IN_SECONDS = 900
    RESOURCE_MONITOR = analytics_credit_guard
    COMMENT = 'Isolated interactive analytics workload';

-- Inspect observed load before resizing or changing the cluster envelope.
SHOW WAREHOUSES LIKE 'ANALYTICS_WH';

-- These values are load ratios over five-minute intervals, not query counts.
SELECT
  warehouse_name,
  AVG(avg_running) AS avg_running_load,
  AVG(avg_queued_load) AS avg_queued_load,
  AVG(avg_queued_provisioning) AS avg_queued_provisioning_load
FROM snowflake.account_usage.warehouse_load_history
WHERE warehouse_name = 'ANALYTICS_WH'
  AND start_time >= DATEADD('day', -7, CURRENT_TIMESTAMP())
GROUP BY warehouse_name;

-- Resource monitors govern user-managed warehouses. Use budgets or other
-- service-specific controls for serverless features such as Automatic Clustering.

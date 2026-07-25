CREATE TABLE campaigns (
  id UUID PRIMARY KEY,
  advertiser_id UUID,
  name VARCHAR(255),
  status campaign_status,
  budget_total DECIMAL(12,2),
  budget_daily DECIMAL(12,2),
  target_cpa DECIMAL(8,2),
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  targeting_config JSONB,
  creative_ids UUID[]
);
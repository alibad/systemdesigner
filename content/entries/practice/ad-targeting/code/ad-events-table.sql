CREATE TABLE ad_events (
  timestamp DateTime,
  event_type Enum8('impression'=1,'click'=2,'conversion'=3),
  auction_id String,
  campaign_id String,
  user_id String,
  creative_id String,
  bid_price Float32,
  win_price Float32,
  revenue Float32
) ENGINE = MergeTree()
ORDER BY (timestamp, campaign_id, user_id);
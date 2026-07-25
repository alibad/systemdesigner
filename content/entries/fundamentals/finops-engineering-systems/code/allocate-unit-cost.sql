-- Attribute normalized billing charges to products, then divide by useful work.
-- The business-unit table must be produced from authoritative product telemetry.
WITH monthly_cost AS (
  SELECT
    ChargePeriodStart::date AS usage_day,
    COALESCE(
      Tags['product'],
      x_DerivedProduct,
      'unallocated'
    ) AS product_id,
    ServiceName,
    SUM(EffectiveCost) AS effective_cost
  FROM focus_cost_and_usage
  WHERE ChargePeriodStart >= :period_start
    AND ChargePeriodStart < :period_end
  GROUP BY 1, 2, 3
),
shared_cost AS (
  SELECT
    usage_day,
    SUM(effective_cost) AS shared_effective_cost
  FROM monthly_cost
  WHERE product_id = 'shared-platform'
  GROUP BY 1
),
product_demand AS (
  SELECT
    event_day AS usage_day,
    product_id,
    SUM(completed_orders) AS business_units
  FROM product_outcomes
  WHERE event_day >= :period_start
    AND event_day < :period_end
  GROUP BY 1, 2
),
direct_cost AS (
  SELECT
    usage_day,
    product_id,
    SUM(effective_cost) AS direct_effective_cost
  FROM monthly_cost
  WHERE product_id NOT IN ('shared-platform', 'unallocated')
  GROUP BY 1, 2
),
allocation_driver AS (
  SELECT
    usage_day,
    product_id,
    business_units,
    business_units
      / NULLIF(SUM(business_units) OVER (PARTITION BY usage_day), 0)
      AS shared_cost_fraction
  FROM product_demand
)
SELECT
  d.usage_day,
  d.product_id,
  d.business_units,
  COALESCE(c.direct_effective_cost, 0) AS direct_effective_cost,
  COALESCE(s.shared_effective_cost, 0) * d.shared_cost_fraction
    AS allocated_shared_cost,
  (
    COALESCE(c.direct_effective_cost, 0)
    + COALESCE(s.shared_effective_cost, 0) * d.shared_cost_fraction
  ) / NULLIF(d.business_units, 0) AS effective_cost_per_order
FROM allocation_driver d
LEFT JOIN direct_cost c USING (usage_day, product_id)
LEFT JOIN shared_cost s USING (usage_day);

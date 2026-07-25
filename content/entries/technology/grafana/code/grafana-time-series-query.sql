SELECT
  $__timeGroupAlias(created_at, '5m'),
  COUNT(*) AS orders_count
FROM orders
WHERE $__timeFilter(created_at)
  AND status <> 'test'
GROUP BY 1
ORDER BY 1;

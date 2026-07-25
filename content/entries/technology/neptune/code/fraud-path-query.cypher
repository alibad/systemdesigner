MATCH path =
  (source:Account {accountId: $accountId})
  -[:TRANSFERRED_TO|USES_DEVICE*1..3]->
  (related:Account)
WHERE all(
  relationship IN relationships(path)
  WHERE relationship.observedAt >= $windowStart
)
RETURN related.accountId, length(path) AS hops, path
ORDER BY hops
LIMIT 50;

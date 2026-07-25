import assert from 'node:assert/strict';

const CONSTRAINTS = String.raw`
CREATE CONSTRAINT customer_id IF NOT EXISTS
FOR (customer:Customer) REQUIRE customer.id IS UNIQUE;

CREATE CONSTRAINT product_sku IF NOT EXISTS
FOR (product:Product) REQUIRE product.sku IS UNIQUE;
`.trim();

const RECOMMENDATION_QUERY = String.raw`
MATCH (customer:Customer {id: $customerId})-[:PURCHASED]->(owned:Product)
MATCH (owned)-[:ALSO_BOUGHT]->(candidate:Product)
WHERE NOT (customer)-[:PURCHASED]->(candidate)
RETURN candidate.sku AS sku, count(*) AS evidence
ORDER BY evidence DESC, sku
LIMIT $limit
`.trim();

const purchases = [
  ['customer-7', 'book-a'],
  ['customer-7', 'book-b'],
];

const alsoBought = [
  ['book-a', 'book-c'],
  ['book-b', 'book-c'],
  ['book-b', 'book-d'],
];

function recommend(customerId, limit) {
  const owned = new Set(
    purchases.filter(([customer]) => customer === customerId).map(([, sku]) => sku),
  );
  const evidence = new Map();

  for (const [source, candidate] of alsoBought) {
    if (!owned.has(source) || owned.has(candidate)) continue;
    evidence.set(candidate, (evidence.get(candidate) ?? 0) + 1);
  }

  return [...evidence]
    .map(([sku, count]) => ({ sku, evidence: count }))
    .sort((left, right) => right.evidence - left.evidence || left.sku.localeCompare(right.sku))
    .slice(0, limit);
}

const recommendations = recommend('customer-7', 2);
assert.deepEqual(recommendations, [
  { sku: 'book-c', evidence: 2 },
  { sku: 'book-d', evidence: 1 },
]);

console.log(JSON.stringify({
  constraints: CONSTRAINTS,
  query: RECOMMENDATION_QUERY,
  parameters: { customerId: 'customer-7', limit: 2 },
  expectedRows: recommendations,
}, null, 2));

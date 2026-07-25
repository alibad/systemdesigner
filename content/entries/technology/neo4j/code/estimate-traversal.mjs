import assert from 'node:assert/strict';

export function estimateTraversal(anchorRows, averageDegree, maxHops, passRatePercent) {
  const passRate = passRatePercent / 100;
  let frontierPaths = anchorRows;
  let relationshipVisits = 0;

  for (let hop = 1; hop <= maxHops; hop += 1) {
    relationshipVisits += frontierPaths * averageDegree;
    frontierPaths *= averageDegree * passRate;
  }

  return {
    anchorRows,
    averageDegree,
    maxHops,
    passRatePercent,
    relationshipVisits: Math.round(relationshipVisits),
    finalFrontierPaths: Math.round(frontierPaths),
  };
}

assert.equal(estimateTraversal(1, 20, 3, 100).relationshipVisits, 8420);
assert.deepEqual(estimateTraversal(2, 4, 2, 50), {
  anchorRows: 2,
  averageDegree: 4,
  maxHops: 2,
  passRatePercent: 50,
  relationshipVisits: 24,
  finalFrontierPaths: 8,
});

const values = process.argv.slice(2).map(Number);
const [anchorRows = 1, averageDegree = 20, maxHops = 3, passRatePercent = 100] = values;

if (
  ![anchorRows, averageDegree, maxHops, passRatePercent].every(Number.isFinite)
  || anchorRows < 1
  || averageDegree < 0
  || !Number.isInteger(maxHops)
  || maxHops < 1
  || passRatePercent < 0
  || passRatePercent > 100
) {
  throw new Error('Usage: node estimate-traversal.mjs <anchorRows> <averageDegree> <maxHops> <passRatePercent>');
}

const estimate = estimateTraversal(anchorRows, averageDegree, maxHops, passRatePercent);
const verdict = estimate.relationshipVisits < 100_000
  ? 'bounded planning envelope'
  : estimate.relationshipVisits < 2_000_000
    ? 'profile against skewed production-like data'
    : 'reduce anchor rows, degree, depth, or pass rate';

console.log(JSON.stringify({ ...estimate, verdict }, null, 2));

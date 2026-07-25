import assert from 'node:assert/strict';

const policy = {
  maxCost: 220,
  maxPageSize: 50,
};

function estimateOperation({ fixedCost, pageSize, perItemCost }) {
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new TypeError('pageSize must be a positive integer');
  }

  return fixedCost + pageSize * perItemCost;
}

function admit(operation) {
  if (operation.pageSize > policy.maxPageSize) {
    return {
      admitted: false,
      reason: `pageSize exceeds ${policy.maxPageSize}`,
    };
  }

  const cost = estimateOperation(operation);
  return cost <= policy.maxCost
    ? { admitted: true, cost }
    : { admitted: false, cost, reason: `cost exceeds ${policy.maxCost}` };
}

const catalogPage = {
  name: 'CatalogPage',
  fixedCost: 12,
  pageSize: 20,
  perItemCost: 5,
};

const broadCatalogExport = {
  name: 'BroadCatalogExport',
  fixedCost: 12,
  pageSize: 80,
  perItemCost: 5,
};

const catalogDecision = admit(catalogPage);
const exportDecision = admit(broadCatalogExport);

assert.deepEqual(catalogDecision, { admitted: true, cost: 112 });
assert.equal(exportDecision.admitted, false);
assert.match(exportDecision.reason, /pageSize exceeds/);

console.log(JSON.stringify({ catalogDecision, exportDecision }, null, 2));

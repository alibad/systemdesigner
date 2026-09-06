let budgets = {};
let capacity = 0;
let used = {};
let inFlight = 0;
let rejected = { unknown: 0, capacity: 0, budget: 0 };

function configure(nextBudgets, nextCapacity) {
  budgets = { ...nextBudgets };
  capacity = nextCapacity;
  used = {};
  for (const tenant of Object.keys(budgets)) used[tenant] = 0;
  inFlight = 0;
  rejected = { unknown: 0, capacity: 0, budget: 0 };
  return report();
}

function admit(tenant, tokens) {
  if (!Object.hasOwn(budgets, tenant)) {
    rejected.unknown++;
    return { admitted: false, reason: "unknown" };
  }
  if (inFlight >= capacity) {
    rejected.capacity++;
    return { admitted: false, reason: "capacity" };
  }
  if (used[tenant] + tokens > budgets[tenant]) {
    rejected.budget++;
    return { admitted: false, reason: "budget" };
  }
  used[tenant] += tokens;
  inFlight++;
  return { admitted: true, reason: null };
}

function complete(tenant, tokens) {
  if (inFlight > 0) inFlight--;
  return used[tenant] || 0;
}

function report() {
  return { inFlight, used: { ...used }, rejected: { ...rejected } };
}

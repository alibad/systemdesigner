#!/usr/bin/env node

const selectedColumns = ['event_day', 'country', 'revenue'];
const eventDayFilter = [26, 30];

const rowGroups = [
  { id: 'RG1', eventDay: [1, 4], columnMiB: { event_day: 1, country: 2, revenue: 5 } },
  { id: 'RG2', eventDay: [5, 8], columnMiB: { event_day: 1, country: 2, revenue: 5 } },
  { id: 'RG3', eventDay: [9, 12], columnMiB: { event_day: 1, country: 2, revenue: 5 } },
  { id: 'RG4', eventDay: [13, 16], columnMiB: { event_day: 1, country: 2, revenue: 5 } },
  { id: 'RG5', eventDay: [17, 20], columnMiB: { event_day: 1, country: 2, revenue: 5 } },
  { id: 'RG6', eventDay: [21, 24], columnMiB: { event_day: 1, country: 2, revenue: 5 } },
  { id: 'RG7', eventDay: [25, 27], columnMiB: { event_day: 1, country: 2, revenue: 5 } },
  { id: 'RG8', eventDay: [28, 30], columnMiB: { event_day: 1, country: 2, revenue: 5 } },
];

function overlaps([minimum, maximum], [filterMinimum, filterMaximum]) {
  return maximum >= filterMinimum && minimum <= filterMaximum;
}

const plan = rowGroups.map((rowGroup) => {
  const read = overlaps(rowGroup.eventDay, eventDayFilter);
  const selectedMiB = read
    ? selectedColumns.reduce((sum, column) => sum + rowGroup.columnMiB[column], 0)
    : 0;
  return { rowGroup: rowGroup.id, eventDay: rowGroup.eventDay.join('-'), decision: read ? 'READ' : 'SKIP', selectedMiB };
});

console.table(plan);
console.log({
  rowGroupsRead: plan.filter((item) => item.decision === 'READ').length,
  modeledMiBRead: plan.reduce((sum, item) => sum + item.selectedMiB, 0),
});

if (plan.filter((item) => item.decision === 'READ').length !== 2) {
  throw new Error('The scan plan no longer matches the expected pruning result.');
}

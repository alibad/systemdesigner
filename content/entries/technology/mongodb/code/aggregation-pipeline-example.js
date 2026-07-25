export function buildTenantSalesPipeline({ tenantId, start, end, limit = 20 }) {
  if (!tenantId) throw new Error('tenantId is required');
  if (!(start instanceof Date) || !(end instanceof Date) || start >= end) {
    throw new Error('start and end must define an increasing time window');
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('limit must be an integer from 1 to 100');
  }

  return [
    {
      $match: {
        tenantId,
        status: 'captured',
        createdAt: { $gte: start, $lt: end },
      },
    },
    {
      $group: {
        _id: '$category',
        orderCount: { $sum: 1 },
        grossAmount: { $sum: '$amount' },
      },
    },
    { $sort: { grossAmount: -1, _id: 1 } },
    { $limit: limit },
    {
      $project: {
        _id: 0,
        category: '$_id',
        orderCount: 1,
        grossAmount: 1,
      },
    },
  ];
}

const example = buildTenantSalesPipeline({
  tenantId: 'tenant-42',
  start: new Date('2026-01-01T00:00:00Z'),
  end: new Date('2026-02-01T00:00:00Z'),
  limit: 10,
});

console.log(JSON.stringify(example, null, 2));

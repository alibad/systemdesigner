const baseUrl = process.env.COUCH_URL ?? 'http://127.0.0.1:5984';
const database = process.env.COUCH_DATABASE ?? 'work-items';
const partition = 'tenant-1842';

async function request(path, body) {
  const response = await fetch(
    `${baseUrl}/${encodeURIComponent(database)}${path}`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  }

  return response.json();
}

const selector = {
  status: 'open',
  updatedAt: { $gte: '2026-07-01T00:00:00Z' },
};

async function verifyQueryPlan() {
  await request('/_index', {
    index: {
      fields: ['status', 'updatedAt'],
    },
    ddoc: 'work-items-by-status-and-update',
    name: 'work-items-by-status-and-update',
    partitioned: true,
    type: 'json',
  });

  const partitionPath = `/_partition/${encodeURIComponent(partition)}`;
  const query = {
    selector,
    fields: ['_id', 'status', 'updatedAt', 'assigneeId'],
    limit: 50,
  };

  const plan = await request(`${partitionPath}/_explain`, query);
  const indexName = plan.index?.name;

  if (indexName !== 'work-items-by-status-and-update') {
    throw new Error(`Unexpected query plan: ${JSON.stringify(plan.index)}`);
  }

  const result = await request(`${partitionPath}/_find`, query);
  console.log({
    index: indexName,
    returned: result.docs.length,
    bookmark: result.bookmark,
  });
}

verifyQueryPlan().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

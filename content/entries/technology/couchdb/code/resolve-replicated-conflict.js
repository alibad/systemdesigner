const baseUrl = process.env.COUCH_URL ?? 'http://127.0.0.1:5984';
const database = process.env.COUCH_DATABASE ?? 'customers';
const documentId = 'customer:1842';

async function couch(path, options = {}) {
  const response = await fetch(
    `${baseUrl}/${encodeURIComponent(database)}${path}`,
    {
      ...options,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...options.headers,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  }

  return response.json();
}

function mergeCustomer(leaves) {
  const newest = (field) =>
    leaves
      .filter((leaf) => leaf[field] !== undefined)
      .sort((left, right) =>
        String(right.updatedAt).localeCompare(String(left.updatedAt)),
      )[0]?.[field];

  return {
    type: 'customer',
    schemaVersion: Math.max(...leaves.map((leaf) => leaf.schemaVersion ?? 1)),
    email: newest('email'),
    phone: newest('phone'),
    marketingConsent: newest('marketingConsent'),
    updatedAt: new Date().toISOString(),
    resolvedFrom: leaves.map((leaf) => leaf._rev),
  };
}

async function resolveConflict() {
  const openLeaves = await couch(
    `/${encodeURIComponent(documentId)}?open_revs=all`,
  );
  const leaves = openLeaves.flatMap((entry) => (entry.ok ? [entry.ok] : []));

  if (leaves.length < 2) {
    console.log('No replicated conflict is open.');
    return;
  }

  const winner = await couch(
    `/${encodeURIComponent(documentId)}?conflicts=true`,
  );
  const merged = mergeCustomer(leaves);

  const committed = await couch(`/${encodeURIComponent(documentId)}`, {
    method: 'PUT',
    body: JSON.stringify({
      ...merged,
      _id: documentId,
      _rev: winner._rev,
    }),
  });

  const losingRevisions = leaves
    .map((leaf) => leaf._rev)
    .filter((revision) => revision !== winner._rev);

  await Promise.all(
    losingRevisions.map((revision) =>
      couch(
        `/${encodeURIComponent(documentId)}?rev=${encodeURIComponent(revision)}`,
        { method: 'DELETE' },
      ),
    ),
  );

  console.log({
    documentId,
    mergedRevision: committed.rev,
    removedConflictLeaves: losingRevisions,
  });
}

resolveConflict().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

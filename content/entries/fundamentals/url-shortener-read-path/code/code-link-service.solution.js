function handleRequests(initial, requests) {
  const records = new Map(Object.entries(initial));
  const cache = new Map();
  const responses = [];
  let databaseReads = 0;
  for (const { method, key, value } of requests) {
    if (method === 'PUT') {
      records.set(key, value);
      cache.delete(key);
      responses.push({ status: 204 });
    } else if (method === 'GET') {
      if (cache.has(key)) responses.push({ status: 302, location: cache.get(key) });
      else {
        databaseReads++;
        if (records.has(key)) {
          cache.set(key, records.get(key));
          responses.push({ status: 302, location: records.get(key) });
        } else responses.push({ status: 404 });
      }
    } else responses.push({ status: 405 });
  }
  return { records: Object.fromEntries(records), responses, databaseReads };
}

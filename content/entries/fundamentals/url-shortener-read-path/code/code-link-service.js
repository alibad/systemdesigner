// Build a small, in-memory model of a link service.
// initial: object mapping short keys to destination strings.
// requests: ordered GET, PUT, or unsupported method objects.
// Return { records, responses, databaseReads } without changing inputs.
function handleRequests(initial, requests) {
  // Maps support string keys, including names such as "__proto__".
  const records = new Map(Object.entries(initial));
  const cache = new Map();
  const responses = [];
  let databaseReads = 0;

  // Process each request in order. PUT must invalidate stale cached values.

  return { records: Object.fromEntries(records), responses, databaseReads };
}

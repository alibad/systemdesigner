function checkIdempotency(records, key) {
  return Object.hasOwn(records, key) ? { execute: false, result: records[key] } : { execute: true, result: null };
}

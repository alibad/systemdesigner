function writeVersion(record, expectedVersion, value) {
  return record.version === expectedVersion ? { updated: true, record: { version: record.version + 1, value } } : { updated: false, record: { ...record } };
}

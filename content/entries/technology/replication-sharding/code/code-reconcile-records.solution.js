function reconcileRecords(local, remote) {
  const records = new Map(); for (const item of [...local, ...remote]) { if (!records.has(item.id) || item.version > records.get(item.id).version) records.set(item.id, item); } return [...records.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

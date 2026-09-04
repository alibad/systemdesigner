function pageResults(items, offset, limit) {
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit <= 0) return []; return items.slice(offset, offset + limit);
}

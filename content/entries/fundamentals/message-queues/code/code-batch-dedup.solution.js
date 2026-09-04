function batchUnique(ids, size) {
  if (!Number.isInteger(size) || size <= 0) return []; const unique = [...new Set(ids)]; const result = []; for (let i = 0; i < unique.length; i += size) result.push(unique.slice(i, i + size)); return result;
}

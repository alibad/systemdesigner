function countEvents(types) {
  const counts = new Map(); for (const type of types) counts.set(type, (counts.get(type) || 0) + 1); return Object.fromEntries(counts);
}

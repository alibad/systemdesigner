function admitBatch(requests, counts, limit) {
  const next = new Map(Object.entries(counts)); const accepted = [], rejected = []; for (const request of requests) { const count = next.get(request.tenant) || 0; if (count < limit) { accepted.push(request.id); next.set(request.tenant, count + 1); } else rejected.push(request.id); } return { accepted, rejected, counts: Object.fromEntries(next) };
}

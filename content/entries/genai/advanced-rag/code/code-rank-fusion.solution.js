function fuseRankings(lists, k) {
  const scores = new Map();
  const firstSeen = new Map();
  let order = 0;
  for (const list of lists) {
    for (let rank = 0; rank < list.length; rank++) {
      const id = list[rank];
      scores.set(id, (scores.get(id) || 0) + 1 / (k + rank));
      if (!firstSeen.has(id)) firstSeen.set(id, order++);
    }
  }
  return [...scores.keys()].sort((a, b) => {
    const gap = scores.get(b) - scores.get(a);
    return gap !== 0 ? gap : firstSeen.get(a) - firstSeen.get(b);
  });
}

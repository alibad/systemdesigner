function decideRelease(candidate, floors, rollbackDrop, exposure) {
  const names = Object.keys(candidate.slices).sort();
  const failing = names.filter((name) => candidate.slices[name] < floors.slice);
  const aggregateCollapsed =
    candidate.aggregate < floors.aggregate - rollbackDrop;
  const sliceCollapsed = failing.some(
    (name) => candidate.slices[name] < floors.slice - rollbackDrop,
  );
  if (aggregateCollapsed || sliceCollapsed)
    return { decision: "rollback", exposure: 0, failing };
  if (candidate.aggregate < floors.aggregate || failing.length)
    return { decision: "hold", exposure, failing };
  return { decision: "promote", exposure: Math.min(100, exposure * 2), failing };
}

function largestShift(baseline, live) {
  const total = (counts) =>
    Object.values(counts).reduce((sum, value) => sum + value, 0);
  const baselineTotal = total(baseline);
  const liveTotal = total(live);
  if (baselineTotal === 0 || liveTotal === 0)
    return { bucket: null, gap: 0, drifted: false };
  const names = [...new Set([...Object.keys(baseline), ...Object.keys(live)])].sort();
  let bucket = null;
  let gap = 0;
  for (const name of names) {
    const difference =
      Math.abs(
        (baseline[name] || 0) / baselineTotal - (live[name] || 0) / liveTotal,
      ) * 100;
    const rounded = Math.round(difference * 100) / 100;
    if (bucket === null || rounded > gap) {
      bucket = name;
      gap = rounded;
    }
  }
  return { bucket, gap, drifted: gap >= 10 };
}

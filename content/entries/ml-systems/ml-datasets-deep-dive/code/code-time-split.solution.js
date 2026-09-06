function splitByTime(records, cutoff, embargo) {
  const train = [];
  const holdout = [];
  const embargoed = [];
  for (const record of records) {
    if (record.at < cutoff) train.push(record.id);
    else if (record.at < cutoff + embargo) embargoed.push(record.id);
    else holdout.push(record.id);
  }
  return { train, holdout, embargoed };
}

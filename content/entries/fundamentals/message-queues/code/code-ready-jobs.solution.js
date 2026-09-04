function readyJobs(jobs, now, limit) {
  return jobs.filter(j => j.readyAt <= now).sort((a, b) => a.readyAt - b.readyAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, limit).map(j => j.id);
}

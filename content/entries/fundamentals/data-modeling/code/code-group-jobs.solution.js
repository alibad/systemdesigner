function groupJobs(jobs) {
  const groups = new Map(); for (const job of jobs) { if (!groups.has(job.tenant)) groups.set(job.tenant, []); groups.get(job.tenant).push(job.id); } return Object.fromEntries(groups);
}

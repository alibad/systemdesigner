function partitionFailures(jobs, maxAttempts) {
  const retry = [], deadLetter = []; for (const job of jobs) (job.attempts >= maxAttempts ? deadLetter : retry).push(job.id); return { retry, deadLetter };
}

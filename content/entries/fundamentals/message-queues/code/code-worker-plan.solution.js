function planWorker(jobs, now, capacity, maxAttempts) {
  const eligible = jobs.filter(j => j.attempts < maxAttempts && j.readyAt <= now).sort((a, b) => a.readyAt - b.readyAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)); const run = eligible.slice(0, capacity).map(j => j.id); const selected = new Set(run); return { run, waiting: jobs.filter(j => j.attempts < maxAttempts && !selected.has(j.id)).map(j => j.id), deadLetter: jobs.filter(j => j.attempts >= maxAttempts).map(j => j.id) };
}

type RemainingBudget = {
  deadlineMs: number;
  reserveMs: number;
};

export async function fetchProduct(
  url: string,
  budget: RemainingBudget,
): Promise<Response> {
  const now = performance.now();
  const remainingMs = budget.deadlineMs - now - budget.reserveMs;

  if (remainingMs <= 0) {
    throw new Error('No useful time remains for the dependency call.');
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), remainingMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        // Propagate the original deadline so the dependency can stop its own work too.
        'x-request-deadline-ms': String(budget.deadlineMs),
      },
    });
  } finally {
    window.clearTimeout(timer);
  }
}

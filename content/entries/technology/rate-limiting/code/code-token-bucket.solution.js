function tokenBucket(tokens, elapsedSeconds, refillPerSecond, capacity, cost) {
  const available = Math.min(capacity, tokens + elapsedSeconds * refillPerSecond); const allowed = available >= cost; return { allowed, tokens: available - (allowed ? cost : 0) };
}

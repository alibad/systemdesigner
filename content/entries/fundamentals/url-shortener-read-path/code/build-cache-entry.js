export function buildCacheEntry(mapping, now = Date.now()) {
  if (!mapping) {
    return {
      value: { state: 'missing' },
      ttlSeconds: 15,
      reason: 'Short negative caching protects storage from repeated unknown codes.',
    };
  }

  if (mapping.disabledAt || mapping.expiresAt <= now) {
    return {
      value: {
        state: mapping.disabledAt ? 'disabled' : 'expired',
        version: mapping.version,
      },
      ttlSeconds: 10,
      reason: 'A short terminal-state TTL limits stale reactivation behavior.',
    };
  }

  const baseTtlSeconds = Math.min(mapping.maxCacheAgeSeconds, 300);
  const jitterSeconds = Math.round(baseTtlSeconds * 0.15);

  return {
    value: {
      state: 'active',
      destination: mapping.destination,
      redirectStatus: mapping.redirectStatus,
      version: mapping.version,
    },
    ttlSeconds:
      baseTtlSeconds - jitterSeconds + Math.floor(Math.random() * (jitterSeconds * 2 + 1)),
    reason: 'TTL jitter spreads refills while the version supports explicit invalidation.',
  };
}

function readCache(cache, key, now) {
  return Object.hasOwn(cache, key) && cache[key].expiresAt > now ? { hit: true, value: cache[key].value } : { hit: false, value: null };
}

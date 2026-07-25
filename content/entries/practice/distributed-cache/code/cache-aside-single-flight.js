import assert from 'node:assert/strict';

class CacheAside {
  constructor({ maxOriginLoads = 4 } = {}) {
    this.entries = new Map();
    this.inFlight = new Map();
    this.maxOriginLoads = maxOriginLoads;
  }

  async get(key, nowMs, loadFromOrigin, ttlMs) {
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > nowMs) {
      return { value: cached.value, source: 'cache' };
    }

    const existingLoad = this.inFlight.get(key);
    if (existingLoad) {
      const value = await existingLoad;
      return { value, source: 'coalesced' };
    }

    if (this.inFlight.size >= this.maxOriginLoads) {
      throw new Error('origin fallback budget exhausted');
    }

    const pending = Promise.resolve()
      .then(loadFromOrigin)
      .then((value) => {
        this.entries.set(key, { value, expiresAt: nowMs + ttlMs });
        return value;
      })
      .finally(() => this.inFlight.delete(key));

    this.inFlight.set(key, pending);
    const value = await pending;
    return { value, source: 'origin' };
  }
}

const cache = new CacheAside({ maxOriginLoads: 4 });
let originReads = 0;
const loadCart = async () => {
  originReads += 1;
  await Promise.resolve();
  return { itemCount: 3, version: 17 };
};

const firstWave = await Promise.all(
  Array.from({ length: 100 }, () =>
    cache.get('cart:42', 1_000, loadCart, 30_000),
  ),
);

assert.equal(originReads, 1);
assert.equal(firstWave.filter((result) => result.source === 'origin').length, 1);
assert.equal(firstWave.filter((result) => result.source === 'coalesced').length, 99);

const warmRead = await cache.get('cart:42', 2_000, loadCart, 30_000);
assert.equal(warmRead.source, 'cache');
assert.equal(originReads, 1);

const readAfterExpiry = await cache.get('cart:42', 32_000, loadCart, 30_000);
assert.equal(readAfterExpiry.source, 'origin');
assert.equal(originReads, 2);

console.log({
  concurrentMisses: firstWave.length,
  firstWaveOriginReads: 1,
  coalescedWaiters: 99,
  totalOriginReads: originReads,
  finalValue: readAfterExpiry.value,
});

import assert from 'node:assert/strict';

class RequestLoader {
  constructor(batchLoad) {
    this.batchLoad = batchLoad;
    this.cache = new Map();
    this.pending = new Map();
    this.scheduled = false;
  }

  load(key) {
    if (this.cache.has(key)) return this.cache.get(key);

    const promise = new Promise((resolve, reject) => {
      this.pending.set(key, { resolve, reject });
    });
    this.cache.set(key, promise);

    if (!this.scheduled) {
      this.scheduled = true;
      queueMicrotask(() => this.flush());
    }

    return promise;
  }

  async flush() {
    this.scheduled = false;
    const entries = [...this.pending.entries()];
    this.pending.clear();
    const keys = entries.map(([key]) => key);

    try {
      const values = await this.batchLoad(keys);
      assert.equal(values.length, keys.length, 'one result is required per key');
      entries.forEach(([, deferred], index) => deferred.resolve(values[index]));
    } catch (error) {
      entries.forEach(([, deferred]) => deferred.reject(error));
    }
  }
}

const products = new Map([
  ['p-1', { id: 'p-1', name: 'Keyboard' }],
  ['p-2', { id: 'p-2', name: 'Display' }],
]);
let backendCalls = 0;

function createRequestContext() {
  return {
    productLoader: new RequestLoader(async (ids) => {
      backendCalls += 1;
      return ids.map((id) => products.get(id) ?? null);
    }),
  };
}

const request = createRequestContext();
const [first, second, duplicate] = await Promise.all([
  request.productLoader.load('p-1'),
  request.productLoader.load('p-2'),
  request.productLoader.load('p-1'),
]);

assert.equal(backendCalls, 1);
assert.equal(first.name, 'Keyboard');
assert.equal(second.name, 'Display');
assert.strictEqual(duplicate, first);

const nextRequest = createRequestContext();
await nextRequest.productLoader.load('p-1');
assert.equal(backendCalls, 2, 'a new request gets a new loader cache');

console.log({ backendCalls, first, second });

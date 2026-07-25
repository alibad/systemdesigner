import assert from 'node:assert/strict';

function hash32(value) {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

class ConsistentHashRing {
  constructor(virtualNodesPerServer = 128) {
    this.virtualNodesPerServer = virtualNodesPerServer;
    this.tokens = [];
  }

  add(serverId) {
    for (let index = 0; index < this.virtualNodesPerServer; index += 1) {
      this.tokens.push({
        position: hash32(`${serverId}#${index}`),
        serverId,
      });
    }
    this.tokens.sort((left, right) => left.position - right.position);
  }

  remove(serverId) {
    this.tokens = this.tokens.filter((token) => token.serverId !== serverId);
  }

  owner(key) {
    if (this.tokens.length === 0) throw new Error('ring has no servers');

    const position = hash32(key);
    let low = 0;
    let high = this.tokens.length;

    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (this.tokens[middle].position < position) low = middle + 1;
      else high = middle;
    }

    return this.tokens[low % this.tokens.length].serverId;
  }
}

function assignments(ring, keys) {
  return new Map(keys.map((key) => [key, ring.owner(key)]));
}

const keys = Array.from({ length: 20_000 }, (_, index) => `key:${index}`);
const ring = new ConsistentHashRing();
for (const serverId of ['cache-a', 'cache-b', 'cache-c', 'cache-d']) ring.add(serverId);

const beforeScaleOut = assignments(ring, keys);
ring.add('cache-e');
const afterScaleOut = assignments(ring, keys);
const movedOnAdd = keys.filter(
  (key) => beforeScaleOut.get(key) !== afterScaleOut.get(key),
);

assert(movedOnAdd.length > keys.length * 0.12);
assert(movedOnAdd.length < keys.length * 0.30);
assert(movedOnAdd.every((key) => afterScaleOut.get(key) === 'cache-e'));

const beforeFailure = assignments(ring, keys);
ring.remove('cache-b');
const afterFailure = assignments(ring, keys);
const movedOnFailure = keys.filter(
  (key) => beforeFailure.get(key) !== afterFailure.get(key),
);

assert(movedOnFailure.every((key) => beforeFailure.get(key) === 'cache-b'));
assert(keys.every((key) => afterFailure.get(key) !== 'cache-b'));

console.log({
  keys: keys.length,
  movedWhenAddingNode: movedOnAdd.length,
  movedPercent: Number(((movedOnAdd.length / keys.length) * 100).toFixed(1)),
  movedAfterNodeFailure: movedOnFailure.length,
});

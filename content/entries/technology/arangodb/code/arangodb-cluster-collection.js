// Run from arangosh against a Coordinator after replacing the example values.
const collection = db._create('orders', {
  numberOfShards: 6,
  shardKeys: ['tenantId'],
  replicationFactor: 3,
  writeConcern: 2,
});

print(JSON.stringify({
  name: collection.name(),
  numberOfShards: collection.properties().numberOfShards,
  shardKeys: collection.properties().shardKeys,
  replicationFactor: collection.properties().replicationFactor,
  writeConcern: collection.properties().writeConcern,
}, null, 2));

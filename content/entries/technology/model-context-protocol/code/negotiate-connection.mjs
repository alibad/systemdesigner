import assert from 'node:assert/strict';

const client = {
  supportedVersions: ['2025-11-25', '2025-06-18'],
  requiredServerCapabilities: ['resources', 'tools'],
};

function negotiate(initializeResult) {
  assert.equal(typeof initializeResult.protocolVersion, 'string');
  assert.equal(typeof initializeResult.capabilities, 'object');

  if (!client.supportedVersions.includes(initializeResult.protocolVersion)) {
    return {
      ready: false,
      reason: `Unsupported protocol revision: ${initializeResult.protocolVersion}`,
    };
  }

  const missing = client.requiredServerCapabilities.filter(
    (name) => !(name in initializeResult.capabilities),
  );

  if (missing.length > 0) {
    return {
      ready: false,
      reason: `Missing required capabilities: ${missing.join(', ')}`,
    };
  }

  return {
    ready: true,
    protocolVersion: initializeResult.protocolVersion,
    operations: ['resources/list', 'resources/read', 'tools/list', 'tools/call'],
  };
}

const accepted = negotiate({
  protocolVersion: '2025-11-25',
  capabilities: {
    resources: { subscribe: true },
    tools: { listChanged: true },
  },
});

const rejected = negotiate({
  protocolVersion: '2025-11-25',
  capabilities: { resources: {} },
});

assert.equal(accepted.ready, true);
assert.deepEqual(accepted.operations, [
  'resources/list',
  'resources/read',
  'tools/list',
  'tools/call',
]);
assert.equal(rejected.ready, false);
assert.match(rejected.reason, /tools/);

console.log(JSON.stringify({ accepted, rejected }, null, 2));

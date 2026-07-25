import assert from 'node:assert/strict';

const host = {
  supportedVersions: ['2025-11-25', '2025-06-18'],
  supportedServerCapabilities: new Set(['resources', 'prompts', 'tools']),
  policy: {
    exposedCapabilities: new Set(['resources', 'tools']),
    allowToolExecution: false,
  },
};

function negotiateSession(serverResponse) {
  if (!host.supportedVersions.includes(serverResponse.protocolVersion)) {
    throw new Error(`Unsupported MCP protocol version: ${serverResponse.protocolVersion}`);
  }

  const advertised = Object.keys(serverResponse.capabilities);
  const understood = advertised.filter((capability) => (
    host.supportedServerCapabilities.has(capability)
  ));
  const exposed = understood.filter((capability) => (
    host.policy.exposedCapabilities.has(capability)
  ));

  return {
    negotiatedVersion: serverResponse.protocolVersion,
    understood,
    exposed,
    toolExecution: exposed.includes('tools') && host.policy.allowToolExecution
      ? 'allowed'
      : 'approval-gated',
    nextMessage: 'notifications/initialized',
  };
}

const session = negotiateSession({
  protocolVersion: '2025-11-25',
  capabilities: {
    resources: { subscribe: true },
    prompts: { listChanged: true },
    tools: { listChanged: true },
  },
});

assert.deepEqual(session.exposed, ['resources', 'tools']);
assert.equal(session.toolExecution, 'approval-gated');
assert.equal(session.nextMessage, 'notifications/initialized');

assert.throws(
  () => negotiateSession({ protocolVersion: '2099-01-01', capabilities: {} }),
  /Unsupported MCP protocol version/,
);

console.log(JSON.stringify(session, null, 2));

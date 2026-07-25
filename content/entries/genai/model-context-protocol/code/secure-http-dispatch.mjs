import assert from 'node:assert/strict';

const MCP_RESOURCE = 'https://mcp.example.com/mcp';
const allowedOrigins = new Set(['https://assistant.example.com']);
const sessions = new Map([
  ['session-a7f3', { subject: 'user-42', active: true }],
]);

function authorizeRequest(request) {
  if (!allowedOrigins.has(request.origin)) {
    return { status: 403, decision: 'reject-origin' };
  }
  if (request.token.audience !== MCP_RESOURCE) {
    return { status: 401, decision: 'reject-token-audience' };
  }

  const session = sessions.get(request.sessionId);
  if (!session?.active) {
    return { status: 404, decision: 'start-new-initialize' };
  }
  if (session.subject !== request.token.subject) {
    return { status: 403, decision: 'reject-session-subject-mismatch' };
  }

  return { status: 202, decision: 'dispatch' };
}

function recoverToolCall({ connectionLost, completionKnown, operationId }) {
  if (!connectionLost) return 'consume-response';
  if (completionKnown === false && operationId) return 'reconcile-before-retry';
  return 'do-not-blindly-retry';
}

const accepted = authorizeRequest({
  origin: 'https://assistant.example.com',
  sessionId: 'session-a7f3',
  token: { subject: 'user-42', audience: MCP_RESOURCE },
});

const hijackAttempt = authorizeRequest({
  origin: 'https://assistant.example.com',
  sessionId: 'session-a7f3',
  token: { subject: 'attacker', audience: MCP_RESOURCE },
});

assert.deepEqual(accepted, { status: 202, decision: 'dispatch' });
assert.deepEqual(hijackAttempt, {
  status: 403,
  decision: 'reject-session-subject-mismatch',
});
assert.equal(
  recoverToolCall({ connectionLost: true, completionKnown: false, operationId: 'op-91' }),
  'reconcile-before-retry',
);

console.log(JSON.stringify({ accepted, hijackAttempt }, null, 2));

import assert from 'node:assert/strict';

function chooseRecovery(event) {
  if (event.httpStatus === 404 && event.hadSessionId) {
    return {
      action: 'discard-session-and-initialize',
      retryToolCall: false,
    };
  }

  if (event.oauthError === 'insufficient_scope') {
    return {
      action: 'request-step-up-authorization',
      retryToolCall: false,
    };
  }

  if (event.tokenAudienceValid === false) {
    return {
      action: 'reject-token-and-reauthorize-for-server',
      retryToolCall: false,
    };
  }

  if (event.writeMayHaveCompleted) {
    return {
      action: 'reconcile-by-operation-id',
      retryToolCall: false,
    };
  }

  return {
    action: 'bounded-retry',
    retryToolCall: true,
  };
}

const expiredSession = chooseRecovery({
  httpStatus: 404,
  hadSessionId: true,
});

const ambiguousWrite = chooseRecovery({
  writeMayHaveCompleted: true,
  operationId: 'calendar-event-0182',
});

assert.deepEqual(expiredSession, {
  action: 'discard-session-and-initialize',
  retryToolCall: false,
});
assert.equal(ambiguousWrite.action, 'reconcile-by-operation-id');
assert.equal(ambiguousWrite.retryToolCall, false);

console.log(JSON.stringify({ expiredSession, ambiguousWrite }, null, 2));

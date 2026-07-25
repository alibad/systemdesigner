import assert from 'node:assert/strict';

const committedOperations = new Map();
let deliveredMessages = 0;

function sendInvoice(operationId, invoiceId) {
  const existing = committedOperations.get(operationId);
  if (existing) return existing;

  const result = {
    operationId,
    invoiceId,
    messageId: `msg-${invoiceId}`,
    status: 'sent',
  };
  deliveredMessages += 1;
  committedOperations.set(operationId, result);

  throw new Error('response_lost_after_commit');
}

function reconcile(operationId) {
  return committedOperations.get(operationId) ?? null;
}

const operationId = 'send-invoice-1842-v1';

try {
  sendInvoice(operationId, '1842');
} catch (error) {
  assert.equal(error.message, 'response_lost_after_commit');
}

const observed = reconcile(operationId);
assert.deepEqual(observed, {
  operationId,
  invoiceId: '1842',
  messageId: 'msg-1842',
  status: 'sent',
});
assert.equal(deliveredMessages, 1);

console.log({ decision: 'do_not_retry', observed, deliveredMessages });

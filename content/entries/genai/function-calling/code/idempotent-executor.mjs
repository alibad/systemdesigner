class IdempotencyStore {
  #outcomes = new Map();

  runOnce(key, operation) {
    if (this.#outcomes.has(key)) return { replayed: true, ...this.#outcomes.get(key) };
    const outcome = operation();
    this.#outcomes.set(key, outcome);
    return { replayed: false, ...outcome };
  }
}

const idempotency = new IdempotencyStore();
const sentMessages = [];

function sendShippingUpdate({ orderId, recipient }) {
  const messageId = `msg_${sentMessages.length + 1}`;
  sentMessages.push({ messageId, orderId, recipient });
  return { status: 'sent', sideEffectId: messageId };
}

function executeAttempt(call) {
  return idempotency.runOnce(call.idempotencyKey, () => sendShippingUpdate(call.arguments));
}

const call = {
  idempotencyKey: 'task_91:send_shipping_update:ord_1842',
  arguments: { orderId: 'ord_1842', recipient: 'customer@example.com' },
};

const first = executeAttempt(call);
console.log('Attempt 1 committed, but its response was lost:', first);

const retry = executeAttempt(call);
console.log('Attempt 2 recovered the stored outcome:', retry);
console.log('External side effects:', sentMessages.length);

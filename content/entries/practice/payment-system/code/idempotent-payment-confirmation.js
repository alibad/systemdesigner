import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const idempotencyStore = new Map();
let providerCalls = 0;

function fingerprint(command) {
  const stableFields = {
    amountMinor: command.amountMinor,
    currency: command.currency,
    paymentIntentId: command.paymentIntentId,
    paymentToken: command.paymentToken,
  };

  return createHash('sha256').update(JSON.stringify(stableFields)).digest('hex');
}

function confirmPayment(command) {
  const scope = `${command.merchantId}:confirm:${command.idempotencyKey}`;
  const requestHash = fingerprint(command);
  const previous = idempotencyStore.get(scope);

  if (previous) {
    if (previous.requestHash !== requestHash) {
      const error = new Error('Idempotency key was reused with a different request');
      error.statusCode = 409;
      throw error;
    }
    return previous.response;
  }

  providerCalls += 1;
  const response = Object.freeze({
    paymentIntentId: command.paymentIntentId,
    providerRequestRef: `confirm:${command.paymentIntentId}`,
    status: 'authorized',
  });

  // A production implementation reserves the key and commits this response in the
  // same transactional workflow that owns the payment-intent transition.
  idempotencyStore.set(scope, { requestHash, response });
  return response;
}

const firstCommand = {
  merchantId: 'merchant-42',
  paymentIntentId: 'pi-1001',
  amountMinor: 12_500,
  currency: 'USD',
  paymentToken: 'tok-network-7',
  idempotencyKey: 'checkout-attempt-900',
};

const first = confirmPayment(firstCommand);
const retry = confirmPayment({ ...firstCommand });

assert.strictEqual(retry, first);
assert.equal(providerCalls, 1);
assert.throws(
  () => confirmPayment({ ...firstCommand, amountMinor: 15_000 }),
  (error) => error.statusCode === 409,
);

console.log({ providerCalls, retryStatus: retry.status, conflictingRetry: 'rejected' });

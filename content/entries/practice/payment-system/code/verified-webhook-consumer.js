import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';

const secret = 'development-webhook-secret';
const inbox = new Set();
const paymentIntents = new Map([
  ['pi-1001', { status: 'processing', version: 3 }],
]);

const stateRank = {
  processing: 1,
  authorized: 2,
  succeeded: 3,
  failed: 3,
};

function signatureFor(rawBody, timestamp) {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
}

function verifySignature(rawBody, header, nowSeconds) {
  const fields = Object.fromEntries(header.split(',').map((part) => part.split('=')));
  const timestamp = Number(fields.t);
  if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > 300) return false;

  const expected = Buffer.from(signatureFor(rawBody, timestamp), 'hex');
  const received = Buffer.from(fields.v1 || '', 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function consumeWebhook(rawBody, signatureHeader, nowSeconds) {
  if (!verifySignature(rawBody, signatureHeader, nowSeconds)) {
    return { accepted: false, reason: 'invalid_signature' };
  }

  const event = JSON.parse(rawBody);
  if (inbox.has(event.id)) return { accepted: true, effect: 'duplicate_ignored' };
  inbox.add(event.id);

  const current = paymentIntents.get(event.paymentIntentId);
  if (!current) return { accepted: true, effect: 'queued_for_reconciliation' };
  if (stateRank[event.status] < stateRank[current.status]) {
    return { accepted: true, effect: 'stale_transition_ignored' };
  }

  paymentIntents.set(event.paymentIntentId, {
    status: event.status,
    version: current.version + 1,
  });
  return { accepted: true, effect: 'state_advanced' };
}

const now = 1_700_000_000;
const captured = JSON.stringify({
  id: 'evt-700',
  paymentIntentId: 'pi-1001',
  status: 'succeeded',
});
const capturedHeader = `t=${now},v1=${signatureFor(captured, now)}`;

assert.equal(consumeWebhook(captured, capturedHeader, now).effect, 'state_advanced');
assert.equal(consumeWebhook(captured, capturedHeader, now).effect, 'duplicate_ignored');

const lateAuthorization = JSON.stringify({
  id: 'evt-699',
  paymentIntentId: 'pi-1001',
  status: 'authorized',
});
const lateHeader = `t=${now},v1=${signatureFor(lateAuthorization, now)}`;
assert.equal(consumeWebhook(lateAuthorization, lateHeader, now).effect, 'stale_transition_ignored');
assert.equal(paymentIntents.get('pi-1001').status, 'succeeded');

console.log({
  finalState: paymentIntents.get('pi-1001'),
  acceptedEventCount: inbox.size,
});

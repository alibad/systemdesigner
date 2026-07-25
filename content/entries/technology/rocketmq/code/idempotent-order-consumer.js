import assert from 'node:assert/strict';

const processedEvents = new Map();
const orderTotals = new Map();

function applyOrderCharge(event) {
  const previousResult = processedEvents.get(event.eventId);
  if (previousResult) return { ...previousResult, replay: true };

  const nextTotal = (orderTotals.get(event.orderId) ?? 0) + event.amountCents;
  const result = { orderId: event.orderId, chargedCents: nextTotal, replay: false };

  // In production, commit this receipt and the business mutation atomically.
  orderTotals.set(event.orderId, nextTotal);
  processedEvents.set(event.eventId, result);
  return result;
}

const delivery = { eventId: 'evt-order-104-paid', orderId: 'order-104', amountCents: 2599 };
const firstAttempt = applyOrderCharge(delivery);
const retryAfterLostAcknowledgement = applyOrderCharge(delivery);

assert.equal(firstAttempt.chargedCents, 2599);
assert.equal(retryAfterLostAcknowledgement.replay, true);
assert.equal(orderTotals.get('order-104'), 2599);

console.log({ firstAttempt, retryAfterLostAcknowledgement });

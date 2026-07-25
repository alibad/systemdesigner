import assert from 'node:assert/strict';

class FakeProviderAdapter {
  constructor() {
    this.requests = 0;
    this.acceptedByKey = new Map();
  }

  async send({ attemptKey, body }) {
    this.requests += 1;

    const previous = this.acceptedByKey.get(attemptKey);
    if (previous) return { ...previous, duplicateRequest: true };

    const accepted = {
      providerMessageId: `provider-${this.acceptedByKey.size + 1}`,
      bodyHash: JSON.stringify(body),
      duplicateRequest: false,
    };
    this.acceptedByKey.set(attemptKey, accepted);
    return accepted;
  }
}

const deliveries = new Map();
const attempts = new Map();
const provider = new FakeProviderAdapter();

async function processDelivery(job, { crashAfterSend = false } = {}) {
  const delivery = deliveries.get(job.channelDeliveryId) ?? {
    state: 'queued',
    attemptSequence: 1,
  };
  deliveries.set(job.channelDeliveryId, delivery);

  if (delivery.state === 'provider_accepted') return delivery;

  const attemptKey = `${job.channelDeliveryId}:${delivery.attemptSequence}`;
  if (!attempts.has(attemptKey)) {
    attempts.set(attemptKey, { state: 'started', attemptKey });
  }

  const result = await provider.send({ attemptKey, body: job.body });

  // Simulate a worker dying after the provider accepts but before checkpointing.
  if (crashAfterSend) throw new Error('worker crashed before status commit');

  attempts.set(attemptKey, {
    state: 'provider_accepted',
    attemptKey,
    providerMessageId: result.providerMessageId,
  });
  Object.assign(delivery, {
    state: 'provider_accepted',
    providerMessageId: result.providerMessageId,
  });
  return delivery;
}

const job = {
  channelDeliveryId: 'delivery-42-email',
  body: { subject: 'Order shipped', orderId: 'order-42' },
};

await assert.rejects(
  processDelivery(job, { crashAfterSend: true }),
  /worker crashed/,
);

const recovered = await processDelivery(job);

assert.equal(provider.requests, 2, 'the transport request was retried');
assert.equal(provider.acceptedByKey.size, 1, 'the provider accepted one logical send');
assert.equal(recovered.state, 'provider_accepted');
assert.equal(recovered.providerMessageId, 'provider-1');

console.log({
  transportRequests: provider.requests,
  logicalProviderSends: provider.acceptedByKey.size,
  deliveryState: recovered.state,
  providerMessageId: recovered.providerMessageId,
});

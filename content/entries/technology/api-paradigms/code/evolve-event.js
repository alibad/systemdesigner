export function readOrderCreated(event) {
  if (!event || event.type !== 'order.created.v1') throw new Error('unsupported event');
  if (typeof event.id !== 'string' || typeof event.data?.orderId !== 'string') {
    throw new Error('invalid event envelope');
  }
  return {
    eventId: event.id,
    orderId: event.data.orderId,
    currency: event.data.currency ?? 'USD',
  };
}

const evolvedProducerEvent = {
  id: 'evt-42',
  type: 'order.created.v1',
  data: { orderId: 'order-018', currency: 'EUR', campaign: 'spring' },
};
console.log(readOrderCreated(evolvedProducerEvent));

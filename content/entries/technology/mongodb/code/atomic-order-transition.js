import { pathToFileURL } from 'node:url';

export async function markOrderPaid(orders, { orderId, paymentId, expectedVersion }) {
  if (!orderId || !paymentId || !Number.isInteger(expectedVersion)) {
    throw new Error('orderId, paymentId, and expectedVersion are required');
  }

  const result = await orders.updateOne(
    {
      _id: orderId,
      status: 'payment_pending',
      version: expectedVersion,
      'payment.id': { $ne: paymentId },
    },
    {
      $set: {
        status: 'paid',
        payment: { id: paymentId, captured: true },
        updatedAt: new Date(),
      },
      $inc: { version: 1 },
    },
    {
      writeConcern: { w: 'majority', wtimeoutMS: 5000 },
    },
  );

  if (result.modifiedCount === 1) return { outcome: 'applied' };

  const current = await orders.findOne(
    { _id: orderId },
    { projection: { status: 1, version: 1, 'payment.id': 1 } },
  );

  if (current?.payment?.id === paymentId && current.status === 'paid') {
    return { outcome: 'already_applied', current };
  }

  return { outcome: 'conflict', current };
}

async function example() {
  const stored = {
    _id: 'order-1042',
    status: 'payment_pending',
    version: 7,
    payment: null,
  };

  const fakeCollection = {
    async updateOne(filter, update) {
      const canApply = stored._id === filter._id
        && stored.status === filter.status
        && stored.version === filter.version
        && stored.payment?.id !== filter['payment.id']?.$ne;

      if (!canApply) return { modifiedCount: 0 };
      Object.assign(stored, update.$set);
      stored.version += update.$inc.version;
      return { modifiedCount: 1 };
    },
    async findOne() {
      return stored;
    },
  };

  const command = {
    orderId: 'order-1042',
    paymentId: 'payment-88',
    expectedVersion: 7,
  };
  const first = await markOrderPaid(fakeCollection, command);
  const replay = await markOrderPaid(fakeCollection, command);

  console.log({ first: first.outcome, replay: replay.outcome, order: stored });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  example().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

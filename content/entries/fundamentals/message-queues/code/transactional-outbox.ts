type Order = {
  id: string;
  customerId: string;
  status: 'confirmed';
};

type OutboxEvent = {
  id: string;
  topic: 'order.confirmed';
  aggregateId: string;
  payload: Order;
};

declare const database: {
  transaction<T>(work: (tx: {
    insertOrder(order: Order): Promise<void>;
    insertOutbox(event: OutboxEvent): Promise<void>;
  }) => Promise<T>): Promise<T>;
};

export async function confirmOrder(order: Order, eventId: string): Promise<void> {
  await database.transaction(async (tx) => {
    await tx.insertOrder(order);
    await tx.insertOutbox({
      id: eventId,
      topic: 'order.confirmed',
      aggregateId: order.id,
      payload: order,
    });
  });
}

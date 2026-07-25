type QueueMessage = {
  id: string;
  orderId: string;
  event: 'order.confirmed';
};

type Transaction = {
  hasProcessed(consumer: string, messageId: string): Promise<boolean>;
  markProcessed(consumer: string, messageId: string): Promise<void>;
  confirmOrder(orderId: string): Promise<void>;
};

declare const database: {
  transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
};

declare const broker: {
  acknowledge(messageId: string): Promise<void>;
};

export async function consume(message: QueueMessage): Promise<void> {
  await database.transaction(async (tx) => {
    if (await tx.hasProcessed('order-confirmer', message.id)) return;

    await tx.confirmOrder(message.orderId);
    await tx.markProcessed('order-confirmer', message.id);
  });

  await broker.acknowledge(message.id);
}

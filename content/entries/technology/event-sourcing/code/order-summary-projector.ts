type OrderEvent =
  | {
      type: 'OrderPlaced.v1';
      data: { orderId: string; customerId: string; currency: string };
    }
  | {
      type: 'OrderLineAdded.v1';
      data: { orderId: string; quantity: number; unitPriceMinor: number };
    }
  | {
      type: 'OrderCancelled.v1';
      data: { orderId: string; reason: string };
    };

type EventEnvelope = OrderEvent & {
  id: string;
  globalPosition: bigint;
};

type ProjectionTarget = 'order_summary_v1' | 'order_summary_v2';

interface ProjectionTransaction {
  hasEventReceipt(target: ProjectionTarget, eventId: string): Promise<boolean>;
  createOrder(
    target: ProjectionTarget,
    row: {
      orderId: string;
      customerId: string;
      currency: string;
      status: 'open';
      totalMinor: number;
    },
  ): Promise<void>;
  addOrderLine(
    target: ProjectionTarget,
    orderId: string,
    quantity: number,
    unitPriceMinor: number,
  ): Promise<void>;
  cancelOrder(
    target: ProjectionTarget,
    orderId: string,
    reason: string,
  ): Promise<void>;
  recordEventReceipt(
    target: ProjectionTarget,
    eventId: string,
  ): Promise<void>;
  saveCheckpoint(
    target: ProjectionTarget,
    globalPosition: bigint,
  ): Promise<void>;
}

interface ProjectionDatabase {
  transaction<T>(
    work: (transaction: ProjectionTransaction) => Promise<T>,
  ): Promise<T>;
  createEmptyTarget(target: ProjectionTarget): Promise<void>;
  reconcileTarget(target: ProjectionTarget): Promise<{
    valid: boolean;
    checkedOrders: number;
    failures: string[];
  }>;
  switchReadAlias(target: ProjectionTarget): Promise<void>;
}

interface EventReader {
  readAll(options: {
    fromPosition: bigint;
    signal: AbortSignal;
  }): AsyncIterable<EventEnvelope>;
}

async function applyEvent(
  transaction: ProjectionTransaction,
  target: ProjectionTarget,
  event: EventEnvelope,
): Promise<void> {
  if (await transaction.hasEventReceipt(target, event.id)) {
    return;
  }

  switch (event.type) {
    case 'OrderPlaced.v1':
      await transaction.createOrder(target, {
        orderId: event.data.orderId,
        customerId: event.data.customerId,
        currency: event.data.currency,
        status: 'open',
        totalMinor: 0,
      });
      break;
    case 'OrderLineAdded.v1':
      await transaction.addOrderLine(
        target,
        event.data.orderId,
        event.data.quantity,
        event.data.unitPriceMinor,
      );
      break;
    case 'OrderCancelled.v1':
      await transaction.cancelOrder(
        target,
        event.data.orderId,
        event.data.reason,
      );
      break;
  }

  // The receipt and checkpoint commit with the read-model mutation. A retry can
  // observe the receipt and skip the duplicate without advancing state twice.
  await transaction.recordEventReceipt(target, event.id);
  await transaction.saveCheckpoint(target, event.globalPosition);
}

export async function runProjector(
  database: ProjectionDatabase,
  reader: EventReader,
  target: ProjectionTarget,
  fromPosition: bigint,
  signal: AbortSignal,
): Promise<void> {
  for await (const event of reader.readAll({ fromPosition, signal })) {
    await database.transaction((transaction) =>
      applyEvent(transaction, target, event),
    );
  }
}

export async function rebuildOrderSummaryV2(
  database: ProjectionDatabase,
  reader: EventReader,
  signal: AbortSignal,
): Promise<void> {
  const target: ProjectionTarget = 'order_summary_v2';
  await database.createEmptyTarget(target);

  await runProjector(database, reader, target, 0n, signal);

  const reconciliation = await database.reconcileTarget(target);
  if (!reconciliation.valid) {
    throw new Error(
      `Projection v2 failed reconciliation: ${reconciliation.failures.join('; ')}`,
    );
  }

  // The alias changes only after replay, catch-up, and domain reconciliation.
  // Keep v1 for a bounded rollback window managed by the deployment runbook.
  await database.switchReadAlias(target);
}

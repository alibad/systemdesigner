type ReservationRequest = {
  orderId: string;
  idempotencyKey: string;
  items: Array<{ sku: string; quantity: number }>;
};

type ReservationResult =
  | { status: 'reserved'; reservationId: string; expiresAt: string }
  | { status: 'rejected'; reason: 'out_of_stock' | 'invalid_item' };

declare const reservationStore: {
  findByIdempotencyKey(key: string): Promise<ReservationResult | undefined>;
  record(value: ReservationRequest & { result: ReservationResult }): Promise<void>;
};

declare const inventory: {
  reserve(items: ReservationRequest['items']): Promise<ReservationResult>;
};

declare const outbox: {
  publish(topic: string, payload: unknown): Promise<void>;
};

export async function reserveInventory(request: ReservationRequest): Promise<ReservationResult> {
  const priorResult = await reservationStore.findByIdempotencyKey(request.idempotencyKey);
  if (priorResult) return priorResult;

  const result = await inventory.reserve(request.items);
  await reservationStore.record({ ...request, result });
  await outbox.publish('reservation.recorded', { orderId: request.orderId, result });
  return result;
}

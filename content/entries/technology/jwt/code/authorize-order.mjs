import { verifyAccessToken } from './verify-access-token.mjs';

export async function readOrder({ token, orderId, orderStore }) {
  const identity = await verifyAccessToken(token);

  if (!identity.scopes.has('orders:read')) {
    return { status: 403, body: { error: 'insufficient_scope' } };
  }

  const order = await orderStore.get(orderId);

  if (!order || order.ownerSubject !== identity.subject) {
    return { status: 404, body: { error: 'order_not_found' } };
  }

  return { status: 200, body: order };
}

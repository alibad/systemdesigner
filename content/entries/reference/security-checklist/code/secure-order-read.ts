type SecurityEvent = {
  actorId: string;
  action: 'order:read';
  resourceId: string;
  tenantId: string;
  outcome: 'allow' | 'deny';
  reason: string;
  policyVersion: string;
  requestId: string;
};

export async function readOrder(request: Request, orderIdInput: string) {
  const session = await sessions.requireAuthenticated(request);
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
  const orderId = orderIdSchema.parse(orderIdInput);

  let decision: PolicyDecision;
  try {
    decision = await policy.authorize({
      actorId: session.subject,
      tenantId: session.tenantId,
      action: 'order:read',
      resource: { type: 'order', id: orderId },
    });
  } catch {
    // This sensitive read fails closed when a trustworthy decision is unavailable.
    return Response.json({ error: 'authorization_unavailable', requestId }, { status: 503 });
  }

  const event: SecurityEvent = {
    actorId: session.subject,
    action: 'order:read',
    resourceId: orderId,
    tenantId: session.tenantId,
    outcome: decision.allowed ? 'allow' : 'deny',
    reason: decision.reason,
    policyVersion: decision.policyVersion,
    requestId,
  };
  await securityEvents.write(event); // Never include cookies, tokens, or order payloads.

  if (!decision.allowed) {
    return Response.json({ error: 'forbidden', requestId }, { status: 403 });
  }

  const order = await database.queryOne(
    'SELECT id, status, total_cents FROM orders WHERE tenant_id = $1 AND id = $2',
    [session.tenantId, orderId]
  );

  return order
    ? Response.json(order, { headers: { 'x-request-id': requestId } })
    : Response.json({ error: 'not_found', requestId }, { status: 404 });
}

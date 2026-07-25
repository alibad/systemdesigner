export function validateCommand(input, nowMs) {
  if (!input || typeof input !== 'object') throw new Error('command must be an object');
  if (typeof input.operationId !== 'string' || input.operationId.length > 80) {
    throw new Error('invalid operation identity');
  }
  if (!Number.isFinite(input.deadlineMs) || input.deadlineMs <= nowMs) {
    throw new Error('deadline already expired');
  }
  if (input.version !== 1) throw new Error('unsupported command version');
  return Object.freeze({
    operationId: input.operationId,
    deadlineMs: input.deadlineMs,
    version: input.version,
    payload: input.payload,
  });
}

const accepted = validateCommand({
  operationId: 'charge:order-018',
  deadlineMs: 1_800,
  version: 1,
  payload: { orderId: 'order-018' },
}, 1_000);
console.assert(accepted.operationId === 'charge:order-018');
console.log(accepted);

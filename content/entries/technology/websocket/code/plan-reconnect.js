export function planReconnect({ attempt, clientId, lastAcknowledgedSequence }) {
  const cappedAttempt = Math.min(attempt, 8);
  const baseDelayMs = 250 * 2 ** cappedAttempt;
  const stableJitterMs = [...clientId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 1_000;
  return {
    delayMs: Math.min(30_000, baseDelayMs + stableJitterMs),
    resumeAfter: lastAcknowledgedSequence,
    requireSnapshotIfCursorExpired: true,
  };
}

const plan = planReconnect({ attempt: 4, clientId: 'client-42', lastAcknowledgedSequence: 913 });
console.assert(plan.delayMs >= 4_000 && plan.resumeAfter === 913);
console.log(plan);

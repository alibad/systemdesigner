type Observation = {
  twinId: string;
  sourceId: string;
  sequence: number;
  observedAt: string;
  value: number;
  unit: 'degC';
};

type TwinState = Observation & {
  ingestedAt: string;
  missingSequences: number[];
};

export function applyObservation(
  current: TwinState | null,
  incoming: Observation,
  now = new Date(),
): TwinState {
  if (current && incoming.sequence <= current.sequence) {
    throw new Error('replayed-or-out-of-order-observation');
  }

  const firstMissing = current ? current.sequence + 1 : incoming.sequence;
  const missingSequences = Array.from(
    { length: Math.max(0, incoming.sequence - firstMissing) },
    (_, index) => firstMissing + index,
  );

  return {
    ...incoming,
    ingestedAt: now.toISOString(),
    missingSequences,
  };
}

export function isFreshEnough(
  state: TwinState,
  maxAgeMs: number,
  now = new Date(),
): boolean {
  const sourceAgeMs = now.getTime() - Date.parse(state.observedAt);
  return sourceAgeMs >= 0 && sourceAgeMs <= maxAgeMs;
}

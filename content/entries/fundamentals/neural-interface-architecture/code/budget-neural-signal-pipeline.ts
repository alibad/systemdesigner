/**
 * Teaching fixture for architecture review.
 * The caller must provide validated device and workload limits for a real system.
 */
type SignalPathInput = {
  channels: number;
  sampleRateHz: number;
  bitsPerSample: number;
  frameWindowMs: number;
  retainedPayloadPercent: number;
  protocolOverheadPercent: number;
  effectiveLinkMbps: number;
  queueAllowanceMs: number;
  processingMs: number;
  transportDelayMs: number;
  decisionDeadlineMs: number;
};

type SignalPathBudget = {
  rawMbps: number;
  transmittedMbps: number;
  frameBytes: number;
  linkUtilizationPercent: number;
  serializationMs: number;
  decisionLatencyMs: number;
  accepted: boolean;
  blockers: string[];
};

export function budgetSignalPath(input: SignalPathInput): SignalPathBudget {
  const positive = [
    input.channels,
    input.sampleRateHz,
    input.bitsPerSample,
    input.frameWindowMs,
    input.effectiveLinkMbps,
    input.decisionDeadlineMs,
  ];

  if (positive.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error('Signal-path dimensions must be finite positive numbers.');
  }

  if (
    input.retainedPayloadPercent <= 0
    || input.retainedPayloadPercent > 100
    || input.protocolOverheadPercent < 0
  ) {
    throw new Error('Payload and overhead percentages are outside the contract.');
  }

  const rawBitsPerSecond =
    input.channels * input.sampleRateHz * input.bitsPerSample;
  const rawMbps = rawBitsPerSecond / 1_000_000;
  const retainedFraction = input.retainedPayloadPercent / 100;
  const overheadMultiplier = 1 + input.protocolOverheadPercent / 100;
  const transmittedMbps = rawMbps * retainedFraction * overheadMultiplier;
  const frameBytes =
    rawBitsPerSecond
    * (input.frameWindowMs / 1000)
    * retainedFraction
    * overheadMultiplier
    / 8;
  const linkUtilizationPercent =
    transmittedMbps / input.effectiveLinkMbps * 100;
  const serializationMs =
    frameBytes * 8 / (input.effectiveLinkMbps * 1_000_000) * 1000;
  const decisionLatencyMs =
    input.frameWindowMs
    + input.queueAllowanceMs
    + input.processingMs
    + serializationMs
    + input.transportDelayMs;

  const blockers: string[] = [];
  if (linkUtilizationPercent >= 80) {
    blockers.push('The retained payload consumes at least 80% of link capacity.');
  }
  if (decisionLatencyMs > input.decisionDeadlineMs) {
    blockers.push('The modeled decision path exceeds its declared deadline.');
  }

  return {
    rawMbps,
    transmittedMbps,
    frameBytes,
    linkUtilizationPercent,
    serializationMs,
    decisionLatencyMs,
    accepted: blockers.length === 0,
    blockers,
  };
}

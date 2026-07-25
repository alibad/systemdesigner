type WorkloadContract = {
  durationHours: number;
  deadlineHours: number;
  requiredReserveHours: number;
  crossRegionAllowed: boolean;
};

type DispatchCandidate = {
  id: string;
  crossRegion: boolean;
  pathAvailable: boolean;
  plannedDelayHours: number;
  observedExtraDelayHours: number;
};

type AdmissionDecision =
  | { action: 'dispatch'; candidateId: string; completionMarginHours: number }
  | { action: 'fallback'; reason: string }
  | { action: 'reject'; reason: string };

export function admitCarbonAwareDispatch(
  workload: WorkloadContract,
  candidate: DispatchCandidate,
  fallbackAvailable: boolean,
): AdmissionDecision {
  if (candidate.crossRegion && !workload.crossRegionAllowed) {
    return fallbackOrReject(
      fallbackAvailable,
      'candidate violates the workload placement boundary',
    );
  }

  if (!candidate.pathAvailable) {
    return fallbackOrReject(
      fallbackAvailable,
      'candidate path is unavailable',
    );
  }

  const completionHours =
    candidate.plannedDelayHours
    + candidate.observedExtraDelayHours
    + workload.durationHours;
  const completionMarginHours = workload.deadlineHours - completionHours;

  if (completionMarginHours < workload.requiredReserveHours) {
    return fallbackOrReject(
      fallbackAvailable,
      `candidate leaves ${completionMarginHours}h of margin; `
        + `${workload.requiredReserveHours}h is required`,
    );
  }

  return {
    action: 'dispatch',
    candidateId: candidate.id,
    completionMarginHours,
  };
}

function fallbackOrReject(
  fallbackAvailable: boolean,
  reason: string,
): AdmissionDecision {
  return fallbackAvailable
    ? { action: 'fallback', reason }
    : { action: 'reject', reason };
}

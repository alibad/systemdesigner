type PairRequest = {
  requestId: string;
  source: string;
  destination: string;
  pairCount: number;
  minimumFidelity: number;
  deadlineMs: number;
};

type RouteSnapshot = {
  routeId: string;
  availablePairSlots: number;
  estimatedFidelity: number;
  estimatedCompletionMs: number;
  oldestPairAgeMs: number;
  memoryLifetimeMs: number;
  controllerIdentity: string;
  snapshotSequence: number;
  snapshotExpiresAtMs: number;
};

type Admission =
  | { accepted: true; reservationId: string; expiresAtMs: number }
  | { accepted: false; reasons: string[] };

export function admitPairRequest(
  request: PairRequest,
  route: RouteSnapshot,
  nowMs: number,
  authorizeController: (identity: string) => boolean,
): Admission {
  const reasons: string[] = [];

  if (!authorizeController(route.controllerIdentity)) {
    reasons.push("route snapshot has no authorized controller identity");
  }
  if (route.snapshotSequence < 1 || route.snapshotExpiresAtMs <= nowMs) {
    reasons.push("route snapshot is stale or replayed");
  }
  if (route.availablePairSlots < request.pairCount) {
    reasons.push("insufficient reserved pair and memory capacity");
  }
  if (route.estimatedFidelity < request.minimumFidelity) {
    reasons.push("estimated end-to-end fidelity is below the contract");
  }
  if (route.estimatedCompletionMs > request.deadlineMs) {
    reasons.push("estimated completion misses the application deadline");
  }
  if (route.oldestPairAgeMs >= route.memoryLifetimeMs) {
    reasons.push("a stored elementary pair is expected to expire");
  }

  if (reasons.length > 0) {
    return { accepted: false, reasons };
  }

  // The reservation binds later heralds and swap outcomes to one request.
  return {
    accepted: true,
    reservationId: `${request.requestId}:${route.routeId}:${route.snapshotSequence}`,
    expiresAtMs: nowMs + request.deadlineMs,
  };
}

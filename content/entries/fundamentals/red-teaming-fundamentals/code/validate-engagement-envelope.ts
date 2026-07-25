type EngagementEnvelope = {
  authorizedTargets: Set<string>;
  permittedBehaviors: Set<string>;
  startsAt: Date;
  expiresAt: Date;
  stopActive: boolean;
  evidenceStore: string;
  recoveryOwner: string;
};

type ExecutionRequest = {
  target: string;
  behavior: string;
  requestedAt: Date;
  exerciseId: string;
};

export function authorizeExecution(
  envelope: EngagementEnvelope,
  request: ExecutionRequest,
): { authorized: true } | { authorized: false; reason: string } {
  if (envelope.stopActive) {
    return { authorized: false, reason: 'The white cell has stopped the exercise.' };
  }
  if (!envelope.authorizedTargets.has(request.target)) {
    return { authorized: false, reason: 'The target is outside the signed scope.' };
  }
  if (!envelope.permittedBehaviors.has(request.behavior)) {
    return { authorized: false, reason: 'The behavior is not permitted.' };
  }
  if (request.requestedAt < envelope.startsAt || request.requestedAt >= envelope.expiresAt) {
    return { authorized: false, reason: 'The authorization window is closed.' };
  }
  if (!request.exerciseId || !envelope.evidenceStore || !envelope.recoveryOwner) {
    return { authorized: false, reason: 'Evidence or recovery ownership is incomplete.' };
  }
  return { authorized: true };
}

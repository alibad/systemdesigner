type Recommendation = {
  id: string;
  workloadId: string;
  action: 'schedule' | 'rightsize' | 'commitment' | 'spot';
  monthlyBaseline: number;
  expectedSavings: number;
  evidenceDays: number;
  proposedHeadroomPercent: number;
  evidenceWindowEnd: string;
};

type WorkloadPolicy = {
  workloadId: string;
  permittedActions: Recommendation['action'][];
  minimumEvidenceDays: number;
  minimumHeadroomPercent: number;
  maximumMonthlySavings: number;
  requiresRollback: boolean;
  requiresVerification: boolean;
};

type ChangeEvidence = {
  owner: string | null;
  rollbackTestedAt: string | null;
  verificationQuery: string | null;
  policyVersion: string;
};

type Decision =
  | { status: 'approved-for-canary'; recommendationId: string; expiresAt: string }
  | { status: 'held'; recommendationId: string; blockers: string[] };

export function evaluateOptimization(
  recommendation: Recommendation,
  policy: WorkloadPolicy,
  evidence: ChangeEvidence,
  now: Date,
): Decision {
  const blockers = [
    recommendation.workloadId !== policy.workloadId
      ? 'Recommendation and policy refer to different workloads.'
      : null,
    !policy.permittedActions.includes(recommendation.action)
      ? `${recommendation.action} is not permitted for this workload.`
      : null,
    recommendation.evidenceDays < policy.minimumEvidenceDays
      ? 'The demand history is shorter than policy requires.'
      : null,
    recommendation.proposedHeadroomPercent < policy.minimumHeadroomPercent
      ? 'The candidate leaves too little capacity headroom.'
      : null,
    recommendation.expectedSavings > policy.maximumMonthlySavings
      ? 'The estimate exceeds the modeled opportunity ceiling.'
      : null,
    !evidence.owner ? 'No accountable owner is assigned.' : null,
    policy.requiresRollback && !evidence.rollbackTestedAt
      ? 'Rollback has not been tested.'
      : null,
    policy.requiresVerification && !evidence.verificationQuery
      ? 'No service-level verification query is attached.'
      : null,
  ].filter((item): item is string => item !== null);

  if (blockers.length > 0) {
    return { status: 'held', recommendationId: recommendation.id, blockers };
  }

  // Approval is deliberately short-lived so stale cost and demand evidence cannot
  // authorize a later production change.
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  return {
    status: 'approved-for-canary',
    recommendationId: recommendation.id,
    expiresAt,
  };
}

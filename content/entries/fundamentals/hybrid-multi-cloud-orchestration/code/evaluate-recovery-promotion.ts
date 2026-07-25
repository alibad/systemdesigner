type RecoveryEvidence = {
  oldPrimaryFenced: boolean;
  replicaLagSeconds: number;
  maximumRpoSeconds: number;
  integrityCheckPassed: boolean;
  dependenciesReady: boolean;
  trafficControlReady: boolean;
};

type PromotionDecision =
  | { promote: true; reason: string }
  | { promote: false; blockers: string[] };

export function evaluateRecoveryPromotion(
  evidence: RecoveryEvidence,
): PromotionDecision {
  const blockers: string[] = [];

  if (!evidence.oldPrimaryFenced) {
    blockers.push('The old write authority is not fenced.');
  }

  if (evidence.replicaLagSeconds > evidence.maximumRpoSeconds) {
    blockers.push(
      `Replica lag ${evidence.replicaLagSeconds}s exceeds the `
      + `${evidence.maximumRpoSeconds}s recovery-point objective.`,
    );
  }

  if (!evidence.integrityCheckPassed) {
    blockers.push('The recovery copy failed its integrity check.');
  }

  if (!evidence.dependenciesReady) {
    blockers.push('Identity, secrets, queues, or downstream dependencies are not ready.');
  }

  if (!evidence.trafficControlReady) {
    blockers.push('Traffic cannot yet be moved to the recovery endpoint.');
  }

  if (blockers.length > 0) {
    return { promote: false, blockers };
  }

  return {
    promote: true,
    reason: 'The old authority is fenced and the recovery target satisfies the promotion gate.',
  };
}

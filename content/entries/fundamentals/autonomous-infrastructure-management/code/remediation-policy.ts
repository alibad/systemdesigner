type Incident = {
  id: string;
  service: string;
  symptom: string;
  corroboratingSignals: number;
  affectedPercent: number;
  confidence: number;
};

type Policy = {
  action: 'recommend' | 'replace-instance' | 'rollback-release';
  maxAffectedPercent: number;
  minSignals: number;
  minConfidence: number;
  requiresRollback: boolean;
};

type Decision =
  | { allowed: false; reason: string }
  | { allowed: true; actionId: string; action: Policy['action'] };

export function authorizeRemediation(
  incident: Incident,
  policy: Policy,
  rollbackArtifact: string | undefined,
): Decision {
  if (incident.corroboratingSignals < policy.minSignals) {
    return { allowed: false, reason: 'insufficient independent evidence' };
  }
  if (incident.confidence < policy.minConfidence) {
    return { allowed: false, reason: 'confidence below policy threshold' };
  }
  if (incident.affectedPercent > policy.maxAffectedPercent) {
    return { allowed: false, reason: 'proposed scope exceeds blast-radius limit' };
  }
  if (policy.requiresRollback && !rollbackArtifact) {
    return { allowed: false, reason: 'no tested rollback artifact' };
  }

  return {
    allowed: true,
    actionId: `${incident.id}:${policy.action}:v1`,
    action: policy.action,
  };
}

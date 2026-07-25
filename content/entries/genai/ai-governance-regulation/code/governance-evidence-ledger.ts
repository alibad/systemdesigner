type EvidenceKind =
  | 'system_card'
  | 'safety_evaluation'
  | 'impact_assessment'
  | 'security_review'
  | 'oversight_drill'
  | 'incident_plan';

type EvidenceStatus = 'passed' | 'failed' | 'accepted_exception';

interface EvidenceRecord {
  id: string;
  kind: EvidenceKind;
  subjectVersion: string;
  artifactUri: string;
  artifactDigest: string;
  owner: string;
  status: EvidenceStatus;
  completedAt: string;
  validUntil: string;
}

interface ReleaseCandidate {
  releaseId: string;
  systemVersion: string;
  riskTier: 'limited' | 'enhanced' | 'stringent';
  evidence: EvidenceRecord[];
}

interface EvidenceRequirement {
  kind: EvidenceKind;
  allowException: boolean;
}

const requirements: Record<ReleaseCandidate['riskTier'], EvidenceRequirement[]> = {
  limited: [
    { kind: 'system_card', allowException: false },
    { kind: 'safety_evaluation', allowException: false },
  ],
  enhanced: [
    { kind: 'system_card', allowException: false },
    { kind: 'safety_evaluation', allowException: false },
    { kind: 'impact_assessment', allowException: false },
    { kind: 'incident_plan', allowException: false },
  ],
  stringent: [
    { kind: 'system_card', allowException: false },
    { kind: 'safety_evaluation', allowException: false },
    { kind: 'impact_assessment', allowException: false },
    { kind: 'security_review', allowException: false },
    { kind: 'oversight_drill', allowException: false },
    { kind: 'incident_plan', allowException: false },
  ],
};

interface EvidenceProblem {
  kind: EvidenceKind;
  reason: 'missing' | 'wrong_version' | 'expired' | 'failed' | 'exception_not_allowed';
}

export function evaluateReleaseEvidence(
  candidate: ReleaseCandidate,
  now = new Date(),
): { approved: boolean; problems: EvidenceProblem[] } {
  const problems: EvidenceProblem[] = [];
  for (const requirement of requirements[candidate.riskTier]) {
    const records = candidate.evidence.filter((item) => item.kind === requirement.kind);
    if (records.length === 0) {
      problems.push({ kind: requirement.kind, reason: 'missing' });
      continue;
    }

    const matching = records.find((item) => item.subjectVersion === candidate.systemVersion);
    if (!matching) {
      problems.push({ kind: requirement.kind, reason: 'wrong_version' });
      continue;
    }
    if (new Date(matching.validUntil) <= now) {
      problems.push({ kind: requirement.kind, reason: 'expired' });
      continue;
    }
    if (matching.status === 'failed') {
      problems.push({ kind: requirement.kind, reason: 'failed' });
      continue;
    }
    if (matching.status === 'accepted_exception' && !requirement.allowException) {
      problems.push({ kind: requirement.kind, reason: 'exception_not_allowed' });
    }
  }

  return { approved: problems.length === 0, problems };
}

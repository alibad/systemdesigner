type Classification = 'public' | 'internal' | 'confidential' | 'restricted';
type Decision = 'enforce' | 'contain' | 'require-human-approval' | 'deny';

type GovernanceEvent = {
  eventId: string;
  subjectId: string;
  actorId: string;
  purpose: string | null;
  classification: Classification;
  classificationConfidence: number;
  requestedAction: 'tag' | 'quarantine' | 'mask' | 'delete';
  policyId: string;
  policyVersion: string;
  policyMatched: boolean;
  policyConflict: boolean;
};

type AuthorityEnvelope = {
  envelopeId: string;
  ownerRole: string;
  maximumImpact: number;
  minimumConfidence: number;
  reversibleActions: GovernanceEvent['requestedAction'][];
  automaticActions: GovernanceEvent['requestedAction'][];
};

type DecisionEnvelope = {
  decisionId: string;
  decision: Decision;
  reason: string;
  policyRef: string;
  authorityRef: string;
  authorityOwner: string;
  evidenceRequired: string[];
  containment: string | null;
};

const actionImpact: Record<GovernanceEvent['requestedAction'], number> = {
  tag: 1,
  quarantine: 2,
  mask: 3,
  delete: 4,
};

export function evaluateAuthorityEnvelope(
  event: GovernanceEvent,
  authority: AuthorityEnvelope,
): DecisionEnvelope {
  const base = {
    decisionId: crypto.randomUUID(),
    policyRef: `${event.policyId}@${event.policyVersion}`,
    authorityRef: authority.envelopeId,
    authorityOwner: authority.ownerRole,
    evidenceRequired: [
      'event context',
      'policy version',
      'classification result',
      'decision reason',
      'enforcement receipt',
    ],
  };

  if (!event.purpose || event.policyConflict) {
    return {
      ...base,
      decision: 'contain',
      reason: 'Required purpose is missing or applicable policies conflict.',
      containment: 'Freeze the request and preserve source data for review.',
    };
  }

  if (!event.policyMatched) {
    return {
      ...base,
      decision: 'deny',
      reason: 'No approved policy authorizes the requested purpose and action.',
      containment: 'Deny the action without changing the governed data.',
    };
  }

  const impact = actionImpact[event.requestedAction];
  const confidenceReady =
    event.classificationConfidence >= authority.minimumConfidence;
  const actionIsReversible = authority.reversibleActions.includes(
    event.requestedAction,
  );
  const actionIsAutomatic = authority.automaticActions.includes(
    event.requestedAction,
  );

  if (
    impact > authority.maximumImpact
    || !confidenceReady
    || !actionIsReversible
    || !actionIsAutomatic
  ) {
    return {
      ...base,
      decision: 'require-human-approval',
      reason:
        'The request exceeds the approved impact, confidence, reversibility, or action boundary.',
      containment: 'Keep the request quarantined until the named owner decides.',
    };
  }

  return {
    ...base,
    decision: 'enforce',
    reason: 'The request satisfies the versioned bounded-authority contract.',
    containment: null,
  };
}

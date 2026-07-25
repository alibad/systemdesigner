type SharedEntityKind = 'tracked-pose' | 'exclusive-object' | 'durable-command';
type AuthorityPath = 'local-sampled' | 'owner-lease' | 'session-authority';

type SharedAction = {
  entityKind: SharedEntityKind;
  actorId: string;
  operationId: string;
  leaseEpoch?: number;
  expectedVersion?: number;
};

type AuthorityDecision = {
  path: AuthorityPath;
  renderImmediately: boolean;
  requiresAcknowledgement: boolean;
  reconciliation: string;
};

export function routeSharedAction(action: SharedAction): AuthorityDecision {
  if (!action.operationId) throw new Error('Every action needs a stable operation ID');

  if (action.entityKind === 'tracked-pose') {
    return {
      path: 'local-sampled',
      renderImmediately: true,
      requiresAcknowledgement: false,
      reconciliation: 'Discard stale remote samples and interpolate the newest accepted pose.',
    };
  }

  if (action.entityKind === 'exclusive-object') {
    if (action.leaseEpoch === undefined) {
      throw new Error('Exclusive-object updates require an ownership lease epoch');
    }
    return {
      path: 'owner-lease',
      renderImmediately: true,
      requiresAcknowledgement: true,
      reconciliation: 'Reject updates from stale lease epochs and hand off from one owner to the next.',
    };
  }

  if (action.expectedVersion === undefined) {
    throw new Error('Durable commands require an expected authoritative version');
  }
  return {
    path: 'session-authority',
    renderImmediately: false,
    requiresAcknowledgement: true,
    reconciliation: 'Commit one validated version or return a conflict for explicit resolution.',
  };
}

const grab = routeSharedAction({
  entityKind: 'exclusive-object',
  actorId: 'participant-17',
  operationId: 'grab-8f3b',
  leaseEpoch: 42,
});

console.log(grab);

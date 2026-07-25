type DependencyFailure =
  | 'retrieval-timeout'
  | 'safety-unavailable'
  | 'tool-authorization-denied'
  | 'model-timeout';

type RequestOutcome =
  | { kind: 'blocked'; reason: string }
  | { kind: 'degraded'; route: 'approved-links' | 'human-review' | 'compact-tier' }
  | { kind: 'continue' };

export function applyFailurePolicy(failure: DependencyFailure): RequestOutcome {
  switch (failure) {
    case 'retrieval-timeout':
      return { kind: 'degraded', route: 'approved-links' };
    case 'safety-unavailable':
      return { kind: 'blocked', reason: 'required-policy-verdict-unavailable' };
    case 'tool-authorization-denied':
      return { kind: 'blocked', reason: 'requesting-identity-not-authorized' };
    case 'model-timeout':
      return { kind: 'degraded', route: 'compact-tier' };
  }
}

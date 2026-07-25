type PolicyBundle = {
  version: string;
  issuedAtMs: number;
  expiresAtMs: number;
  signatureValid: boolean;
};

type PolicyFallback =
  | { mode: 'fail-closed' }
  | { mode: 'bounded-cache'; maxAgeMs: number };

type EnforcementResult =
  | { allowed: true; policyVersion: string; source: 'current' | 'last-known-good' }
  | { allowed: false; status: 503; reason: 'policy_unavailable' | 'policy_expired' };

function usable(bundle: PolicyBundle, nowMs: number): boolean {
  return bundle.signatureValid
    && bundle.issuedAtMs <= nowMs
    && nowMs < bundle.expiresAtMs;
}

export function selectPolicyForRequest(
  current: PolicyBundle | null,
  cached: PolicyBundle | null,
  fallback: PolicyFallback,
  nowMs: number,
): EnforcementResult {
  if (current && usable(current, nowMs)) {
    return {
      allowed: true,
      policyVersion: current.version,
      source: 'current',
    };
  }

  if (fallback.mode === 'fail-closed') {
    return { allowed: false, status: 503, reason: 'policy_unavailable' };
  }

  if (!cached || !usable(cached, nowMs)) {
    return { allowed: false, status: 503, reason: 'policy_expired' };
  }

  const ageMs = nowMs - cached.issuedAtMs;
  if (ageMs > fallback.maxAgeMs) {
    return { allowed: false, status: 503, reason: 'policy_expired' };
  }

  return {
    allowed: true,
    policyVersion: cached.version,
    source: 'last-known-good',
  };
}

// Selecting a usable bundle is only the availability boundary.
// The caller, destination, operation, resource, and context must still match its rules.

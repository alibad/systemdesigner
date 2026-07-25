type Risk = 'low' | 'medium' | 'high';
type Authority = 'suggest' | 'confirm' | 'automatic';

interface Evidence {
  confidence: number;
  weight: number;
  fresh: boolean;
}

const authorityRank: Record<Authority, number> = {
  suggest: 0,
  confirm: 1,
  automatic: 2,
};

const authorityCeiling: Record<Risk, number> = {
  low: 2,
  medium: 1,
  high: 0,
};

export function decide(
  evidence: Evidence[],
  threshold: number,
  risk: Risk,
  authority: Authority,
) {
  const score = evidence.reduce((sum, signal) => {
    const freshnessFactor = signal.fresh ? 1 : 0.5;
    return sum + signal.confidence * signal.weight * freshnessFactor;
  }, 0);

  if (score < threshold) return { decision: 'defer', score };
  if (authorityRank[authority] > authorityCeiling[risk]) {
    return { decision: 'reduce-authority', score };
  }

  return { decision: authority, score };
}

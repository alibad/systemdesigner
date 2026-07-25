type Impact = 'limited' | 'material' | 'rights-affecting';
type Authority = 'assist' | 'recommend' | 'decide';
type GovernanceTier = 'tier-1' | 'tier-2' | 'tier-3';

type UseCase = {
  id: string;
  intendedUse: string;
  impact: Impact;
  authority: Authority;
  handlesSensitiveData: boolean;
};

type PolicyDecision = {
  tier: GovernanceTier;
  matchedRuleIds: string[];
  requiredControls: string[];
};

const CONTROLS: Record<GovernanceTier, string[]> = {
  'tier-1': [
    'named owner and use-case record',
    'baseline quality, privacy, and security tests',
    'change log and user feedback channel',
  ],
  'tier-2': [
    'all tier-1 controls',
    'documented impact assessment and subgroup evaluation',
    'independent reviewer and production thresholds',
    'tested restriction or rollback path',
  ],
  'tier-3': [
    'all tier-2 controls',
    'senior accountable approver separate from the model owner',
    'human oversight and appeal workflow tested at expected load',
    'predefined stop conditions and incident exercise',
  ],
};

export function classifyUseCase(useCase: UseCase): PolicyDecision {
  const matchedRuleIds: string[] = [];

  if (useCase.impact === 'rights-affecting') {
    matchedRuleIds.push('R3-RIGHTS-AFFECTING');
  }
  if (useCase.impact === 'material' && useCase.authority === 'decide') {
    matchedRuleIds.push('R3-AUTONOMOUS-MATERIAL-DECISION');
  }

  if (matchedRuleIds.length > 0) {
    return { tier: 'tier-3', matchedRuleIds, requiredControls: CONTROLS['tier-3'] };
  }

  if (useCase.impact === 'material') matchedRuleIds.push('R2-MATERIAL-IMPACT');
  if (useCase.authority !== 'assist') matchedRuleIds.push('R2-RECOMMEND-OR-DECIDE');
  if (useCase.handlesSensitiveData) matchedRuleIds.push('R2-SENSITIVE-DATA');

  const tier: GovernanceTier = matchedRuleIds.length > 0 ? 'tier-2' : 'tier-1';
  return { tier, matchedRuleIds, requiredControls: CONTROLS[tier] };
}

const decision = classifyUseCase({
  id: 'benefits-eligibility',
  intendedUse: 'Determine access to a public benefit',
  impact: 'rights-affecting',
  authority: 'recommend',
  handlesSensitiveData: true,
});

console.log(JSON.stringify(decision, null, 2));

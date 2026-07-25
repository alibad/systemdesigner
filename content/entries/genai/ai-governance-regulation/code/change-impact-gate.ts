type ComponentKind =
  | 'model'
  | 'prompt'
  | 'policy'
  | 'retrieval_corpus'
  | 'tool'
  | 'user_population'
  | 'human_oversight';

type ReviewKind =
  | 'system_documentation'
  | 'risk_mapping'
  | 'quality_evaluation'
  | 'safety_evaluation'
  | 'security_review'
  | 'oversight_drill';

const invalidatedEvidence: Record<ComponentKind, ReviewKind[]> = {
  model: ['system_documentation', 'quality_evaluation', 'safety_evaluation'],
  prompt: ['system_documentation', 'quality_evaluation', 'safety_evaluation'],
  policy: ['system_documentation', 'risk_mapping', 'safety_evaluation'],
  retrieval_corpus: ['system_documentation', 'quality_evaluation', 'safety_evaluation'],
  tool: ['system_documentation', 'risk_mapping', 'security_review'],
  user_population: ['risk_mapping', 'quality_evaluation', 'safety_evaluation'],
  human_oversight: ['risk_mapping', 'oversight_drill'],
};

interface ComponentChange {
  component: ComponentKind;
  priorVersion: string;
  candidateVersion: string;
  increasesAutonomy: boolean;
  affectsNewPopulation: boolean;
}

export function planGovernanceReview(changes: ComponentChange[]) {
  const reviews = new Set<ReviewKind>();
  for (const change of changes) {
    if (change.priorVersion === change.candidateVersion) continue;
    invalidatedEvidence[change.component].forEach((review) => reviews.add(review));
    if (change.increasesAutonomy) reviews.add('oversight_drill');
    if (change.affectsNewPopulation) reviews.add('risk_mapping');
  }

  const requiredReviews = [...reviews].sort();
  return {
    material: requiredReviews.length > 0,
    requiredReviews,
    maximumExposure: requiredReviews.length === 0 ? 'existing approval' : 'shadow only',
  };
}

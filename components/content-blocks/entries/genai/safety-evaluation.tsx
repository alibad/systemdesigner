'use client';

import SafetyEvaluationReleaseDecisionLab from './safety-evaluation-release-decision-lab';
import SafetyEvaluationSliceEvidenceLab from './safety-evaluation-slice-evidence-lab';

const SLICE_DATA_FILE =
  '/api/content/genai/safety-evaluation/data/slice-evidence-model.json';
const RELEASE_DATA_FILE =
  '/api/content/genai/safety-evaluation/data/release-decision-model.json';

export default function SafetyEvaluationLearningLab({
  dataFile = SLICE_DATA_FILE,
}: {
  dataFile?: string;
}) {
  if (dataFile === RELEASE_DATA_FILE) {
    return <SafetyEvaluationReleaseDecisionLab dataFile={dataFile} />;
  }

  return <SafetyEvaluationSliceEvidenceLab dataFile={dataFile} />;
}

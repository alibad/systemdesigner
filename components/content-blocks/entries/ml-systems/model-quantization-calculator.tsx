'use client';

import ModelQuantizationCalibrationLab from './model-quantization-calibration-lab';
import ModelQuantizationReleaseGateLab from './model-quantization-release-gate-lab';

const CALIBRATION_DATA_FILE =
  '/api/content/ml-systems/model-quantization/data/calibration-range-model.json';
const RELEASE_DATA_FILE =
  '/api/content/ml-systems/model-quantization/data/deployment-release-model.json';

export default function ModelQuantizationLearningLab({
  dataFile = CALIBRATION_DATA_FILE,
}: {
  dataFile?: string;
}) {
  if (dataFile === RELEASE_DATA_FILE) {
    return <ModelQuantizationReleaseGateLab dataFile={dataFile} />;
  }

  return <ModelQuantizationCalibrationLab dataFile={dataFile} />;
}

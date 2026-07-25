'use client';

import NeuromorphicComputingDeploymentEnvelopeLab from '@/components/content-blocks/entries/ml-systems/neuromorphic-computing-deployment-envelope-lab';

const BLOCK_ID = 'fundamentals/neuromorphic-computing-systems-mapping-lab';
const DATA_FILE =
  '/api/content/fundamentals/neuromorphic-computing-systems/data/mapping-envelope-model.json';

export default function NeuromorphicComputingSystemsMappingLab() {
  return (
    <NeuromorphicComputingDeploymentEnvelopeLab blockId={BLOCK_ID} dataFile={DATA_FILE} />
  );
}

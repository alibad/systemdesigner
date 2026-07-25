'use client';

import NeuromorphicComputingEventFlowLab from '@/components/content-blocks/entries/ml-systems/neuromorphic-computing-event-flow-lab';

const BLOCK_ID = 'fundamentals/neuromorphic-computing-systems-calculator';
const DATA_FILE =
  '/api/content/fundamentals/neuromorphic-computing-systems/data/event-workload-model.json';

export default function NeuromorphicComputingSystemsCalculator() {
  return <NeuromorphicComputingEventFlowLab blockId={BLOCK_ID} dataFile={DATA_FILE} />;
}

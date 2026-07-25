'use client';

import DynamoDBConsistencyIndexRecoveryLab from './dynamodb-consistency-index-recovery-lab';
import DynamoDBKeyDistributionCapacityLab from './dynamodb-key-distribution-capacity-lab';

const DEFAULT_DATA_FILE =
  '/api/content/technology/dynamodb/data/key-distribution-capacity-model.json';

export default function DynamoDBCapacity({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  if (dataFile.includes('consistency-index-recovery')) {
    return <DynamoDBConsistencyIndexRecoveryLab dataFile={dataFile} />;
  }

  return <DynamoDBKeyDistributionCapacityLab dataFile={dataFile} />;
}

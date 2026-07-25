'use client';

import CassandraConsistencyFailureLab from './cassandra-consistency-failure-lab';
import CassandraPartitionPlacementLab from './cassandra-partition-placement-lab';

const PARTITION_DATA_FILE =
  '/api/content/technology/cassandra/data/partition-placement-model.json';
const CONSISTENCY_DATA_FILE =
  '/api/content/technology/cassandra/data/consistency-failure-model.json';

export default function CassandraLearningLab({
  dataFile = PARTITION_DATA_FILE,
}: {
  dataFile?: string;
}) {
  if (dataFile === CONSISTENCY_DATA_FILE) {
    return <CassandraConsistencyFailureLab dataFile={dataFile} />;
  }

  return <CassandraPartitionPlacementLab dataFile={dataFile} />;
}

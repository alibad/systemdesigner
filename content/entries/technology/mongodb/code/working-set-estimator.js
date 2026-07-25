export function estimateMongoFootprint({
  documents,
  averageDocumentKiB,
  indexToDataRatio,
  hotPercent,
  replicas,
  migrationGenerations = 1,
}) {
  const logicalGiB = documents * averageDocumentKiB / 1024 / 1024;
  const indexGiB = logicalGiB * indexToDataRatio;
  const hotGiB = (logicalGiB + indexGiB) * hotPercent / 100;
  const storedGiB = (logicalGiB + indexGiB) * replicas * migrationGenerations;

  return {
    logicalGiB,
    indexGiB,
    hotGiB,
    storedGiB,
    minimumCacheGiB: hotGiB * 1.2,
  };
}

const estimate = estimateMongoFootprint({
  documents: 25_000_000,
  averageDocumentKiB: 3.5,
  indexToDataRatio: 0.42,
  hotPercent: 18,
  replicas: 3,
  migrationGenerations: 2,
});

for (const [name, value] of Object.entries(estimate)) {
  console.log(`${name}: ${value.toFixed(1)} GiB`);
}

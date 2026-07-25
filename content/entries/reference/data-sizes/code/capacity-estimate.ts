type CapacityAssumptions = {
  bytesPerItem: number;
  itemsPerSecond: number;
  retentionDays: number;
  compressionRatio: number;
  indexOverheadRatio: number;
  servingCopies: number;
  backupCopies: number;
};

const secondsPerDay = 86_400;

export function estimateCapacity(input: CapacityAssumptions) {
  const retainedItems = input.itemsPerSecond * secondsPerDay * input.retentionDays;
  const rawBytes = retainedItems * input.bytesPerItem;
  const compressedBytes = rawBytes * (1 - input.compressionRatio);
  const indexedServingBytes = compressedBytes * (1 + input.indexOverheadRatio);
  const durableBytes = indexedServingBytes * input.servingCopies + compressedBytes * input.backupCopies;
  const ingestBytesPerSecond = input.itemsPerSecond * input.bytesPerItem;

  return {
    retainedItems,
    rawBytes,
    ingestBytesPerSecond,
    durableBytes,
    assumptions: {
      units: 'bytes, seconds, and decimal storage units',
      copies: input.servingCopies + input.backupCopies,
      retentionDays: input.retentionDays,
      overhead: `${input.indexOverheadRatio * 100}% index overhead`,
    },
  };
}

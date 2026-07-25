type PlaybackSample = {
  estimatedMbps: number;
  bufferSeconds: number;
  segmentFailed: boolean;
};

type Rendition = {
  id: string;
  bitrateMbps: number;
};

export function chooseNextRendition(
  renditions: Rendition[],
  current: Rendition,
  sample: PlaybackSample,
): Rendition {
  const sorted = [...renditions].sort((left, right) => left.bitrateMbps - right.bitrateMbps);
  const currentIndex = sorted.findIndex((rendition) => rendition.id === current.id);
  const safeThroughputMbps = sample.estimatedMbps * 0.8;

  if (sample.segmentFailed || sample.bufferSeconds < 8) {
    return sorted[Math.max(0, currentIndex - 1)];
  }

  const sustainable = sorted.filter(
    (rendition) => rendition.bitrateMbps <= safeThroughputMbps,
  );
  const bestSustainable = sustainable.at(-1) ?? sorted[0];

  // Upgrade only after a healthy buffer exists; production controllers also use history.
  if (sample.bufferSeconds >= 20 && bestSustainable.bitrateMbps > current.bitrateMbps) {
    return bestSustainable;
  }

  return current;
}

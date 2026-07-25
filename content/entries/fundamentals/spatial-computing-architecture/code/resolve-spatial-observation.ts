type FrameId = 'device' | 'local-map' | 'anchor';

type SpatialObservation = {
  capturedAtNs: bigint;
  sourceFrame: FrameId;
  mapVersion: string;
  confidence: number;
  point: [number, number, number];
};

type Transform = {
  from: FrameId;
  to: FrameId;
  validAtNs: bigint;
  mapVersion: string;
  apply(point: SpatialObservation['point']): SpatialObservation['point'];
};

export function resolveObservation(
  observation: SpatialObservation,
  transform: Transform,
  nowNs: bigint,
) {
  const ageMs = Number(nowNs - observation.capturedAtNs) / 1_000_000;
  if (observation.confidence < 0.8) throw new Error('tracking-confidence-low');
  if (ageMs > 80) throw new Error('observation-stale');
  if (observation.sourceFrame !== transform.from) throw new Error('frame-mismatch');
  if (observation.mapVersion !== transform.mapVersion) throw new Error('map-version-mismatch');

  return {
    frame: transform.to,
    observedAtNs: observation.capturedAtNs,
    point: transform.apply(observation.point),
  };
}

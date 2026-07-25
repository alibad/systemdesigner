interface PresentationBudget {
  sensorMs: number;
  trackingMs: number;
  networkMs: number;
  renderMs: number;
  codecMs: number;
  composeAndDisplayMs: number;
}

export function evaluateBudget(budget: PresentationBudget, refreshHz: number) {
  const frameIntervalMs = 1000 / refreshHz;
  const pipelineMs = Object.values(budget).reduce((sum, value) => sum + value, 0);

  return {
    frameIntervalMs,
    pipelineMs,
    frameIntervals: pipelineMs / frameIntervalMs,
    targetMarginMs: frameIntervalMs - pipelineMs,
  };
}

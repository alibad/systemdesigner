type FramePlan = {
  refreshHz: number;
  runtimeReserveMs: number;
  cpuMs: number;
  gpuMs: number;
};

type FrameResult = FramePlan & {
  displayIntervalMs: number;
  applicationBudgetMs: number;
  criticalPathMs: number;
  marginMs: number;
  meetsDeadline: boolean;
  bottleneck: 'cpu' | 'gpu';
};

export function evaluateFramePlan(plan: FramePlan): FrameResult {
  if (plan.refreshHz <= 0) throw new Error('refreshHz must be positive');
  if ([plan.runtimeReserveMs, plan.cpuMs, plan.gpuMs].some((value) => value < 0)) {
    throw new Error('Frame durations cannot be negative');
  }

  const displayIntervalMs = 1000 / plan.refreshHz;
  const applicationBudgetMs = Math.max(0, displayIntervalMs - plan.runtimeReserveMs);

  // CPU and GPU work is commonly pipelined. This envelope uses the slower side
  // as the application critical path; real devices still require trace data.
  const criticalPathMs = Math.max(plan.cpuMs, plan.gpuMs);
  const marginMs = applicationBudgetMs - criticalPathMs;

  return {
    ...plan,
    displayIntervalMs,
    applicationBudgetMs,
    criticalPathMs,
    marginMs,
    meetsDeadline: marginMs >= 0,
    bottleneck: plan.cpuMs >= plan.gpuMs ? 'cpu' : 'gpu',
  };
}

const designReview = evaluateFramePlan({
  refreshHz: 90,
  runtimeReserveMs: 1.2,
  cpuMs: 4.4,
  gpuMs: 7.1,
});

if (!designReview.meetsDeadline) {
  throw new Error(`Frame plan misses by ${Math.abs(designReview.marginMs).toFixed(1)} ms`);
}

console.log({
  deadline: `${designReview.applicationBudgetMs.toFixed(1)} ms`,
  criticalPath: `${designReview.criticalPathMs.toFixed(1)} ms`,
  headroom: `${designReview.marginMs.toFixed(1)} ms`,
  bottleneck: designReview.bottleneck,
});

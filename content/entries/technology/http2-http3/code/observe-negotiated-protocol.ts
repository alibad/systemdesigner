type ProtocolSample = {
  protocol: string;
  durationMs: number;
  transferBytes: number;
};

const samples: ProtocolSample[] = [];

const observer = new PerformanceObserver((list) => {
  for (const item of list.getEntries()) {
    const entry = item as PerformanceResourceTiming;
    samples.push({
      protocol: entry.nextHopProtocol || 'not-exposed',
      durationMs: entry.duration,
      transferBytes: entry.transferSize,
    });
  }
});

observer.observe({ type: 'resource', buffered: true });

// Aggregate by route and cohort before comparing latency distributions.
// Cross-origin resources need Timing-Allow-Origin to expose protocol timing.
export function drainProtocolSamples(): ProtocolSample[] {
  return samples.splice(0, samples.length);
}

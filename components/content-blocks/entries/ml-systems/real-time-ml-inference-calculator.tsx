'use client';

import { useState } from 'react';

type Cache = 'redis' | 'memcached' | 'application-cache' | 'cdn';
type Hardware = 'cpu' | 'gpu' | 'tpu';

export default function RealTimeMlInferenceCalculator() {
  const [requestsPerSecond, setRequestsPerSecond] = useState(10_000);
  const [modelSize, setModelSize] = useState(500);
  const [featureDimensions, setFeatureDimensions] = useState(1_000);
  const [cache, setCache] = useState<Cache>('redis');
  const [hardware, setHardware] = useState<Hardware>('gpu');
  const batchSize = 32;

  const caches = {
    redis: { name: 'Redis Cache', latency: 0.8, memory: 1.5, hitRate: 0.85 },
    memcached: { name: 'Memcached', latency: 0.7, memory: 1.2, hitRate: 0.8 },
    'application-cache': { name: 'Application Cache', latency: 0.9, memory: 2, hitRate: 0.75 },
    cdn: { name: 'CDN Edge Cache', latency: 0.95, memory: 1.1, hitRate: 0.7 },
  };
  const current = caches[cache];
  const baseLatency = Math.log(modelSize) * 5 + (featureDimensions / 100) * 2 + (batchSize / 8) * 3;
  const acceleration = hardware === 'gpu' ? 0.3 : hardware === 'tpu' ? 0.2 : 1;
  const compression = 0.6;
  const uncachedLatency = baseLatency * acceleration * compression;
  const cachedLatency = uncachedLatency * current.latency;
  const effectiveThroughput = Math.min(requestsPerSecond, (1_000 / cachedLatency) * batchSize);
  const totalMemory = modelSize * compression * (1 + current.memory);
  const results = [
    ['Cached latency', `${Math.round(cachedLatency)}ms`],
    ['Uncached latency', `${Math.round(uncachedLatency)}ms`],
    ['Latency improvement', `${Math.round((1 - current.latency) * 100)}% faster`],
    ['Effective throughput', `${Math.round(effectiveThroughput).toLocaleString()} RPS`],
    ['Memory usage', `${Math.round(totalMemory)} MB`],
    ['Cache hit rate', `${Math.round(current.hitRate * 100)}%`],
    ['Cost efficiency', `${Math.round((effectiveThroughput / totalMemory) * 10)}/10`],
  ];

  return (
    <section className="not-prose my-8 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-xl font-semibold">Real-Time Inference Performance Calculator</h2>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Estimate latency, throughput, and memory for a cached inference path.</p>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-4 text-sm">
          <label className="block font-medium">Requests per Second: {requestsPerSecond.toLocaleString()}<input className="mt-2 w-full" type="range" min="1000" max="100000" step="1000" value={requestsPerSecond} onChange={(event) => setRequestsPerSecond(Number(event.target.value))} /></label>
          <label className="block font-medium">Model Size: {modelSize} MB<input className="mt-2 w-full" type="range" min="10" max="5000" step="10" value={modelSize} onChange={(event) => setModelSize(Number(event.target.value))} /></label>
          <label className="block font-medium">Feature Dimensions: {featureDimensions}<input className="mt-2 w-full" type="range" min="100" max="10000" step="100" value={featureDimensions} onChange={(event) => setFeatureDimensions(Number(event.target.value))} /></label>
          <label className="block font-medium">Caching Strategy<select className="mt-2 w-full rounded-md border p-2 dark:bg-neutral-950" value={cache} onChange={(event) => setCache(event.target.value as Cache)}><option value="redis">Redis Cache</option><option value="memcached">Memcached</option><option value="application-cache">Application Cache</option><option value="cdn">CDN Edge Cache</option></select></label>
          <label className="block font-medium">Hardware Acceleration<select className="mt-2 w-full rounded-md border p-2 dark:bg-neutral-950" value={hardware} onChange={(event) => setHardware(event.target.value as Hardware)}><option value="cpu">CPU Only</option><option value="gpu">GPU Accelerated</option><option value="tpu">TPU Optimized</option></select></label>
        </div>
        <div className="rounded-lg bg-neutral-50 p-5 dark:bg-neutral-800">
          <h3 className="font-semibold">Performance Metrics</h3>
          <p className="mt-1 text-xs text-neutral-500">{current.name}</p>
          <dl className="mt-4 space-y-3 text-sm">{results.map(([label, value]) => <div className="flex justify-between gap-4" key={label}><dt className="text-neutral-600 dark:text-neutral-400">{label}</dt><dd className="text-right font-mono font-medium">{value}</dd></div>)}</dl>
        </div>
      </div>
    </section>
  );
}

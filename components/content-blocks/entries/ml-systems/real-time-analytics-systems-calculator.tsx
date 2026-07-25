'use client';

import { useState } from 'react';

type ModelComplexity = 'simple' | 'medium' | 'complex';

export default function RealTimeAnalyticsSystemsCalculator() {
  const [eventRate, setEventRate] = useState(100_000);
  const [processingLatency, setProcessingLatency] = useState(50);
  const [windowSize, setWindowSize] = useState(60);
  const [partitions, setPartitions] = useState(12);
  const [featureCount, setFeatureCount] = useState(50);
  const [modelComplexity, setModelComplexity] = useState<ModelComplexity>('medium');
  const batchSize = 1000;

  const eventsPerPartition = eventRate / partitions;
  const networkLatency = 2;
  const featureLatency = featureCount * 0.1;
  const modelLatency = { simple: 5, medium: 15, complex: 35 }[modelComplexity];
  const totalLatency = processingLatency + networkLatency + featureLatency + modelLatency;
  const eventSize = 1;
  const windowMemory = (eventRate * windowSize * eventSize) / 1024;
  const featureMemory = (featureCount * batchSize * 4) / 1024;
  const bufferMemory = (batchSize * partitions * eventSize) / 1024;
  const totalMemory = windowMemory + featureMemory + bufferMemory;
  const recommendedPartitions = Math.max(partitions, Math.ceil(eventRate / 8000));
  const results = [
    ['Events/sec', eventRate.toLocaleString()],
    ['Events/partition', Math.round(eventsPerPartition).toLocaleString()],
    ['Total Latency', `${Math.round(totalLatency)}ms`],
    ['Window Memory', `${Math.round(windowMemory)} MB`],
    ['Total Memory', `${Math.round(totalMemory)} MB`],
    ['Latency Class', totalLatency < 100 ? 'Sub-100ms' : totalLatency < 500 ? 'Sub-500ms' : 'High'],
    ['Recommended Partitions', recommendedPartitions],
    ['Recommended Instances', Math.ceil(recommendedPartitions / 4)],
  ];

  return (
    <section className="not-prose my-8 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-xl font-semibold">Real-Time Analytics Calculator</h2>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">Calculate throughput, latency, memory usage, and scaling requirements for streaming analytics.</p>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-4 text-sm">
          <label className="block font-medium">Event Rate: {eventRate.toLocaleString()} events/sec<input className="mt-2 w-full" type="range" min="1000" max="1000000" step="1000" value={eventRate} onChange={(event) => setEventRate(Number(event.target.value))} /></label>
          <label className="block font-medium">Processing Latency: {processingLatency}ms<input className="mt-2 w-full" type="range" min="1" max="200" value={processingLatency} onChange={(event) => setProcessingLatency(Number(event.target.value))} /></label>
          <label className="block font-medium">Window Size: {windowSize} seconds<input className="mt-2 w-full" type="range" min="1" max="300" step="5" value={windowSize} onChange={(event) => setWindowSize(Number(event.target.value))} /></label>
          <label className="block font-medium">Partitions: {partitions}<input className="mt-2 w-full" type="range" min="1" max="64" value={partitions} onChange={(event) => setPartitions(Number(event.target.value))} /></label>
          <label className="block font-medium">Feature Count: {featureCount}<input className="mt-2 w-full" type="range" min="5" max="200" step="5" value={featureCount} onChange={(event) => setFeatureCount(Number(event.target.value))} /></label>
          <label className="block font-medium">Model Complexity<select className="mt-2 w-full rounded-md border p-2 dark:bg-neutral-950" value={modelComplexity} onChange={(event) => setModelComplexity(event.target.value as ModelComplexity)}><option value="simple">Simple (Linear/Logistic)</option><option value="medium">Medium (Tree-based)</option><option value="complex">Complex (Neural Network)</option></select></label>
        </div>
        <div className="rounded-lg bg-neutral-50 p-5 dark:bg-neutral-800"><h3 className="font-semibold">Performance Analysis</h3><dl className="mt-4 space-y-3 text-sm">{results.map(([label, value]) => <div className="flex justify-between gap-4" key={label}><dt className="text-neutral-600 dark:text-neutral-400">{label}</dt><dd className="font-mono font-medium">{value}</dd></div>)}</dl></div>
      </div>
    </section>
  );
}

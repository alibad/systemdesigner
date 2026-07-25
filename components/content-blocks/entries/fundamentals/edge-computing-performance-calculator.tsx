'use client';

import { useState } from 'react';

export default function EdgeComputingPerformanceCalculator() {
  const [edgeNodes, setEdgeNodes] = useState(10);
  const [dataVolume, setDataVolume] = useState(100);
  const [latencyRequirement, setLatencyRequirement] = useState(50);
  const [syncFrequency, setSyncFrequency] = useState(5);

  const processingCapacity = edgeNodes * 50;
  const networkLatency = Math.max(10, 200 - edgeNodes * 10);
  const effectiveLatency = networkLatency + (dataVolume / processingCapacity) * 10;
  const bandwidthSavings = Math.min(90, (edgeNodes / 100) * 100);
  const syncOverhead = (dataVolume / syncFrequency) * 0.1;
  const costReduction = Math.min(70, bandwidthSavings * 0.6);

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6 shadow-card dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Edge Computing Performance Calculator
      </h2>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <RangeControl
            id="edge-node-count"
            label="Edge Nodes"
            value={edgeNodes}
            display={edgeNodes.toString()}
            min={1}
            max={1000}
            onChange={setEdgeNodes}
          />
          <RangeControl
            id="edge-data-volume"
            label="Data Volume"
            value={dataVolume}
            display={`${dataVolume} GB/hr`}
            min={10}
            max={10000}
            step={10}
            onChange={setDataVolume}
          />
          <RangeControl
            id="edge-latency-target"
            label="Latency Target"
            value={latencyRequirement}
            display={`${latencyRequirement}ms`}
            min={1}
            max={500}
            onChange={setLatencyRequirement}
          />
          <RangeControl
            id="edge-sync-frequency"
            label="Sync Frequency"
            value={syncFrequency}
            display={`${syncFrequency} min`}
            min={1}
            max={60}
            onChange={setSyncFrequency}
          />
        </div>

        <div className="rounded-lg bg-gray-50 p-6 dark:bg-gray-800">
          <h3 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">
            System Performance
          </h3>
          <div className="space-y-3">
            <Metric label="Processing Capacity" value={`${processingCapacity} GB/hr`} />
            <Metric label="Effective Latency" value={`${effectiveLatency.toFixed(1)}ms`} />
            <Metric label="Bandwidth Savings" value={`${bandwidthSavings.toFixed(0)}%`} />
            <Metric label="Sync Overhead" value={`${syncOverhead.toFixed(1)} MB`} />
            <Metric label="Cost Reduction" value={`${costReduction.toFixed(0)}%`} />
          </div>
          <p className="mt-4 rounded bg-white p-3 text-sm dark:bg-gray-700">
            <strong>Status:</strong>{' '}
            {effectiveLatency <= latencyRequirement
              ? 'Latency target met'
              : 'Need more edge nodes or optimization'}
          </p>
        </div>
      </div>
    </section>
  );
}

function RangeControl({
  id,
  label,
  value,
  display,
  min,
  max,
  step = 1,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-4">
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="flex-1"
        />
        <output htmlFor={id} className="rounded bg-gray-100 px-2 py-1 font-mono text-sm dark:bg-gray-700">
          {display}
        </output>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span>{label}:</span>
      <span className="font-mono font-bold text-teal-600 dark:text-teal-400">{value}</span>
    </div>
  );
}

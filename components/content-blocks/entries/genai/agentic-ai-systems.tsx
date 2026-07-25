'use client';

import { useMemo, useState } from 'react';

export default function AgenticAiSystemsCalculator() {
  const [agentCount, setAgentCount] = useState(5);
  const [tasksPerHour, setTasksPerHour] = useState(100);
  const [complexityLevel, setComplexityLevel] = useState(3);
  const [coordinationOverhead, setCoordinationOverhead] = useState(15);

  const metrics = useMemo(() => {
    const totalCapacity = agentCount * tasksPerHour;
    const effectiveCapacity = totalCapacity * (1 - coordinationOverhead / 100);
    const efficiency = Math.max(0.3, 1 - coordinationOverhead / 100 - complexityLevel / 20);

    return {
      totalCapacity,
      effectiveCapacity,
      averageDuration: complexityLevel * 2,
      parallelismGain: Math.min(agentCount, 10) * 0.8,
      efficiency,
      costPerTask: (agentCount * 0.02) / Math.max(1, effectiveCapacity),
    };
  }, [agentCount, tasksPerHour, complexityLevel, coordinationOverhead]);

  const recommendation = metrics.efficiency > 0.7
    ? 'Optimal agent configuration'
    : coordinationOverhead > 25
      ? 'Reduce coordination overhead'
      : 'Consider simpler tasks or more agents';

  return (
    <div className="rounded-md border border-fuchsia-200 bg-fuchsia-50/60 p-5 dark:border-fuchsia-900 dark:bg-fuchsia-950/20">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
        <div className="space-y-4">
          <RangeControl id="agent-count" label="Number of agents" value={agentCount} min={1} max={50} onChange={setAgentCount} />
          <RangeControl id="tasks-per-hour" label="Tasks per agent per hour" value={tasksPerHour} min={10} max={1000} step={10} suffix="/hr" onChange={setTasksPerHour} />
          <RangeControl id="task-complexity" label="Task complexity" value={complexityLevel} min={1} max={10} suffix="/10" onChange={setComplexityLevel} />
          <RangeControl id="coordination-overhead" label="Coordination overhead" value={coordinationOverhead} min={5} max={50} suffix="%" onChange={setCoordinationOverhead} />
        </div>

        <div className="border-l-0 border-neutral-200 lg:border-l lg:pl-6 dark:border-neutral-800">
          <h3 className="mb-3 text-base font-semibold text-neutral-950 dark:text-neutral-100">System performance</h3>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
            <Metric label="Total capacity" value={`${metrics.totalCapacity.toLocaleString()}/hr`} />
            <Metric label="Effective capacity" value={`${metrics.effectiveCapacity.toFixed(0)}/hr`} />
            <Metric label="Average task duration" value={`${metrics.averageDuration} min`} />
            <Metric label="Parallelism gain" value={`${metrics.parallelismGain.toFixed(1)}x`} />
            <Metric label="System efficiency" value={`${(metrics.efficiency * 100).toFixed(0)}%`} />
            <Metric label="Cost per task" value={`$${metrics.costPerTask.toFixed(4)}`} />
          </dl>
          <p className="mt-4 border-t border-neutral-200 pt-3 text-sm text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
            <strong>Recommendation:</strong> {recommendation}
          </p>
        </div>
      </div>
    </div>
  );
}

function RangeControl({ id, label, value, min, max, step = 1, suffix = '', onChange }: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{label}</label>
        <output htmlFor={id} className="font-mono text-sm text-fuchsia-800 dark:text-fuchsia-300">{value}{suffix}</output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-fuchsia-700" />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <><dt className="text-neutral-600 dark:text-neutral-400">{label}</dt><dd className="font-mono font-medium text-neutral-950 dark:text-neutral-100">{value}</dd></>;
}

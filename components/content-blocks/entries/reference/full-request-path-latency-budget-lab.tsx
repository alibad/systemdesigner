'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Cloud,
  Database,
  Gauge,
  Route,
  TriangleAlert,
  Wifi,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type PathMode = 'edge-hit' | 'origin-read';
type NetworkId = 'broadband' | 'four-g' | 'congested';

const TARGET_MS = 300;

const pathModes: Array<{ id: PathMode; label: string; detail: string }> = [
  {
    id: 'edge-hit',
    label: 'Edge cache hit',
    detail: 'The edge returns a safe cached response without gateway, application, or database work.',
  },
  {
    id: 'origin-read',
    label: 'Dynamic origin read',
    detail: 'The request crosses gateway, authorization, application, and a hot cache before the response returns.',
  },
];

const networks: Array<{ id: NetworkId; label: string; detail: string; setupMs: number; rttMs: number; downMbps: number }> = [
  {
    id: 'broadband',
    label: 'Warm broadband',
    detail: 'Reused connection, 30 ms round trip, about 25 Mbps downstream.',
    setupMs: 0,
    rttMs: 30,
    downMbps: 25,
  },
  {
    id: 'four-g',
    label: 'Warm 4G',
    detail: 'Reused connection, 80 ms round trip, about 15 Mbps downstream.',
    setupMs: 0,
    rttMs: 80,
    downMbps: 15.2,
  },
  {
    id: 'congested',
    label: 'Cold congested 4G',
    detail: 'DNS and TLS setup, 150 ms round trip, about 4 Mbps downstream.',
    setupMs: 55,
    rttMs: 150,
    downMbps: 4,
  },
];

function formatMs(value: number) {
  return `${Math.round(value)} ms`;
}

export default function FullRequestPathLatencyBudgetLab() {
  const [pathMode, setPathMode] = useState<PathMode>('origin-read');
  const [networkId, setNetworkId] = useState<NetworkId>('four-g');
  const [payloadKb, setPayloadKb] = useState(200);

  const model = useMemo(() => {
    const network = networks.find((item) => item.id === networkId) ?? networks[1];
    const originStages = pathMode === 'origin-read'
      ? [
          { label: 'Gateway and authorization', value: 16, tone: 'bg-violet-500' },
          { label: 'Application and hot cache', value: 39, tone: 'bg-emerald-500' },
        ]
      : [];
    const transferMs = (payloadKb * 8) / network.downMbps;
    const stages = [
      { label: 'Setup and round trip', value: network.setupMs + network.rttMs, tone: 'bg-blue-500' },
      { label: 'Edge policy and cache lookup', value: 10, tone: 'bg-cyan-500' },
      ...originStages,
      { label: 'Transfer and render', value: transferMs + 20, tone: 'bg-amber-500' },
    ];
    const totalMs = stages.reduce((sum, stage) => sum + stage.value, 0);
    const dominant = stages.reduce((largest, stage) => (stage.value > largest.value ? stage : largest));
    const remainingMs = TARGET_MS - totalMs;
    const recommendation = dominant.label === 'Transfer and render'
      ? 'The response bytes dominate. Compress, paginate, or omit fields before chasing small origin savings.'
      : dominant.label === 'Setup and round trip'
        ? 'The network dominates. Reuse connections, keep an edge close to users, and avoid extra sequential round trips.'
        : pathMode === 'origin-read'
          ? 'Origin work is now meaningful. Remove unnecessary calls, keep hot reads in cache, and bound the miss path by the remaining deadline.'
          : 'The short edge path is healthy. Preserve explicit cache freshness rules before increasing its reuse.';

    return { dominant, network, recommendation, remainingMs, stages, totalMs, transferMs };
  }, [networkId, pathMode, payloadKb]);

  const withinBudget = model.remainingMs >= 0;

  return (
    <div data-content-block="reference/full-request-path-latency-budget-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="End-to-end budget"
          title="Spend one p95 deadline across the whole path"
          description="Change the path, client network, and payload. The estimate makes the budget trade-off visible: removing a stage and reducing bytes solve different problems."
          icon={Gauge}
          accent="violet"
          onReset={() => {
            setPathMode('origin-read');
            setNetworkId('four-g');
            setPayloadKb(200);
          }}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Required response path</legend>
                <div className="mt-3 space-y-2">
                  {pathModes.map((option) => (
                    <LabChoice
                      key={option.id}
                      selected={pathMode === option.id}
                      label={option.label}
                      detail={option.detail}
                      icon={option.id === 'edge-hit' ? Cloud : Route}
                      accent={option.id === 'edge-hit' ? 'cyan' : 'violet'}
                      onClick={() => setPathMode(option.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Client network cohort</legend>
                <div className="mt-3 space-y-2">
                  {networks.map((option) => (
                    <LabChoice
                      key={option.id}
                      selected={networkId === option.id}
                      label={option.label}
                      detail={option.detail}
                      icon={Wifi}
                      accent={option.id === 'congested' ? 'amber' : 'blue'}
                      onClick={() => setNetworkId(option.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <LabRange
                label="Compressed response size"
                value={payloadKb}
                output={`${payloadKb} KB`}
                min={50}
                max={1200}
                step={50}
                accent="amber"
                lowLabel="small summary"
                highLabel="large response"
                onChange={setPayloadKb}
              />
            </div>
          }
        >
          <div aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Estimated p95 path"
                value={formatMs(model.totalMs)}
                detail={`${pathMode === 'edge-hit' ? 'Edge response' : 'Dynamic origin'} on ${model.network.label.toLowerCase()}`}
                icon={Activity}
                tone={withinBudget ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="300 ms budget"
                value={withinBudget ? `${Math.round(model.remainingMs)} ms left` : `${Math.abs(Math.round(model.remainingMs))} ms over`}
                detail="Reserve headroom for normal p95 variation and error handling."
                icon={withinBudget ? CheckCircle2 : TriangleAlert}
                tone={withinBudget ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Largest stage"
                value={formatMs(model.dominant.value)}
                detail={model.dominant.label}
                icon={model.dominant.label === 'Transfer and render' ? Cloud : Database}
                tone="amber"
              />
            </div>

            <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">Estimated critical path</p>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Each row is sequential work in this simplified p95 estimate. The bar width is relative to the total path.</p>
              </div>
              <ol className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {model.stages.map((stage) => (
                  <li key={stage.label} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_72px] sm:items-center sm:gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">{stage.label}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-neutral-700 dark:text-neutral-300 sm:hidden">{formatMs(stage.value)}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                        <div className={`h-full rounded-full ${stage.tone}`} style={{ width: `${Math.max(4, (stage.value / model.totalMs) * 100)}%` }} />
                      </div>
                    </div>
                    <span className="hidden text-right text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-300 sm:block">{formatMs(stage.value)}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className={`mt-5 rounded-md border p-4 ${withinBudget ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50' : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'}`}>
              <p className="text-xs font-semibold uppercase opacity-75">Decision consequence</p>
              <p className="mt-2 text-sm font-semibold">{withinBudget ? 'This cohort fits the target, but the remaining headroom is the real safety margin.' : 'This cohort misses the target before normal tail variation, retries, or queueing are included.'}</p>
              <p className="mt-2 text-sm leading-6 opacity-90">{model.recommendation}</p>
            </section>

            <p className="mt-4 text-xs leading-5 text-neutral-500 dark:text-neutral-400">Model assumptions: a warm path avoids DNS and TLS setup; transfer time is approximate compressed payload bits divided by downstream throughput; the origin path uses a hot cache rather than a database miss. Use traces and real-user measurements to replace these planning numbers.</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

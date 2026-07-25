'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  Clock3,
  Gauge,
  Network,
  RadioTower,
  RefreshCw,
  Route,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';

type AnswerMode = 'now' | 'later';
type AudienceMode = 'one' | 'many';
type TrafficMode = 'steady' | 'bursty';
type PatternId = 'request' | 'queue' | 'stream';

const patterns: Record<
  PatternId,
  {
    label: string;
    eyebrow: string;
    summary: string;
    latency: string;
    coupling: string;
    buffer: string;
    icon: typeof Route;
    accent: string;
    soft: string;
  }
> = {
  request: {
    label: 'Request-response',
    eyebrow: 'Synchronous path',
    summary: 'The caller waits for one service to return a result.',
    latency: 'End-to-end',
    coupling: 'Higher',
    buffer: 'None',
    icon: Route,
    accent: 'text-blue-300',
    soft: 'border-blue-400/40 bg-blue-400/10',
  },
  queue: {
    label: 'Work queue',
    eyebrow: 'Asynchronous handoff',
    summary: 'The producer stores work and one consumer processes it later.',
    latency: 'Fast submit',
    coupling: 'Lower',
    buffer: 'Built in',
    icon: Workflow,
    accent: 'text-emerald-300',
    soft: 'border-emerald-400/40 bg-emerald-400/10',
  },
  stream: {
    label: 'Event stream',
    eyebrow: 'Publish-subscribe',
    summary: 'The producer records a fact that several consumers can react to.',
    latency: 'Variable',
    coupling: 'Lowest',
    buffer: 'Replayable',
    icon: RadioTower,
    accent: 'text-violet-300',
    soft: 'border-violet-400/40 bg-violet-400/10',
  },
};

const presets = [
  { label: 'Price lookup', answer: 'now', audience: 'one', traffic: 'steady' },
  { label: 'Image resize', answer: 'later', audience: 'one', traffic: 'bursty' },
  { label: 'Order created', answer: 'later', audience: 'many', traffic: 'bursty' },
] as const;

function ToggleGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">{label}</legend>
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-1 rounded-md bg-neutral-900 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`min-h-10 rounded px-3 text-sm font-medium transition-colors ${
              value === option.value
                ? 'bg-white text-neutral-950 shadow-sm'
                : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function CommunicationPatternExplorer() {
  const [answer, setAnswer] = useState<AnswerMode>('now');
  const [audience, setAudience] = useState<AudienceMode>('one');
  const [traffic, setTraffic] = useState<TrafficMode>('steady');

  const recommendation = useMemo<PatternId>(() => {
    if (answer === 'now') return 'request';
    if (audience === 'many') return 'stream';
    return 'queue';
  }, [answer, audience]);

  const pattern = patterns[recommendation];
  const PatternIcon = pattern.icon;
  const consumerLabels = recommendation === 'stream' ? ['Email', 'Analytics', 'Billing'] : ['Worker'];
  const pressure = traffic === 'bursty' && recommendation === 'request';

  return (
    <section className="not-prose my-8 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 text-white shadow-xl shadow-neutral-950/10">
      <header className="border-b border-neutral-800 px-5 py-5 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              <Network aria-hidden="true" className="h-4 w-4" />
              Interactive decision lab
            </div>
            <h3 className="mt-2 text-xl font-semibold md:text-2xl">Choose the communication shape</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Change the workload constraints. The path updates to show the simplest pattern that satisfies them.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setAnswer(preset.answer);
                  setAudience(preset.audience);
                  setTraffic(preset.traffic);
                }}
                className="rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-300 transition-colors hover:border-cyan-400/60 hover:text-white"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-5 border-b border-neutral-800 bg-neutral-900/40 p-5 lg:border-b-0 lg:border-r md:p-6">
          <ToggleGroup
            label="Does the caller need an answer?"
            value={answer}
            options={[
              { value: 'now', label: 'Right now' },
              { value: 'later', label: 'Can finish later' },
            ]}
            onChange={setAnswer}
          />
          <ToggleGroup
            label="Who receives the message?"
            value={audience}
            options={[
              { value: 'one', label: 'One worker' },
              { value: 'many', label: 'Many consumers' },
            ]}
            onChange={setAudience}
          />
          <ToggleGroup
            label="How does traffic arrive?"
            value={traffic}
            options={[
              { value: 'steady', label: 'Steady' },
              { value: 'bursty', label: 'Bursty' },
            ]}
            onChange={setTraffic}
          />
        </div>

        <div className="min-w-0 p-5 md:p-6">
          <div className={`rounded-lg border p-4 md:p-5 ${pattern.soft}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-black/30">
                  <PatternIcon aria-hidden="true" className={`h-5 w-5 ${pattern.accent}`} />
                </span>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold uppercase tracking-wider ${pattern.accent}`}>{pattern.eyebrow}</p>
                  <h4 className="mt-1 text-lg font-semibold text-white">{pattern.label}</h4>
                </div>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded border border-white/15 bg-black/25 px-3 py-2 text-xs font-semibold text-neutral-200">
                <Check aria-hidden="true" className="h-4 w-4 text-emerald-300" />
                Best fit
              </span>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-300">{pattern.summary}</p>
          </div>

          <div className="mt-5 overflow-x-auto pb-1">
            <div className="flex min-w-[620px] items-center gap-3 rounded-lg border border-neutral-800 bg-black/30 p-5">
              <div className="w-32 rounded-md border border-blue-400/40 bg-blue-400/10 p-3">
                <Zap aria-hidden="true" className="h-5 w-5 text-blue-300" />
                <p className="mt-3 text-sm font-semibold">Producer</p>
                <p className="mt-1 text-xs text-neutral-500">Creates intent</p>
              </div>
              <ArrowRight aria-hidden="true" className={`h-5 w-5 shrink-0 ${pressure ? 'text-rose-400' : 'text-neutral-500'}`} />
              <div className={`relative w-40 overflow-hidden rounded-md border p-3 ${pattern.soft}`}>
                <PatternIcon aria-hidden="true" className={`h-5 w-5 ${pattern.accent}`} />
                <p className="mt-3 text-sm font-semibold">{pattern.label}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-800">
                  <div
                    className={`h-full rounded-full transition-all ${
                      pressure ? 'w-full bg-rose-400' : traffic === 'bursty' ? 'w-3/4 bg-amber-400' : 'w-1/3 bg-cyan-400'
                    }`}
                  />
                </div>
              </div>
              <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 text-neutral-500" />
              <div className="flex flex-1 gap-2">
                {consumerLabels.map((label) => (
                  <div key={label} className="min-w-0 flex-1 rounded-md border border-emerald-400/30 bg-emerald-400/10 p-3">
                    <Users aria-hidden="true" className="h-5 w-5 text-emerald-300" />
                    <p className="mt-3 truncate text-sm font-semibold">{label}</p>
                    <p className="mt-1 text-xs text-neutral-500">Handles work</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {pressure ? (
            <div className="mt-4 flex items-start gap-3 rounded-md border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-100">
              <Activity aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
              A synchronous path cannot absorb this burst. If the answer can be delayed, a queue would isolate the caller from overload.
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-3 divide-x divide-neutral-800 rounded-lg border border-neutral-800 bg-neutral-900/50">
            {[
              { label: 'Latency', value: pattern.latency, icon: Clock3 },
              { label: 'Coupling', value: pattern.coupling, icon: RefreshCw },
              { label: 'Buffering', value: pattern.buffer, icon: Gauge },
            ].map((metric) => (
              <div key={metric.label} className="min-w-0 px-3 py-4 md:px-4">
                <metric.icon aria-hidden="true" className="h-4 w-4 text-neutral-500" />
                <p className="mt-2 break-words text-xs font-semibold leading-4 text-white sm:text-sm">{metric.value}</p>
                <p className="mt-1 text-xs text-neutral-500">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

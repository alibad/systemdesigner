'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CloudOff,
  Flame,
  Gauge,
  Layers3,
  LoaderCircle,
  Server,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/varnish-origin-pressure-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/varnish/data/origin-pressure-model.json';

type Bounds = {
  min: number;
  max: number;
  step: number;
};

type FailureScenario = {
  id: string;
  label: string;
  detail: string;
  originCapacityRps: number;
  originLatencyMs: number;
  expiredFraction: number;
  staleAgeSeconds: number;
  originAvailable: boolean;
};

type CollapsePolicy = {
  id: string;
  label: string;
  detail: string;
  collapseFactor: number;
};

type OriginPressureModel = {
  kind: 'varnish-origin-pressure';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    collapseId: string;
    trafficRps: number;
    graceSeconds: number;
  };
  bounds: {
    trafficRps: Bounds;
    graceSeconds: Bounds;
  };
  scenarios: FailureScenario[];
  collapsePolicies: CollapsePolicy[];
  notice: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBounds(value: unknown): value is Bounds {
  if (!isRecord(value)) return false;
  return isFiniteNumber(value.min)
    && isFiniteNumber(value.max)
    && isFiniteNumber(value.step)
    && value.min < value.max
    && value.step > 0;
}

function isScenario(value: unknown): value is FailureScenario {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.label)
    && isNonEmptyString(value.detail)
    && isFiniteNumber(value.originCapacityRps)
    && value.originCapacityRps >= 0
    && isFiniteNumber(value.originLatencyMs)
    && value.originLatencyMs > 0
    && isFiniteNumber(value.expiredFraction)
    && value.expiredFraction >= 0
    && value.expiredFraction <= 1
    && isFiniteNumber(value.staleAgeSeconds)
    && value.staleAgeSeconds >= 0
    && typeof value.originAvailable === 'boolean';
}

function isCollapsePolicy(value: unknown): value is CollapsePolicy {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.label)
    && isNonEmptyString(value.detail)
    && isFiniteNumber(value.collapseFactor)
    && value.collapseFactor > 0
    && value.collapseFactor <= 1;
}

function isModel(value: unknown): value is OriginPressureModel {
  if (
    !isRecord(value)
    || value.kind !== 'varnish-origin-pressure'
    || value.blockId !== BLOCK_ID
    || !isNonEmptyString(value.title)
    || !isNonEmptyString(value.description)
    || !isNonEmptyString(value.notice)
    || !isRecord(value.defaults)
    || !isRecord(value.bounds)
    || !Array.isArray(value.scenarios)
    || value.scenarios.length < 3
    || !value.scenarios.every(isScenario)
    || !Array.isArray(value.collapsePolicies)
    || value.collapsePolicies.length < 2
    || !value.collapsePolicies.every(isCollapsePolicy)
  ) {
    return false;
  }

  const defaults = value.defaults;
  const bounds = value.bounds;
  return isNonEmptyString(defaults.scenarioId)
    && isNonEmptyString(defaults.collapseId)
    && isFiniteNumber(defaults.trafficRps)
    && isFiniteNumber(defaults.graceSeconds)
    && isBounds(bounds.trafficRps)
    && isBounds(bounds.graceSeconds)
    && defaults.trafficRps >= bounds.trafficRps.min
    && defaults.trafficRps <= bounds.trafficRps.max
    && defaults.graceSeconds >= bounds.graceSeconds.min
    && defaults.graceSeconds <= bounds.graceSeconds.max
    && value.scenarios.some((scenario) => scenario.id === defaults.scenarioId)
    && value.collapsePolicies.some((policy) => policy.id === defaults.collapseId)
    && new Set(value.scenarios.map((scenario) => scenario.id)).size === value.scenarios.length
    && new Set(value.collapsePolicies.map((policy) => policy.id)).size === value.collapsePolicies.length;
}

function byId<T extends { id: string }>(items: T[], id: string): T {
  return items.find((item) => item.id === id) ?? items[0];
}

function formatRate(value: number): string {
  return Math.round(value).toLocaleString();
}

export default function VarnishOriginPressureLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<OriginPressureModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isModel(payload)) {
          throw new Error('The Varnish origin-pressure model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the origin-pressure lab.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Origin pressure lab"
            title="Keep one expired object from becoming a traffic spike"
            description="Loading failure, grace, and request-collapse assumptions."
            icon={ShieldCheck}
            accent="emerald"
          />
          <div className="flex min-h-44 items-center justify-center p-6">
            {error ? (
              <div className="text-center">
                <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => setReloadKey((value) => value + 1)}
                  className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-neutral-700 dark:text-neutral-100"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
                Loading resilience model
              </div>
            )}
          </div>
        </LearningLab>
      </div>
    );
  }

  return <OriginPressureWorkbench model={model} />;
}

function OriginPressureWorkbench({ model }: { model: OriginPressureModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [collapseId, setCollapseId] = useState(model.defaults.collapseId);
  const [trafficRps, setTrafficRps] = useState(model.defaults.trafficRps);
  const [graceSeconds, setGraceSeconds] = useState(model.defaults.graceSeconds);

  const scenario = byId(model.scenarios, scenarioId);
  const collapse = byId(model.collapsePolicies, collapseId);

  const result = useMemo(() => {
    const staleEligible = graceSeconds >= scenario.staleAgeSeconds;
    const expiredRps = trafficRps * scenario.expiredFraction;
    const staleRps = staleEligible ? expiredRps : 0;
    const refreshRps = expiredRps * collapse.collapseFactor;
    const normalMissRps = trafficRps * (1 - scenario.expiredFraction) * 0.08;
    const originRps = scenario.originAvailable
      ? refreshRps + normalMissRps
      : 0;
    const originShortfallRps = scenario.originAvailable
      ? Math.max(0, originRps - scenario.originCapacityRps)
      : refreshRps + normalMissRps;
    const rejectedRps = staleEligible
      ? Math.min(normalMissRps, originShortfallRps)
      : scenario.originAvailable && originRps > 0
        ? Math.min(
            expiredRps + normalMissRps,
            (expiredRps + normalMissRps) * (originShortfallRps / originRps),
          )
        : expiredRps + normalMissRps;
    const servedRps = Math.max(0, trafficRps - rejectedRps);
    const availability = servedRps / trafficRps;
    const pressure = scenario.originCapacityRps === 0
      ? Number.POSITIVE_INFINITY
      : originRps / scenario.originCapacityRps;
    const latencyMs = staleEligible
      ? 5
      : scenario.originAvailable
        ? Math.min(3000, scenario.originLatencyMs * Math.max(1, pressure))
        : 3000;

    let verdict = 'The cache absorbs the failure pressure';
    let explanation =
      'Grace serves a bounded stale object while Varnish limits refresh work reaching the origin.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (availability < 0.99) {
      verdict = 'Failure: expired demand overwhelms the usable path';
      explanation = scenario.originAvailable
        ? 'The modeled refresh demand exceeds origin capacity. Extend grace, collapse duplicate misses, or invalidate in smaller cohorts.'
        : 'The origin is unavailable and the object is outside its grace window, so Varnish has no acceptable response to serve.';
      tone = 'rose';
    } else if (pressure > 0.75 && !staleEligible) {
      verdict = 'Warning: little origin headroom remains';
      explanation =
        'Requests still succeed in this model, but a larger burst or slower backend would cross capacity.';
      tone = 'amber';
    } else if (scenario.id === 'healthy') {
      verdict = 'Healthy path with measured refresh overhead';
      explanation =
        'Grace is available but not needed. The origin handles bounded misses and refreshes below its modeled capacity.';
      tone = 'emerald';
    }

    return {
      availability,
      explanation,
      latencyMs,
      originRps,
      pressure,
      rejectedRps,
      staleEligible,
      staleRps,
      tone,
      verdict,
    };
  }, [collapse, graceSeconds, scenario, trafficRps]);

  const statusClass = result.tone === 'rose'
    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
    : result.tone === 'amber'
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
      : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50';
  const StatusIcon = result.tone === 'emerald'
    ? CheckCircle2
    : AlertTriangle;

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setCollapseId(model.defaults.collapseId);
    setTrafficRps(model.defaults.trafficRps);
    setGraceSeconds(model.defaults.graceSeconds);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Origin pressure lab"
          title={model.title}
          description={model.description}
          icon={ShieldCheck}
          accent="emerald"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Inject a condition
                </legend>
                <div className="mt-3 space-y-2">
                  {model.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={scenarioId === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.originAvailable ? Activity : CloudOff}
                      accent="emerald"
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Handle duplicate misses
                </legend>
                <div className="mt-3 space-y-2">
                  {model.collapsePolicies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={collapseId === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.collapseFactor < 0.1 ? Layers3 : Flame}
                      accent="amber"
                      onClick={() => setCollapseId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Client traffic"
                value={trafficRps}
                output={`${formatRate(trafficRps)} req/s`}
                min={model.bounds.trafficRps.min}
                max={model.bounds.trafficRps.max}
                step={model.bounds.trafficRps.step}
                lowLabel="Normal"
                highLabel="Flash crowd"
                accent="emerald"
                onChange={setTrafficRps}
              />

              <LabRange
                label="Grace window"
                value={graceSeconds}
                output={graceSeconds === 0 ? 'Disabled' : `${graceSeconds}s`}
                min={model.bounds.graceSeconds.min}
                max={model.bounds.graceSeconds.max}
                step={model.bounds.graceSeconds.step}
                lowLabel="Fresh only"
                highLabel="Stale safety"
                accent="amber"
                onChange={setGraceSeconds}
              />
            </div>
          )}
        >
          <div className="space-y-6">
            <div className={`rounded-md border p-4 ${statusClass}`} role="status">
              <div className="flex items-start gap-3">
                <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">{result.verdict}</p>
                  <p className="mt-1 text-sm leading-6 opacity-80">
                    {result.explanation}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Availability"
                value={`${(result.availability * 100).toFixed(2)}%`}
                detail={`${formatRate(result.rejectedRps)}/s without a usable response`}
                icon={ShieldCheck}
                tone={result.tone}
              />
              <LabMetric
                label="Origin demand"
                value={`${formatRate(result.originRps)}/s`}
                detail={`${formatRate(scenario.originCapacityRps)}/s modeled capacity`}
                icon={Server}
                tone={result.pressure > 1 ? 'rose' : result.pressure > 0.75 ? 'amber' : 'blue'}
              />
              <LabMetric
                label="Response path"
                value={`${Math.round(result.latencyMs)} ms`}
                detail={result.staleEligible ? 'Bounded stale response' : 'Origin or failure timeout'}
                icon={Gauge}
                tone={result.latencyMs > 500 ? 'rose' : result.latencyMs > 100 ? 'amber' : 'emerald'}
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-semibold text-neutral-950 dark:text-white">
                  Expired-object traffic
                </span>
                <span className="text-neutral-500 dark:text-neutral-400">
                  {Math.round(scenario.expiredFraction * 100)}% of the burst
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50">
                  <p className="text-xs font-semibold uppercase opacity-70">Varnish serves</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {formatRate(result.staleRps)}/s stale
                  </p>
                </div>
                <span className="hidden text-neutral-400 sm:block" aria-hidden="true">
                  or
                </span>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50">
                  <p className="text-xs font-semibold uppercase opacity-70">Origin receives</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">
                    {formatRate(result.originRps)}/s
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 border-t border-neutral-200 pt-5 sm:grid-cols-2 dark:border-neutral-800">
              <div>
                <div className="flex items-center gap-2 text-neutral-950 dark:text-white">
                  <TimerReset aria-hidden="true" className="h-4 w-4" />
                  <p className="text-sm font-semibold">Grace decision</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  The modeled object is {scenario.staleAgeSeconds}s beyond TTL.
                  A {graceSeconds}s grace window {result.staleEligible ? 'can' : 'cannot'} serve it.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-neutral-950 dark:text-white">
                  <Layers3 aria-hidden="true" className="h-4 w-4" />
                  <p className="text-sm font-semibold">Collapse decision</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {collapse.detail}
                </p>
              </div>
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {model.notice}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

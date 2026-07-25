'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cookie,
  Gauge,
  KeyRound,
  LoaderCircle,
  Route,
  Server,
  ShieldCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/varnish-cache-policy-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/varnish/data/cache-policy-model.json';

type Bounds = {
  min: number;
  max: number;
  step: number;
};

type RouteProfile = {
  id: string;
  label: string;
  detail: string;
  cacheableFraction: number;
  hitPotential: number;
  privateResponse: boolean;
  originLatencyMs: number;
};

type IdentityPolicy = {
  id: string;
  label: string;
  detail: string;
  eligibleFactor: number;
  keyMultiplier: number;
  passesAuthenticated: boolean;
  normalizesNoise: boolean;
};

type CachePolicyModel = {
  kind: 'varnish-cache-policy';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  defaults: {
    routeId: string;
    policyId: string;
    trafficRps: number;
    ttlSeconds: number;
  };
  bounds: {
    trafficRps: Bounds;
    ttlSeconds: Bounds;
  };
  routes: RouteProfile[];
  policies: IdentityPolicy[];
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

function isRoute(value: unknown): value is RouteProfile {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.label)
    && isNonEmptyString(value.detail)
    && isFiniteNumber(value.cacheableFraction)
    && value.cacheableFraction >= 0
    && value.cacheableFraction <= 1
    && isFiniteNumber(value.hitPotential)
    && value.hitPotential >= 0
    && value.hitPotential <= 1
    && typeof value.privateResponse === 'boolean'
    && isFiniteNumber(value.originLatencyMs)
    && value.originLatencyMs > 0;
}

function isPolicy(value: unknown): value is IdentityPolicy {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.id)
    && isNonEmptyString(value.label)
    && isNonEmptyString(value.detail)
    && isFiniteNumber(value.eligibleFactor)
    && value.eligibleFactor >= 0
    && value.eligibleFactor <= 1
    && isFiniteNumber(value.keyMultiplier)
    && value.keyMultiplier >= 1
    && typeof value.passesAuthenticated === 'boolean'
    && typeof value.normalizesNoise === 'boolean';
}

function isModel(value: unknown): value is CachePolicyModel {
  if (
    !isRecord(value)
    || value.kind !== 'varnish-cache-policy'
    || value.blockId !== BLOCK_ID
    || !isNonEmptyString(value.title)
    || !isNonEmptyString(value.description)
    || !isNonEmptyString(value.notice)
    || !isRecord(value.defaults)
    || !isRecord(value.bounds)
    || !Array.isArray(value.routes)
    || value.routes.length < 3
    || !value.routes.every(isRoute)
    || !Array.isArray(value.policies)
    || value.policies.length < 3
    || !value.policies.every(isPolicy)
  ) {
    return false;
  }

  const defaults = value.defaults;
  const bounds = value.bounds;
  return isNonEmptyString(defaults.routeId)
    && isNonEmptyString(defaults.policyId)
    && isFiniteNumber(defaults.trafficRps)
    && isFiniteNumber(defaults.ttlSeconds)
    && isBounds(bounds.trafficRps)
    && isBounds(bounds.ttlSeconds)
    && defaults.trafficRps >= bounds.trafficRps.min
    && defaults.trafficRps <= bounds.trafficRps.max
    && defaults.ttlSeconds >= bounds.ttlSeconds.min
    && defaults.ttlSeconds <= bounds.ttlSeconds.max
    && value.routes.some((route) => route.id === defaults.routeId)
    && value.policies.some((policy) => policy.id === defaults.policyId)
    && new Set(value.routes.map((route) => route.id)).size === value.routes.length
    && new Set(value.policies.map((policy) => policy.id)).size === value.policies.length;
}

function byId<T extends { id: string }>(items: T[], id: string): T {
  return items.find((item) => item.id === id) ?? items[0];
}

function formatRate(value: number): string {
  return Math.round(value).toLocaleString();
}

export default function VarnishCachePolicyLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<CachePolicyModel | null>(null);
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
          throw new Error('The Varnish cache-policy model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the cache-policy lab.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Cache policy lab"
            title="Decide what one cache object represents"
            description="Loading route, identity, and freshness contracts."
            icon={KeyRound}
            accent="blue"
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
                  className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-neutral-700 dark:text-neutral-100"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
                Loading policy model
              </div>
            )}
          </div>
        </LearningLab>
      </div>
    );
  }

  return <CachePolicyWorkbench model={model} />;
}

function CachePolicyWorkbench({ model }: { model: CachePolicyModel }) {
  const [routeId, setRouteId] = useState(model.defaults.routeId);
  const [policyId, setPolicyId] = useState(model.defaults.policyId);
  const [trafficRps, setTrafficRps] = useState(model.defaults.trafficRps);
  const [ttlSeconds, setTtlSeconds] = useState(model.defaults.ttlSeconds);

  const route = byId(model.routes, routeId);
  const policy = byId(model.policies, policyId);

  const result = useMemo(() => {
    const ttlWarmth = ttlSeconds === 0
      ? 0
      : Math.min(1, Math.log2(ttlSeconds / 15 + 1) / 4);
    const fragmentationPenalty = 1 / Math.sqrt(policy.keyMultiplier);
    const eligibleFraction = route.cacheableFraction * policy.eligibleFactor;
    const hitRate = Math.min(
      0.98,
      route.hitPotential * eligibleFraction * ttlWarmth * fragmentationPenalty,
    );
    const cacheRps = trafficRps * hitRate;
    const originRps = trafficRps - cacheRps;
    const weightedLatency = hitRate * 4
      + (1 - hitRate) * route.originLatencyMs;
    const privateLeakRisk = route.privateResponse
      && !policy.passesAuthenticated
      && ttlSeconds > 0;
    const fragmented = policy.keyMultiplier >= 12;
    const bypassed = ttlSeconds === 0 || policy.eligibleFactor === 0;

    let verdict = 'Safe cache identity with useful origin relief';
    let explanation =
      'The policy excludes authenticated state and keeps the object key narrow enough to reuse responses.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (privateLeakRisk) {
      verdict = 'Unsafe: private responses can share one object';
      explanation =
        'A URL-only key cannot distinguish users. Pass authenticated traffic or prove the response is public before storing it.';
      tone = 'rose';
    } else if (bypassed) {
      verdict = 'Safe, but this route is not accelerated';
      explanation =
        'Every request reaches the origin. That may be correct for private or mutating traffic, but it provides no cache relief.';
      tone = 'amber';
    } else if (fragmented || hitRate < 0.35) {
      verdict = 'The cache key is too fragmented for this workload';
      explanation =
        'Too many cookie or header variants create mostly cold objects. Whitelist only dimensions that truly change the representation.';
      tone = 'amber';
    }

    return {
      cacheRps,
      explanation,
      hitRate,
      originRps,
      privateLeakRisk,
      tone,
      verdict,
      weightedLatency,
    };
  }, [policy, route, trafficRps, ttlSeconds]);

  const statusClass = result.tone === 'rose'
    ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
    : result.tone === 'amber'
      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
      : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50';
  const StatusIcon = result.tone === 'emerald'
    ? CheckCircle2
    : AlertTriangle;

  function reset() {
    setRouteId(model.defaults.routeId);
    setPolicyId(model.defaults.policyId);
    setTrafficRps(model.defaults.trafficRps);
    setTtlSeconds(model.defaults.ttlSeconds);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Cache policy lab"
          title={model.title}
          description={model.description}
          icon={KeyRound}
          accent="blue"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose a route
                </legend>
                <div className="mt-3 space-y-2">
                  {model.routes.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={routeId === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Route}
                      accent="blue"
                      onClick={() => setRouteId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose cache identity
                </legend>
                <div className="mt-3 space-y-2">
                  {model.policies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={policyId === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.passesAuthenticated ? ShieldCheck : Cookie}
                      accent="violet"
                      onClick={() => setPolicyId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Incoming traffic"
                value={trafficRps}
                output={`${formatRate(trafficRps)} req/s`}
                min={model.bounds.trafficRps.min}
                max={model.bounds.trafficRps.max}
                step={model.bounds.trafficRps.step}
                lowLabel="Quiet"
                highLabel="Peak"
                accent="blue"
                onChange={setTrafficRps}
              />

              <LabRange
                label="Fresh TTL"
                value={ttlSeconds}
                output={ttlSeconds === 0 ? 'Bypass' : `${ttlSeconds}s`}
                min={model.bounds.ttlSeconds.min}
                max={model.bounds.ttlSeconds.max}
                step={model.bounds.ttlSeconds.step}
                lowLabel="No storage"
                highLabel="Long reuse"
                accent="violet"
                onChange={setTtlSeconds}
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
                label="Modeled hit rate"
                value={`${(result.hitRate * 100).toFixed(1)}%`}
                detail="Reusable responses served from memory"
                icon={Gauge}
                tone={result.tone}
              />
              <LabMetric
                label="Origin demand"
                value={`${formatRate(result.originRps)}/s`}
                detail={`${formatRate(result.cacheRps)}/s stop at Varnish`}
                icon={Server}
                tone={result.originRps > trafficRps * 0.65 ? 'amber' : 'blue'}
              />
              <LabMetric
                label="Mean path latency"
                value={`${Math.round(result.weightedLatency)} ms`}
                detail="4 ms hit assumption plus route origin latency"
                icon={Route}
                tone={result.weightedLatency > 100 ? 'amber' : 'emerald'}
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-semibold text-neutral-950 dark:text-white">
                  Where requests finish
                </span>
                <span className="text-neutral-500 dark:text-neutral-400">
                  Total {formatRate(trafficRps)}/s
                </span>
              </div>
              <div className="mt-3 h-5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className="h-full bg-emerald-500 transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${result.hitRate * 100}%` }}
                  aria-hidden="true"
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                <span className="font-medium text-emerald-700 dark:text-emerald-300">
                  Cache {formatRate(result.cacheRps)}/s
                </span>
                <span className="text-right font-medium text-neutral-600 dark:text-neutral-300">
                  Origin {formatRate(result.originRps)}/s
                </span>
              </div>
            </div>

            <div className="grid gap-4 border-t border-neutral-200 pt-5 sm:grid-cols-2 dark:border-neutral-800">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Object identity
                </p>
                <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  {policy.keyMultiplier} modeled variant{policy.keyMultiplier === 1 ? '' : 's'} per URL
                </p>
                <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {policy.normalizesNoise
                    ? 'Tracking noise is removed before hashing.'
                    : 'The policy preserves request dimensions that may split reuse.'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Safety boundary
                </p>
                <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
                  {result.privateLeakRisk
                    ? 'User identity is missing from the decision'
                    : 'Private requests do not enter the shared cache'}
                </p>
                <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  Cache eligibility must be decided before a shared object is created.
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

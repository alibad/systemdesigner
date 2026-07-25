'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Boxes,
  CircleAlert,
  Clock3,
  Cpu,
  Gauge,
  Layers3,
  LoaderCircle,
  Server,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type MetricTone = 'neutral' | 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose' | 'blue';

interface TrafficProfile {
  id: string;
  label: string;
  detail: string;
  averageTokens: number;
  tokensPerCoreSecond: number;
  fixedRequestMs: number;
}

interface CapacityBatchingModel {
  blockId: string;
  title: string;
  description: string;
  modelNote: string;
  planningTargetUtilization: number;
  workerCores: number;
  cacheLookupMs: number;
  maximumBatchWaitMs: number;
  defaults: {
    profileId: string;
    requestRate: number;
    batchSize: number;
    cacheHitPercent: number;
    readyWorkers: number;
  };
  profiles: TrafficProfile[];
}

const BLOCK_ID = 'genai/production-tokenization-capacity-batching-lab';
const compact = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCapacityBatchingModel(value: unknown): value is CapacityBatchingModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CapacityBatchingModel>;
  return Boolean(
    candidate.blockId === BLOCK_ID
      && candidate.title
      && candidate.description
      && candidate.modelNote
      && isFiniteNumber(candidate.planningTargetUtilization)
      && candidate.planningTargetUtilization > 0
      && candidate.planningTargetUtilization < 1
      && isFiniteNumber(candidate.workerCores)
      && candidate.workerCores > 0
      && isFiniteNumber(candidate.cacheLookupMs)
      && isFiniteNumber(candidate.maximumBatchWaitMs)
      && candidate.defaults?.profileId
      && isFiniteNumber(candidate.defaults.requestRate)
      && isFiniteNumber(candidate.defaults.batchSize)
      && isFiniteNumber(candidate.defaults.cacheHitPercent)
      && isFiniteNumber(candidate.defaults.readyWorkers)
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length > 0
      && candidate.profiles.every((profile) => (
        typeof profile.id === 'string'
        && typeof profile.label === 'string'
        && typeof profile.detail === 'string'
        && isFiniteNumber(profile.averageTokens)
        && profile.averageTokens > 0
        && isFiniteNumber(profile.tokensPerCoreSecond)
        && profile.tokensPerCoreSecond > 0
        && isFiniteNumber(profile.fixedRequestMs)
        && profile.fixedRequestMs >= 0
      )),
  );
}

export default function ProductionTokenizationCapacityBatchingLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapacityBatchingModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No tokenization capacity model was supplied.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isCapacityBatchingModel(payload)) {
          throw new Error('The tokenization capacity model is incomplete.');
        }
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the capacity lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabState status="error" detail={loadError} />;
  if (!data) return <LabState status="loading" detail="Loading the capacity model..." />;
  return <CapacityBatchingLab data={data} />;
}

function CapacityBatchingLab({ data }: { data: CapacityBatchingModel }) {
  const initialProfile = data.profiles.find(
    (profile) => profile.id === data.defaults.profileId,
  ) ?? data.profiles[0];
  const [profileId, setProfileId] = useState(initialProfile.id);
  const [requestRate, setRequestRate] = useState(data.defaults.requestRate);
  const [batchSize, setBatchSize] = useState(data.defaults.batchSize);
  const [cacheHitPercent, setCacheHitPercent] = useState(data.defaults.cacheHitPercent);
  const [readyWorkers, setReadyWorkers] = useState(data.defaults.readyWorkers);

  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];

  const result = useMemo(() => {
    const cacheFraction = cacheHitPercent / 100;
    const missRate = requestRate * (1 - cacheFraction);
    const hitRate = requestRate - missRate;
    const offeredTokensPerSecond = requestRate * profile.averageTokens;
    const encodedTokensPerSecond = missRate * profile.averageTokens;
    const encodeCores = encodedTokensPerSecond / profile.tokensPerCoreSecond;
    const fixedCores = missRate * (profile.fixedRequestMs / 1000) / batchSize;
    const cacheCores = hitRate * (data.cacheLookupMs / 1000);
    const requiredCores = encodeCores + fixedCores + cacheCores;
    const availableCores = readyWorkers * data.workerCores;
    const planningCores = availableCores * data.planningTargetUtilization;
    const utilization = requiredCores / availableCores;
    const requiredWorkers = Math.max(
      1,
      Math.ceil(requiredCores / (data.workerCores * data.planningTargetUtilization)),
    );
    const batchFillMs = missRate > 0
      ? Math.min(data.maximumBatchWaitMs, ((batchSize - 1) / missRate) * 1000)
      : 0;
    const expectedBatchWidth = missRate > 0
      ? Math.min(
        batchSize,
        Math.max(1, Math.floor((missRate * data.maximumBatchWaitMs) / 1000) + 1),
      )
      : 1;
    const uncachedCpuSeconds = (
      profile.averageTokens / profile.tokensPerCoreSecond
    ) + (profile.fixedRequestMs / 1000 / batchSize);
    const safeRequestRate = (
      planningCores
      / Math.max(
        (1 - cacheFraction) * uncachedCpuSeconds
          + cacheFraction * (data.cacheLookupMs / 1000),
        0.000001,
      )
    );
    const overflowRate = Math.max(0, requestRate - safeRequestRate);
    const encodeMs = (
      profile.averageTokens / profile.tokensPerCoreSecond * 1000
    ) + (profile.fixedRequestMs / batchSize);
    const estimatedP95Ms = batchFillMs + encodeMs * 1.6;

    let verdict = 'Capacity has planned headroom';
    let explanation = `The ${readyWorkers} ready workers can admit the offered load below the ${(data.planningTargetUtilization * 100).toFixed(0)}% planning target.`;
    let tone: MetricTone = 'emerald';

    if (requiredCores > availableCores) {
      verdict = 'Work arrives faster than the workers can encode it';
      explanation = `The queue grows by roughly ${Math.ceil(overflowRate).toLocaleString()} requests/s. Shed work or add ready workers before increasing traffic.`;
      tone = 'rose';
    } else if (requiredCores > planningCores) {
      verdict = 'The hot path is inside hard capacity but outside the safe envelope';
      explanation = `At least ${requiredWorkers} workers are needed to restore burst and deployment headroom.`;
      tone = 'amber';
    } else if (batchFillMs >= data.maximumBatchWaitMs * 0.95 && batchSize > 1) {
      verdict = 'The batch target is spending its full wait budget';
      explanation = `Only about ${expectedBatchWidth} of ${batchSize} slots fill before the timer. A smaller interactive batch reduces queue delay.`;
      tone = 'blue';
    }

    return {
      availableCores,
      batchFillMs,
      encodedTokensPerSecond,
      estimatedP95Ms,
      expectedBatchWidth,
      explanation,
      missRate,
      offeredTokensPerSecond,
      overflowRate,
      planningCores,
      requiredCores,
      requiredWorkers,
      safeRequestRate,
      tone,
      utilization,
      verdict,
    };
  }, [batchSize, cacheHitPercent, data, profile, readyWorkers, requestRate]);

  const reset = () => {
    setProfileId(initialProfile.id);
    setRequestRate(data.defaults.requestRate);
    setBatchSize(data.defaults.batchSize);
    setCacheHitPercent(data.defaults.cacheHitPercent);
    setReadyWorkers(data.defaults.readyWorkers);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Capacity and batching lab"
          title={data.title}
          description={data.description}
          icon={Gauge}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Traffic slice
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === profile.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'chat' ? Zap : item.id === 'documents' ? Layers3 : Boxes}
                      accent={item.id === 'chat' ? 'blue' : item.id === 'documents' ? 'violet' : 'amber'}
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Arrival rate"
                value={requestRate}
                output={`${requestRate.toLocaleString()} req/s`}
                min={200}
                max={10000}
                step={200}
                accent="blue"
                lowLabel="200"
                highLabel="10K"
                onChange={setRequestRate}
              />
              <LabRange
                label="Batch target"
                value={batchSize}
                output={`${batchSize} requests`}
                min={1}
                max={64}
                step={1}
                accent="violet"
                lowLabel="Immediate"
                highLabel="64"
                onChange={setBatchSize}
              />
              <LabRange
                label="Exact cache reuse"
                value={cacheHitPercent}
                output={`${cacheHitPercent}%`}
                min={0}
                max={80}
                step={5}
                accent="emerald"
                lowLabel="Unique"
                highLabel="High reuse"
                onChange={setCacheHitPercent}
              />
              <LabRange
                label="Ready workers"
                value={readyWorkers}
                output={`${readyWorkers}`}
                min={1}
                max={16}
                step={1}
                accent="amber"
                lowLabel="1"
                highLabel="16"
                onChange={setReadyWorkers}
              />
            </div>
          )}
        >
          <div className="min-h-[680px] min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Offered token work"
                value={`${compact.format(result.offeredTokensPerSecond)}/s`}
                detail={`${requestRate.toLocaleString()} req/s x ${profile.averageTokens} average tokens`}
                icon={Activity}
                tone="blue"
              />
              <LabMetric
                label="Encoded after hits"
                value={`${compact.format(result.encodedTokensPerSecond)}/s`}
                detail={`${Math.round(result.missRate).toLocaleString()} cache misses/s`}
                icon={Cpu}
                tone="violet"
              />
              <LabMetric
                label="Required CPU"
                value={`${result.requiredCores.toFixed(1)} cores`}
                detail={`${result.availableCores} hard cores; ${result.planningCores.toFixed(1)} planned`}
                icon={Server}
                tone={result.tone}
              />
              <LabMetric
                label="Estimated p95"
                value={`${result.estimatedP95Ms.toFixed(2)} ms`}
                detail={`${result.batchFillMs.toFixed(2)} ms is batch-fill wait`}
                icon={Clock3}
                tone={result.batchFillMs >= data.maximumBatchWaitMs * 0.95 ? 'amber' : 'cyan'}
              />
            </div>

            <section className="border-y border-neutral-200 py-5 dark:border-neutral-800">
              <h4 className="text-base font-semibold text-neutral-950 dark:text-white">
                Follow one second of offered work
              </h4>
              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-center">
                <PathNode
                  icon={Activity}
                  eyebrow="Arrive"
                  title={`${requestRate.toLocaleString()} requests`}
                  detail={`${compact.format(result.offeredTokensPerSecond)} token operations offered`}
                />
                <PathArrow />
                <PathNode
                  icon={Layers3}
                  eyebrow="Reuse and batch"
                  title={`${Math.round(result.missRate).toLocaleString()} misses`}
                  detail={`Expected batch ${result.expectedBatchWidth}/${batchSize} before the ${data.maximumBatchWaitMs} ms cap`}
                />
                <PathArrow />
                <PathNode
                  icon={Server}
                  eyebrow="Encode"
                  title={`${result.requiredCores.toFixed(1)} core-seconds`}
                  detail={`${result.requiredWorkers} workers needed at the planning target`}
                />
              </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(230px,0.8fr)]">
              <section>
                <div className="flex items-center justify-between gap-4">
                  <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    CPU envelope
                  </h4>
                  <span className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                    {(result.utilization * 100).toFixed(0)}% hard utilization
                  </span>
                </div>
                <div
                  className="mt-3 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800"
                  role="progressbar"
                  aria-label="Required CPU as a share of hard worker capacity"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(100, Math.round(result.utilization * 100))}
                >
                  <div
                    className={`h-full rounded-full ${
                      result.tone === 'rose'
                        ? 'bg-rose-500'
                        : result.tone === 'amber'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, result.utilization * 100)}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                  <span>{result.requiredCores.toFixed(1)} cores used</span>
                  <span>{result.availableCores} hard cores</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  Safe admission is about {Math.floor(result.safeRequestRate).toLocaleString()} req/s
                  for this measured slice. Cache reuse only helps when outputs are exact and safe to
                  share.
                </p>
              </section>

              <section className={`border-l-4 pl-4 ${
                result.tone === 'rose'
                  ? 'border-rose-500'
                  : result.tone === 'amber'
                    ? 'border-amber-500'
                    : result.tone === 'blue'
                      ? 'border-blue-500'
                      : 'border-emerald-500'
              }`}>
                <div className="flex items-center gap-2">
                  {result.tone === 'emerald' ? (
                    <ShieldCheck aria-hidden="true" className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <CircleAlert aria-hidden="true" className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  )}
                  <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Capacity verdict
                  </span>
                </div>
                <h4 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                  {result.verdict}
                </h4>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {result.explanation}
                </p>
              </section>
            </div>

            <p className="border-t border-neutral-200 pt-4 text-xs leading-5 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              {data.modelNote}
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function PathNode({
  icon: Icon,
  eyebrow,
  title,
  detail,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="min-h-32 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {eyebrow}
      </div>
      <p className="mt-2 font-semibold text-neutral-950 dark:text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-300">{detail}</p>
    </div>
  );
}

function PathArrow() {
  return (
    <>
      <ArrowDown aria-hidden="true" className="mx-auto h-5 w-5 text-neutral-400 md:hidden" />
      <ArrowRight aria-hidden="true" className="hidden h-5 w-5 text-neutral-400 md:block" />
    </>
  );
}

function LabState({
  status,
  detail,
}: {
  status: 'loading' | 'error';
  detail: string;
}) {
  const Icon = status === 'loading' ? LoaderCircle : CircleAlert;
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div
            className="flex min-h-56 items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300"
            role={status === 'error' ? 'alert' : 'status'}
          >
            <Icon aria-hidden="true" className="h-5 w-5" />
            {detail}
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Braces,
  CheckCircle2,
  CircleAlert,
  Database,
  Gauge,
  Layers3,
  LoaderCircle,
  Network,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };
type ResolverMode = 'naive' | 'request-batched';
type OperationProfile = {
  id: string;
  label: string;
  detail: string;
  defaultRequestsPerSecond: number;
  defaultPageSize: number;
  fixedCost: number;
  perItemCost: number;
  baseBackendCalls: number;
  naiveCallsPerItem: number;
  batchedCallsPerOperation: number;
  fixedResponseBytes: number;
  responseBytesPerItem: number;
};
type OperationBudgetData = {
  title: string;
  description: string;
  limits: {
    maxOperationCost: number;
    maxBackendCallsPerSecond: number;
    warningUtilizationPct: number;
  };
  bounds: {
    requestsPerSecond: Bound;
    pageSize: Bound;
  };
  profiles: OperationProfile[];
};

const BLOCK_ID = 'technology/graphql-performance';
const DEFAULT_DATA_FILE = '/api/content/technology/graphql/data/operation-budget-model.json';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<Bound>;
  return isFiniteNumber(candidate.min)
    && isFiniteNumber(candidate.max)
    && isFiniteNumber(candidate.step);
}

function isProfile(value: unknown): value is OperationProfile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OperationProfile>;
  return Boolean(
    candidate.id
      && candidate.label
      && candidate.detail
      && isFiniteNumber(candidate.defaultRequestsPerSecond)
      && isFiniteNumber(candidate.defaultPageSize)
      && isFiniteNumber(candidate.fixedCost)
      && isFiniteNumber(candidate.perItemCost)
      && isFiniteNumber(candidate.baseBackendCalls)
      && isFiniteNumber(candidate.naiveCallsPerItem)
      && isFiniteNumber(candidate.batchedCallsPerOperation)
      && isFiniteNumber(candidate.fixedResponseBytes)
      && isFiniteNumber(candidate.responseBytesPerItem),
  );
}

function isOperationBudgetData(value: unknown): value is OperationBudgetData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OperationBudgetData>;
  const limits = candidate.limits;
  const bounds = candidate.bounds;
  return Boolean(
    candidate.title
      && candidate.description
      && limits
      && isFiniteNumber(limits.maxOperationCost)
      && isFiniteNumber(limits.maxBackendCallsPerSecond)
      && isFiniteNumber(limits.warningUtilizationPct)
      && bounds
      && isBound(bounds.requestsPerSecond)
      && isBound(bounds.pageSize)
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length >= 2
      && candidate.profiles.every(isProfile),
  );
}

function compact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatBytes(value: number) {
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / 1024 ** 2).toFixed(1)} MiB`;
}

export default function GraphqlPerformance({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<OperationBudgetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [profileId, setProfileId] = useState('');
  const [requestsPerSecond, setRequestsPerSecond] = useState(800);
  const [pageSize, setPageSize] = useState(20);
  const [resolverMode, setResolverMode] = useState<ResolverMode>('request-batched');

  function applyProfile(profile: OperationProfile) {
    setProfileId(profile.id);
    setRequestsPerSecond(profile.defaultRequestsPerSecond);
    setPageSize(profile.defaultPageSize);
    setResolverMode('request-batched');
  }

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isOperationBudgetData(payload)) {
          throw new Error('The GraphQL operation model is incomplete.');
        }
        setData(payload);
        applyProfile(payload.profiles[0]);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setData(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the operation model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  const result = useMemo(() => {
    if (!data) return null;
    const profile = data.profiles.find((candidate) => candidate.id === profileId)
      ?? data.profiles[0];
    const operationCost = profile.fixedCost + pageSize * profile.perItemCost;
    const backendCallsPerOperation = profile.baseBackendCalls + (
      resolverMode === 'naive'
        ? pageSize * profile.naiveCallsPerItem
        : profile.batchedCallsPerOperation
    );
    const naiveBackendCallsPerOperation = profile.baseBackendCalls
      + pageSize * profile.naiveCallsPerItem;
    const backendCallsPerSecond = requestsPerSecond * backendCallsPerOperation;
    const responseBytes = profile.fixedResponseBytes + pageSize * profile.responseBytesPerItem;
    const costUtilizationPct = (operationCost / data.limits.maxOperationCost) * 100;
    const backendUtilizationPct = (
      backendCallsPerSecond / data.limits.maxBackendCallsPerSecond
    ) * 100;
    const avoidedBackendCallsPerSecond = Math.max(
      0,
      requestsPerSecond * (naiveBackendCallsPerOperation - backendCallsPerOperation),
    );

    if (operationCost > data.limits.maxOperationCost) {
      return {
        operationCost,
        backendCallsPerOperation,
        backendCallsPerSecond,
        responseBytes,
        costUtilizationPct,
        backendUtilizationPct,
        avoidedBackendCallsPerSecond,
        status: 'Reject before resolver execution',
        tone: 'rose' as const,
        verdict: `The modeled cost is ${operationCost} points, above the ${data.limits.maxOperationCost}-point admission limit. Return a request error before any resolver contacts a backend.`,
      };
    }

    if (backendUtilizationPct > 100) {
      return {
        operationCost,
        backendCallsPerOperation,
        backendCallsPerSecond,
        responseBytes,
        costUtilizationPct,
        backendUtilizationPct,
        avoidedBackendCallsPerSecond,
        status: 'The resolver path overloads its dependencies',
        tone: 'rose' as const,
        verdict: `Admitted traffic creates ${compact(backendCallsPerSecond)} modeled backend calls per second, above the ${compact(data.limits.maxBackendCallsPerSecond)} call envelope. Query admission alone is not enough; batch access or reduce fan-out.`,
      };
    }

    if (
      costUtilizationPct >= data.limits.warningUtilizationPct
      || backendUtilizationPct >= data.limits.warningUtilizationPct
    ) {
      return {
        operationCost,
        backendCallsPerOperation,
        backendCallsPerSecond,
        responseBytes,
        costUtilizationPct,
        backendUtilizationPct,
        avoidedBackendCallsPerSecond,
        status: 'Admitted with narrow operating headroom',
        tone: 'amber' as const,
        verdict: 'The operation is inside both modeled limits, but one budget is above the warning threshold. Measure real resolver and backend saturation before raising either limit.',
      };
    }

    return {
      operationCost,
      backendCallsPerOperation,
      backendCallsPerSecond,
      responseBytes,
      costUtilizationPct,
      backendUtilizationPct,
      avoidedBackendCallsPerSecond,
      status: 'Admitted with modeled headroom',
      tone: 'emerald' as const,
      verdict: 'The operation fits the declared cost limit and the modeled backend call envelope. Production admission still needs measured field weights, timeouts, authorization, and per-client budgets.',
    };
  }, [data, pageSize, profileId, requestsPerSecond, resolverMode]);

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Operation budget lab"
          title={data?.title ?? 'Can this selection set enter the executor?'}
          description={data?.description ?? 'Loading the GraphQL operation model.'}
          icon={Braces}
          accent="violet"
          onReset={data ? () => applyProfile(data.profiles[0]) : undefined}
        />

        {!data || !result ? (
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Operation shape
                  </legend>
                  <div className="mt-3 grid gap-2">
                    {data.profiles.map((profile) => (
                      <LabChoice
                        key={profile.id}
                        selected={profile.id === profileId}
                        label={profile.label}
                        detail={profile.detail}
                        icon={Layers3}
                        accent={profile.id === 'account-dashboard' ? 'cyan' : profile.id === 'search-results' ? 'amber' : 'violet'}
                        onClick={() => applyProfile(profile)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Incoming operations"
                  value={requestsPerSecond}
                  output={`${compact(requestsPerSecond)}/s`}
                  {...data.bounds.requestsPerSecond}
                  accent="blue"
                  lowLabel="Steady"
                  highLabel="Peak"
                  onChange={(value) => setRequestsPerSecond(value)}
                />
                <LabRange
                  label="Requested list size"
                  value={pageSize}
                  output={`${pageSize} items`}
                  {...data.bounds.pageSize}
                  accent="amber"
                  lowLabel="Bounded"
                  highLabel="Broad"
                  onChange={(value) => setPageSize(value)}
                />

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Resolver access
                  </legend>
                  <div className="mt-3 grid gap-2">
                    <LabChoice
                      selected={resolverMode === 'naive'}
                      label="Naive per-item loads"
                      detail="Each list item can issue its own dependent reads."
                      icon={Network}
                      accent="rose"
                      onClick={() => setResolverMode('naive')}
                    />
                    <LabChoice
                      selected={resolverMode === 'request-batched'}
                      label="Request-scoped batching"
                      detail="Collect compatible keys and fetch them together for this request."
                      icon={Database}
                      accent="emerald"
                      onClick={() => setResolverMode('request-batched')}
                    />
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="space-y-6" aria-live="polite">
              <div className={`rounded-md border p-5 ${result.tone === 'rose' ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100' : result.tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'}`}>
                <div className="flex items-start gap-3">
                  {result.tone === 'emerald' ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    <p className="text-xs font-semibold uppercase opacity-75">Admission verdict</p>
                    <h4 className="mt-1 text-xl font-semibold">{result.status}</h4>
                    <p className="mt-2 text-sm leading-6 opacity-80">{result.verdict}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric label="Operation cost" value={`${result.operationCost} pts`} detail={`${Math.round(result.costUtilizationPct)}% of the admission limit`} icon={Gauge} tone={result.costUtilizationPct > 100 ? 'rose' : result.costUtilizationPct >= data.limits.warningUtilizationPct ? 'amber' : 'violet'} />
                <LabMetric label="Backend calls" value={`${result.backendCallsPerOperation}/op`} detail={`${compact(result.backendCallsPerSecond)} calls/s at current traffic`} icon={Database} tone={result.backendUtilizationPct > 100 ? 'rose' : result.backendUtilizationPct >= data.limits.warningUtilizationPct ? 'amber' : 'cyan'} />
                <LabMetric label="Response estimate" value={formatBytes(result.responseBytes)} detail="Selected payload before transport compression" icon={Braces} tone="blue" />
                <LabMetric label="Calls avoided" value={`${compact(result.avoidedBackendCallsPerSecond)}/s`} detail="Compared with this profile's naive resolver path" icon={CheckCircle2} tone={result.avoidedBackendCallsPerSecond > 0 ? 'emerald' : 'neutral'} />
              </div>

              <BudgetBar
                label="Schema cost budget"
                value={result.operationCost}
                limit={data.limits.maxOperationCost}
                utilizationPct={result.costUtilizationPct}
              />
              <BudgetBar
                label="Backend call envelope"
                value={result.backendCallsPerSecond}
                limit={data.limits.maxBackendCallsPerSecond}
                utilizationPct={result.backendUtilizationPct}
                compactValues
              />

              <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm leading-6">
                  These are design weights, not portable GraphQL benchmarks. Calibrate field cost from traces, cap every list independently, and create batching loaders per request so cached values cannot cross users or authorization contexts.
                </p>
              </div>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function BudgetBar({
  label,
  value,
  limit,
  utilizationPct,
  compactValues = false,
}: {
  label: string;
  value: number;
  limit: number;
  utilizationPct: number;
  compactValues?: boolean;
}) {
  const barWidth = Math.min(100, utilizationPct);
  const tone = utilizationPct > 100
    ? 'bg-rose-500'
    : utilizationPct >= 75
      ? 'bg-amber-500'
      : 'bg-emerald-500';
  const format = (number: number) => compactValues ? compact(number) : Math.round(number).toString();

  return (
    <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{label}</p>
          <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
            {format(value)} of {format(limit)}
          </p>
        </div>
        <span className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-300">
          {Math.round(utilizationPct)}%
        </span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${tone}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </section>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex min-h-64 items-center justify-center p-6">
      {error ? (
        <div className="max-w-md text-center">
          <CircleAlert aria-hidden="true" className="mx-auto h-8 w-8 text-rose-500" />
          <p className="mt-3 font-semibold text-neutral-950 dark:text-white">Operation model unavailable</p>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-400">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-white dark:text-neutral-950"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
          Loading operation budget
        </div>
      )}
    </div>
  );
}

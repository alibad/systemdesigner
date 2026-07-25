'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeDollarSign,
  Ban,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  Route,
  ShieldAlert,
  ShieldCheck,
  TimerReset,
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

type OutcomeStatus = 'available' | 'blocked' | 'degraded' | 'unsafe';

type FailureOutcome = {
  status: OutcomeStatus;
  title: string;
  detail: string;
};

type Policy = {
  id: string;
  label: string;
  detail: string;
};

type Failure = {
  id: string;
  label: string;
  detail: string;
  outcomes: Record<string, FailureOutcome>;
};

type ModelTier = {
  id: string;
  label: string;
  detail: string;
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  firstTokenLatencyMs: number;
  outputTokensPerSecond: number;
};

type RequestEnvelopeData = {
  title: string;
  description: string;
  evidenceNote: string;
  defaultTierId: string;
  defaultFailureId: string;
  defaultPolicyId: string;
  defaultInputTokens: number;
  defaultOutputTokens: number;
  defaultRequestsPerMinute: number;
  monthlyBudgetUsd: number;
  latencyTargetMs: number;
  daysPerMonth: number;
  fixedStageLatencyMs: {
    gateway: number;
    retrieval: number;
    safety: number;
  };
  tiers: ModelTier[];
  policies: Policy[];
  failures: Failure[];
};

function isRequestEnvelopeData(value: unknown): value is RequestEnvelopeData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RequestEnvelopeData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.evidenceNote
      && candidate.defaultTierId
      && candidate.defaultFailureId
      && candidate.defaultPolicyId
      && typeof candidate.defaultInputTokens === 'number'
      && typeof candidate.defaultOutputTokens === 'number'
      && typeof candidate.defaultRequestsPerMinute === 'number'
      && typeof candidate.monthlyBudgetUsd === 'number'
      && typeof candidate.latencyTargetMs === 'number'
      && typeof candidate.daysPerMonth === 'number'
      && candidate.fixedStageLatencyMs
      && typeof candidate.fixedStageLatencyMs.gateway === 'number'
      && typeof candidate.fixedStageLatencyMs.retrieval === 'number'
      && typeof candidate.fixedStageLatencyMs.safety === 'number'
      && Array.isArray(candidate.tiers)
      && candidate.tiers.length > 0
      && candidate.tiers.every((tier) => (
        Boolean(tier.id && tier.label)
          && tier.outputTokensPerSecond > 0
          && tier.firstTokenLatencyMs >= 0
      ))
      && Array.isArray(candidate.policies)
      && candidate.policies.length > 0
      && candidate.policies.every((policy) => Boolean(policy.id && policy.label))
      && Array.isArray(candidate.failures)
      && candidate.failures.length > 0
      && candidate.failures.every((failure) => (
        Boolean(failure.id && failure.label && failure.outcomes)
      )),
  );
}

export default function GenaiRequestEnvelopeLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RequestEnvelopeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No request-envelope evidence was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isRequestEnvelopeData(payload)) {
          throw new Error('Request-envelope data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the request lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (error) {
    return (
      <LoadState
        error={error}
        title="Request lab unavailable"
        onRetry={() => setReloadKey((key) => key + 1)}
      />
    );
  }

  if (!data) {
    return <LoadState error={null} title="Loading request evidence" onRetry={() => undefined} />;
  }

  return <RequestEnvelopeLab data={data} />;
}

function RequestEnvelopeLab({ data }: { data: RequestEnvelopeData }) {
  const defaultTier = data.tiers.find((tier) => tier.id === data.defaultTierId)
    ?? data.tiers[0];
  const defaultFailure = data.failures.find((failure) => failure.id === data.defaultFailureId)
    ?? data.failures[0];
  const defaultPolicy = data.policies.find((policy) => policy.id === data.defaultPolicyId)
    ?? data.policies[0];

  const [tierId, setTierId] = useState(defaultTier.id);
  const [failureId, setFailureId] = useState(defaultFailure.id);
  const [policyId, setPolicyId] = useState(defaultPolicy.id);
  const [inputTokens, setInputTokens] = useState(data.defaultInputTokens);
  const [outputTokens, setOutputTokens] = useState(data.defaultOutputTokens);
  const [requestsPerMinute, setRequestsPerMinute] = useState(data.defaultRequestsPerMinute);

  const tier = data.tiers.find((item) => item.id === tierId) ?? data.tiers[0];
  const failure = data.failures.find((item) => item.id === failureId) ?? data.failures[0];
  const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];
  const outcome = failure.outcomes[policy.id] ?? {
    status: 'unsafe' as const,
    title: 'Missing failure policy',
    detail: 'The selected failure has no declared outcome for this policy.',
  };

  const result = useMemo(() => {
    const inputUsd = inputTokens * tier.inputUsdPerMillionTokens / 1_000_000;
    const outputUsd = outputTokens * tier.outputUsdPerMillionTokens / 1_000_000;
    const perRequestUsd = inputUsd + outputUsd;
    const requestsPerMonth = requestsPerMinute * 60 * 24 * data.daysPerMonth;
    const monthlyUsd = perRequestUsd * requestsPerMonth;
    const fixedLatencyMs = (
      data.fixedStageLatencyMs.gateway
      + data.fixedStageLatencyMs.retrieval
      + data.fixedStageLatencyMs.safety
    );
    const generationMs = outputTokens / tier.outputTokensPerSecond * 1000;
    const planningLatencyMs = fixedLatencyMs + tier.firstTokenLatencyMs + generationMs;
    const estimatedConcurrency = Math.max(
      1,
      Math.ceil(requestsPerMinute * (planningLatencyMs / 1000) / 60),
    );

    return {
      estimatedConcurrency,
      fixedLatencyMs,
      generationMs,
      inputUsd,
      latencyPass: planningLatencyMs <= data.latencyTargetMs,
      monthlyPass: monthlyUsd <= data.monthlyBudgetUsd,
      monthlyUsd,
      outputUsd,
      perRequestUsd,
      planningLatencyMs,
      requestsPerMonth,
    };
  }, [data, inputTokens, outputTokens, requestsPerMinute, tier]);

  const outcomeIcon = {
    available: CheckCircle2,
    blocked: Ban,
    degraded: TriangleAlert,
    unsafe: ShieldAlert,
  }[outcome.status];

  function reset() {
    setTierId(defaultTier.id);
    setFailureId(defaultFailure.id);
    setPolicyId(defaultPolicy.id);
    setInputTokens(data.defaultInputTokens);
    setOutputTokens(data.defaultOutputTokens);
    setRequestsPerMinute(data.defaultRequestsPerMinute);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Token, latency, and failure lab"
        title={data.title}
        description={data.description}
        icon={Activity}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Choose a model tier
              </legend>
              <div className="mt-3 space-y-2">
                {data.tiers.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === tier.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Gauge}
                    accent="cyan"
                    onClick={() => setTierId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <div className="space-y-6">
              <LabRange
                label="Input tokens"
                value={inputTokens}
                output={inputTokens.toLocaleString()}
                min={500}
                max={16000}
                step={500}
                lowLabel="500"
                highLabel="16,000"
                accent="blue"
                onChange={setInputTokens}
              />
              <LabRange
                label="Maximum output tokens"
                value={outputTokens}
                output={outputTokens.toLocaleString()}
                min={60}
                max={1800}
                step={60}
                lowLabel="60"
                highLabel="1,800"
                accent="violet"
                onChange={setOutputTokens}
              />
              <LabRange
                label="Requests per minute"
                value={requestsPerMinute}
                output={`${requestsPerMinute} rpm`}
                min={1}
                max={100}
                step={1}
                lowLabel="1"
                highLabel="100"
                accent="emerald"
                onChange={setRequestsPerMinute}
              />
            </div>

            <label className="block">
              <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Inject a dependency state
              </span>
              <select
                value={failure.id}
                onChange={(event) => setFailureId(event.target.value)}
                className="mt-3 w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-950 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
              >
                {data.failures.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
              <span className="mt-2 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                {failure.detail}
              </span>
            </label>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Choose failure behavior
              </legend>
              <div className="mt-3 space-y-2">
                {data.policies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === policy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={ShieldCheck}
                    accent={item.id === 'fail-open' ? 'rose' : 'emerald'}
                    onClick={() => setPolicyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Cost per request"
            value={formatUsd(result.perRequestUsd, 5)}
            detail={`${formatUsd(result.inputUsd, 5)} input + ${formatUsd(result.outputUsd, 5)} output`}
            icon={BadgeDollarSign}
            tone="blue"
          />
          <LabMetric
            label="Monthly planning cost"
            value={formatUsd(result.monthlyUsd, 0)}
            detail={`Budget: ${formatUsd(data.monthlyBudgetUsd, 0)}`}
            icon={BadgeDollarSign}
            tone={result.monthlyPass ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Planning latency"
            value={`${Math.round(result.planningLatencyMs).toLocaleString()} ms`}
            detail={`Target: at most ${data.latencyTargetMs.toLocaleString()} ms`}
            icon={Clock3}
            tone={result.latencyPass ? 'emerald' : 'rose'}
          />
          <LabMetric
            label="Concurrency floor"
            value={`${result.estimatedConcurrency}`}
            detail="Little's Law estimate; no queue reserve included"
            icon={Activity}
            tone="violet"
          />
        </div>

        <section
          className={`mt-5 rounded-md border p-5 ${
            outcome.status === 'available'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50'
              : outcome.status === 'blocked'
                ? 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50'
                : outcome.status === 'degraded'
                  ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50'
                  : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
          }`}
        >
          <div className="flex items-start gap-3">
            {(() => {
              const OutcomeIcon = outcomeIcon;
              return <OutcomeIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />;
            })()}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase opacity-75">
                {failure.label} · {policy.label}
              </p>
              <h4 className="mt-2 text-lg font-semibold">{outcome.title}</h4>
              <p className="mt-2 text-sm leading-6 opacity-85">{outcome.detail}</p>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-center gap-2">
              <BadgeDollarSign aria-hidden="true" className="h-4 w-4 text-blue-600 dark:text-blue-300" />
              <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Token cost trace
              </h4>
            </div>
            <p className="mt-3 break-words font-mono text-xs leading-6 text-neutral-600 dark:text-neutral-300">
              (({inputTokens.toLocaleString()} × ${tier.inputUsdPerMillionTokens}) + ({outputTokens.toLocaleString()} × ${tier.outputUsdPerMillionTokens})) ÷ 1,000,000
            </p>
            <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              {result.requestsPerMonth.toLocaleString()} requests/month at {requestsPerMinute} rpm for {data.daysPerMonth} days.
            </p>
          </div>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex items-center gap-2">
              <TimerReset aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />
              <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                Latency trace
              </h4>
            </div>
            <p className="mt-3 break-words font-mono text-xs leading-6 text-neutral-600 dark:text-neutral-300">
              {result.fixedLatencyMs} ms fixed + {tier.firstTokenLatencyMs} ms first token + {Math.round(result.generationMs).toLocaleString()} ms generation
            </p>
            <p className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Queueing, retries, network variance, and downstream tools are deliberately excluded.
            </p>
          </div>
        </section>

        <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
          <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {data.evidenceNote}
        </p>
      </LearningLabBody>
    </LearningLab>
  );
}

function formatUsd(value: number, maximumFractionDigits: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits > 0 ? Math.min(2, maximumFractionDigits) : 0,
  }).format(value);
}

function LoadState({
  error,
  title,
  onRetry,
}: {
  error: string | null;
  title: string;
  onRetry: () => void;
}) {
  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Token, latency, and failure lab"
        title={title}
        description={error ?? 'Loading the co-located request evidence.'}
        icon={Activity}
        accent={error ? 'rose' : 'cyan'}
        onReset={error ? onRetry : undefined}
      />
    </LearningLab>
  );
}

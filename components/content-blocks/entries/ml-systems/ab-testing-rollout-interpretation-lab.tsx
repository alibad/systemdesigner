'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Gauge,
  Layers3,
  Rocket,
  ShieldCheck,
  Target,
  TriangleAlert,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/ab-testing/data/rollout-evidence.json';
const BLOCK_ID = 'ml-systems/ab-testing-rollout-interpretation-lab';

type EvidencePolicy = {
  id: string;
  label: string;
  detail: string;
  minimumSegmentSharePct: number;
};

type SegmentResult = {
  id: string;
  label: string;
  sharePct: number;
  liftPctPoints: number;
  lowerBoundPctPoints: number;
};

type GuardrailLimit = {
  id: string;
  label: string;
  unit: string;
  maximumDelta: number;
};

type GuardrailResult = {
  id: string;
  delta: number;
};

type EvidenceScenario = {
  id: string;
  label: string;
  detail: string;
  aggregateLiftPctPoints: number;
  aggregateLowerBoundPctPoints: number;
  segments: SegmentResult[];
  guardrails: GuardrailResult[];
};

type RolloutData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    policyId: string;
    requestedRolloutPct: number;
  };
  populationPerDay: number;
  policies: EvidencePolicy[];
  guardrailLimits: GuardrailLimit[];
  scenarios: EvidenceScenario[];
};

function isRolloutData(value: unknown): value is RolloutData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<RolloutData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && typeof data.populationPerDay === 'number'
      && data.defaults
      && Array.isArray(data.policies)
      && data.policies.length > 0
      && data.policies.every((policy) => (
        typeof policy.id === 'string' && typeof policy.minimumSegmentSharePct === 'number'
      ))
      && Array.isArray(data.guardrailLimits)
      && data.guardrailLimits.length > 0
      && Array.isArray(data.scenarios)
      && data.scenarios.length > 0
      && data.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.aggregateLiftPctPoints === 'number'
        && typeof scenario.aggregateLowerBoundPctPoints === 'number'
        && Array.isArray(scenario.segments)
        && scenario.segments.length > 0
        && Array.isArray(scenario.guardrails)
      )),
  );
}

function signed(value: number, unit = ' pp') {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}${unit}`;
}

export default function AbTestingRolloutInterpretationLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<RolloutData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('');
  const [policyId, setPolicyId] = useState('');
  const [requestedRollout, setRequestedRollout] = useState(25);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isRolloutData(payload)) throw new Error('Rollout evidence data is incomplete.');
        setData(payload);
        setScenarioId(payload.defaults.scenarioId);
        setPolicyId(payload.defaults.policyId);
        setRequestedRollout(payload.defaults.requestedRolloutPct);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load rollout evidence.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const scenario = data?.scenarios.find((item) => item.id === scenarioId)
    ?? data?.scenarios[0];
  const policy = data?.policies.find((item) => item.id === policyId)
    ?? data?.policies[0];

  const result = useMemo(() => {
    if (!data || !scenario || !policy) return null;

    const guardrails = data.guardrailLimits.map((limit) => {
      const observed = scenario.guardrails.find((item) => item.id === limit.id)?.delta;
      const missing = typeof observed !== 'number';
      const failed = missing || observed > limit.maximumDelta;
      return { ...limit, observed: observed ?? 0, failed, missing };
    });
    const failedGuardrails = guardrails.filter((item) => item.failed);
    const harmfulSegments = scenario.segments.filter((segment) => segment.lowerBoundPctPoints < 0);
    const protectedHarm = harmfulSegments.filter(
      (segment) => segment.sharePct >= policy.minimumSegmentSharePct,
    );
    const aggregatePass = scenario.aggregateLowerBoundPctPoints > 0;
    const blindSpot = harmfulSegments.length > 0 && protectedHarm.length === 0;
    const exposedUnits = Math.round(data.populationPerDay * requestedRollout / 100);
    const harmfulShare = harmfulSegments.reduce((sum, segment) => sum + segment.sharePct, 0);
    const atRiskUnits = Math.round(exposedUnits * harmfulShare / 100);

    const maximumRollout = failedGuardrails.length > 0
      ? 0
      : protectedHarm.length > 0
        ? 5
        : !aggregatePass
          ? 10
          : blindSpot
            ? 25
            : 50;
    const requestedAllowed = requestedRollout <= maximumRollout && maximumRollout > 0;

    const verdict = failedGuardrails.length > 0
      ? {
          title: 'Stop exposure and restore the safe serving path',
          detail: `${failedGuardrails.map((item) => item.label).join(', ')} crossed an independent limit. Primary lift cannot purchase a guardrail breach.`,
          tone: 'rose' as const,
        }
      : protectedHarm.length > 0
        ? {
            title: 'Hold expansion and repair the harmed segment',
            detail: `${protectedHarm.map((item) => item.label).join(', ')} meets this policy's materiality rule and still has credible downside. Isolate the cause or target the treatment before broader exposure.`,
            tone: 'rose' as const,
          }
        : !aggregatePass
          ? {
              title: 'Keep a small canary while evidence matures',
              detail: 'The aggregate interval still includes no improvement. More independent evidence, not a wider rollout, should resolve the decision.',
              tone: 'amber' as const,
            }
          : blindSpot
            ? {
                title: 'The selected policy permits a dangerous blind spot',
                detail: `${harmfulSegments.map((item) => item.label).join(', ')} is harmed, but this policy ignores that segment. The apparent approval exposes ${atRiskUnits.toLocaleString()} affected units per day at the requested rollout.`,
                tone: 'amber' as const,
              }
            : requestedAllowed
              ? {
                  title: `Approve a staged rollout to ${requestedRollout}%`,
                  detail: 'Aggregate, segment, and guardrail evidence all pass. Preserve abort signals and require another checkpoint before full exposure.',
                  tone: 'emerald' as const,
                }
              : {
                  title: `Cap this checkpoint at ${maximumRollout}%`,
                  detail: 'The evidence is healthy, but one experiment should not jump directly to unrestricted exposure. Expand in bounded stages with fresh live guardrail checks.',
                  tone: 'amber' as const,
                };

    return {
      aggregatePass,
      atRiskUnits,
      blindSpot,
      exposedUnits,
      failedGuardrails,
      guardrails,
      harmfulSegments,
      maximumRollout,
      protectedHarm,
      requestedAllowed,
      verdict,
    };
  }, [data, policy, requestedRollout, scenario]);

  function reset() {
    if (!data) return;
    setScenarioId(data.defaults.scenarioId);
    setPolicyId(data.defaults.policyId);
    setRequestedRollout(data.defaults.requestedRolloutPct);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Rollout interpretation lab"
          title={data?.title ?? 'Decide how far conflicting evidence may travel'}
          description={data?.description ?? 'Loading aggregate, segment, and guardrail evidence...'}
          icon={Layers3}
          accent="cyan"
          onReset={data ? reset : undefined}
        />

        {!data || !scenario || !policy || !result ? (
          <LoadState error={error} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Observed evidence
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.scenarios.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === scenario.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'latency-breach' ? Activity : Target}
                        accent={item.id === 'broad-win' ? 'emerald' : item.id === 'latency-breach' ? 'rose' : 'amber'}
                        onClick={() => setScenarioId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Segment policy
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.policies.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === policy.id}
                        label={item.label}
                        detail={item.detail}
                        icon={ShieldCheck}
                        accent={item.id === 'aggregate-only' ? 'amber' : item.id === 'protect-every-slice' ? 'violet' : 'blue'}
                        onClick={() => setPolicyId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="3. Requested rollout"
                  value={requestedRollout}
                  output={`${requestedRollout}%`}
                  min={5}
                  max={100}
                  step={5}
                  accent="cyan"
                  lowLabel="Small canary"
                  highLabel="Full population"
                  onChange={setRequestedRollout}
                />
              </div>
            )}
          >
            <div className="min-h-[720px] min-w-0 space-y-6" aria-live="polite">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="Aggregate lift"
                  value={signed(scenario.aggregateLiftPctPoints)}
                  detail={`95% lower bound ${signed(scenario.aggregateLowerBoundPctPoints)}`}
                  icon={Gauge}
                  tone={result.aggregatePass ? 'emerald' : 'amber'}
                />
                <LabMetric
                  label="Failed guardrails"
                  value={`${result.failedGuardrails.length}`}
                  detail={`${result.guardrails.length} hard limits evaluated`}
                  icon={ShieldCheck}
                  tone={result.failedGuardrails.length > 0 ? 'rose' : 'emerald'}
                />
                <LabMetric
                  label="Maximum safe rollout"
                  value={`${result.maximumRollout}%`}
                  detail={result.maximumRollout === 0 ? 'Rollback or stop exposure' : 'Modeled checkpoint under this policy'}
                  icon={Rocket}
                  tone={result.maximumRollout === 0 ? 'rose' : result.maximumRollout < requestedRollout ? 'amber' : 'blue'}
                />
                <LabMetric
                  label="Harmed units exposed"
                  value={result.atRiskUnits.toLocaleString()}
                  detail={`Per ${result.exposedUnits.toLocaleString()} candidate exposures each day`}
                  icon={Users}
                  tone={result.atRiskUnits > 0 ? 'rose' : 'emerald'}
                />
              </div>

              <section aria-label="Segment evidence">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Segment evidence
                </p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                  The global average is a weighted blend, not a safety guarantee
                </h4>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {scenario.segments.map((segment) => {
                    const harmed = segment.lowerBoundPctPoints < 0;
                    const protectedByPolicy = segment.sharePct >= policy.minimumSegmentSharePct;
                    return (
                      <article
                        key={segment.id}
                        className={`rounded-md border p-4 ${
                          harmed
                            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h5 className="font-semibold">{segment.label}</h5>
                            <p className="mt-1 text-xs opacity-75">{segment.sharePct}% of traffic</p>
                          </div>
                          {harmed ? (
                            <TriangleAlert aria-hidden="true" className="h-5 w-5 shrink-0" />
                          ) : (
                            <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />
                          )}
                        </div>
                        <div className="mt-4 flex items-end justify-between gap-4 border-t border-current/15 pt-3">
                          <div>
                            <span className="block text-xs font-semibold uppercase opacity-65">Observed lift</span>
                            <strong className="mt-1 block text-xl tabular-nums">{signed(segment.liftPctPoints)}</strong>
                          </div>
                          <div className="text-right">
                            <span className="block text-xs font-semibold uppercase opacity-65">Lower bound</span>
                            <strong className="mt-1 block text-xl tabular-nums">{signed(segment.lowerBoundPctPoints)}</strong>
                          </div>
                        </div>
                        <p className="mt-3 text-xs leading-5 opacity-80">
                          {protectedByPolicy
                            ? 'This policy lets the segment constrain rollout.'
                            : 'This policy excludes the segment from the rollout gate.'}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section aria-label="Guardrail evidence">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Independent guardrails
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {result.guardrails.map((guardrail) => (
                    <div
                      key={guardrail.id}
                      className={`rounded-md border p-4 ${
                        guardrail.failed
                          ? 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
                          : 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/70'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {guardrail.failed ? (
                          <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-300" />
                        ) : (
                          <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                        )}
                        <h5 className="text-sm font-semibold text-neutral-950 dark:text-white">
                          {guardrail.label}
                        </h5>
                      </div>
                      <p className="mt-3 text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">
                        {guardrail.missing ? 'Missing' : signed(guardrail.observed, guardrail.unit)}
                      </p>
                      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                        Maximum allowed: +{guardrail.maximumDelta.toFixed(guardrail.maximumDelta < 1 ? 2 : 0)}{guardrail.unit}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section
                className={`rounded-md border p-5 ${
                  result.verdict.tone === 'emerald'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                    : result.verdict.tone === 'amber'
                      ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
                      : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.verdict.tone === 'emerald' ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  ) : (
                    <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase opacity-70">Rollout decision</p>
                    <h4 className="mt-1 text-lg font-semibold">{result.verdict.title}</h4>
                    <p className="mt-2 text-sm leading-6 opacity-80">{result.verdict.detail}</p>
                  </div>
                </div>
              </section>

              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                The thresholds are illustrative. Production policies should predeclare material segments, acceptable uncertainty, guardrail ownership, checkpoint sizes, and automatic rollback conditions.
              </p>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LoadState({ error }: { error: string | null }) {
  return (
    <div className="min-h-72 p-5 md:p-6">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
          {error}
        </div>
      ) : (
        <div
          className="h-64 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-900"
          aria-label="Loading rollout interpretation lab"
        />
      )}
    </div>
  );
}

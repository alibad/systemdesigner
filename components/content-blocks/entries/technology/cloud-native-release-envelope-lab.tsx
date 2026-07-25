'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Gauge,
  GitCompareArrows,
  LoaderCircle,
  PackageCheck,
  Repeat2,
  Rocket,
  ShieldAlert,
  TimerReset,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bounds = {
  min: number;
  max: number;
  step: number;
};

type Strategy = {
  id: string;
  label: string;
  detail: string;
  exposureMultiplier: number;
  containmentMultiplier: number;
  peakCapacityPercent: number;
  rollback: string;
};

type ReleaseEnvelopeData = {
  title: string;
  description: string;
  trafficRps: number;
  workDaysPerWeek: number;
  defaults: {
    strategyId: string;
    deploysPerDay: number;
    changeFailureRatePercent: number;
    firstWavePercent: number;
    containmentMinutes: number;
  };
  bounds: {
    deploysPerDay: Bounds;
    changeFailureRatePercent: Bounds;
    firstWavePercent: Bounds;
    containmentMinutes: Bounds;
  };
  thresholds: {
    healthyAffectedRequestsPerWeek: number;
    warningAffectedRequestsPerWeek: number;
  };
  strategies: Strategy[];
};

const BLOCK_ID = 'technology/cloud-native-release-envelope-lab';

const strategyIcons: Record<string, LucideIcon> = {
  rolling: Repeat2,
  canary: Activity,
  'blue-green': GitCompareArrows,
};

function isBounds(value: unknown): value is Bounds {
  if (!value || typeof value !== 'object') return false;
  const bounds = value as Partial<Bounds>;
  return typeof bounds.min === 'number'
    && typeof bounds.max === 'number'
    && typeof bounds.step === 'number';
}

function isReleaseEnvelopeData(value: unknown): value is ReleaseEnvelopeData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<ReleaseEnvelopeData>;

  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && typeof data.trafficRps === 'number'
      && typeof data.workDaysPerWeek === 'number'
      && typeof data.defaults?.strategyId === 'string'
      && typeof data.defaults.deploysPerDay === 'number'
      && typeof data.defaults.changeFailureRatePercent === 'number'
      && typeof data.defaults.firstWavePercent === 'number'
      && typeof data.defaults.containmentMinutes === 'number'
      && isBounds(data.bounds?.deploysPerDay)
      && isBounds(data.bounds.changeFailureRatePercent)
      && isBounds(data.bounds.firstWavePercent)
      && isBounds(data.bounds.containmentMinutes)
      && typeof data.thresholds?.healthyAffectedRequestsPerWeek === 'number'
      && typeof data.thresholds.warningAffectedRequestsPerWeek === 'number'
      && Array.isArray(data.strategies)
      && data.strategies.length >= 3
      && data.strategies.every((strategy) => (
        typeof strategy.id === 'string'
        && typeof strategy.label === 'string'
        && typeof strategy.detail === 'string'
        && typeof strategy.exposureMultiplier === 'number'
        && typeof strategy.containmentMultiplier === 'number'
        && typeof strategy.peakCapacityPercent === 'number'
        && typeof strategy.rollback === 'string'
      )),
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: 1,
    notation: value >= 1000 ? 'compact' : 'standard',
  }).format(value);
}

export default function CloudNativeReleaseEnvelopeLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ReleaseEnvelopeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No release-envelope model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load the release model (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isReleaseEnvelopeData(payload)) {
          throw new Error('The release model does not match the expected contract.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the release model.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <LearningLab>
        <LearningLabHeader
          eyebrow="Release risk workbench"
          title="Loading the release envelope"
          description="The lesson is loading its rollout strategies and risk thresholds."
          icon={Rocket}
          accent="amber"
        />
        <LearningLabBody>
          <div className="flex min-h-40 items-center justify-center p-6 text-center">
            {error ? (
              <div>
                <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-400" />
                <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((value) => value + 1)}
                  className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="text-neutral-600 dark:text-neutral-300">
                <LoaderCircle aria-hidden="true" className="mx-auto h-7 w-7 animate-spin motion-reduce:animate-none" />
                <p className="mt-3 text-sm">Loading rollout strategies...</p>
              </div>
            )}
          </div>
        </LearningLabBody>
      </LearningLab>
    );
  }

  return <ReleaseEnvelopeWorkbench data={data} />;
}

function ReleaseEnvelopeWorkbench({ data }: { data: ReleaseEnvelopeData }) {
  const initialStrategy = data.strategies.find((item) => item.id === data.defaults.strategyId)
    ?? data.strategies[0];
  const [strategyId, setStrategyId] = useState(initialStrategy.id);
  const [deploysPerDay, setDeploysPerDay] = useState(data.defaults.deploysPerDay);
  const [changeFailureRatePercent, setChangeFailureRatePercent] = useState(
    data.defaults.changeFailureRatePercent,
  );
  const [firstWavePercent, setFirstWavePercent] = useState(data.defaults.firstWavePercent);
  const [containmentMinutes, setContainmentMinutes] = useState(data.defaults.containmentMinutes);

  const strategy = data.strategies.find((item) => item.id === strategyId)
    ?? data.strategies[0];

  const result = useMemo(() => {
    const deploymentsPerWeek = deploysPerDay * data.workDaysPerWeek;
    const expectedFailures = deploymentsPerWeek * changeFailureRatePercent / 100;
    const exposurePercent = Math.min(100, firstWavePercent * strategy.exposureMultiplier);
    const effectiveContainmentMinutes = containmentMinutes * strategy.containmentMultiplier;
    const affectedPerFailure = data.trafficRps
      * 60
      * effectiveContainmentMinutes
      * exposurePercent / 100;
    const affectedPerWeek = Math.round(expectedFailures * affectedPerFailure);

    let verdict = 'The release stays inside the modeled exposure budget';
    let explanation = 'Small first-wave traffic and prompt containment keep expected request exposure bounded. Validate the thresholds against real business impact.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (affectedPerWeek > data.thresholds.warningAffectedRequestsPerWeek) {
      verdict = 'The release process exposes too much traffic';
      explanation = 'Lower change failure, shrink the first wave, or shorten detection and rollback before increasing deployment frequency.';
      tone = 'rose';
    } else if (affectedPerWeek > data.thresholds.healthyAffectedRequestsPerWeek) {
      verdict = 'The release needs a tighter containment loop';
      explanation = 'The strategy is workable, but expected exposure is above the healthy budget. Improve the weakest control before automatic promotion.';
      tone = 'amber';
    }

    return {
      affectedPerFailure,
      affectedPerWeek,
      deploymentsPerWeek,
      effectiveContainmentMinutes,
      expectedFailures,
      explanation,
      exposurePercent,
      tone,
      verdict,
    };
  }, [
    changeFailureRatePercent,
    containmentMinutes,
    data.trafficRps,
    data.thresholds.healthyAffectedRequestsPerWeek,
    data.thresholds.warningAffectedRequestsPerWeek,
    data.workDaysPerWeek,
    deploysPerDay,
    firstWavePercent,
    strategy.containmentMultiplier,
    strategy.exposureMultiplier,
  ]);

  function reset() {
    setStrategyId(initialStrategy.id);
    setDeploysPerDay(data.defaults.deploysPerDay);
    setChangeFailureRatePercent(data.defaults.changeFailureRatePercent);
    setFirstWavePercent(data.defaults.firstWavePercent);
    setContainmentMinutes(data.defaults.containmentMinutes);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Release risk workbench"
          title={data.title}
          description={data.description}
          icon={Rocket}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                  1. Rollout strategy
                </legend>
                <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                  {data.strategies.map((candidate) => (
                    <LabChoice
                      key={candidate.id}
                      selected={candidate.id === strategy.id}
                      label={candidate.label}
                      detail={candidate.detail}
                      icon={strategyIcons[candidate.id] ?? Rocket}
                      accent="amber"
                      onClick={() => setStrategyId(candidate.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6">
                <LabRange
                  label="Deployments per workday"
                  value={deploysPerDay}
                  output={String(deploysPerDay)}
                  {...data.bounds.deploysPerDay}
                  accent="blue"
                  lowLabel="Few large changes"
                  highLabel="Many small changes"
                  onChange={setDeploysPerDay}
                />
                <LabRange
                  label="Change failure rate"
                  value={changeFailureRatePercent}
                  output={`${changeFailureRatePercent}%`}
                  {...data.bounds.changeFailureRatePercent}
                  accent="rose"
                  lowLabel="Strong pre-release evidence"
                  highLabel="Frequent bad changes"
                  onChange={setChangeFailureRatePercent}
                />
                <LabRange
                  label="First-wave traffic"
                  value={firstWavePercent}
                  output={`${firstWavePercent}%`}
                  {...data.bounds.firstWavePercent}
                  accent="violet"
                  lowLabel="Small cohort"
                  highLabel="Broad exposure"
                  onChange={setFirstWavePercent}
                />
                <LabRange
                  label="Detection plus rollback"
                  value={containmentMinutes}
                  output={`${containmentMinutes} min`}
                  {...data.bounds.containmentMinutes}
                  accent="cyan"
                  lowLabel="Fast containment"
                  highLabel="Long incident window"
                  onChange={setContainmentMinutes}
                />
              </div>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Weekly releases"
                value={String(result.deploymentsPerWeek)}
                detail={`${result.expectedFailures.toFixed(1)} expected failures`}
                icon={PackageCheck}
                tone="blue"
              />
              <LabMetric
                label="Effective exposure"
                value={`${result.exposurePercent.toFixed(1)}%`}
                detail={`${strategy.label} first wave`}
                icon={Gauge}
                tone={result.exposurePercent <= 10 ? 'emerald' : result.exposurePercent <= 30 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Containment window"
                value={`${result.effectiveContainmentMinutes.toFixed(1)} min`}
                detail="Strategy-adjusted detection and rollback"
                icon={Clock3}
                tone={result.effectiveContainmentMinutes <= 5 ? 'emerald' : result.effectiveContainmentMinutes <= 12 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Affected per week"
                value={formatCompact(result.affectedPerWeek)}
                detail={`${formatCompact(result.affectedPerFailure)} per failed release`}
                icon={ShieldAlert}
                tone={result.tone}
              />
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/70">
              <div className="grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] md:gap-3">
                <ReleaseStage icon={PackageCheck} label="Candidate" detail={`${data.trafficRps.toLocaleString()} rps workload`} tone="blue" />
                <FlowArrow />
                <ReleaseStage icon={Activity} label="First wave" detail={`${result.exposurePercent.toFixed(1)}% traffic`} tone="violet" />
                <FlowArrow />
                <ReleaseStage icon={Gauge} label="Observe" detail={`${result.effectiveContainmentMinutes.toFixed(1)} min window`} tone="amber" />
                <FlowArrow />
                <ReleaseStage icon={TimerReset} label="Contain" detail={strategy.rollback} tone={result.tone} />
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                <div
                  className={`h-full rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none ${
                    result.tone === 'emerald'
                      ? 'bg-emerald-500'
                      : result.tone === 'amber'
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                  }`}
                  style={{ width: `${Math.max(4, result.exposurePercent)}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between gap-4 text-xs text-neutral-500 dark:text-neutral-400">
                <span>First-wave blast radius</span>
                <span>{strategy.peakCapacityPercent}% peak rollout capacity</span>
              </div>
            </div>

            <div className={`rounded-lg border p-5 ${
              result.tone === 'emerald'
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'
                : result.tone === 'amber'
                  ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/35'
                  : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
            }`}
            >
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <TriangleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${result.tone === 'amber' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`} />
                )}
                <div>
                  <p className="font-semibold text-neutral-950 dark:text-white">{result.verdict}</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{result.explanation}</p>
                </div>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center text-neutral-400 dark:text-neutral-600">
      <ArrowRight aria-hidden="true" className="hidden h-5 w-5 md:block" />
      <span aria-hidden="true" className="h-4 w-px bg-neutral-300 md:hidden dark:bg-neutral-700" />
    </div>
  );
}

function ReleaseStage({
  icon: Icon,
  label,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  detail: string;
  tone: 'blue' | 'violet' | 'amber' | 'emerald' | 'rose';
}) {
  const styles = {
    blue: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-50',
    violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-50',
    amber: 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
    rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  };

  return (
    <div className={`min-w-0 rounded-md border p-3 ${styles[tone]}`}>
      <Icon aria-hidden="true" className="h-4 w-4" />
      <p className="mt-2 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

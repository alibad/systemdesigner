'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  Boxes,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  Layers3,
  RadioTower,
  TimerReset,
  TriangleAlert,
  Waves,
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
  '/api/content/ml-systems/data-pipelines/data/freshness-routing-lab.json';
const BLOCK_ID = 'ml-systems/data-pipelines-freshness-routing-lab';

type RangeDefinition = {
  min: number;
  max: number;
  step: number;
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  freshnessSloMinutes: number;
  eventsPerMinute: number;
  sourceLagMinutes: number;
  transformMinutes: number;
  qualityMinutes: number;
  publishMinutes: number;
};

type ProcessingMode = {
  id: 'batch' | 'micro-batch' | 'stream';
  label: string;
  detail: string;
  waitFactor: number;
  computeFactor: number;
  costIndex: number;
  operationsIndex: number;
};

type LabData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    modeId: ProcessingMode['id'];
    publicationIntervalMinutes: number;
  };
  intervalRange: RangeDefinition;
  scenarios: Scenario[];
  modes: ProcessingMode[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && data.defaults
      && data.intervalRange
      && typeof data.intervalRange.min === 'number'
      && typeof data.intervalRange.max === 'number'
      && typeof data.intervalRange.step === 'number'
      && Array.isArray(data.scenarios)
      && data.scenarios.length > 0
      && data.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.freshnessSloMinutes === 'number'
        && typeof scenario.eventsPerMinute === 'number'
      ))
      && Array.isArray(data.modes)
      && data.modes.length > 0
      && data.modes.every((mode) => (
        ['batch', 'micro-batch', 'stream'].includes(mode.id)
        && typeof mode.waitFactor === 'number'
        && typeof mode.computeFactor === 'number'
      )),
  );
}

function formatMinutes(minutes: number) {
  if (minutes < 1) return `${Math.round(minutes * 60)} sec`;
  if (minutes < 60) return `${minutes.toFixed(minutes < 10 ? 1 : 0)} min`;
  const hours = minutes / 60;
  return `${hours.toFixed(hours < 10 ? 1 : 0)} hr`;
}

function formatRecords(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return Math.round(value).toLocaleString();
}

export default function DataPipelinesFreshnessRoutingLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('');
  const [modeId, setModeId] = useState<ProcessingMode['id']>('micro-batch');
  const [publicationInterval, setPublicationInterval] = useState(10);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load freshness data (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLabData(payload)) throw new Error('Freshness lab data is incomplete.');
        setData(payload);
        setScenarioId(payload.defaults.scenarioId);
        setModeId(payload.defaults.modeId);
        setPublicationInterval(payload.defaults.publicationIntervalMinutes);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load freshness data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const scenario = data?.scenarios.find((item) => item.id === scenarioId)
    ?? data?.scenarios[0];
  const mode = data?.modes.find((item) => item.id === modeId)
    ?? data?.modes[0];

  const result = useMemo(() => {
    if (!scenario || !mode) return null;

    const collectionWait = publicationInterval * mode.waitFactor;
    const transform = scenario.transformMinutes * mode.computeFactor;
    const stages = [
      { id: 'source', label: 'Source lag', value: scenario.sourceLagMinutes, tone: 'bg-cyan-500 dark:bg-cyan-400' },
      { id: 'wait', label: 'Collection wait', value: collectionWait, tone: 'bg-blue-500 dark:bg-blue-400' },
      { id: 'transform', label: 'Transform', value: transform, tone: 'bg-violet-500 dark:bg-violet-400' },
      { id: 'quality', label: 'Quality gate', value: scenario.qualityMinutes, tone: 'bg-amber-500 dark:bg-amber-400' },
      { id: 'publish', label: 'Publish', value: scenario.publishMinutes, tone: 'bg-emerald-500 dark:bg-emerald-400' },
    ];
    const totalMinutes = stages.reduce((sum, stage) => sum + stage.value, 0);
    const headroom = scenario.freshnessSloMinutes - totalMinutes;
    const fits = headroom >= 0;
    const recordsPerPublication = scenario.eventsPerMinute * publicationInterval;
    const recommendedMode: ProcessingMode['id'] = scenario.freshnessSloMinutes <= 3
      ? 'stream'
      : scenario.freshnessSloMinutes <= 60
        ? 'micro-batch'
        : 'batch';
    const complexityFit = mode.id === recommendedMode
      || (recommendedMode === 'batch' && mode.id === 'micro-batch');

    const diagnosis = !fits
      ? {
          title: 'Freshness contract missed',
          detail: `This route arrives ${formatMinutes(Math.abs(headroom))} after the consumer deadline. Shorten the publication interval, reduce a measured stage, or choose a lower-wait mode.`,
          tone: 'rose' as const,
        }
      : !complexityFit
        ? {
            title: 'The deadline is met with avoidable complexity',
            detail: `${mode.label} fits, but ${recommendedMode === 'batch' ? 'bounded batch' : 'micro-batch'} is the simpler default for this decision horizon. Keep the extra machinery only when another measured requirement needs it.`,
            tone: 'amber' as const,
          }
        : {
            title: 'Mode and deadline are aligned',
            detail: `The route preserves ${formatMinutes(headroom)} of freshness headroom while using an operating model proportionate to the decision deadline.`,
            tone: 'emerald' as const,
          };

    return {
      complexityFit,
      diagnosis,
      fits,
      headroom,
      recordsPerPublication,
      recommendedMode,
      stages,
      totalMinutes,
    };
  }, [mode, publicationInterval, scenario]);

  function reset() {
    if (!data) return;
    setScenarioId(data.defaults.scenarioId);
    setModeId(data.defaults.modeId);
    setPublicationInterval(data.defaults.publicationIntervalMinutes);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Freshness architecture lab"
          title={data?.title ?? 'Route a freshness budget'}
          description={data?.description ?? 'Loading the freshness model...'}
          icon={TimerReset}
          accent="cyan"
          onReset={data ? reset : undefined}
        />

        {!data || !scenario || !mode || !result ? (
          <LoadState error={error} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-7">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Consumer decision
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.scenarios.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === scenario.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'fraud-decision' ? RadioTower : item.id === 'daily-training' ? Database : Waves}
                        accent={item.id === 'fraud-decision' ? 'rose' : item.id === 'daily-training' ? 'blue' : 'cyan'}
                        onClick={() => setScenarioId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Execution mode
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.modes.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === mode.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'batch' ? Boxes : item.id === 'micro-batch' ? Layers3 : RadioTower}
                        accent={item.id === 'batch' ? 'blue' : item.id === 'micro-batch' ? 'violet' : 'emerald'}
                        onClick={() => setModeId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="3. Publication interval"
                  value={publicationInterval}
                  output={formatMinutes(publicationInterval)}
                  min={data.intervalRange.min}
                  max={data.intervalRange.max}
                  step={data.intervalRange.step}
                  accent="cyan"
                  lowLabel="Fresher, more runs"
                  highLabel="Cheaper, staler"
                  onChange={setPublicationInterval}
                />
              </div>
            )}
          >
            <div className="min-w-0 space-y-6" aria-live="polite">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Current route
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                    {scenario.label} through {mode.label.toLowerCase()}
                  </h4>
                </div>
                <span className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold ${
                  result.fits
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100'
                    : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100'
                }`}>
                  {result.fits
                    ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
                    : <TriangleAlert aria-hidden="true" className="h-4 w-4" />}
                  {result.fits ? 'Inside freshness SLO' : 'Freshness SLO missed'}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <LabMetric
                  label="End-to-end freshness"
                  value={formatMinutes(result.totalMinutes)}
                  detail={`Consumer SLO: ${formatMinutes(scenario.freshnessSloMinutes)}`}
                  icon={Clock3}
                  tone={result.fits ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Budget headroom"
                  value={`${result.headroom >= 0 ? '+' : '-'}${formatMinutes(Math.abs(result.headroom))}`}
                  detail="Margin before the consumer deadline"
                  icon={Gauge}
                  tone={result.headroom >= 0 ? 'cyan' : 'rose'}
                />
                <LabMetric
                  label="Records per publication"
                  value={formatRecords(result.recordsPerPublication)}
                  detail={`${scenario.eventsPerMinute.toLocaleString()} events per minute`}
                  icon={Boxes}
                  tone="violet"
                />
                <LabMetric
                  label="Operating load"
                  value={`${mode.operationsIndex}/3`}
                  detail={`${mode.costIndex.toFixed(2)}x illustrative run-cost index`}
                  icon={Layers3}
                  tone={mode.operationsIndex === 3 ? 'amber' : 'blue'}
                />
              </div>

              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                      Freshness budget
                    </p>
                    <h4 className="mt-1 font-semibold text-neutral-950 dark:text-white">
                      See which stage spends the deadline
                    </h4>
                  </div>
                  <span className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-200">
                    {formatMinutes(result.totalMinutes)} / {formatMinutes(scenario.freshnessSloMinutes)}
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {result.stages.map((stage) => {
                    const width = Math.max(2, Math.min(100, (stage.value / result.totalMinutes) * 100));
                    return (
                      <div key={stage.id} className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_72px] sm:items-center">
                        <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">{stage.label}</span>
                        <div className="h-2.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                          <div className={`h-full rounded-full ${stage.tone}`} style={{ width: `${width}%` }} />
                        </div>
                        <span className="text-right text-xs font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">
                          {formatMinutes(stage.value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section aria-label="Selected pipeline route">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Execution path
                </p>
                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)_24px_minmax(0,1fr)] md:items-stretch">
                  <RouteNode icon={Database} label="Source contract" detail={`${scenario.eventsPerMinute.toLocaleString()} events/min with event time`} tone="cyan" />
                  <RouteArrow />
                  <RouteNode icon={mode.id === 'stream' ? RadioTower : Layers3} label={mode.label} detail={`${formatMinutes(publicationInterval)} publication interval`} tone="violet" />
                  <RouteArrow />
                  <RouteNode icon={result.fits ? CheckCircle2 : TriangleAlert} label="Validated artifact" detail={result.fits ? `${formatMinutes(result.headroom)} before deadline` : `${formatMinutes(Math.abs(result.headroom))} late`} tone={result.fits ? 'emerald' : 'rose'} />
                </div>
              </section>

              <section className={`rounded-md border p-5 ${
                result.diagnosis.tone === 'emerald'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
                  : result.diagnosis.tone === 'amber'
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
                    : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100'
              }`}>
                <div className="flex items-start gap-3">
                  {result.diagnosis.tone === 'emerald'
                    ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                    : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    <h4 className="font-semibold">{result.diagnosis.title}</h4>
                    <p className="mt-2 text-sm leading-6 opacity-80">{result.diagnosis.detail}</p>
                  </div>
                </div>
              </section>

              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Illustrative budget: replace these stage times and cost factors with measured percentiles from your own source, compute, validation, and publication path.
              </p>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function RouteArrow() {
  return (
    <div className="flex items-center justify-center text-neutral-400 dark:text-neutral-600">
      <ArrowDown aria-hidden="true" className="h-5 w-5 md:-rotate-90" />
    </div>
  );
}

function RouteNode({
  icon: Icon,
  label,
  detail,
  tone,
}: {
  icon: typeof Database;
  label: string;
  detail: string;
  tone: 'cyan' | 'violet' | 'emerald' | 'rose';
}) {
  const classes = {
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/35 dark:text-cyan-100',
    violet: 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-100',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100',
    rose: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100',
  };

  return (
    <div className={`min-w-0 rounded-md border p-4 ${classes[tone]}`}>
      <Icon aria-hidden="true" className="h-5 w-5" />
      <p className="mt-3 text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs leading-5 opacity-75">{detail}</p>
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
        <div className="h-64 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-900" aria-label="Loading freshness routing lab" />
      )}
    </div>
  );
}

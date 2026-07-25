'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Boxes,
  Database,
  HardDrive,
  Server,
  ShieldCheck,
  Sigma,
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
type Profile = {
  id: string;
  label: string;
  detail: string;
  targets: number;
  seriesPerTarget: number;
  scrapeIntervalSeconds: number;
  retentionDays: number;
};
type SeriesBudgetModel = {
  title: string;
  description: string;
  defaults: {
    profileId: string;
    targets: number;
    seriesPerTarget: number;
    scrapeIntervalSeconds: number;
    retentionDays: number;
    bytesPerSample: number;
    headroomPercent: number;
  };
  bounds: {
    targets: Bound;
    seriesPerTarget: Bound;
    scrapeIntervalSeconds: Bound;
    retentionDays: Bound;
    bytesPerSample: Bound;
    headroomPercent: Bound;
  };
  profiles: Profile[];
};

const BLOCK_ID = 'technology/prometheus-sizing';
const DEFAULT_DATA_FILE = '/api/content/technology/prometheus/data/series-budget-model.json';
const SECONDS_PER_DAY = 86_400;
const BYTES_PER_GIB = 1024 ** 3;

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const bound = value as Partial<Bound>;
  return [bound.min, bound.max, bound.step].every(
    (item) => typeof item === 'number' && Number.isFinite(item),
  );
}

function isSeriesBudgetModel(value: unknown): value is SeriesBudgetModel {
  if (!value || typeof value !== 'object') return false;
  const model = value as Partial<SeriesBudgetModel>;
  const defaults = model.defaults;
  const bounds = model.bounds;
  return Boolean(
    model.title
      && model.description
      && defaults?.profileId
      && [
        defaults.targets,
        defaults.seriesPerTarget,
        defaults.scrapeIntervalSeconds,
        defaults.retentionDays,
        defaults.bytesPerSample,
        defaults.headroomPercent,
      ].every((item) => typeof item === 'number' && Number.isFinite(item))
      && bounds
      && isBound(bounds.targets)
      && isBound(bounds.seriesPerTarget)
      && isBound(bounds.scrapeIntervalSeconds)
      && isBound(bounds.retentionDays)
      && isBound(bounds.bytesPerSample)
      && isBound(bounds.headroomPercent)
      && Array.isArray(model.profiles)
      && model.profiles.length >= 3
      && model.profiles.every((profile) => (
        typeof profile.id === 'string'
        && typeof profile.label === 'string'
        && typeof profile.targets === 'number'
        && typeof profile.seriesPerTarget === 'number'
        && typeof profile.scrapeIntervalSeconds === 'number'
        && typeof profile.retentionDays === 'number'
      )),
  );
}

function formatCount(value: number) {
  return Math.round(value).toLocaleString();
}

function formatGiB(value: number) {
  if (value < 1) return `${(value * 1024).toFixed(0)} MiB`;
  if (value < 100) return `${value.toFixed(1)} GiB`;
  return `${Math.round(value).toLocaleString()} GiB`;
}

export default function PrometheusSizing({ dataFile = DEFAULT_DATA_FILE }: { dataFile?: string }) {
  const [model, setModel] = useState<SeriesBudgetModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isSeriesBudgetModel(payload)) throw new Error('The series budget model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load series data.');
      });
    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Series budget lab"
            title="Make ingestion arithmetic visible"
            description="Loading measured target, series, scrape, retention, and storage assumptions."
            icon={Sigma}
            accent="blue"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : <BudgetLab model={model} />}
    </div>
  );
}

function BudgetLab({ model }: { model: SeriesBudgetModel }) {
  const [profileId, setProfileId] = useState(model.defaults.profileId);
  const [targets, setTargets] = useState<number>(model.defaults.targets);
  const [seriesPerTarget, setSeriesPerTarget] = useState<number>(model.defaults.seriesPerTarget);
  const [scrapeIntervalSeconds, setScrapeIntervalSeconds] = useState<number>(model.defaults.scrapeIntervalSeconds);
  const [retentionDays, setRetentionDays] = useState<number>(model.defaults.retentionDays);
  const [bytesPerSample, setBytesPerSample] = useState<number>(model.defaults.bytesPerSample);
  const [headroomPercent, setHeadroomPercent] = useState<number>(model.defaults.headroomPercent);

  const result = useMemo(() => {
    const activeSeries = targets * seriesPerTarget;
    const samplesPerSecond = activeSeries / scrapeIntervalSeconds;
    const retainedSamples = samplesPerSecond * retentionDays * SECONDS_PER_DAY;
    const rawGiB = retainedSamples * bytesPerSample / BYTES_PER_GIB;
    const usableFraction = Math.max(0.01, 1 - headroomPercent / 100);
    const provisionedGiB = rawGiB / usableFraction;
    return {
      activeSeries,
      samplesPerSecond,
      retainedSamples,
      rawGiB,
      provisionedGiB,
      reservedGiB: provisionedGiB - rawGiB,
      dailyGiB: samplesPerSecond * SECONDS_PER_DAY * bytesPerSample / BYTES_PER_GIB,
      recommendedBuffer: headroomPercent >= 15,
    };
  }, [bytesPerSample, headroomPercent, retentionDays, scrapeIntervalSeconds, seriesPerTarget, targets]);

  function applyProfile(profile: Profile) {
    setProfileId(profile.id);
    setTargets(profile.targets);
    setSeriesPerTarget(profile.seriesPerTarget);
    setScrapeIntervalSeconds(profile.scrapeIntervalSeconds);
    setRetentionDays(profile.retentionDays);
  }

  function reset() {
    const profile = model.profiles.find((item) => item.id === model.defaults.profileId) ?? model.profiles[0];
    applyProfile(profile);
    setBytesPerSample(model.defaults.bytesPerSample);
    setHeadroomPercent(model.defaults.headroomPercent);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Series budget lab"
        title={model.title}
        description={model.description}
        icon={Sigma}
        accent="blue"
        onReset={reset}
      />
      <LearningLabBody controls={(
        <div className="space-y-6">
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Workload profile</legend>
            <div className="mt-3 space-y-2">
              {model.profiles.map((profile) => (
                <LabChoice
                  key={profile.id}
                  selected={profile.id === profileId}
                  label={profile.label}
                  detail={profile.detail}
                  icon={profile.id === 'cardinality-regression' ? TriangleAlert : Server}
                  accent={profile.id === 'cardinality-regression' ? 'rose' : 'blue'}
                  onClick={() => applyProfile(profile)}
                />
              ))}
            </div>
          </fieldset>
          <LabRange label="Scrape targets" value={targets} output={formatCount(targets)} {...model.bounds.targets} lowLabel="small fleet" highLabel="large fleet" accent="blue" onChange={setTargets} />
          <LabRange label="Series per target" value={seriesPerTarget} output={formatCount(seriesPerTarget)} {...model.bounds.seriesPerTarget} lowLabel="bounded labels" highLabel="wide metric set" accent="rose" onChange={setSeriesPerTarget} />
          <LabRange label="Scrape interval" value={scrapeIntervalSeconds} output={`${scrapeIntervalSeconds}s`} {...model.bounds.scrapeIntervalSeconds} lowLabel="more samples" highLabel="slower detection" accent="cyan" onChange={setScrapeIntervalSeconds} />
          <LabRange label="Local retention" value={retentionDays} output={`${retentionDays}d`} {...model.bounds.retentionDays} lowLabel="short history" highLabel="long history" accent="violet" onChange={setRetentionDays} />
          <LabRange label="Documented sample range" value={bytesPerSample} output={`${bytesPerSample.toFixed(1)} B/sample`} {...model.bounds.bytesPerSample} lowLabel="1 byte" highLabel="2 bytes" accent="amber" onChange={setBytesPerSample} />
          <LabRange label="Reserved disk headroom" value={headroomPercent} output={`${headroomPercent}%`} {...model.bounds.headroomPercent} lowLabel="no buffer" highLabel="larger buffer" accent="emerald" onChange={setHeadroomPercent} />
        </div>
      )}>
        <div className="space-y-5" aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Active series" value={formatCount(result.activeSeries)} detail={`${formatCount(targets)} targets x ${formatCount(seriesPerTarget)} series.`} icon={Boxes} tone="blue" />
            <LabMetric label="Samples per second" value={formatCount(result.samplesPerSecond)} detail={`${formatCount(result.activeSeries)} / ${scrapeIntervalSeconds}s.`} icon={Activity} tone="cyan" />
            <LabMetric label="Raw retained blocks" value={formatGiB(result.rawGiB)} detail={`${retentionDays} days at ${bytesPerSample.toFixed(1)} bytes/sample.`} icon={Database} tone="violet" />
            <LabMetric label="Provisioned baseline" value={formatGiB(result.provisionedGiB)} detail={`${formatGiB(result.reservedGiB)} reserved as explicit headroom.`} icon={HardDrive} tone={result.recommendedBuffer ? 'emerald' : 'amber'} />
          </div>

          <div className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Arithmetic trace</p>
              <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">Each line feeds the next; no latency, memory, or shard count is inferred.</p>
            </div>
            <div className="grid gap-px bg-neutral-200 sm:grid-cols-2 dark:bg-neutral-800">
              <FormulaStep number="1" label="Series" formula={`${formatCount(targets)} x ${formatCount(seriesPerTarget)}`} result={formatCount(result.activeSeries)} />
              <FormulaStep number="2" label="Ingestion" formula={`${formatCount(result.activeSeries)} / ${scrapeIntervalSeconds}s`} result={`${formatCount(result.samplesPerSecond)}/s`} />
              <FormulaStep number="3" label="Retained samples" formula={`${formatCount(result.samplesPerSecond)}/s x ${retentionDays}d`} result={formatCount(result.retainedSamples)} />
              <FormulaStep number="4" label="Raw disk" formula={`${formatCount(result.retainedSamples)} x ${bytesPerSample.toFixed(1)}B`} result={formatGiB(result.rawGiB)} />
            </div>
          </div>

          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Planned disk split</p>
                <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-300">{formatGiB(result.dailyGiB)} of modeled block growth per day.</p>
              </div>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">{formatGiB(result.provisionedGiB)} total</p>
            </div>
            <div className="mt-4 flex h-5 overflow-hidden rounded-full bg-emerald-200 dark:bg-emerald-950" role="img" aria-label={`${100 - headroomPercent}% raw retained data and ${headroomPercent}% reserved disk headroom`}>
              <div className="bg-blue-500 dark:bg-blue-400" style={{ width: `${100 - headroomPercent}%` }} />
              <div className="bg-emerald-400 dark:bg-emerald-600" style={{ width: `${headroomPercent}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-600 dark:text-neutral-400">
              <span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-blue-500" />Raw sample estimate: {100 - headroomPercent}%</span>
              <span><span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" />Reserved headroom: {headroomPercent}%</span>
            </div>
          </div>

          <div className={`rounded-md border p-4 ${result.recommendedBuffer
            ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
            : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'}`}>
            <div className="flex items-start gap-3">
              {result.recommendedBuffer ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div>
                <p className="text-sm font-semibold">{result.recommendedBuffer ? 'The plan reserves at least 15% outside retained blocks' : 'The plan leaves less than 15% outside retained blocks'}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">
                  Prometheus recommends setting retention size to at most 80-85% of allocated disk. This lab's buffer still excludes WAL, head, index shape, churn, compaction peaks, snapshots, and operating-system use.
                </p>
              </div>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function FormulaStep({ number, label, formula, result }: { number: string; label: string; formula: string; result: string }) {
  return (
    <div className="bg-white p-4 dark:bg-neutral-950">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">{number}</span>
        {label}
      </div>
      <p className="mt-3 break-words font-mono text-xs text-neutral-600 dark:text-neutral-400">{formula}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-neutral-950 dark:text-white">= {result}</p>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="p-5 md:p-6">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
          <div className="flex items-start gap-3">
            <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="text-sm font-semibold">Series budget unavailable</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
              <button type="button" onClick={onRetry} className="mt-3 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">Retry</button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-32 items-center justify-center text-sm text-neutral-500 dark:text-neutral-400">Loading series budget...</div>
      )}
    </div>
  );
}

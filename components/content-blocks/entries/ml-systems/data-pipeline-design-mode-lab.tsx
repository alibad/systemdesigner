'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Clock3, Cpu, DatabaseZap, RefreshCw, TriangleAlert } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE = '/api/content/ml-systems/data-pipeline-design/data/pipeline-mode-lab.json';

type ModeId = 'batch' | 'stream' | 'hybrid';
type Mode = {
  id: ModeId;
  label: string;
  detail: string;
  lagBaseSeconds: number;
  computeFactor: number;
  costFactor: number;
  replayFactor: number;
};
type LabData = {
  title: string;
  description: string;
  modes: Mode[];
  defaults: {
    mode: ModeId;
    eventRate: number;
    freshnessSloSeconds: number;
    windowMinutes: number;
    lateArrivalPercent: number;
    transformCostMs: number;
  };
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string' &&
      typeof data.description === 'string' &&
      Array.isArray(data.modes) &&
      data.modes.length === 3 &&
      data.modes.every((mode) =>
        mode &&
        ['batch', 'stream', 'hybrid'].includes(mode.id) &&
        typeof mode.label === 'string' &&
        typeof mode.detail === 'string' &&
        typeof mode.lagBaseSeconds === 'number' &&
        typeof mode.computeFactor === 'number' &&
        typeof mode.costFactor === 'number' &&
        typeof mode.replayFactor === 'number',
      ) &&
      data.defaults &&
      ['batch', 'stream', 'hybrid'].includes(data.defaults.mode),
  );
}

function formatLag(seconds: number) {
  if (seconds >= 60) return `${(seconds / 60).toFixed(seconds >= 600 ? 0 : 1)} min`;
  return `${Math.round(seconds)} s`;
}

export default function DataPipelineDesignModeLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modeId, setModeId] = useState<ModeId | null>(null);
  const [eventRate, setEventRate] = useState<number | null>(null);
  const [freshnessSloSeconds, setFreshnessSloSeconds] = useState<number | null>(null);
  const [windowMinutes, setWindowMinutes] = useState<number | null>(null);
  const [lateArrivalPercent, setLateArrivalPercent] = useState<number | null>(null);
  const [transformCostMs, setTransformCostMs] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load lab data (${response.status}).`);
        return response.json();
      })
      .then((value: unknown) => {
        if (!isLabData(value)) throw new Error('The lab data does not match the expected contract.');
        setData(value);
        setModeId(value.defaults.mode);
        setEventRate(value.defaults.eventRate);
        setFreshnessSloSeconds(value.defaults.freshnessSloSeconds);
        setWindowMinutes(value.defaults.windowMinutes);
        setLateArrivalPercent(value.defaults.lateArrivalPercent);
        setTransformCostMs(value.defaults.transformCostMs);
      })
      .catch((fetchError: unknown) => {
        if ((fetchError as { name?: string }).name !== 'AbortError') {
          setError(fetchError instanceof Error ? fetchError.message : 'Could not load lab data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const model = useMemo(() => {
    if (!data || !modeId || !eventRate || !freshnessSloSeconds || !windowMinutes || lateArrivalPercent === null || !transformCostMs) return null;
    const mode = data.modes.find((candidate) => candidate.id === modeId) ?? data.modes[0];
    const baseWork = (eventRate * transformCostMs) / 1000;
    const computeUnits = (baseWork * mode.computeFactor) / 0.62;
    const batchWait = mode.id === 'batch' ? windowMinutes * 30 : mode.id === 'hybrid' ? Math.min(windowMinutes * 4, 45) : 0;
    const processingLag = (baseWork / (mode.id === 'stream' ? 12 : 18)) * 2;
    const lateLag = lateArrivalPercent * mode.replayFactor * 2.5;
    const lagSeconds = mode.lagBaseSeconds + batchWait + processingLag + lateLag;
    const replayEvents = Math.round(eventRate * (lateArrivalPercent / 100) * windowMinutes * 60 * mode.replayFactor);
    const monthlyCost = Math.round(computeUnits * 92 * mode.costFactor + replayEvents * 0.003);
    const recommended: ModeId = freshnessSloSeconds <= 45 ? 'stream' : lateArrivalPercent >= 7 || windowMinutes >= 30 ? 'hybrid' : 'batch';
    const meetsSlo = lagSeconds <= freshnessSloSeconds;
    const selectedMatches = mode.id === recommended && meetsSlo;

    return {
      mode,
      computeUnits,
      lagSeconds,
      replayEvents,
      monthlyCost,
      recommended,
      meetsSlo,
      selectedMatches,
      headline: selectedMatches
        ? `${mode.label} fits this freshness and correction profile.`
        : !meetsSlo
          ? `${mode.label} misses the freshness SLO under these assumptions.`
          : `${mode.label} can work, but ${recommended === 'hybrid' ? 'late data or a long correction window argues for a hybrid path.' : 'the simpler mode is more appropriate.'}`,
    };
  }, [data, eventRate, freshnessSloSeconds, lateArrivalPercent, modeId, transformCostMs, windowMinutes]);

  const reset = () => {
    if (!data) return;
    setModeId(data.defaults.mode);
    setEventRate(data.defaults.eventRate);
    setFreshnessSloSeconds(data.defaults.freshnessSloSeconds);
    setWindowMinutes(data.defaults.windowMinutes);
    setLateArrivalPercent(data.defaults.lateArrivalPercent);
    setTransformCostMs(data.defaults.transformCostMs);
  };

  if (error) {
    return <p className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{error}</p>;
  }

  if (!data || !model || modeId === null || eventRate === null || freshnessSloSeconds === null || windowMinutes === null || lateArrivalPercent === null || transformCostMs === null) {
    return <div className="not-prose my-7 h-64 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading pipeline mode lab" />;
  }

  return (
    <div data-content-block="ml-systems/data-pipeline-design-mode-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Freshness and capacity lab"
          title="Pick a mode from the data pressure"
          description={data.description}
          icon={Activity}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Processing mode</legend>
                <div className="mt-3 space-y-2">
                  {data.modes.map((mode) => (
                    <LabChoice
                      key={mode.id}
                      selected={modeId === mode.id}
                      label={mode.label}
                      detail={mode.detail}
                      icon={mode.id === 'batch' ? DatabaseZap : mode.id === 'stream' ? Activity : RefreshCw}
                      accent={mode.id === 'batch' ? 'violet' : mode.id === 'stream' ? 'cyan' : 'emerald'}
                      onClick={() => setModeId(mode.id)}
                    />
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-5">
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Workload assumptions</legend>
                <LabRange label="Event rate" value={eventRate} output={`${eventRate.toLocaleString()} events/s`} min={100} max={5000} step={100} accent="cyan" lowLabel="100 events/s" highLabel="5,000 events/s" onChange={setEventRate} />
                <LabRange label="Freshness SLO" value={freshnessSloSeconds} output={formatLag(freshnessSloSeconds)} min={15} max={900} step={15} accent="emerald" lowLabel="15 s" highLabel="15 min" onChange={setFreshnessSloSeconds} />
                <LabRange label="Event-time window" value={windowMinutes} output={`${windowMinutes} min`} min={5} max={60} step={5} accent="violet" lowLabel="5 min" highLabel="60 min" onChange={setWindowMinutes} />
                <LabRange label="Late arrivals" value={lateArrivalPercent} output={`${lateArrivalPercent}%`} min={0} max={15} step={1} accent="amber" lowLabel="0% late" highLabel="15% late" onChange={setLateArrivalPercent} />
                <LabRange label="Transform cost" value={transformCostMs} output={`${transformCostMs} ms/event`} min={1} max={20} step={1} accent="rose" lowLabel="1 ms" highLabel="20 ms" onChange={setTransformCostMs} />
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite" className={`rounded-md border p-4 ${model.selectedMatches ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40' : 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'}`}>
            <div className="flex items-start gap-3">
              {model.selectedMatches ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />}
              <div>
                <p className="text-sm font-semibold text-neutral-950 dark:text-white">{model.headline}</p>
                <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">Recommendation: <strong>{data.modes.find((mode) => mode.id === model.recommended)?.label}</strong>. This estimate includes queue work, window delay, and late-event correction pressure; verify it with production traces before committing an architecture.</p>
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Estimated lag" value={formatLag(model.lagSeconds)} detail={`${formatLag(freshnessSloSeconds)} SLO`} icon={Clock3} tone={model.meetsSlo ? 'emerald' : 'rose'} />
            <LabMetric label="Compute demand" value={`${model.computeUnits.toFixed(1)} vCPU`} detail="At 62% target utilization" icon={Cpu} tone="cyan" />
            <LabMetric label="Monthly compute" value={`$${model.monthlyCost}`} detail="Illustrative processing estimate" icon={DatabaseZap} tone="violet" />
            <LabMetric label="Replay pressure" value={`${model.replayEvents.toLocaleString()} events`} detail="Late events per window" icon={RefreshCw} tone={lateArrivalPercent >= 7 ? 'rose' : 'amber'} />
          </div>
          <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-300">
            <p className="font-semibold text-neutral-950 dark:text-white">What changes when you move the controls</p>
            <p className="mt-1">A tighter SLO favors a continuous path. Larger windows make batch delay visible, while late arrivals increase the work needed to correct completed windows. Hybrid designs pay for both paths when recent decisions and historical truth are both requirements.</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

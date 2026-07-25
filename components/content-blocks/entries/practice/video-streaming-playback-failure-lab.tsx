'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CloudOff,
  Gauge,
  PlayCircle,
  RefreshCcw,
  Route,
  ShieldCheck,
  Timer,
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

const BLOCK_ID = 'practice/video-streaming-playback-failure-lab';
const DEFAULT_DATA_FILE = '/api/content/practice/video-streaming/data/playback-failures.json';

type Phase = { id: string; label: string; detail: string; bufferMultiplier: number };
type Failure = { id: string; label: string; detail: string; recoverySeconds: number; originPressure: number; requiredCapability: string };
type Response = { id: string; label: string; detail: string; capability: string; recoveryFactor: number; originRelief: number; qualityCost: number };
type FailureData = {
  title: string;
  description: string;
  defaults: { phaseId: string; failureId: string; responseId: string; bufferSeconds: number };
  bufferBounds: { min: number; max: number; step: number };
  phases: Phase[];
  failures: Failure[];
  responses: Response[];
};

function isFailureData(value: unknown): value is FailureData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<FailureData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && typeof data.defaults?.phaseId === 'string'
      && typeof data.defaults.failureId === 'string'
      && typeof data.defaults.responseId === 'string'
      && typeof data.defaults.bufferSeconds === 'number'
      && typeof data.bufferBounds?.min === 'number'
      && typeof data.bufferBounds.max === 'number'
      && typeof data.bufferBounds.step === 'number'
      && Array.isArray(data.phases)
      && data.phases.length > 0
      && data.phases.every((item) => typeof item.id === 'string' && typeof item.bufferMultiplier === 'number')
      && Array.isArray(data.failures)
      && data.failures.length > 0
      && data.failures.every((item) => typeof item.id === 'string' && typeof item.recoverySeconds === 'number' && typeof item.requiredCapability === 'string')
      && Array.isArray(data.responses)
      && data.responses.length > 0
      && data.responses.every((item) => typeof item.id === 'string' && typeof item.recoveryFactor === 'number' && typeof item.capability === 'string'),
  );
}

export default function VideoStreamingPlaybackFailureLab({ dataFile = DEFAULT_DATA_FILE }: { dataFile?: string }) {
  const [data, setData] = useState<FailureData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Could not load failure scenarios (${response.status}).`);
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        if (!isFailureData(value)) throw new Error('The failure data does not match the expected contract.');
        setData(value);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Could not load failure scenarios.');
      });
    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <FailureWorkbench data={data} />;
}

function FailureWorkbench({ data }: { data: FailureData }) {
  const [phaseId, setPhaseId] = useState(data.defaults.phaseId);
  const [failureId, setFailureId] = useState(data.defaults.failureId);
  const [responseId, setResponseId] = useState(data.defaults.responseId);
  const [bufferSeconds, setBufferSeconds] = useState(data.defaults.bufferSeconds);

  const phase = data.phases.find((item) => item.id === phaseId) ?? data.phases[0];
  const failure = data.failures.find((item) => item.id === failureId) ?? data.failures[0];
  const response = data.responses.find((item) => item.id === responseId) ?? data.responses[0];
  const result = useMemo(() => {
    const effectiveBufferSeconds = bufferSeconds * phase.bufferMultiplier;
    const recoverySeconds = Math.max(1, Math.round(failure.recoverySeconds * response.recoveryFactor));
    const visibleDelaySeconds = Math.max(0, recoverySeconds - effectiveBufferSeconds);
    const correctCapability = response.capability === failure.requiredCapability;
    const originPressure = Math.max(0, failure.originPressure - response.originRelief);
    const originProtected = originPressure < 80;
    const uninterrupted = visibleDelaySeconds === 0;
    const healthy = correctCapability && originProtected && (uninterrupted || phase.id === 'startup');
    const experienceLabel = phase.id === 'startup'
      ? `${recoverySeconds}s startup wait`
      : uninterrupted
        ? 'No visible stall'
        : `${visibleDelaySeconds.toFixed(0)}s rebuffer`;
    return { correctCapability, effectiveBufferSeconds, experienceLabel, healthy, originPressure, originProtected, recoverySeconds, uninterrupted, visibleDelaySeconds };
  }, [bufferSeconds, failure, phase, response]);

  function reset() {
    setPhaseId(data.defaults.phaseId);
    setFailureId(data.defaults.failureId);
    setResponseId(data.defaults.responseId);
    setBufferSeconds(data.defaults.bufferSeconds);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader eyebrow="Playback resilience lab" title={data.title} description={data.description} icon={CloudOff} accent="rose" onReset={reset} />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">1. Playback phase</legend>
                <div className="mt-3 space-y-2">{data.phases.map((item) => <LabChoice key={item.id} selected={phase.id === item.id} label={item.label} detail={item.detail} icon={PlayCircle} accent="blue" onClick={() => setPhaseId(item.id)} />)}</div>
              </fieldset>
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">2. Inject a failure</legend>
                <div className="mt-3 space-y-2">{data.failures.map((item) => <LabChoice key={item.id} selected={failure.id === item.id} label={item.label} detail={item.detail} icon={TriangleAlert} accent="rose" onClick={() => setFailureId(item.id)} />)}</div>
              </fieldset>
              <LabRange label="Player buffer" value={bufferSeconds} output={`${bufferSeconds}s`} min={data.bufferBounds.min} max={data.bufferBounds.max} step={data.bufferBounds.step} lowLabel="No margin" highLabel="More resilience" accent="cyan" onChange={setBufferSeconds} />
            </div>
          )}
        >
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">3. Choose the response</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">{data.responses.map((item) => <LabChoice key={item.id} selected={response.id === item.id} label={item.label} detail={item.detail} icon={Route} accent={item.capability === failure.requiredCapability ? 'emerald' : 'amber'} onClick={() => setResponseId(item.id)} />)}</div>
          </fieldset>

          <div aria-live="polite" className={`mt-6 rounded-md border p-4 ${result.healthy ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40' : 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'}`}>
            <div className="flex items-start gap-3">
              {result.healthy
                ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />}
              <div className="min-w-0">
                <p className="text-base font-semibold text-neutral-950 dark:text-white">{result.healthy ? 'The response contains this failure' : 'The response leaves a material playback risk'}</p>
                <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {!result.correctCapability
                    ? `${response.label} does not provide the ${failure.requiredCapability} capability this failure needs.`
                    : !result.originProtected
                      ? 'The player response still sends unsafe pressure toward the origin.'
                      : result.uninterrupted
                        ? 'The modeled recovery completes before the usable buffer is exhausted.'
                        : 'The route recovers, but the viewer experiences a visible delay before media resumes.'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Usable buffer" value={`${result.effectiveBufferSeconds.toFixed(0)}s`} detail={`${phase.label} multiplier applied`} icon={Gauge} tone={result.effectiveBufferSeconds >= result.recoverySeconds ? 'emerald' : 'amber'} />
            <LabMetric label="Recovery time" value={`${result.recoverySeconds}s`} detail="Illustrative route recovery" icon={RefreshCcw} tone="violet" />
            <LabMetric label="Viewer impact" value={result.experienceLabel} detail={`${response.qualityCost}% quality cost index`} icon={Timer} tone={result.uninterrupted ? 'emerald' : 'rose'} />
            <LabMetric label="Origin pressure" value={`${result.originPressure}%`} detail={`${response.originRelief} points relieved`} icon={ShieldCheck} tone={result.originProtected ? 'emerald' : 'rose'} />
          </div>

          <div className="mt-7 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
            <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60"><p className="text-sm font-semibold text-neutral-950 dark:text-white">Failure timeline</p></div>
            <ol className="grid gap-0 sm:grid-cols-3">
              <TimelineStep number="1" title={failure.label} detail={`Base recovery ${failure.recoverySeconds}s`} />
              <TimelineStep number="2" title={response.label} detail={`${result.recoverySeconds}s after response`} />
              <TimelineStep number="3" title={result.experienceLabel} detail={result.correctCapability ? 'Required capability present' : `Needs ${failure.requiredCapability}`} />
            </ol>
          </div>

          <p className="mt-5 text-sm leading-6 text-neutral-600 dark:text-neutral-400">This model is for reasoning, not an SLO forecast. Production values must come from player traces, regional failure drills, and CDN-specific load tests.</p>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function TimelineStep({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <li className="min-w-0 border-b border-neutral-200 p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 dark:border-neutral-800"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">{number}</span><p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">{title}</p><p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">{detail}</p></li>;
}

function LoadState() {
  return <div data-content-block={BLOCK_ID} aria-label="Loading playback failure lab" className="not-prose my-7 h-72 animate-pulse rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900" />;
}

function LoadError({ detail }: { detail: string }) {
  return <div data-content-block={BLOCK_ID} role="alert" className="not-prose my-7 rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{detail}</div>;
}

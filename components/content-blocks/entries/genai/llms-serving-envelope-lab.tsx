'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Boxes,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Cpu,
  Gauge,
  Layers3,
  LoaderCircle,
  MemoryStick,
  Timer,
  Zap,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ServingScenario = {
  id: string;
  label: string;
  brief: string;
  promptTokens: number;
  reusablePrefixTokens: number;
  outputTokens: number;
  ttftTargetMs: number;
  tpotTargetMs: number;
  qualityTarget: number;
  memoryBudgetGib: number;
};

type ModelProfile = {
  id: string;
  label: string;
  detail: string;
  weightsGib: number;
  prefillTokensPerSecond: number;
  baseTpotMs: number;
  referenceConcurrency: number;
  kvMibPer1kTokens: number;
  qualityScore: number;
};

type ServingEnvelopeModel = {
  title: string;
  description: string;
  notice: string;
  defaults: {
    scenarioId: string;
    profileId: string;
    concurrency: number;
    prefixHitRate: number;
    batchWindowMs: number;
  };
  scenarios: ServingScenario[];
  profiles: ModelProfile[];
};

const BLOCK_ID = 'genai/llms-serving-envelope-lab';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isServingEnvelopeModel(value: unknown): value is ServingEnvelopeModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ServingEnvelopeModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.notice
      && candidate.defaults
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((scenario) => (
        scenario.id
        && scenario.label
        && isFiniteNumber(scenario.promptTokens)
        && scenario.promptTokens > 0
        && isFiniteNumber(scenario.memoryBudgetGib)
      ))
      && Array.isArray(candidate.profiles)
      && candidate.profiles.length > 0
      && candidate.profiles.every((profile) => (
        profile.id
        && profile.label
        && isFiniteNumber(profile.weightsGib)
        && isFiniteNumber(profile.prefillTokensPerSecond)
        && profile.prefillTokensPerSecond > 0
      )),
  );
}

function formatMs(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)}s` : `${Math.round(value)}ms`;
}

function formatTokens(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export default function LlmsServingEnvelopeLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<ServingEnvelopeModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No serving envelope model was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isServingEnvelopeModel(payload)) {
          throw new Error('The serving envelope model is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load serving data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <ServingEnvelopeLab data={data} />;
}

function ServingEnvelopeLab({ data }: { data: ServingEnvelopeModel }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const initialProfile = data.profiles.find((item) => item.id === data.defaults.profileId)
    ?? data.profiles[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [profileId, setProfileId] = useState(initialProfile.id);
  const [concurrency, setConcurrency] = useState(data.defaults.concurrency);
  const [prefixHitRate, setPrefixHitRate] = useState(data.defaults.prefixHitRate);
  const [batchWindowMs, setBatchWindowMs] = useState(data.defaults.batchWindowMs);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const profile = data.profiles.find((item) => item.id === profileId) ?? data.profiles[0];

  const result = useMemo(() => {
    const reusedTokens = scenario.reusablePrefixTokens * prefixHitRate / 100;
    const effectivePromptTokens = scenario.promptTokens - reusedTokens;
    const schedulerMs = 90;
    const prefillMs = effectivePromptTokens / profile.prefillTokensPerSecond * 1000;
    const ttftMs = batchWindowMs + schedulerMs + prefillMs;
    const concurrencyPressure = Math.max(
      0,
      (concurrency - profile.referenceConcurrency) / profile.referenceConcurrency,
    );
    const tpotMs = profile.baseTpotMs * (1 + 0.65 * concurrencyPressure);
    const kvGib = concurrency
      * (scenario.promptTokens + scenario.outputTokens)
      / 1000
      * profile.kvMibPer1kTokens
      / 1024;
    const totalMemoryGib = profile.weightsGib + kvGib;
    const ttftPass = ttftMs <= scenario.ttftTargetMs;
    const tpotPass = tpotMs <= scenario.tpotTargetMs;
    const memoryPass = totalMemoryGib <= scenario.memoryBudgetGib;
    const qualityPass = profile.qualityScore >= scenario.qualityTarget;
    const outputTimeMs = scenario.outputTokens * tpotMs;
    const endToEndMs = ttftMs + outputTimeMs;

    let verdict = 'The modeled bundle fits this request envelope';
    let detail = 'First token, decode, memory, and task-quality thresholds all pass in the teaching model.';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';

    if (!memoryPass) {
      verdict = 'KV state pushes the worker beyond its memory budget';
      detail = `Weights plus active-sequence state need ${totalMemoryGib.toFixed(1)} GiB against a ${scenario.memoryBudgetGib} GiB budget. Reduce context or concurrency, or change the measured bundle.`;
      tone = 'rose';
    } else if (!ttftPass) {
      verdict = 'Prefill misses the first-token target';
      detail = `The modeled path reaches the first token in ${formatMs(ttftMs)}, beyond the ${formatMs(scenario.ttftTargetMs)} target.`;
      tone = 'rose';
    } else if (!tpotPass) {
      verdict = 'Decode pressure misses the streaming target';
      detail = `${concurrency} active sequences raise modeled token latency to ${formatMs(tpotMs)} against a ${formatMs(scenario.tpotTargetMs)} target.`;
      tone = 'rose';
    } else if (!qualityPass) {
      verdict = 'The fast path does not clear the task-quality floor';
      detail = `The ${profile.label.toLowerCase()} scores ${profile.qualityScore} in this teaching profile, below the required ${scenario.qualityTarget}.`;
      tone = 'amber';
    } else if (batchWindowMs > Math.max(100, scenario.ttftTargetMs * 0.2)) {
      verdict = 'The batch wait consumes too much of the latency budget';
      detail = 'The request still fits, but queueing leaves little headroom for traffic bursts and slower prompt slices.';
      tone = 'amber';
    }

    return {
      detail,
      effectivePromptTokens,
      endToEndMs,
      kvGib,
      memoryPass,
      outputTimeMs,
      prefillMs,
      qualityPass,
      reusedTokens,
      schedulerMs,
      tone,
      totalMemoryGib,
      tpotMs,
      tpotPass,
      ttftMs,
      ttftPass,
      verdict,
    };
  }, [batchWindowMs, concurrency, prefixHitRate, profile, scenario]);

  const chooseScenario = (nextScenario: ServingScenario) => {
    setScenarioId(nextScenario.id);
    setConcurrency(nextScenario.id === 'batch-extraction' ? 48 : nextScenario.id === 'document-analysis' ? 8 : 16);
  };

  const reset = () => {
    setScenarioId(initialScenario.id);
    setProfileId(initialProfile.id);
    setConcurrency(data.defaults.concurrency);
    setPrefixHitRate(data.defaults.prefixHitRate);
    setBatchWindowMs(data.defaults.batchWindowMs);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Inference envelope lab"
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
                  1. Request shape
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.brief}
                      icon={item.id === 'batch-extraction' ? Boxes : item.id === 'document-analysis' ? Layers3 : Zap}
                      accent={item.id === 'batch-extraction' ? 'amber' : item.id === 'document-analysis' ? 'violet' : 'cyan'}
                      onClick={() => chooseScenario(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Model tier
                </legend>
                <div className="mt-3 space-y-2">
                  {data.profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === profile.id}
                      label={item.label}
                      detail={item.detail}
                      icon={Cpu}
                      accent={item.id === 'compact' ? 'emerald' : item.id === 'balanced' ? 'blue' : 'violet'}
                      onClick={() => setProfileId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Active sequences"
                value={concurrency}
                output={`${concurrency}`}
                min={1}
                max={64}
                step={1}
                accent="cyan"
                lowLabel="1"
                highLabel="64"
                onChange={setConcurrency}
              />
              <LabRange
                label="Reusable-prefix hit rate"
                value={prefixHitRate}
                output={`${prefixHitRate}%`}
                min={0}
                max={100}
                step={5}
                accent="emerald"
                lowLabel="No reuse"
                highLabel="All eligible"
                onChange={setPrefixHitRate}
              />
              <LabRange
                label="Batch wait"
                value={batchWindowMs}
                output={`${batchWindowMs} ms`}
                min={0}
                max={200}
                step={10}
                accent="amber"
                lowLabel="Immediate"
                highLabel="200 ms"
                onChange={setBatchWindowMs}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Time to first token"
                value={formatMs(result.ttftMs)}
                detail={`Target: at most ${formatMs(scenario.ttftTargetMs)}.`}
                icon={Timer}
                tone={result.ttftPass ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Time per output token"
                value={formatMs(result.tpotMs)}
                detail={`Target: at most ${formatMs(scenario.tpotTargetMs)}.`}
                icon={Zap}
                tone={result.tpotPass ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Worker memory"
                value={`${result.totalMemoryGib.toFixed(1)} GiB`}
                detail={`${profile.weightsGib} GiB weights + ${result.kvGib.toFixed(1)} GiB KV state.`}
                icon={MemoryStick}
                tone={result.memoryPass ? 'violet' : 'rose'}
              />
              <LabMetric
                label="Modeled quality"
                value={`${profile.qualityScore}`}
                detail={`Task floor: ${scenario.qualityTarget}. Validate on real cases.`}
                icon={Gauge}
                tone={result.qualityPass ? 'emerald' : 'amber'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Request timeline
                  </p>
                  <h4 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                    Prefill determines the first token; decode determines the stream
                  </h4>
                </div>
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  End to end: {formatMs(result.endToEndMs)}
                </p>
              </div>

              <div className="mt-5 grid items-stretch gap-2 md:grid-cols-[minmax(0,0.7fr)_auto_minmax(0,1.2fr)_auto_minmax(0,1.4fr)]">
                <TimelineStage
                  label="Schedule"
                  value={formatMs(batchWindowMs + result.schedulerMs)}
                  detail={`${batchWindowMs} ms batch wait plus modeled dispatch.`}
                  tone="amber"
                />
                <TimelineConnector />
                <TimelineStage
                  label="Prefill"
                  value={formatMs(result.prefillMs)}
                  detail={`${formatTokens(result.effectivePromptTokens)} tokens processed; ${formatTokens(result.reusedTokens)} reused.`}
                  tone="blue"
                />
                <TimelineConnector />
                <TimelineStage
                  label="Decode"
                  value={formatMs(result.outputTimeMs)}
                  detail={`${scenario.outputTokens} serial output steps at ${formatMs(result.tpotMs)} each.`}
                  tone="violet"
                />
              </div>
            </section>

            <section className="rounded-md border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Device-memory envelope</p>
                  <h4 className="mt-2 font-semibold text-neutral-950 dark:text-white">
                    Weights fit first; active sequence state consumes the remaining budget
                  </h4>
                </div>
                <p className="text-sm font-semibold tabular-nums text-neutral-700 dark:text-neutral-300">
                  {result.totalMemoryGib.toFixed(1)} / {scenario.memoryBudgetGib} GiB
                </p>
              </div>
              <div
                className="mt-4 h-4 overflow-hidden rounded-sm bg-neutral-200 dark:bg-neutral-800"
                role="progressbar"
                aria-label="Modeled worker memory used"
                aria-valuemin={0}
                aria-valuemax={scenario.memoryBudgetGib}
                aria-valuenow={Math.min(result.totalMemoryGib, scenario.memoryBudgetGib)}
              >
                <div className="flex h-full">
                  <span
                    className="block h-full bg-violet-500 dark:bg-violet-400"
                    style={{ width: `${Math.min(100, profile.weightsGib / scenario.memoryBudgetGib * 100)}%` }}
                  />
                  <span
                    className={`block h-full ${result.memoryPass ? 'bg-cyan-500 dark:bg-cyan-400' : 'bg-rose-500 dark:bg-rose-400'}`}
                    style={{ width: `${Math.min(100, result.kvGib / scenario.memoryBudgetGib * 100)}%` }}
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 bg-violet-500 dark:bg-violet-400" />Weights</span>
                <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 bg-cyan-500 dark:bg-cyan-400" />KV cache</span>
                <span>{formatTokens(scenario.promptTokens + scenario.outputTokens)} tokens per active sequence</span>
              </div>
            </section>

            <section className={`rounded-md border p-5 ${result.tone === 'emerald'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100'
              : result.tone === 'amber'
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100'}`}
            >
              <div className="flex items-start gap-3">
                {result.tone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <CircleAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${result.tone === 'amber' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`} />
                )}
                <div className="min-w-0">
                  <h4 className="text-base font-semibold">{result.verdict}</h4>
                  <p className="mt-1 text-sm leading-6 opacity-80">{result.detail}</p>
                </div>
              </div>
            </section>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">{data.notice}</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function TimelineStage({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'amber' | 'blue' | 'violet';
}) {
  const styles = {
    amber: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-100',
    blue: 'border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/35 dark:text-blue-100',
    violet: 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/35 dark:text-violet-100',
  } as const;

  return (
    <div className={`min-w-0 rounded-md border p-4 ${styles[tone]}`}>
      <p className="text-xs font-semibold uppercase opacity-70">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-2 text-xs leading-5 opacity-75">{detail}</p>
    </div>
  );
}

function TimelineConnector() {
  return (
    <div className="flex items-center justify-center text-neutral-400 dark:text-neutral-600" aria-hidden="true">
      <ArrowDown className="h-5 w-5 md:hidden" />
      <ArrowRight className="hidden h-5 w-5 md:block" />
    </div>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
            <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
            Loading inference envelope...
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabBody>
          <div className="flex min-h-48 items-center justify-center">
            <div className="max-w-lg rounded-md border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100">
              <div className="flex items-start gap-3">
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h3 className="font-semibold">Inference lab unavailable</h3>
                  <p className="mt-1 text-sm leading-6 opacity-80">{detail}</p>
                </div>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BrainCircuit,
  CheckCircle2,
  CircleAlert,
  Clock3,
  EyeOff,
  Gauge,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  MessageSquareText,
  ShieldAlert,
  Sparkles,
  Timer,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Candidate = {
  id: string;
  text: string;
  relevance: number;
  style: number;
  utility: number;
  repetition: number;
  safety: number;
};

type CompletionScenario = {
  id: string;
  label: string;
  brief: string;
  prefix: string;
  deadlineMs: number;
  minimumSafety: number;
  candidates: Candidate[];
};

type ContextProfile = {
  id: string;
  label: string;
  detail: string;
  tokens: number;
  encodingMs: number;
  relevanceLift: number;
  styleLift: number;
  privacyLabel: string;
};

type ModelProfile = {
  id: string;
  label: string;
  detail: string;
  inferenceMs: number;
  qualityLift: number;
};

type CandidateReleaseData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    contextId: string;
    modelId: string;
    candidateCount: number;
    releaseThreshold: number;
  };
  fixedLatency: {
    clientMs: number;
    networkMs: number;
    releaseGateMs: number;
    perCandidateMs: number;
  };
  contexts: ContextProfile[];
  models: ModelProfile[];
  scenarios: CompletionScenario[];
};

type RankedCandidate = Candidate & { score: number };

const BLOCK_ID = 'genai/smart-text-completion-candidate-release-lab';

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCandidateReleaseData(value: unknown): value is CandidateReleaseData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<CandidateReleaseData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && candidate.fixedLatency
      && finite(candidate.fixedLatency.clientMs)
      && Array.isArray(candidate.contexts)
      && candidate.contexts.length > 0
      && Array.isArray(candidate.models)
      && candidate.models.length > 0
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.prefix === 'string'
        && finite(scenario.deadlineMs)
        && Array.isArray(scenario.candidates)
        && scenario.candidates.length > 0
      )),
  );
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

export default function SmartTextCompletionCandidateReleaseLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CandidateReleaseData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No candidate-release model was supplied.');
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
        if (!isCandidateReleaseData(payload)) {
          throw new Error('Candidate-release data is incomplete.');
        }
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load release data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {loadError ? (
        <LoadState error={loadError} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : data ? (
        <CandidateReleaseLab data={data} />
      ) : (
        <LoadState error={null} onRetry={() => setReloadKey((key) => key + 1)} />
      )}
    </div>
  );
}

function CandidateReleaseLab({ data }: { data: CandidateReleaseData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const initialContext = data.contexts.find((item) => item.id === data.defaults.contextId)
    ?? data.contexts[0];
  const initialModel = data.models.find((item) => item.id === data.defaults.modelId)
    ?? data.models[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [contextId, setContextId] = useState(initialContext.id);
  const [modelId, setModelId] = useState(initialModel.id);
  const [candidateCount, setCandidateCount] = useState(data.defaults.candidateCount);
  const [releaseThreshold, setReleaseThreshold] = useState(data.defaults.releaseThreshold);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const context = data.contexts.find((item) => item.id === contextId) ?? data.contexts[0];
  const model = data.models.find((item) => item.id === modelId) ?? data.models[0];

  const result = useMemo(() => {
    const ranked: RankedCandidate[] = scenario.candidates
      .slice(0, candidateCount)
      .map((candidate) => {
        const relevance = clamp(candidate.relevance + context.relevanceLift + model.qualityLift);
        const style = clamp(candidate.style + context.styleLift + model.qualityLift / 2);
        const score = 0.45 * relevance
          + 0.20 * style
          + 0.20 * candidate.utility
          + 0.15 * candidate.repetition;
        return { ...candidate, score: Math.round(score * 10) / 10 };
      })
      .sort((left, right) => right.score - left.score);

    const top = ranked[0];
    const stages = [
      { id: 'client', label: 'Client', value: data.fixedLatency.clientMs, tone: 'bg-blue-500 dark:bg-blue-400' },
      { id: 'network', label: 'Network', value: data.fixedLatency.networkMs, tone: 'bg-cyan-500 dark:bg-cyan-400' },
      { id: 'context', label: 'Context', value: context.encodingMs, tone: 'bg-violet-500 dark:bg-violet-400' },
      { id: 'model', label: 'Model', value: model.inferenceMs, tone: 'bg-fuchsia-500 dark:bg-fuchsia-400' },
      {
        id: 'candidates',
        label: 'Decode',
        value: candidateCount * data.fixedLatency.perCandidateMs,
        tone: 'bg-amber-500 dark:bg-amber-400',
      },
      { id: 'gate', label: 'Gate', value: data.fixedLatency.releaseGateMs, tone: 'bg-emerald-500 dark:bg-emerald-400' },
    ];
    const totalMs = stages.reduce((sum, stage) => sum + stage.value, 0);
    const headroomMs = scenario.deadlineMs - totalMs;
    const latencyPass = headroomMs >= 0;
    const scorePass = Boolean(top && top.score >= releaseThreshold);
    const safetyPass = Boolean(top && top.safety >= scenario.minimumSafety);
    const releases = latencyPass && scorePass && safetyPass;

    let verdict = 'Render the proposal';
    let detail = 'The top candidate clears ranking, safety, and end-to-end deadline gates.';
    if (!latencyPass) {
      verdict = 'Suppress: deadline missed';
      detail = `The modeled path is ${Math.abs(headroomMs)} ms beyond the client deadline. A late suggestion is stale interaction work.`;
    } else if (!safetyPass) {
      verdict = 'Suppress: safety gate failed';
      detail = `The top candidate has safety evidence ${top?.safety ?? 0}, below the required ${scenario.minimumSafety}.`;
    } else if (!scorePass) {
      verdict = 'Suppress: value is below threshold';
      detail = `The top ranking score is ${top?.score.toFixed(1) ?? '0.0'}, below the ${releaseThreshold} release floor.`;
    }

    return {
      detail,
      headroomMs,
      latencyPass,
      ranked,
      releases,
      safetyPass,
      scorePass,
      stages,
      top,
      totalMs,
      verdict,
    };
  }, [candidateCount, context, data.fixedLatency, model, releaseThreshold, scenario]);

  function reset() {
    setScenarioId(initialScenario.id);
    setContextId(initialContext.id);
    setModelId(initialModel.id);
    setCandidateCount(data.defaults.candidateCount);
    setReleaseThreshold(data.defaults.releaseThreshold);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Candidate decision workbench"
        title={data.title}
        description={data.description}
        icon={Sparkles}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Choose the editor state
              </legend>
              <div className="mt-3 space-y-2">
                {data.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.brief}
                    icon={MessageSquareText}
                    accent="blue"
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Set the context envelope
              </legend>
              <div className="mt-3 space-y-2">
                {data.contexts.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === context.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Layers3}
                    accent="violet"
                    onClick={() => setContextId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Choose the serving model
              </legend>
              <div className="mt-3 space-y-2">
                {data.models.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === model.id}
                    label={item.label}
                    detail={item.detail}
                    icon={BrainCircuit}
                    accent="cyan"
                    onClick={() => setModelId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <div className="space-y-6">
              <LabRange
                label="Generated candidates"
                value={candidateCount}
                output={`${candidateCount}`}
                min={1}
                max={Math.min(4, scenario.candidates.length)}
                step={1}
                accent="amber"
                lowLabel="Less decode work"
                highLabel="More ranking choice"
                onChange={setCandidateCount}
              />
              <LabRange
                label="Release threshold"
                value={releaseThreshold}
                output={`${releaseThreshold}`}
                min={55}
                max={90}
                step={1}
                accent="emerald"
                lowLabel="More coverage"
                highLabel="More abstention"
                onChange={setReleaseThreshold}
              />
            </div>
          </div>
        )}
      >
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="End-to-end"
              value={`${result.totalMs} ms`}
              detail={`${scenario.deadlineMs} ms deadline`}
              icon={Timer}
              tone={result.latencyPass ? 'cyan' : 'rose'}
            />
            <LabMetric
              label="Headroom"
              value={`${result.headroomMs >= 0 ? '+' : ''}${result.headroomMs} ms`}
              detail={result.latencyPass ? 'Deadline survives' : 'Deadline exceeded'}
              icon={Clock3}
              tone={result.latencyPass ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Top rank"
              value={result.top ? result.top.score.toFixed(1) : '0.0'}
              detail={`${releaseThreshold} release floor`}
              icon={Gauge}
              tone={result.scorePass ? 'violet' : 'amber'}
            />
            <LabMetric
              label="Context"
              value={`${context.tokens} tokens`}
              detail={context.privacyLabel}
              icon={LockKeyhole}
              tone="blue"
            />
          </div>

          <section className="overflow-hidden rounded-md border border-neutral-800 bg-neutral-950 text-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase text-violet-300">Editor preview</p>
                <p className="mt-1 text-xs text-neutral-400">One draft version, one temporary proposal</p>
              </div>
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                  result.releases
                    ? 'border-emerald-500/60 bg-emerald-950 text-emerald-200'
                    : 'border-amber-500/60 bg-amber-950 text-amber-100'
                }`}
              >
                {result.releases ? <BadgeCheck className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                {result.releases ? 'Proposal visible' : 'Abstained'}
              </span>
            </div>
            <div className="min-h-28 px-4 py-5 font-mono text-base leading-8 md:text-lg">
              <span className="text-neutral-100">{scenario.prefix}</span>{' '}
              {result.releases && result.top ? (
                <span className="border-b border-cyan-400/50 text-cyan-300">{result.top.text}</span>
              ) : (
                <span className="text-neutral-500">[no suggestion rendered]</span>
              )}
            </div>
          </section>

          <section aria-label="Latency budget" className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Latency budget trace</h4>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Every stage spends the same client-visible deadline.
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
                {result.totalMs} / {scenario.deadlineMs} ms
              </span>
            </div>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
              {result.stages.map((stage) => (
                <span
                  key={stage.id}
                  className={stage.tone}
                  style={{ width: `${Math.max(4, stage.value / result.totalMs * 100)}%` }}
                  title={`${stage.label}: ${stage.value} ms`}
                />
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              {result.stages.map((stage) => (
                <div key={stage.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-neutral-500 dark:text-neutral-400">{stage.label}</span>
                  <strong className="tabular-nums text-neutral-900 dark:text-neutral-100">{stage.value} ms</strong>
                </div>
              ))}
            </div>
          </section>

          <section aria-label="Ranked candidates">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">Ranked candidate set</h4>
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                  Soft evidence orders candidates; the safety floor remains a hard gate.
                </p>
              </div>
              <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                {result.ranked.length} generated
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {result.ranked.map((candidate, index) => {
                const safe = candidate.safety >= scenario.minimumSafety;
                return (
                  <div
                    key={candidate.id}
                    className={`rounded-md border p-3 ${
                      index === 0
                        ? 'border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30'
                        : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
                    }`}
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="min-w-0 text-sm font-medium text-neutral-900 dark:text-neutral-100">
                        <span className="mr-2 text-neutral-400">#{index + 1}</span>{candidate.text}
                      </p>
                      <div className="flex shrink-0 items-center gap-2 text-xs font-semibold">
                        <span className="tabular-nums text-violet-700 dark:text-violet-300">Rank {candidate.score.toFixed(1)}</span>
                        <span className={safe ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}>
                          {safe ? 'Safety pass' : 'Safety fail'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div className="h-full rounded-full bg-violet-500 dark:bg-violet-400" style={{ width: `${candidate.score}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section
            aria-live="polite"
            className={`rounded-md border p-4 ${
              result.releases
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
                : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.releases ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />}
              <div>
                <h4 className="font-semibold">{result.verdict}</h4>
                <p className="mt-1 text-sm leading-6 opacity-80">{result.detail}</p>
              </div>
            </div>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <section className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start gap-3">
        {error ? (
          <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
        ) : (
          <LoaderCircle className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-violet-500 motion-reduce:animate-none" />
        )}
        <div>
          <h3 className="font-semibold text-neutral-950 dark:text-white">
            {error ? 'Candidate workbench unavailable' : 'Loading candidate workbench'}
          </h3>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {error ?? 'Loading the context, model, and ranking scenarios.'}
          </p>
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              Try again
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

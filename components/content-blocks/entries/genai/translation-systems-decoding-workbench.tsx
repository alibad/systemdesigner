'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Gauge,
  Languages,
  ListFilter,
  Route,
  Search,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Strategy = {
  id: string;
  label: string;
  detail: string;
  baseDecoderMs: number;
  perBeamMs: number;
  enforceConstraints: boolean;
};

type Candidate = {
  id: string;
  translation: string;
  modelScore: number;
  discoveryBeam: number;
  greedyChoice: boolean;
  adequacy: number;
  fluency: number;
  glossaryOk: boolean;
  placeholdersOk: boolean;
  numbersOk: boolean;
  note: string;
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  sourceLocale: string;
  targetLocale: string;
  targetDirection: 'ltr' | 'rtl';
  riskTier: string;
  source: string;
  requiredTerm: string;
  protectedFacts: string[];
  encoderMs: number;
  deadlineMs: number;
  candidates: Candidate[];
};

type DecodingData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    strategyId: string;
    beamWidth: number;
  };
  strategies: Strategy[];
  scenarios: Scenario[];
};

const BLOCK_ID = 'genai/translation-systems-decoding-workbench';

function isDecodingData(value: unknown): value is DecodingData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DecodingData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.scenarioId
      && candidate.defaults.strategyId
      && typeof candidate.defaults.beamWidth === 'number'
      && Array.isArray(candidate.strategies)
      && candidate.strategies.length >= 2
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((scenario) => (
        Array.isArray(scenario.candidates) && scenario.candidates.length > 0
      )),
  );
}

export default function TranslationSystemsDecodingWorkbench({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<DecodingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No decoding scenarios were supplied.');
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
        if (!isDecodingData(payload)) throw new Error('Decoding scenario data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load decoding data.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {error ? (
        <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : data ? (
        <DecodingWorkbench data={data} />
      ) : (
        <LoadState error={null} onRetry={() => setReloadKey((key) => key + 1)} />
      )}
    </div>
  );
}

function DecodingWorkbench({ data }: { data: DecodingData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
    ?? data.scenarios[0];
  const initialStrategy = data.strategies.find((item) => item.id === data.defaults.strategyId)
    ?? data.strategies[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [strategyId, setStrategyId] = useState(initialStrategy.id);
  const [beamWidth, setBeamWidth] = useState(data.defaults.beamWidth);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const strategy = data.strategies.find((item) => item.id === strategyId) ?? data.strategies[0];

  const result = useMemo(() => {
    const effectiveBeam = strategy.id === 'greedy' ? 1 : beamWidth;
    const discovered = scenario.candidates.filter((item) => item.discoveryBeam <= effectiveBeam);
    const admissible = strategy.enforceConstraints
      ? discovered.filter((item) => item.glossaryOk && item.placeholdersOk && item.numbersOk)
      : discovered;
    const selected = strategy.id === 'greedy'
      ? scenario.candidates.find((item) => item.greedyChoice) ?? scenario.candidates[0]
      : [...admissible].sort((left, right) => right.modelScore - left.modelScore)[0];
    const latencyMs = scenario.encoderMs
      + strategy.baseDecoderMs
      + Math.max(0, effectiveBeam - 1) * strategy.perBeamMs
      + (strategy.enforceConstraints ? 5 : 0);
    const integrityPassed = Boolean(
      selected?.glossaryOk && selected.placeholdersOk && selected.numbersOk,
    );
    const qualityIndex = selected
      ? Math.round(
        selected.adequacy * 0.5
          + selected.fluency * 0.2
          + (selected.glossaryOk ? 10 : 0)
          + (selected.placeholdersOk ? 10 : 0)
          + (selected.numbersOk ? 10 : 0),
      )
      : 0;
    const withinDeadline = latencyMs <= scenario.deadlineMs;
    const release = Boolean(selected && integrityPassed && selected.adequacy >= 85 && withinDeadline);
    const reason = !selected
      ? 'No admissible candidate remains inside the selected beam.'
      : !selected.placeholdersOk
        ? 'Hold: a protected placeholder or markup span changed.'
        : !selected.numbersOk
          ? 'Hold: a protected number or time changed.'
          : !selected.glossaryOk
            ? 'Hold: the approved terminology contract failed.'
            : selected.adequacy < 85
              ? 'Hold: source meaning is incomplete despite acceptable surface form.'
              : !withinDeadline
                ? 'Hold: the candidate finished after this request deadline.'
                : 'Release: meaning, protected facts, terminology, and deadline all pass.';

    return {
      admissible,
      discovered,
      effectiveBeam,
      integrityPassed,
      latencyMs,
      qualityIndex,
      reason,
      release,
      selected,
      withinDeadline,
    };
  }, [beamWidth, scenario, strategy]);

  function reset() {
    setScenarioId(initialScenario.id);
    setStrategyId(initialStrategy.id);
    setBeamWidth(data.defaults.beamWidth);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Candidate decoding lab"
        title={data.title}
        description={data.description}
        icon={Languages}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Choose a translation contract
              </legend>
              <div className="mt-3 space-y-2">
                {data.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={scenarioId === item.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Route}
                    accent="blue"
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Select a decoding policy
              </legend>
              <div className="mt-3 space-y-2">
                {data.strategies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={strategyId === item.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.enforceConstraints ? ListFilter : Search}
                    accent={item.enforceConstraints ? 'emerald' : 'violet'}
                    onClick={() => setStrategyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            {strategy.id !== 'greedy' ? (
              <LabRange
                label="Beam width"
                value={beamWidth}
                output={`${beamWidth} hypotheses`}
                min={2}
                max={8}
                step={1}
                lowLabel="Less search"
                highLabel="More latency"
                accent="violet"
                onChange={setBeamWidth}
              />
            ) : null}
          </div>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Search width"
            value={`${result.effectiveBeam}`}
            detail={`${result.discovered.length} of ${scenario.candidates.length} illustrative candidates discovered`}
            icon={Search}
            tone="violet"
          />
          <LabMetric
            label="Modeled latency"
            value={`${result.latencyMs} ms`}
            detail={`${scenario.deadlineMs} ms request deadline`}
            icon={Clock3}
            tone={result.withinDeadline ? 'cyan' : 'rose'}
          />
          <LabMetric
            label="Evidence index"
            value={`${result.qualityIndex} / 100`}
            detail="Illustrative adequacy, fluency, and integrity portfolio"
            icon={Gauge}
            tone={result.qualityIndex >= 85 ? 'emerald' : 'amber'}
          />
          <LabMetric
            label="Release decision"
            value={result.release ? 'Release' : 'Hold'}
            detail={result.release ? 'All required gates pass' : 'One or more gates fail'}
            icon={result.release ? BadgeCheck : ShieldAlert}
            tone={result.release ? 'emerald' : 'rose'}
          />
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <section className="min-w-0 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-900 dark:bg-blue-950 dark:text-blue-200">
                {scenario.sourceLocale}
              </span>
              <span aria-hidden="true" className="text-neutral-400">-&gt;</span>
              <span className="rounded-sm bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-200">
                {scenario.targetLocale}
              </span>
              <span className="rounded-sm border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:text-neutral-200">
                {scenario.riskTier}
              </span>
            </div>
            <p className="mt-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              Source
            </p>
            <p className="mt-2 text-base leading-7 text-neutral-950 dark:text-white">{scenario.source}</p>
            <dl className="mt-5 space-y-3 text-sm">
              <div>
                <dt className="font-semibold text-neutral-950 dark:text-white">Required term</dt>
                <dd className="mt-1 break-words text-neutral-600 dark:text-neutral-300">{scenario.requiredTerm}</dd>
              </div>
              <div>
                <dt className="font-semibold text-neutral-950 dark:text-white">Protected facts</dt>
                <dd className="mt-2 flex flex-wrap gap-2">
                  {scenario.protectedFacts.map((fact) => (
                    <code
                      key={fact}
                      className="rounded-sm bg-white px-2 py-1 text-xs text-neutral-800 ring-1 ring-neutral-200 dark:bg-neutral-950 dark:text-neutral-100 dark:ring-neutral-700"
                    >
                      {fact}
                    </code>
                  ))}
                </dd>
              </div>
            </dl>
          </section>

          <section
            aria-live="polite"
            className={`min-w-0 rounded-md border p-5 ${
              result.release
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/35 dark:text-rose-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.release ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              ) : (
                <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase opacity-75">Selected output</p>
                <p
                  dir={scenario.targetDirection}
                  className="mt-3 break-words text-lg font-semibold leading-8"
                >
                  {result.selected?.translation ?? 'No admissible candidate'}
                </p>
                <p className="mt-3 text-sm leading-6 opacity-80">{result.reason}</p>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            <Sparkles aria-hidden="true" className="h-4 w-4" />
            Candidate field
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {scenario.candidates.map((candidate) => {
              const discovered = result.discovered.some((item) => item.id === candidate.id);
              const filtered = discovered
                && strategy.enforceConstraints
                && !result.admissible.some((item) => item.id === candidate.id);
              const selected = result.selected?.id === candidate.id;
              const status = selected
                ? 'Selected'
                : !discovered
                  ? `Needs beam ${candidate.discoveryBeam}`
                  : filtered
                    ? 'Filtered by contract'
                    : 'Available';

              return (
                <article
                  key={candidate.id}
                  className={`min-w-0 rounded-md border p-4 ${
                    selected
                      ? 'border-violet-400 bg-violet-50 text-violet-950 ring-1 ring-violet-400 dark:border-violet-500 dark:bg-violet-950/45 dark:text-violet-50'
                      : filtered
                        ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'
                        : 'border-neutral-200 bg-white text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase opacity-70">{status}</span>
                    <span className="text-xs font-semibold tabular-nums">
                      {(candidate.modelScore * 100).toFixed(0)} score
                    </span>
                  </div>
                  <p dir={scenario.targetDirection} className="mt-3 break-words text-sm font-semibold leading-6">
                    {candidate.translation}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                    <EvidencePill passed={candidate.glossaryOk} label="Term" />
                    <EvidencePill passed={candidate.placeholdersOk} label="Spans" />
                    <EvidencePill passed={candidate.numbersOk} label="Numbers" />
                  </div>
                  <p className="mt-3 text-xs leading-5 opacity-75">{candidate.note}</p>
                </article>
              );
            })}
          </div>
        </section>
      </LearningLabBody>
    </LearningLab>
  );
}

function EvidencePill({ passed, label }: { passed: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-2 py-1 ${
        passed
          ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/60 dark:text-emerald-100'
          : 'bg-rose-100 text-rose-900 dark:bg-rose-900/60 dark:text-rose-100'
      }`}
    >
      {passed ? <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" /> : <ShieldAlert aria-hidden="true" className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div
      className={`not-prose my-7 rounded-lg border p-6 ${
        error
          ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50'
          : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
      }`}
      role={error ? 'alert' : 'status'}
    >
      <div className="flex items-start gap-3">
        {error ? <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <Clock3 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-pulse" />}
        <div>
          <p className="font-semibold">{error ? 'Decoding lab unavailable' : 'Loading decoding lab'}</p>
          {error ? <p className="mt-2 text-sm opacity-80">{error}</p> : null}
          {error ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

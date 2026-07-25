'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  FileQuestion,
  Gauge,
  LoaderCircle,
  RotateCcw,
  Search,
  SearchX,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Workflow,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Scenario = {
  id: string;
  label: string;
  detail: string;
  answerablePct: number;
  retrievalRecallPct: number;
  readerCorrectPct: number;
  abstentionSpecificityPct: number;
};

type PipelineData = {
  sampleSize: number;
  defaultScenarioId: string;
  gates: {
    minimumCorrectPct: number;
    maximumUnsupportedAnswerPct: number;
  };
  scenarios: Scenario[];
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/world-knowledge-benchmarks/data/pipeline-diagnosis.json';

function isPipelineData(value: unknown): value is PipelineData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PipelineData>;
  return typeof candidate.sampleSize === 'number'
    && typeof candidate.defaultScenarioId === 'string'
    && Boolean(candidate.gates)
    && Array.isArray(candidate.scenarios)
    && candidate.scenarios.length > 0;
}

function percent(value: number, total: number) {
  return total === 0 ? 0 : (100 * value) / total;
}

export default function WorldKnowledgeBenchmarksPipelineDiagnosisLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<PipelineData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scenarioId, setScenarioId] = useState('');
  const [answerablePct, setAnswerablePct] = useState(70);
  const [retrievalRecallPct, setRetrievalRecallPct] = useState(82);
  const [readerCorrectPct, setReaderCorrectPct] = useState(88);
  const [abstentionSpecificityPct, setAbstentionSpecificityPct] = useState(85);

  function applyScenario(scenario: Scenario) {
    setScenarioId(scenario.id);
    setAnswerablePct(scenario.answerablePct);
    setRetrievalRecallPct(scenario.retrievalRecallPct);
    setReaderCorrectPct(scenario.readerCorrectPct);
    setAbstentionSpecificityPct(scenario.abstentionSpecificityPct);
  }

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isPipelineData(payload)) throw new Error('Pipeline diagnosis data is incomplete.');
        if (!active) return;
        const initial = payload.scenarios.find((item) => item.id === payload.defaultScenarioId)
          ?? payload.scenarios[0];
        setData(payload);
        applyScenario(initial);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load pipeline data.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const model = useMemo(() => {
    if (!data) return null;
    const answerable = Math.round(data.sampleSize * answerablePct / 100);
    const unanswerable = data.sampleSize - answerable;
    const evidenceRetrieved = Math.round(answerable * retrievalRecallPct / 100);
    const retrievalMiss = answerable - evidenceRetrieved;
    const supportedCorrect = Math.round(evidenceRetrieved * readerCorrectPct / 100);
    const readerError = evidenceRetrieved - supportedCorrect;
    const correctAbstention = Math.round(unanswerable * abstentionSpecificityPct / 100);
    const unsupportedAnswer = unanswerable - correctAbstention;
    const totalCorrect = supportedCorrect + correctAbstention;
    const totalFailures = retrievalMiss + readerError + unsupportedAnswer;
    const correctPct = percent(totalCorrect, data.sampleSize);
    const unsupportedAnswerPct = percent(unsupportedAnswer, data.sampleSize);
    const buckets = [
      {
        id: 'retrieval',
        label: 'Retrieval misses',
        value: retrievalMiss,
        action: 'Improve corpus coverage, indexing, query rewriting, or ranking before tuning the reader.',
      },
      {
        id: 'reader',
        label: 'Reader errors',
        value: readerError,
        action: 'Inspect evidence use, span selection, answer formatting, and prompt behavior.',
      },
      {
        id: 'unsupported',
        label: 'Unsupported answers',
        value: unsupportedAnswer,
        action: 'Calibrate the answer gate and test that abstention does not become blanket refusal.',
      },
    ];
    const largestFailure = [...buckets].sort((left, right) => right.value - left.value)[0];
    const gatePasses = correctPct >= data.gates.minimumCorrectPct
      && unsupportedAnswerPct <= data.gates.maximumUnsupportedAnswerPct;

    return {
      answerable,
      buckets,
      correctAbstention,
      correctPct,
      evidenceRetrieved,
      gatePasses,
      largestFailure,
      readerError,
      retrievalMiss,
      supportedCorrect,
      totalCorrect,
      totalFailures,
      unanswerable,
      unsupportedAnswer,
      unsupportedAnswerPct,
    };
  }, [abstentionSpecificityPct, answerablePct, data, readerCorrectPct, retrievalRecallPct]);

  function changeRange(setter: (value: number) => void, value: number) {
    setScenarioId('custom');
    setter(value);
  }

  function reset() {
    if (!data) return;
    const initial = data.scenarios.find((item) => item.id === data.defaultScenarioId)
      ?? data.scenarios[0];
    applyScenario(initial);
  }

  return (
    <div data-content-block="genai/world-knowledge-benchmarks-pipeline-diagnosis-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Failure attribution lab"
          title="Find the stage that loses the answer"
          description="Every question flows into one auditable outcome. Challenge retrieval, reading, or abstention and watch the release gate and next investment move."
          icon={Workflow}
          accent="cyan"
          onReset={data ? reset : undefined}
        />

        {!data || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Challenge the pipeline
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.scenarios.map((scenario) => (
                      <LabChoice
                        key={scenario.id}
                        selected={scenario.id === scenarioId}
                        label={scenario.label}
                        detail={scenario.detail}
                        icon={scenario.id === 'index-drift' ? SearchX : scenario.id === 'reader-confusion' ? FileQuestion : scenario.id === 'over-answering' ? ShieldX : ShieldCheck}
                        accent={scenario.id === 'balanced' ? 'emerald' : scenario.id === 'over-answering' ? 'rose' : 'amber'}
                        onClick={() => applyScenario(scenario)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="Answerable questions"
                  value={answerablePct}
                  output={`${answerablePct}%`}
                  min={30}
                  max={90}
                  step={1}
                  lowLabel="Many unsupported"
                  highLabel="Mostly answerable"
                  accent="blue"
                  onChange={(value) => changeRange(setAnswerablePct, value)}
                />

                <LabRange
                  label="Retrieval recall"
                  value={retrievalRecallPct}
                  output={`${retrievalRecallPct}%`}
                  min={35}
                  max={98}
                  step={1}
                  lowLabel="Evidence often missing"
                  highLabel="Evidence usually found"
                  accent="violet"
                  onChange={(value) => changeRange(setRetrievalRecallPct, value)}
                />

                <LabRange
                  label="Reader correct when evidence arrives"
                  value={readerCorrectPct}
                  output={`${readerCorrectPct}%`}
                  min={35}
                  max={98}
                  step={1}
                  lowLabel="Reader confused"
                  highLabel="Reader precise"
                  accent="cyan"
                  onChange={(value) => changeRange(setReaderCorrectPct, value)}
                />

                <LabRange
                  label="Correct abstention on unsupported questions"
                  value={abstentionSpecificityPct}
                  output={`${abstentionSpecificityPct}%`}
                  min={25}
                  max={99}
                  step={1}
                  lowLabel="Guesses often"
                  highLabel="Abstains correctly"
                  accent="amber"
                  onChange={(value) => changeRange(setAbstentionSpecificityPct, value)}
                />
              </div>
            )}
          >
            <div className="min-w-0 space-y-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <LabMetric
                  label="Correct outcomes"
                  value={`${model.correctPct.toFixed(1)}%`}
                  detail={`${model.totalCorrect} of ${data.sampleSize} questions`}
                  icon={CheckCircle2}
                  tone={model.correctPct >= data.gates.minimumCorrectPct ? 'emerald' : 'amber'}
                />
                <LabMetric
                  label="Unsupported answers"
                  value={`${model.unsupportedAnswerPct.toFixed(1)}%`}
                  detail={`Gate maximum: ${data.gates.maximumUnsupportedAnswerPct}%`}
                  icon={ShieldAlert}
                  tone={model.unsupportedAnswerPct <= data.gates.maximumUnsupportedAnswerPct ? 'blue' : 'rose'}
                />
                <LabMetric
                  label="Largest failure source"
                  value={model.largestFailure.label}
                  detail={`${model.largestFailure.value} questions`}
                  icon={CircleAlert}
                  tone="amber"
                />
                <LabMetric
                  label="Illustrative gate"
                  value={model.gatePasses ? 'Pass' : 'Hold'}
                  detail={`Need ${data.gates.minimumCorrectPct}% correct and no more than ${data.gates.maximumUnsupportedAnswerPct}% unsupported answers`}
                  icon={model.gatePasses ? ShieldCheck : ShieldX}
                  tone={model.gatePasses ? 'emerald' : 'rose'}
                />
              </div>

              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h4 className="font-semibold text-neutral-950 dark:text-white">Question outcome partition</h4>
                    <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                      All {data.sampleSize.toLocaleString()} questions stay visible; no failed item disappears from the denominator.
                    </p>
                  </div>
                  <p className="shrink-0 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Failures: {model.totalFailures}
                  </p>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  <OutcomeGroup
                    title={`Answerable / ${model.answerable}`}
                    icon={Search}
                    sampleSize={data.sampleSize}
                    outcomes={[
                      { label: 'Supported correct', value: model.supportedCorrect, color: 'bg-emerald-500 dark:bg-emerald-400' },
                      { label: 'Retrieval miss', value: model.retrievalMiss, color: 'bg-violet-500 dark:bg-violet-400' },
                      { label: 'Reader error', value: model.readerError, color: 'bg-cyan-600 dark:bg-cyan-400' },
                    ]}
                  />
                  <OutcomeGroup
                    title={`Unsupported / ${model.unanswerable}`}
                    icon={BookOpenCheck}
                    sampleSize={data.sampleSize}
                    outcomes={[
                      { label: 'Correct abstention', value: model.correctAbstention, color: 'bg-blue-500 dark:bg-blue-400' },
                      { label: 'Unsupported answer', value: model.unsupportedAnswer, color: 'bg-rose-500 dark:bg-rose-400' },
                    ]}
                  />
                </div>
              </section>

              <section
                aria-live="polite"
                className={`rounded-md border p-4 ${model.gatePasses ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50' : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'}`}
              >
                <div className="flex items-start gap-3">
                  {model.gatePasses ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <Gauge aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    <h4 className="font-semibold">{model.gatePasses ? 'Proceed to protected product cases' : `Prioritize ${model.largestFailure.label.toLowerCase()}`}</h4>
                    <p className="mt-1 text-sm leading-6 opacity-90">
                      {model.gatePasses
                        ? 'The illustrative aggregate gate passes. Critical slices, freshness, contamination, latency, and cost still need independent checks.'
                        : model.largestFailure.action}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function OutcomeGroup({
  title,
  icon: Icon,
  outcomes,
  sampleSize,
}: {
  title: string;
  icon: typeof Search;
  outcomes: Array<{ label: string; value: number; color: string }>;
  sampleSize: number;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <h5 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
        <Icon aria-hidden="true" className="h-4 w-4" />
        {title}
      </h5>
      <div className="mt-4 space-y-4">
        {outcomes.map((outcome) => (
          <div key={outcome.label}>
            <div className="flex items-baseline justify-between gap-4 text-xs">
              <span className="font-medium text-neutral-700 dark:text-neutral-200">{outcome.label}</span>
              <span className="shrink-0 font-semibold tabular-nums text-neutral-950 dark:text-white">{outcome.value}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                className={`h-full min-w-0 rounded-full ${outcome.color}`}
                style={{ width: `${percent(outcome.value, sampleSize)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex min-h-64 items-center justify-center p-6">
      {error ? (
        <div className="max-w-md text-center">
          <ShieldAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-400" />
          <p className="mt-3 font-semibold text-neutral-950 dark:text-white">Pipeline data did not load</p>
          <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 dark:border-neutral-700 dark:text-neutral-100"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
          Loading pipeline model...
        </div>
      )}
    </div>
  );
}

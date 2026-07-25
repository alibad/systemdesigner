'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  CheckCircle2,
  CircleAlert,
  FlaskConical,
  GitCompareArrows,
  LoaderCircle,
  RefreshCw,
  SearchCheck,
  ShieldAlert,
  Sparkles,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type GoldLabel = 'harmful' | 'legitimate';
type Prediction = 'passes-pair' | 'overblocks-legitimate' | 'misses-harmful';
type ActualOutcome = Prediction | 'fails-both';

type Candidate = {
  id: string;
  label: string;
  detail: string;
};

type FunctionalCase = {
  id: string;
  role: string;
  text: string;
  gold: GoldLabel;
  scores: Record<string, number>;
};

type FunctionPair = {
  id: string;
  label: string;
  detail: string;
  repair: string;
  cases: FunctionalCase[];
};

type ContrastData = {
  defaultModelId: string;
  defaultFunctionId: string;
  decisionThresholdPct: number;
  models: Candidate[];
  functions: FunctionPair[];
};

const BLOCK_ID = 'genai/toxigen-hatecheck-evaluation-functional-contrast-lab';
const DEFAULT_DATA_FILE =
  '/api/content/genai/toxigen-hatecheck-evaluation/data/functional-contrasts.json';

const predictionOptions: Array<{ id: Prediction; label: string; detail: string }> = [
  { id: 'passes-pair', label: 'Passes both cases', detail: 'Detects the harmful case and allows its legitimate contrast.' },
  { id: 'overblocks-legitimate', label: 'Overblocks the contrast', detail: 'Detects harm but also flags the legitimate case.' },
  { id: 'misses-harmful', label: 'Misses the harmful case', detail: 'Allows the legitimate case but fails to detect harm.' },
];

function isContrastData(value: unknown): value is ContrastData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ContrastData>;
  return typeof candidate.defaultModelId === 'string'
    && typeof candidate.defaultFunctionId === 'string'
    && typeof candidate.decisionThresholdPct === 'number'
    && Array.isArray(candidate.models)
    && candidate.models.length > 0
    && Array.isArray(candidate.functions)
    && candidate.functions.length > 0;
}

const outcomeLabels: Record<ActualOutcome, string> = {
  'passes-pair': 'Passes the complete function',
  'overblocks-legitimate': 'Overblocks the legitimate contrast',
  'misses-harmful': 'Misses the harmful case',
  'fails-both': 'Reverses both intended decisions',
};

export default function ToxigenHatecheckEvaluationFunctionalContrastLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ContrastData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modelId, setModelId] = useState('');
  const [functionId, setFunctionId] = useState('');
  const [prediction, setPrediction] = useState<Prediction>('passes-pair');
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isContrastData(payload)) throw new Error('Functional contrast data is incomplete.');
        if (!active) return;
        setData(payload);
        setModelId(payload.defaultModelId);
        setFunctionId(payload.defaultFunctionId);
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load functional contrasts.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const candidate = data?.models.find((item) => item.id === modelId) ?? data?.models[0];
  const pair = data?.functions.find((item) => item.id === functionId) ?? data?.functions[0];

  const result = useMemo(() => {
    if (!data || !candidate || !pair || pair.cases.length !== 2) return null;
    const cases = pair.cases.map((item) => {
      const score = item.scores[candidate.id];
      const predicted: GoldLabel = score >= data.decisionThresholdPct ? 'harmful' : 'legitimate';
      return { ...item, predicted, score, correct: predicted === item.gold };
    });
    const harmfulCase = cases.find((item) => item.gold === 'harmful');
    const legitimateCase = cases.find((item) => item.gold === 'legitimate');
    if (!harmfulCase || !legitimateCase) return null;

    let actual: ActualOutcome;
    if (harmfulCase.correct && legitimateCase.correct) actual = 'passes-pair';
    else if (harmfulCase.correct && !legitimateCase.correct) actual = 'overblocks-legitimate';
    else if (!harmfulCase.correct && legitimateCase.correct) actual = 'misses-harmful';
    else actual = 'fails-both';

    return {
      actual,
      cases,
      predictionCorrect: prediction === actual,
    };
  }, [candidate, data, pair, prediction]);

  function changeModel(id: string) {
    setModelId(id);
    setRevealed(false);
  }

  function changeFunction(id: string) {
    setFunctionId(id);
    setRevealed(false);
  }

  function reset() {
    if (!data) return;
    setModelId(data.defaultModelId);
    setFunctionId(data.defaultFunctionId);
    setPrediction('passes-pair');
    setRevealed(false);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Functional contrast audit"
          title="Predict which minimal change breaks the detector"
          description="Choose one candidate and one controlled function. Commit a prediction before revealing both case-level decisions and the engineering diagnosis."
          icon={GitCompareArrows}
          accent="violet"
          onReset={data ? reset : undefined}
        />

        {!data || !candidate || !pair || !result ? (
          <LoadState error={error} onRetry={() => setReloadKey((current) => current + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Choose a candidate</legend>
                  <div className="mt-3 space-y-2">
                    {data.models.map((option) => (
                      <LabChoice
                        key={option.id}
                        selected={option.id === candidate.id}
                        label={option.label}
                        detail={option.detail}
                        icon={SearchCheck}
                        accent={option.id === 'contextual-v2' ? 'blue' : option.id === 'safety-heavy-v3' ? 'rose' : 'amber'}
                        onClick={() => changeModel(option.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Choose a function</legend>
                  <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-1">
                    {data.functions.map((option) => (
                      <LabChoice
                        key={option.id}
                        selected={option.id === pair.id}
                        label={option.label}
                        detail={option.detail}
                        icon={FlaskConical}
                        accent="violet"
                        onClick={() => changeFunction(option.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">3. Predict the outcome</legend>
                  <div className="mt-3 space-y-2">
                    {predictionOptions.map((option) => (
                      <LabChoice
                        key={option.id}
                        selected={option.id === prediction}
                        label={option.label}
                        detail={option.detail}
                        icon={Sparkles}
                        accent="emerald"
                        onClick={() => {
                          setPrediction(option.id);
                          setRevealed(false);
                        }}
                      />
                    ))}
                  </div>
                </fieldset>

                <button
                  type="button"
                  onClick={() => setRevealed(true)}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-neutral-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
                >
                  <FlaskConical aria-hidden="true" className="h-4 w-4" /> Test prediction
                </button>
              </div>
            )}
          >
            <div className="min-w-0">
              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <p className="text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Selected function</p>
                <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{pair.label}</h4>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{pair.detail}</p>
                <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                  Active candidate: {candidate.label}. Decision threshold: {data.decisionThresholdPct}%.
                </p>
              </section>

              <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
                <CaseCard item={result.cases[0]} revealed={revealed} />
                <div className="flex items-center justify-center text-neutral-400">
                  <ArrowDown aria-hidden="true" className="h-5 w-5 md:-rotate-90" />
                </div>
                <CaseCard item={result.cases[1]} revealed={revealed} />
              </div>

              {revealed ? (
                <div className="mt-5 space-y-4" aria-live="polite">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <LabMetric
                      label="Observed function"
                      value={outcomeLabels[result.actual]}
                      detail={`${candidate.label} at ${data.decisionThresholdPct}%`}
                      icon={result.actual === 'passes-pair' ? CheckCircle2 : ShieldAlert}
                      tone={result.actual === 'passes-pair' ? 'emerald' : 'rose'}
                    />
                    <LabMetric
                      label="Your prediction"
                      value={result.predictionCorrect ? 'Matched' : 'Did not match'}
                      detail={predictionOptions.find((item) => item.id === prediction)?.label}
                      icon={result.predictionCorrect ? CheckCircle2 : CircleAlert}
                      tone={result.predictionCorrect ? 'blue' : 'amber'}
                    />
                  </div>

                  <section className={`rounded-md border p-5 ${result.actual === 'passes-pair' ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/35' : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/35'}`}>
                    <div className="flex items-start gap-3">
                      {result.actual === 'passes-pair' ? (
                        <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                      ) : (
                        <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
                      )}
                      <div>
                        <h4 className="font-semibold text-neutral-950 dark:text-white">
                          {result.actual === 'passes-pair' ? 'The function passes this pair' : 'The function needs targeted remediation'}
                        </h4>
                        <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{pair.repair}</p>
                        <p className="mt-2 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                          One pair diagnoses behavior but does not estimate a population rate. Run the complete versioned function with independently reviewed cases.
                        </p>
                      </div>
                    </div>
                  </section>
                </div>
              ) : (
                <div className="mt-5 rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center dark:border-neutral-700 dark:bg-neutral-900/50">
                  <FlaskConical aria-hidden="true" className="mx-auto h-6 w-6 text-violet-500" />
                  <p className="mt-2 font-semibold text-neutral-950 dark:text-white">Outcome hidden</p>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">Commit a prediction to reveal scores, decisions, and the repair path.</p>
                </div>
              )}
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function CaseCard({
  item,
  revealed,
}: {
  item: FunctionalCase & { predicted: GoldLabel; score: number; correct: boolean };
  revealed: boolean;
}) {
  return (
    <article className="min-w-0 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{item.role}</p>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${item.gold === 'harmful' ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200' : 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'}`}>
          Gold: {item.gold}
        </span>
      </div>
      <p className="mt-4 min-h-14 text-base font-medium leading-7 text-neutral-950 dark:text-white">{item.text}</p>
      <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
        {revealed ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Harmful score</p>
              <p className="mt-0.5 font-semibold tabular-nums text-neutral-950 dark:text-white">{item.score}%</p>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${item.correct ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>
              {item.correct ? <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> : <XCircle aria-hidden="true" className="h-4 w-4" />}
              Predicted {item.predicted}
            </span>
          </div>
        ) : (
          <p className="text-xs font-medium text-neutral-400">Prediction hidden until test</p>
        )}
      </div>
    </article>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="min-h-64 p-5 md:p-6">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-100" role="alert">
          <div className="flex items-start gap-3">
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Functional contrasts could not be loaded</p>
              <p className="mt-1 text-sm opacity-80">{error}</p>
              <button type="button" onClick={onRetry} className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-current px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
                <RefreshCw aria-hidden="true" className="h-4 w-4" /> Retry
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-neutral-500 dark:text-neutral-400" aria-label="Loading functional contrast lab">
          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" /> Loading functional contrasts
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CircleStop,
  Coins,
  GitBranch,
  LoaderCircle,
  Play,
  SearchCheck,
  ShieldCheck,
  UserCheck,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type OutcomeTone = 'emerald' | 'amber' | 'rose' | 'violet';

interface Candidate {
  answer: string;
  summary: string;
}

interface Checker {
  label: string;
  kind: 'deterministic' | 'source' | 'none';
  supportedAnswer: string | null;
  result: string;
  available: boolean;
}

interface StoppingScenario {
  id: string;
  label: string;
  detail: string;
  risk: string;
  minimumCandidates: number;
  minimumAgreement: number;
  verificationRequired: boolean;
  candidates: Candidate[];
  checker: Checker;
  escalation: string;
  lesson: string;
}

interface StoppingLabData {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
  };
  scenarios: StoppingScenario[];
}

interface DecisionOutcome {
  title: string;
  detail: string;
  tone: OutcomeTone;
}

const BLOCK_ID = 'genai/inference-time-scaling-evidence-stopping-lab';

function isStoppingLabData(value: unknown): value is StoppingLabData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoppingLabData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && Array.isArray(scenario.candidates)
        && scenario.candidates.length > 0
        && Boolean(scenario.checker)
      )),
  );
}

export default function InferenceTimeScalingEvidenceStoppingLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<StoppingLabData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setLoadError('No stopping-rule model was supplied.');
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
        if (!isStoppingLabData(payload)) throw new Error('Stopping-rule data is incomplete.');
        setData(payload);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load stopping-rule data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data) return <LabLoading />;
  return <EvidenceStoppingLab data={data} />;
}

function EvidenceStoppingLab({ data }: { data: StoppingLabData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [candidateCount, setCandidateCount] = useState(1);
  const [checkerRun, setCheckerRun] = useState(false);
  const [outcome, setOutcome] = useState<DecisionOutcome | null>(null);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];

  const model = useMemo(() => {
    const visibleCandidates = scenario.candidates.slice(0, candidateCount);
    const counts = new Map<string, number>();
    visibleCandidates.forEach((candidate) => {
      counts.set(candidate.answer, (counts.get(candidate.answer) ?? 0) + 1);
    });
    const majority = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const majorityAnswer = majority?.[0] ?? 'No candidate';
    const agreement = majority ? Math.round(majority[1] / visibleCandidates.length * 100) : 0;
    const checkerSupportsMajority = checkerRun
      && scenario.checker.available
      && scenario.checker.supportedAnswer === majorityAnswer;
    const checkerConflict = checkerRun
      && scenario.checker.available
      && scenario.checker.supportedAnswer !== majorityAnswer;

    return {
      agreement,
      checkerConflict,
      checkerSupportsMajority,
      majorityAnswer,
      visibleCandidates,
    };
  }, [candidateCount, checkerRun, scenario]);

  const resetScenario = (nextScenario: StoppingScenario) => {
    setScenarioId(nextScenario.id);
    setCandidateCount(1);
    setCheckerRun(false);
    setOutcome(null);
  };

  const reset = () => {
    const initial = data.scenarios.find((item) => item.id === data.defaults.scenarioId)
      ?? data.scenarios[0];
    resetScenario(initial);
  };

  const sampleAgain = () => {
    if (candidateCount >= scenario.candidates.length) return;
    setCandidateCount((count) => count + 1);
    setCheckerRun(false);
    setOutcome(null);
  };

  const runChecker = () => {
    setCheckerRun(true);
    setOutcome(null);
  };

  const acceptCurrent = () => {
    if (candidateCount < scenario.minimumCandidates) {
      setOutcome({
        title: 'The sampling rule is not satisfied',
        detail: `This scenario requires at least ${scenario.minimumCandidates} candidate${scenario.minimumCandidates === 1 ? '' : 's'} before agreement is meaningful.`,
        tone: 'amber',
      });
      return;
    }

    if (model.agreement < scenario.minimumAgreement) {
      setOutcome({
        title: 'The candidates have not converged',
        detail: `Agreement is ${model.agreement}%, below the ${scenario.minimumAgreement}% rule. Continue only if another sample is expected to add independent evidence.`,
        tone: 'amber',
      });
      return;
    }

    if (scenario.verificationRequired && !checkerRun) {
      setOutcome({
        title: 'Acceptance is premature',
        detail: `The policy requires ${scenario.checker.label.toLowerCase()} before the majority answer may be accepted.`,
        tone: 'rose',
      });
      return;
    }

    if (!scenario.checker.available) {
      setOutcome({
        title: 'No automatic acceptance path exists',
        detail: scenario.escalation,
        tone: 'violet',
      });
      return;
    }

    if (model.checkerConflict) {
      setOutcome({
        title: 'The checker contradicts the majority',
        detail: scenario.checker.result,
        tone: 'rose',
      });
      return;
    }

    setOutcome({
      title: 'Evidence supports a bounded stop',
      detail: `${scenario.checker.result} Record the candidate, evidence, policy version, and accepted stop reason.`,
      tone: 'emerald',
    });
  };

  const escalate = () => {
    setOutcome({
      title: 'Escalated with the evidence gathered so far',
      detail: scenario.escalation,
      tone: 'violet',
    });
  };

  const checkerState = !checkerRun
    ? 'Not run'
    : !scenario.checker.available
      ? 'Unavailable'
      : model.checkerSupportsMajority
        ? 'Supports majority'
        : 'Contradicts majority';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Evidence stopping lab"
          title={data.title}
          description={data.description}
          icon={CircleStop}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Decision to resolve
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={scenario.id === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.checker.kind === 'deterministic' ? ShieldCheck : item.checker.kind === 'source' ? SearchCheck : UserCheck}
                      accent={item.checker.kind === 'deterministic' ? 'emerald' : item.checker.kind === 'source' ? 'blue' : 'rose'}
                      onClick={() => resetScenario(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <section className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Acceptance contract
                </p>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                  <li className="flex gap-2">
                    <CheckCircle2 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
                    {scenario.minimumCandidates} candidate{scenario.minimumCandidates === 1 ? '' : 's'} minimum
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
                    {scenario.minimumAgreement > 0
                      ? `${scenario.minimumAgreement}% agreement minimum`
                      : 'Agreement is diagnostic, not an acceptance gate'}
                  </li>
                  <li className="flex gap-2">
                    <CheckCircle2 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
                    {scenario.verificationRequired ? scenario.checker.label : 'No external check required'}
                  </li>
                </ul>
              </section>
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Candidates"
                value={`${candidateCount}/${scenario.candidates.length}`}
                detail={`${scenario.minimumCandidates} required before acceptance`}
                icon={GitBranch}
                tone={candidateCount >= scenario.minimumCandidates ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Majority answer"
                value={model.majorityAnswer}
                detail={`${model.agreement}% candidate agreement`}
                icon={CircleStop}
                tone={model.agreement >= scenario.minimumAgreement ? 'violet' : 'amber'}
              />
              <LabMetric
                label="Checker"
                value={checkerState}
                detail={scenario.checker.label}
                icon={SearchCheck}
                tone={!checkerRun ? 'neutral' : model.checkerSupportsMajority ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Modeled spend"
                value={`${(candidateCount + (checkerRun ? 0.5 : 0)).toFixed(1)} units`}
                detail="Every extra attempt consumes the parent budget"
                icon={Coins}
                tone="blue"
              />
            </div>

            <section>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Candidate stream
                  </p>
                  <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                    Observe what each extra sample actually adds
                  </h4>
                </div>
                <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  {scenario.risk}
                </span>
              </div>

              <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {model.visibleCandidates.map((candidate, index) => (
                  <li key={`${candidate.answer}-${index}`} className="min-w-0 rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                        {index + 1}
                      </span>
                      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${candidate.answer === model.majorityAnswer
                        ? 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200'
                        : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-900 dark:text-neutral-300'}`}
                      >
                        {candidate.answer === model.majorityAnswer ? 'Current majority' : 'Alternative'}
                      </span>
                    </div>
                    <p className="mt-3 font-semibold text-neutral-950 dark:text-white">{candidate.answer}</p>
                    <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                      {candidate.summary}
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            <section className={`rounded-md border p-5 ${!checkerRun
              ? 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900'
              : model.checkerSupportsMajority
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'}`}
            >
              <div className="flex items-start gap-3">
                {checkerRun && model.checkerSupportsMajority ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                ) : checkerRun ? (
                  <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
                ) : (
                  <SearchCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-neutral-600 dark:text-neutral-300" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Independent evidence · {scenario.checker.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                    {checkerRun ? scenario.checker.result : 'Run the checker before deciding whether agreement is enough.'}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Reasoning loop actions">
              <button
                type="button"
                onClick={sampleAgain}
                disabled={candidateCount >= scenario.candidates.length}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-violet-300 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-900 transition-colors hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100 dark:hover:bg-violet-950"
              >
                <Play aria-hidden="true" className="h-4 w-4" />
                Sample again
              </button>
              <button
                type="button"
                onClick={runChecker}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-100 dark:hover:bg-blue-950"
              >
                <SearchCheck aria-hidden="true" className="h-4 w-4" />
                Run checker
              </button>
              <button
                type="button"
                onClick={acceptCurrent}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100 dark:hover:bg-emerald-950"
              >
                <CircleStop aria-hidden="true" className="h-4 w-4" />
                Accept and stop
              </button>
              <button
                type="button"
                onClick={escalate}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 transition-colors hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-950"
              >
                <UserCheck aria-hidden="true" className="h-4 w-4" />
                Escalate
              </button>
            </div>

            <section className={`rounded-md border p-5 ${outcome?.tone === 'emerald'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
              : outcome?.tone === 'rose'
                ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
                : outcome?.tone === 'violet'
                  ? 'border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100'
                  : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'}`}
            >
              <div className="flex items-start gap-3">
                <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase opacity-75">Stop decision</p>
                  <p className="mt-2 text-lg font-semibold">
                    {outcome?.title ?? 'No terminal decision yet'}
                  </p>
                  <p className="mt-2 text-sm leading-6 opacity-85">
                    {outcome?.detail ?? scenario.lesson}
                  </p>
                  {outcome ? (
                    <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase opacity-75">
                      Controller emitted a typed outcome
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </p>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function LabLoading() {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 flex min-h-64 items-center justify-center rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading evidence stopping model...
      </div>
    </div>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="not-prose my-7 rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
      <div className="flex items-start gap-3">
        <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">Evidence stopping lab unavailable</p>
          <p className="mt-1 text-sm opacity-80">{detail}</p>
        </div>
      </div>
    </div>
  );
}

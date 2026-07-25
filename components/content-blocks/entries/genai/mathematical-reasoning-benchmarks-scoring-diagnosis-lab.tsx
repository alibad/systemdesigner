'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Binary,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  FileQuestion,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type BaseJudgeId = 'strict' | 'normalized' | 'symbolic';
type JudgeId = BaseJudgeId | 'trace-audit';

type ResponseCase = {
  id: string;
  label: string;
  benchmark: string;
  prompt: string;
  gold: string;
  candidate: string;
  trace: string;
  traceValid: boolean;
  errorType: string;
  judgements: Record<BaseJudgeId, boolean>;
  explanation: string;
  remediation: string;
};

type Judge = {
  id: JudgeId;
  label: string;
  detail: string;
};

type ScoringData = {
  defaultCaseId: string;
  defaultJudgeId: JudgeId;
  cases: ResponseCase[];
  judges: Judge[];
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/mathematical-reasoning-benchmarks/data/scoring-diagnosis-lab.json';

function validData(value: unknown): value is ScoringData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ScoringData>;
  return typeof candidate.defaultCaseId === 'string'
    && typeof candidate.defaultJudgeId === 'string'
    && Array.isArray(candidate.cases)
    && candidate.cases.length > 0
    && candidate.cases.every((item) => (
      item
      && typeof item.id === 'string'
      && typeof item.traceValid === 'boolean'
      && item.judgements
      && typeof item.judgements.strict === 'boolean'
      && typeof item.judgements.normalized === 'boolean'
      && typeof item.judgements.symbolic === 'boolean'
    ))
    && Array.isArray(candidate.judges)
    && candidate.judges.length > 0;
}

export default function MathematicalReasoningBenchmarksScoringDiagnosisLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ScoringData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [caseId, setCaseId] = useState('');
  const [judgeId, setJudgeId] = useState<JudgeId>('normalized');

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!validData(payload)) throw new Error('Scoring lab data is incomplete.');
        if (!active) return;
        setData(payload);
        setCaseId(payload.defaultCaseId);
        setJudgeId(payload.defaultJudgeId);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load scoring lab data.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const responseCase = data?.cases.find((item) => item.id === caseId) ?? data?.cases[0];
  const judge = data?.judges.find((item) => item.id === judgeId) ?? data?.judges[0];

  const result = useMemo(() => {
    if (!responseCase || !judge) return null;
    const answerPass = judge.id === 'trace-audit'
      ? responseCase.judgements.symbolic
      : responseCase.judgements[judge.id];
    const evidencePass = answerPass && (judge.id !== 'trace-audit' || responseCase.traceValid);
    const claim = judge.id === 'trace-audit'
      ? evidencePass
        ? 'Answer and visible trace pass'
        : answerPass
          ? 'Answer passes; trace fails'
          : 'Answer fails before trace credit'
      : answerPass
        ? 'Final-answer metric passes'
        : 'Final-answer metric fails';

    return { answerPass, claim, evidencePass };
  }, [judge, responseCase]);

  function reset() {
    if (!data) return;
    setCaseId(data.defaultCaseId);
    setJudgeId(data.defaultJudgeId);
  }

  return (
    <div data-content-block="genai/mathematical-reasoning-benchmarks-scoring-diagnosis-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Scoring and trace lab"
          title="Judge the answer the contract actually asks for"
          description="Change the response and verifier. The final-answer verdict, visible-trace diagnosis, evidence claim, and remediation update independently."
          icon={ScanSearch}
          accent="violet"
          onReset={data ? reset : undefined}
        />

        {!data || !responseCase || !judge || !result ? (
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Response case
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.cases.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === responseCase.id}
                        label={item.label}
                        detail={item.benchmark}
                        icon={FileQuestion}
                        accent="violet"
                        onClick={() => setCaseId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Judging policy
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.judges.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === judge.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.id === 'trace-audit' ? BookOpenCheck : Binary}
                        accent="blue"
                        onClick={() => setJudgeId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
          >
            <div className="min-w-0 space-y-6">
              <div className="grid gap-3 sm:grid-cols-3">
                <LabMetric
                  label="Final answer"
                  value={result.answerPass ? 'Pass' : 'Fail'}
                  detail={judge.label}
                  icon={result.answerPass ? CheckCircle2 : ShieldX}
                  tone={result.answerPass ? 'emerald' : 'rose'}
                />
                <LabMetric
                  label="Visible trace"
                  value={responseCase.traceValid ? 'Valid' : 'Broken'}
                  detail="Separate diagnostic"
                  icon={responseCase.traceValid ? ShieldCheck : CircleAlert}
                  tone={responseCase.traceValid ? 'blue' : 'amber'}
                />
                <LabMetric
                  label="Evidence claim"
                  value={result.evidencePass ? 'Supported' : 'Not supported'}
                  detail={result.claim}
                  icon={result.evidencePass ? ShieldCheck : ShieldX}
                  tone={result.evidencePass ? 'emerald' : 'rose'}
                />
              </div>

              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-semibold text-neutral-950 dark:text-white">{responseCase.prompt}</h4>
                  <span className="rounded-full border border-neutral-300 px-2 py-1 text-xs font-semibold text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                    {responseCase.benchmark}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Candidate final</p>
                    <code className="mt-2 block break-words text-sm font-semibold text-neutral-950 dark:text-white">{responseCase.candidate}</code>
                  </div>
                  <div className="min-w-0 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Gold answer</p>
                    <code className="mt-2 block break-words text-sm font-semibold text-neutral-950 dark:text-white">{responseCase.gold}</code>
                  </div>
                </div>
                <div className="mt-3 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Visible derivation</p>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{responseCase.trace}</p>
                </div>
              </section>

              <section className={`rounded-md border p-4 ${result.evidencePass ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50' : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50'}`} aria-live="polite">
                <div className="flex items-start gap-3">
                  {result.evidencePass ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    <h4 className="font-semibold">{responseCase.errorType}</h4>
                    <p className="mt-1 text-sm leading-6 opacity-90">{responseCase.explanation}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50">
                <h4 className="text-sm font-semibold">Evaluator action</h4>
                <p className="mt-1 text-sm leading-6 opacity-90">{responseCase.remediation}</p>
              </section>

              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                This lab models declared scorer behavior. A production symbolic checker also needs a restricted grammar, explicit assumptions, time limits, and adversarial fixtures.
              </p>
            </div>
          </LearningLabBody>
        )}
      </LearningLab>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="min-h-[360px] p-6" aria-live="polite">
      {error ? (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
          <p className="font-semibold">The scoring lab could not load.</p>
          <p className="mt-1 opacity-80">{error}</p>
          <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-2 rounded-md border border-current px-3 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Loading scoring lab...</p>
      )}
    </div>
  );
}

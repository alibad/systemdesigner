'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  FlaskConical,
  Gauge,
  GitCompareArrows,
  LoaderCircle,
  RotateCcw,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
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
  benchmark: string;
  detail: string;
  originalPrompt: string;
  counterfactualChange: string;
  originalScorePct: number;
  maximumGapPct: number;
};

type AuditPolicy = {
  id: string;
  label: string;
  detail: string;
  recoveryPct: number;
  independent: boolean;
};

type AuditData = {
  defaultScenarioId: string;
  defaultPolicyId: string;
  defaultPerturbationPct: number;
  defaultMaximumGapPct: number;
  minimumCounterfactualPct: number;
  scenarios: Scenario[];
  policies: AuditPolicy[];
};

const DEFAULT_DATA_FILE =
  '/api/content/genai/common-sense-reasoning-benchmarks/data/counterfactual-audit.json';

function isAuditData(value: unknown): value is AuditData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AuditData>;
  return typeof candidate.defaultScenarioId === 'string'
    && typeof candidate.defaultPolicyId === 'string'
    && typeof candidate.defaultPerturbationPct === 'number'
    && typeof candidate.defaultMaximumGapPct === 'number'
    && typeof candidate.minimumCounterfactualPct === 'number'
    && Array.isArray(candidate.scenarios)
    && candidate.scenarios.length > 0
    && Array.isArray(candidate.policies)
    && candidate.policies.length > 0;
}

export default function CommonSenseReasoningBenchmarksCounterfactualAuditLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<AuditData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scenarioId, setScenarioId] = useState('');
  const [policyId, setPolicyId] = useState('');
  const [perturbationPct, setPerturbationPct] = useState(70);
  const [maximumGapPct, setMaximumGapPct] = useState(6);

  useEffect(() => {
    let active = true;

    async function loadData() {
      setError(null);
      try {
        const response = await fetch(dataFile);
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        const payload = (await response.json()) as unknown;
        if (!isAuditData(payload)) throw new Error('Counterfactual audit data is incomplete.');
        if (!active) return;
        setData(payload);
        setScenarioId(payload.defaultScenarioId);
        setPolicyId(payload.defaultPolicyId);
        setPerturbationPct(payload.defaultPerturbationPct);
        setMaximumGapPct(payload.defaultMaximumGapPct);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load the audit.');
        }
      }
    }

    void loadData();
    return () => {
      active = false;
    };
  }, [dataFile, reloadKey]);

  const scenario = data?.scenarios.find((item) => item.id === scenarioId) ?? data?.scenarios[0];
  const policy = data?.policies.find((item) => item.id === policyId) ?? data?.policies[0];

  const model = useMemo(() => {
    if (!data || !scenario || !policy) return null;
    const exposedGap = scenario.maximumGapPct * (perturbationPct / 100);
    const residualGap = exposedGap * (1 - policy.recoveryPct / 100);
    const counterfactualScore = Math.max(0, scenario.originalScorePct - residualGap);
    const flipRate = Math.min(100, residualGap * 1.25);
    const gapPass = residualGap <= maximumGapPct;
    const slicePass = counterfactualScore >= data.minimumCounterfactualPct;

    let state: 'pass' | 'hold' | 'invalid';
    let decision: string;
    let explanation: string;
    if (!policy.independent) {
      state = 'invalid';
      decision = 'Do not use this as release evidence';
      explanation = policy.id === 'none'
        ? 'Without paired counterfactuals, the score cannot reveal whether this shortcut changes the model decision.'
        : 'Automatic pairs are useful for discovery, but equivalence and labels need independent verification before they support a gate.';
    } else if (!gapPass || !slicePass) {
      state = 'hold';
      decision = 'Hold and investigate the shortcut';
      explanation = !gapPass
        ? `The modeled paired gap is ${residualGap.toFixed(1)} points, above the ${maximumGapPct}-point limit.`
        : `Counterfactual accuracy is ${counterfactualScore.toFixed(1)}%, below the ${data.minimumCounterfactualPct}% critical floor.`;
    } else {
      state = 'pass';
      decision = 'Robustness gate passes';
      explanation = 'The verified pair remains within the declared gap and slice floor. Keep the protected set independent and monitor product failures.';
    }

    return { counterfactualScore, decision, explanation, flipRate, gapPass, residualGap, slicePass, state };
  }, [data, maximumGapPct, perturbationPct, policy, scenario]);

  function reset() {
    if (!data) return;
    setScenarioId(data.defaultScenarioId);
    setPolicyId(data.defaultPolicyId);
    setPerturbationPct(data.defaultPerturbationPct);
    setMaximumGapPct(data.defaultMaximumGapPct);
  }

  return (
    <div data-content-block="genai/common-sense-reasoning-benchmarks-counterfactual-audit-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Counterfactual shortcut audit"
          title="Change the cue without changing the answer logic"
          description="Choose a suspected shortcut, perturb its strength, and set the review policy. The paired score, flip rate, robustness gap, and release gate reveal whether the original result survives."
          icon={GitCompareArrows}
          accent="rose"
          onReset={data ? reset : undefined}
        />

        {!data || !scenario || !policy || !model ? (
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        ) : (
          <LearningLabBody
            controls={(
              <div className="space-y-6">
                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    1. Suspected shortcut
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.scenarios.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === scenario.id}
                        label={item.label}
                        detail={`${item.benchmark}: ${item.detail}`}
                        icon={SearchCheck}
                        accent={item.id === 'social-stereotype' ? 'rose' : item.id === 'entity-frequency' ? 'violet' : item.id === 'lexical-overlap' ? 'amber' : 'blue'}
                        onClick={() => setScenarioId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="2. Cue perturbation strength"
                  value={perturbationPct}
                  output={`${perturbationPct}%`}
                  min={0}
                  max={100}
                  step={5}
                  lowLabel="Original cue retained"
                  highLabel="Cue removed or reversed"
                  accent="rose"
                  onChange={setPerturbationPct}
                />

                <fieldset>
                  <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    3. Audit policy
                  </legend>
                  <div className="mt-3 space-y-2">
                    {data.policies.map((item) => (
                      <LabChoice
                        key={item.id}
                        selected={item.id === policy.id}
                        label={item.label}
                        detail={item.detail}
                        icon={item.independent ? ShieldCheck : ShieldAlert}
                        accent={item.independent ? 'emerald' : 'amber'}
                        onClick={() => setPolicyId(item.id)}
                      />
                    ))}
                  </div>
                </fieldset>

                <LabRange
                  label="4. Maximum acceptable gap"
                  value={maximumGapPct}
                  output={`${maximumGapPct} points`}
                  min={2}
                  max={15}
                  step={1}
                  lowLabel="Strict"
                  highLabel="Permissive"
                  accent="violet"
                  onChange={setMaximumGapPct}
                />
              </div>
            )}
          >
            <div className="min-w-0 space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <LabMetric label="Original score" value={`${scenario.originalScorePct.toFixed(1)}%`} detail="Before the cue is challenged" icon={Gauge} tone="blue" />
                <LabMetric label="Counterfactual score" value={`${model.counterfactualScore.toFixed(1)}%`} detail={`Floor: ${data.minimumCounterfactualPct}%`} icon={FlaskConical} tone={model.slicePass ? 'emerald' : 'rose'} />
                <LabMetric label="Paired robustness gap" value={`${model.residualGap.toFixed(1)} pts`} detail={`Gate: at most ${maximumGapPct} points`} icon={GitCompareArrows} tone={model.gapPass ? 'emerald' : 'amber'} />
                <LabMetric label="Correct-to-wrong flips" value={`~${model.flipRate.toFixed(1)}%`} detail="Illustrative paired flip estimate" icon={CircleAlert} tone={model.flipRate <= maximumGapPct ? 'cyan' : 'rose'} />
              </div>

              <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{scenario.benchmark}</p>
                    <h4 className="mt-1 font-semibold text-neutral-950 dark:text-white">{scenario.label}</h4>
                  </div>
                  <span className="rounded-full border border-neutral-300 px-2.5 py-1 text-xs font-semibold text-neutral-600 dark:border-neutral-700 dark:text-neutral-300">
                    {perturbationPct}% challenge
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
                  <div className="rounded-md border border-blue-200 bg-white p-4 dark:border-blue-900 dark:bg-neutral-950">
                    <p className="text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">Original item</p>
                    <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{scenario.originalPrompt}</p>
                  </div>
                  <div className="flex items-center justify-center text-neutral-400">
                    <ArrowRight aria-hidden="true" className="h-5 w-5 rotate-90 md:rotate-0" />
                  </div>
                  <div className="rounded-md border border-violet-200 bg-white p-4 dark:border-violet-900 dark:bg-neutral-950">
                    <p className="text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">Counterfactual pair</p>
                    <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{scenario.counterfactualChange}</p>
                  </div>
                </div>
              </section>

              <section className={`rounded-md border p-4 ${model.state === 'pass' ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50' : model.state === 'hold' ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50' : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-50'}`}>
                <div className="flex items-start gap-3">
                  {model.state === 'pass' ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : model.state === 'hold' ? <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                  <div>
                    <h4 className="font-semibold">{model.decision}</h4>
                    <p className="mt-1 text-sm leading-6 opacity-90">{model.explanation}</p>
                    <p className="mt-2 text-xs leading-5 opacity-80">Selected evidence policy: {policy.label}.</p>
                  </div>
                </div>
              </section>

              <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Scores in this lab are illustrative. A real audit computes outcomes from independently verified item pairs and reports pair-level confidence intervals and disagreements.
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
    <div className="flex min-h-64 items-center justify-center p-6">
      {error ? (
        <div className="max-w-md text-center">
          <TriangleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-600 dark:text-rose-300" />
          <p className="mt-3 font-semibold text-neutral-950 dark:text-white">Audit data could not load</p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{error}</p>
          <button type="button" onClick={onRetry} className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-900">
            <RotateCcw aria-hidden="true" className="h-4 w-4" /> Retry
          </button>
        </div>
      ) : (
        <div className="text-center text-neutral-500 dark:text-neutral-400">
          <LoaderCircle aria-hidden="true" className="mx-auto h-7 w-7 animate-spin motion-reduce:animate-none" />
          <p className="mt-3 text-sm">Loading counterfactual audit...</p>
        </div>
      )}
    </div>
  );
}

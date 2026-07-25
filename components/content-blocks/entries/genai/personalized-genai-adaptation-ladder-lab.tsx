'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookKey,
  Braces,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  Layers3,
  LoaderCircle,
  Route,
  ShieldCheck,
  Sparkles,
  UsersRound,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Mechanism = {
  id: string;
  label: string;
  detail: string;
  capabilities: string[];
  freshnessHours: number;
  deletionHours: number;
  addedLatencyMs: number;
  operationalWeight: number;
  updatePath: string;
};

type Scenario = {
  id: string;
  label: string;
  brief: string;
  requiredCapabilities: string[];
  recommendedMechanismId: string;
  maximumFreshnessHours: number;
  maximumDeletionHours: number;
  cohortSize: number;
  consequence: string;
};

type AdaptationLadderModel = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    mechanismId: string;
    exposurePercent: number;
    evaluationPassed: boolean;
    deletionVerified: boolean;
  };
  mechanisms: Mechanism[];
  scenarios: Scenario[];
};

const BLOCK_ID = 'genai/personalized-genai-adaptation-ladder-lab';

function isAdaptationLadderModel(value: unknown): value is AdaptationLadderModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AdaptationLadderModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults
      && Array.isArray(candidate.mechanisms)
      && candidate.mechanisms.length > 0
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length > 0,
  );
}

export default function PersonalizedGenaiAdaptationLadderLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<AdaptationLadderModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No adaptation-ladder model was supplied.');
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
        if (!isAdaptationLadderModel(payload)) {
          throw new Error('Adaptation-ladder data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load adaptation data.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <AdaptationLadder data={data} />;
}

function AdaptationLadder({ data }: { data: AdaptationLadderModel }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [mechanismId, setMechanismId] = useState(data.defaults.mechanismId);
  const [exposurePercent, setExposurePercent] = useState(data.defaults.exposurePercent);
  const [evaluationPassed, setEvaluationPassed] = useState(data.defaults.evaluationPassed);
  const [deletionVerified, setDeletionVerified] = useState(data.defaults.deletionVerified);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const mechanism = data.mechanisms.find((item) => item.id === mechanismId) ?? data.mechanisms[0];

  const result = useMemo(() => {
    const covered = scenario.requiredCapabilities.filter((capability) =>
      mechanism.capabilities.includes(capability),
    );
    const capabilityFit = covered.length === scenario.requiredCapabilities.length;
    const freshnessFit = mechanism.freshnessHours <= scenario.maximumFreshnessHours;
    const deletionFit = mechanism.deletionHours <= scenario.maximumDeletionHours;
    const recommended = mechanism.id === scenario.recommendedMechanismId;
    const fitScore = Math.round(
      ([capabilityFit, freshnessFit, deletionFit, recommended].filter(Boolean).length / 4) * 100,
    );
    const exposedUsers = Math.round((scenario.cohortSize * exposurePercent) / 100);
    const evidenceReady = evaluationPassed && deletionVerified;

    let verdict = 'Ready for a bounded canary';
    let tone: 'emerald' | 'amber' | 'rose' = 'emerald';
    if (!capabilityFit) {
      verdict = 'This mechanism cannot satisfy the requirement';
      tone = 'rose';
    } else if (!freshnessFit) {
      verdict = 'The adaptation will become stale';
      tone = 'rose';
    } else if (!deletionFit || !deletionVerified) {
      verdict = 'The deletion contract is not release-ready';
      tone = 'rose';
    } else if (!evaluationPassed) {
      verdict = 'Measured benefit is not established';
      tone = 'rose';
    } else if (!recommended) {
      verdict = 'Capable, but more persistent than necessary';
      tone = 'amber';
    } else if (exposurePercent > 25) {
      verdict = 'Start with a smaller observable cohort';
      tone = 'amber';
    }

    return {
      capabilityFit,
      deletionFit,
      evidenceReady,
      exposedUsers,
      fitScore,
      freshnessFit,
      recommended,
      tone,
      verdict,
    };
  }, [deletionVerified, evaluationPassed, exposurePercent, mechanism, scenario]);

  const chooseScenario = (nextScenario: Scenario) => {
    setScenarioId(nextScenario.id);
    setMechanismId(nextScenario.recommendedMechanismId);
    setExposurePercent(10);
  };

  const reset = () => {
    setScenarioId(data.defaults.scenarioId);
    setMechanismId(data.defaults.mechanismId);
    setExposurePercent(data.defaults.exposurePercent);
    setEvaluationPassed(data.defaults.evaluationPassed);
    setDeletionVerified(data.defaults.deletionVerified);
  };

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Adaptation ladder"
          title={data.title}
          description={data.description}
          icon={Route}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Choose the requirement
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.brief}
                      icon={Sparkles}
                      accent="blue"
                      onClick={() => chooseScenario(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Choose the adaptation layer
                </legend>
                <div className="mt-3 space-y-2">
                  {data.mechanisms.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === mechanism.id}
                      label={item.label}
                      detail={item.detail}
                      icon={mechanismIcon(item.id)}
                      accent={item.id === 'learned-adapter' ? 'amber' : item.id === 'private-retrieval' ? 'emerald' : 'violet'}
                      onClick={() => setMechanismId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-3">
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Attach release evidence
                </legend>
                <EvidenceToggle
                  checked={evaluationPassed}
                  label="Personalized candidate beat baseline"
                  detail="Quality and critical cohort gates passed on versioned cases."
                  onChange={setEvaluationPassed}
                />
                <EvidenceToggle
                  checked={deletionVerified}
                  label="Deletion drill completed"
                  detail="Profile, cache, index, and learned artifacts followed the declared route."
                  onChange={setDeletionVerified}
                />
              </fieldset>

              <LabRange
                label="Canary exposure"
                value={exposurePercent}
                output={`${exposurePercent}%`}
                min={1}
                max={100}
                step={1}
                accent="violet"
                lowLabel="1%"
                highLabel="100%"
                onChange={setExposurePercent}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Mechanism fit"
                value={`${result.fitScore}%`}
                detail="Capability, freshness, deletion, and least-persistence checks."
                icon={Gauge}
                tone={result.fitScore === 100 ? 'emerald' : result.fitScore >= 75 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Freshness"
                value={formatHours(mechanism.freshnessHours)}
                detail={`Requirement: at most ${formatHours(scenario.maximumFreshnessHours)}.`}
                icon={Clock3}
                tone={result.freshnessFit ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Deletion path"
                value={formatHours(mechanism.deletionHours)}
                detail={`Requirement: at most ${formatHours(scenario.maximumDeletionHours)}.`}
                icon={ShieldCheck}
                tone={result.deletionFit && deletionVerified ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Users in canary"
                value={result.exposedUsers.toLocaleString()}
                detail={`${exposurePercent}% of a modeled ${scenario.cohortSize.toLocaleString()}-user cohort.`}
                icon={UsersRound}
                tone={exposurePercent <= 25 ? 'violet' : 'amber'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Persistence ladder
                  </p>
                  <h4 className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                    Stop at the first layer that meets the requirement
                  </h4>
                </div>
                <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                  Persistence and operating burden increase left to right
                </p>
              </div>
              <ol className="mt-4 grid gap-3 md:grid-cols-4">
                {data.mechanisms.map((item, index) => {
                  const selected = item.id === mechanism.id;
                  const recommended = item.id === scenario.recommendedMechanismId;
                  const Icon = mechanismIcon(item.id);
                  return (
                    <li key={item.id} className={`relative min-w-0 rounded-md border p-4 ${selected
                      ? 'border-violet-500 bg-violet-50 text-violet-950 ring-2 ring-violet-200 dark:border-violet-400 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-900'
                      : 'border-neutral-200 bg-white text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                          {index + 1}
                        </span>
                        <Icon aria-hidden="true" className="h-4 w-4" />
                      </div>
                      <p className="mt-3 text-sm font-semibold">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 opacity-75">Weight {item.operationalWeight} / 5</p>
                      {recommended ? (
                        <span className="mt-3 inline-flex rounded-sm border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold uppercase text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                          Smallest fit
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="rounded-md border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Update and removal path
              </p>
              <div className="mt-3 flex items-start gap-3">
                <BookKey aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" />
                <div>
                  <p className="font-semibold text-neutral-950 dark:text-white">{mechanism.label}</p>
                  <p className="mt-1 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{mechanism.updatePath}</p>
                  <p className="mt-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    Modeled request overhead: +{mechanism.addedLatencyMs} ms
                  </p>
                </div>
              </div>
            </section>

            <section className={`rounded-md border p-5 ${result.tone === 'emerald'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
              : result.tone === 'amber'
                ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'}`}
            >
              <div className="flex items-start gap-3">
                {result.tone === 'emerald'
                  ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                  : result.tone === 'amber'
                    ? <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                    : <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Release consequence</p>
                  <p className="mt-2 text-lg font-semibold">{result.verdict}</p>
                  <p className="mt-2 text-sm leading-6 opacity-85">
                    {scenario.consequence} {!result.evidenceReady
                      ? 'Missing release evidence keeps exposure closed regardless of modeled mechanism fit.'
                      : result.recommended
                        ? 'The selected layer matches the requirement without adding unnecessary persistence.'
                        : 'Prefer the marked smallest-fit layer unless evaluation proves this heavier mechanism adds necessary value.'}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function mechanismIcon(id: string): LucideIcon {
  if (id === 'request-prompt') return Braces;
  if (id === 'private-retrieval') return BookKey;
  if (id === 'learned-adapter') return Layers3;
  return Route;
}

function formatHours(value: number): string {
  if (value === 0) return 'Immediate';
  if (value < 1) return `${Math.round(value * 60)} min`;
  if (value < 24) return `${value} hr`;
  return `${Math.round(value / 24)} days`;
}

function EvidenceToggle({
  checked,
  label,
  detail,
  onChange,
}: {
  checked: boolean;
  label: string;
  detail: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${checked
      ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
      : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'}`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 shrink-0 accent-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs leading-5 opacity-75">{detail}</span>
      </span>
    </label>
  );
}

function LoadState() {
  return (
    <div data-content-block={BLOCK_ID} className="flex min-h-72 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" />
        Loading adaptation-ladder model...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div data-content-block={BLOCK_ID} className="rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100" role="alert">
      <p className="font-semibold">Adaptation ladder unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}

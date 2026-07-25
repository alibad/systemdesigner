'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  CheckSquare2,
  ClipboardCheck,
  FileWarning,
  ShieldAlert,
  Square,
  UserCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const DEFAULT_DATA_FILE =
  '/api/content/ml-systems/financial-ml/data/release-gate-scenarios.json';
const BLOCK_ID = 'ml-systems/financial-ml-release-gate-lab';

type Control = {
  id: string;
  label: string;
  detail: string;
};

type Scenario = {
  id: string;
  label: string;
  detail: string;
  decisionOwner: string;
  consequence: string;
  minimumIndependentReviews: number;
  requiredControls: string[];
};

type LabData = {
  title: string;
  description: string;
  defaults: {
    scenarioId: string;
    independentReviews: number;
    completedControls: string[];
  };
  reviewRange: { min: number; max: number; step: number };
  controls: Control[];
  scenarios: Scenario[];
};

function isLabData(value: unknown): value is LabData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<LabData>;
  return Boolean(
    typeof data.title === 'string'
      && typeof data.description === 'string'
      && data.defaults
      && typeof data.defaults.scenarioId === 'string'
      && typeof data.defaults.independentReviews === 'number'
      && Array.isArray(data.defaults.completedControls)
      && data.reviewRange
      && typeof data.reviewRange.min === 'number'
      && typeof data.reviewRange.max === 'number'
      && typeof data.reviewRange.step === 'number'
      && Array.isArray(data.controls)
      && data.controls.length >= 5
      && data.controls.every((control) => (
        typeof control.id === 'string'
        && typeof control.label === 'string'
        && typeof control.detail === 'string'
      ))
      && Array.isArray(data.scenarios)
      && data.scenarios.length >= 3
      && data.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.decisionOwner === 'string'
        && typeof scenario.minimumIndependentReviews === 'number'
        && Array.isArray(scenario.requiredControls)
        && scenario.requiredControls.every((id) => typeof id === 'string')
      )),
  );
}

export default function FinancialMlReleaseGateLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<LabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState('credit-threshold');
  const [independentReviews, setIndependentReviews] = useState(1);
  const [completedControls, setCompletedControls] = useState<string[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isLabData(payload)) throw new Error('Release-gate scenario data is incomplete.');
        setData(payload);
        setScenarioId(payload.defaults.scenarioId);
        setIndependentReviews(payload.defaults.independentReviews);
        setCompletedControls(payload.defaults.completedControls);
      })
      .catch((loadError: unknown) => {
        if ((loadError as { name?: string }).name !== 'AbortError') {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load lab data.');
        }
      });

    return () => controller.abort();
  }, [dataFile]);

  const scenario = data?.scenarios.find((item) => item.id === scenarioId)
    ?? data?.scenarios[0];

  const result = useMemo(() => {
    if (!data || !scenario) return null;
    const required = data.controls.filter((control) => scenario.requiredControls.includes(control.id));
    const completed = required.filter((control) => completedControls.includes(control.id));
    const missing = required.filter((control) => !completedControls.includes(control.id));
    const reviewGap = Math.max(0, scenario.minimumIndependentReviews - independentReviews);

    if (missing.length === 0 && reviewGap === 0) {
      return {
        completed,
        missing,
        required,
        posture: 'Bounded release candidate',
        detail: 'The evidence package can move to the accountable owner for a small, reversible release decision. This lab does not confer approval.',
        tone: 'emerald' as const,
        icon: BadgeCheck,
        progress: 100,
        reviewGap,
      };
    }

    if (missing.length <= 2 && reviewGap <= 1) {
      return {
        completed,
        missing,
        required,
        posture: 'Shadow or challenger only',
        detail: 'Collect live evidence without allowing the candidate to control a consequential decision. Preserve the incumbent path.',
        tone: 'amber' as const,
        icon: FileWarning,
        progress: Math.round((completed.length / required.length) * 80),
        reviewGap,
      };
    }

    return {
      completed,
      missing,
      required,
      posture: 'Hold and contain',
      detail: 'The release package lacks evidence or effective challenge. Keep the candidate away from customer, capital, or market authority.',
      tone: 'rose' as const,
      icon: ShieldAlert,
      progress: Math.round((completed.length / required.length) * 70),
      reviewGap,
    };
  }, [completedControls, data, independentReviews, scenario]);

  function toggleControl(controlId: string) {
    setCompletedControls((current) => (
      current.includes(controlId)
        ? current.filter((id) => id !== controlId)
        : [...current, controlId]
    ));
  }

  function reset() {
    if (!data) return;
    setScenarioId(data.defaults.scenarioId);
    setIndependentReviews(data.defaults.independentReviews);
    setCompletedControls(data.defaults.completedControls);
  }

  if (!data || !scenario || !result) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className={`not-prose my-7 rounded-md border p-5 text-sm ${
          error
            ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
            : 'h-96 animate-pulse border-neutral-200 bg-neutral-50 motion-reduce:animate-none dark:border-neutral-800 dark:bg-neutral-900'
        }`}
        role={error ? 'alert' : undefined}
        aria-label={error ? undefined : 'Loading release-gate lab'}
      >
        {error}
      </div>
    );
  }

  const StatusIcon = result.icon;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Model-risk release gate"
          title={data.title}
          description={data.description}
          icon={ClipboardCheck}
          accent="amber"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Select the proposed change
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={FileWarning}
                      accent="amber"
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="2. Independent reviews"
                value={independentReviews}
                output={String(independentReviews)}
                min={data.reviewRange.min}
                max={data.reviewRange.max}
                step={data.reviewRange.step}
                accent="violet"
                lowLabel="No challenge"
                highLabel="Multiple reviewers"
                onChange={setIndependentReviews}
              />
            </div>
          )}
        >
          <div className="space-y-6" aria-live="polite">
            <div className={`rounded-md border p-5 ${
              result.tone === 'emerald'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                : result.tone === 'amber'
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
            }`}>
              <div className="flex items-start gap-3">
                <StatusIcon aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
                <div className="min-w-0">
                  <p className="text-lg font-semibold">{result.posture}</p>
                  <p className="mt-1 text-sm leading-6 opacity-80">{result.detail}</p>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${
                    result.tone === 'emerald'
                      ? 'bg-emerald-600 dark:bg-emerald-400'
                      : result.tone === 'amber'
                        ? 'bg-amber-600 dark:bg-amber-400'
                        : 'bg-rose-600 dark:bg-rose-400'
                  }`}
                  style={{ width: `${result.progress}%` }}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Required controls"
                value={`${result.completed.length}/${result.required.length}`}
                detail={`${result.missing.length} evidence gaps`}
                icon={CheckSquare2}
                tone={result.missing.length === 0 ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Effective challenge"
                value={result.reviewGap === 0 ? 'Covered' : `Need ${result.reviewGap}`}
                detail={`Minimum ${scenario.minimumIndependentReviews} independent reviews`}
                icon={UserCheck}
                tone={result.reviewGap === 0 ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Decision authority"
                value={scenario.decisionOwner}
                detail="The model does not approve itself"
                icon={ClipboardCheck}
                tone="violet"
              />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Build the evidence package
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                Toggle a control only when its artifact exists and can be independently reproduced.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {data.controls.map((control) => {
                  const required = scenario.requiredControls.includes(control.id);
                  const checked = completedControls.includes(control.id);
                  const Icon = checked ? CheckSquare2 : Square;
                  return (
                    <button
                      key={control.id}
                      type="button"
                      aria-pressed={checked}
                      onClick={() => toggleControl(control.id)}
                      className={`min-h-28 rounded-md border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                        checked
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100'
                          : required
                            ? 'border-rose-300 bg-white text-neutral-900 hover:border-rose-500 dark:border-rose-900 dark:bg-neutral-950 dark:text-white'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200'
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{control.label}</span>
                            {required ? (
                              <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold uppercase text-white dark:bg-white dark:text-neutral-950">
                                Required
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-1 block text-sm leading-6 opacity-75">{control.detail}</span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-neutral-200 pt-5 dark:border-neutral-800">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Consequence under review
              </p>
              <p className="mt-2 text-base font-semibold text-neutral-950 dark:text-white">
                {scenario.consequence}
              </p>
              {result.missing.length > 0 ? (
                <div className="mt-4">
                  <p className="text-sm font-semibold text-neutral-900 dark:text-white">Missing evidence</p>
                  <ul className="mt-2 space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
                    {result.missing.map((control) => (
                      <li key={control.id} className="flex items-start gap-2">
                        <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                        <span>{control.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

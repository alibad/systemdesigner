'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  CloudOff,
  FileWarning,
  GitCompareArrows,
  History,
  ShieldCheck,
  TimerReset,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type ScenarioId = 'ready' | 'late' | 'leakage' | 'timeout';
type ResponseId = 'promote' | 'pin' | 'rebuild' | 'fallback';

type Scenario = {
  id: ScenarioId;
  label: string;
  detail: string;
  icon: LucideIcon;
  recommended: ResponseId;
};

type Response = {
  id: ResponseId;
  label: string;
  detail: string;
  icon: LucideIcon;
};

const scenarios: Scenario[] = [
  {
    id: 'ready',
    label: 'Version bundle ready',
    detail: 'The transform, offline snapshot, online materialization, and model manifest all reference v42.',
    icon: ShieldCheck,
    recommended: 'promote',
  },
  {
    id: 'late',
    label: 'Online materializer is 85 seconds behind',
    detail: 'The candidate transform is correct, but online values exceed the 60-second freshness contract.',
    icon: TimerReset,
    recommended: 'pin',
  },
  {
    id: 'leakage',
    label: 'Training join sees a future event',
    detail: 'A historical label at 10:00 was joined to a feature value produced at 10:05.',
    icon: FileWarning,
    recommended: 'rebuild',
  },
  {
    id: 'timeout',
    label: 'Online store misses its deadline',
    detail: 'The serving lookup cannot return before the model request deadline.',
    icon: CloudOff,
    recommended: 'fallback',
  },
];

const responses: Response[] = [
  {
    id: 'promote',
    label: 'Promote the candidate manifest',
    detail: 'Deploy the model only with its matching transform and materialized feature version.',
    icon: Workflow,
  },
  {
    id: 'pin',
    label: 'Pin the last compatible release',
    detail: 'Keep the prior model and feature bundle live while the candidate catches up.',
    icon: History,
  },
  {
    id: 'rebuild',
    label: 'Rebuild the point-in-time training set',
    detail: 'Correct the event-time join before measuring or promoting the candidate model.',
    icon: GitCompareArrows,
  },
  {
    id: 'fallback',
    label: 'Use bounded last-good defaults',
    detail: 'Serve a declared fallback bundle, record it, and reject it once its freshness policy expires.',
    icon: ShieldCheck,
  },
];

export default function FeatureStoreParityFailureLab() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('late');
  const [responseId, setResponseId] = useState<ResponseId>('pin');

  const model = useMemo(() => {
    const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
    const response = responses.find((item) => item.id === responseId) ?? responses[0];
    const correct = scenario.recommended === response.id;
    const compatibility = correct ? 100 : response.id === 'pin' ? 86 : response.id === 'fallback' ? 72 : 35;
    const availability = response.id === 'rebuild' ? 0 : response.id === 'pin' ? 99.99 : response.id === 'fallback' ? 99.95 : 99.9;
    const auditability = response.id === 'promote' || response.id === 'rebuild' || response.id === 'fallback' ? 100 : 96;

    let title = 'Parity preserved and the outcome remains explainable';
    let detail = 'The response keeps a model attached to the exact feature definition, event-time semantics, and fallback policy it was evaluated with.';
    let tone: 'healthy' | 'warning' | 'danger' = 'healthy';

    if (!correct) {
      title = 'The response breaks a correctness boundary';
      detail = scenario.id === 'leakage'
        ? 'No online fallback can repair a training set that contains future information. Rebuild the point-in-time dataset before trusting evaluation.'
        : scenario.id === 'late'
          ? 'Promoting a model against late online values creates a silent feature-version and freshness mismatch. Keep the compatible release live.'
          : scenario.id === 'timeout'
            ? 'A candidate promotion or retraining job does not answer an online timeout. Use the declared, time-bounded fallback path.'
            : 'A ready manifest is the only case where promotion is safe; other actions add unnecessary risk or delay.';
      tone = response.id === 'promote' && scenario.id !== 'ready' ? 'danger' : 'warning';
    }

    return { scenario, response, correct, compatibility, availability, auditability, title, detail, tone };
  }, [responseId, scenarioId]);

  const reset = () => {
    setScenarioId('late');
    setResponseId('pin');
  };

  const outcomeStyle = model.tone === 'healthy'
    ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40'
    : model.tone === 'warning'
      ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
      : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40';
  const OutcomeIcon = model.tone === 'healthy' ? CheckCircle2 : CircleAlert;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Parity and failure decision lab"
        title="Choose the response that keeps feature semantics intact"
        description="Inject a release or serving failure, then choose the operational response. A feature value is only safe when its definition, event time, materialized version, and model manifest remain compatible."
        icon={GitCompareArrows}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <fieldset>
            <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">1. Observe the condition</legend>
            <div className="mt-3 space-y-2">
              {scenarios.map((scenario) => (
                <LabChoice
                  key={scenario.id}
                  selected={scenario.id === scenarioId}
                  label={scenario.label}
                  detail={scenario.detail}
                  icon={scenario.icon}
                  accent="violet"
                  onClick={() => setScenarioId(scenario.id)}
                />
              ))}
            </div>
          </fieldset>
        )}
      >
        <fieldset>
          <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">2. Select the release or fallback action</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {responses.map((response) => (
              <LabChoice
                key={response.id}
                selected={response.id === responseId}
                label={response.label}
                detail={response.detail}
                icon={response.icon}
                accent="blue"
                onClick={() => setResponseId(response.id)}
              />
            ))}
          </div>
        </fieldset>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric label="Compatibility" value={`${model.compatibility}%`} detail="Definition, event time, and version alignment" icon={GitCompareArrows} tone={model.compatibility === 100 ? 'emerald' : model.compatibility >= 70 ? 'amber' : 'rose'} />
          <LabMetric label="Path availability" value={`${model.availability}%`} detail="Modeled availability while this action runs" icon={ShieldCheck} tone={model.availability >= 99.95 ? 'cyan' : 'amber'} />
          <LabMetric label="Audit record" value={`${model.auditability}%`} detail="Manifest, reason code, and recovery evidence" icon={History} tone="violet" />
          <LabMetric label="Decision" value={model.correct ? 'Compatible' : 'Unsafe'} detail={model.correct ? 'Action matches the condition.' : 'Action does not repair this failure.'} icon={model.correct ? CheckCircle2 : CircleAlert} tone={model.correct ? 'emerald' : 'rose'} />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(250px,0.78fr)]">
          <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Decision manifest</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-violet-200 bg-violet-50 p-3 text-violet-950 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-50">
                <p className="text-xs font-semibold uppercase opacity-70">Observed</p>
                <p className="mt-1 text-sm font-semibold">{model.scenario.label}</p>
              </div>
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-50">
                <p className="text-xs font-semibold uppercase opacity-70">Action</p>
                <p className="mt-1 text-sm font-semibold">{model.response.label}</p>
              </div>
              <div className="rounded-md border border-neutral-200 bg-white p-3 text-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white">
                <p className="text-xs font-semibold uppercase text-neutral-500">Record</p>
                <p className="mt-1 text-sm font-semibold">Feature version, event-time watermark, model ID, reason code</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-neutral-600 dark:text-neutral-300">Every serving decision should record which feature bundle was used, whether a fallback applied, and what recovery or reconciliation must happen next.</p>
          </div>

          <div className={`rounded-md border p-5 ${outcomeStyle}`} aria-live="polite">
            <OutcomeIcon aria-hidden="true" className={`h-6 w-6 ${model.tone === 'healthy' ? 'text-emerald-700 dark:text-emerald-300' : model.tone === 'warning' ? 'text-amber-700 dark:text-amber-300' : 'text-rose-700 dark:text-rose-300'}`} />
            <p className="mt-4 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Observed outcome</p>
            <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{model.title}</p>
            <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">{model.detail}</p>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

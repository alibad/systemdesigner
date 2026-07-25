'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  CircleAlert,
  Database,
  Gauge,
  HardDrive,
  LoaderCircle,
  Network,
  Search,
  Server,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ActionFit = 'best' | 'investigate' | 'wrong';
type PhaseTone = 'blue' | 'cyan' | 'violet' | 'amber' | 'rose';
type Phase = {
  id: string;
  label: string;
  seconds: number;
  detail: string;
  tone: PhaseTone;
};
type Signal = { label: string; value: string; detail: string };
type DiagnosticAction = {
  id: string;
  label: string;
  detail: string;
  fit: ActionFit;
  result: string;
  verify: string[];
};
type DiagnosticScenario = {
  id: string;
  label: string;
  detail: string;
  symptom: string;
  phases: Phase[];
  signals: Signal[];
  actions: DiagnosticAction[];
};
type DiagnosticModel = {
  title: string;
  description: string;
  defaultScenarioId: string;
  scenarios: DiagnosticScenario[];
};

const BLOCK_ID = 'technology/databricks-job-diagnostics-lab';
const DEFAULT_DATA_FILE = '/api/content/technology/databricks/data/job-diagnostic-scenarios.json';

const phaseClasses: Record<PhaseTone, string> = {
  blue: 'bg-blue-500 dark:bg-blue-400',
  cyan: 'bg-cyan-500 dark:bg-cyan-400',
  violet: 'bg-violet-500 dark:bg-violet-400',
  amber: 'bg-amber-500 dark:bg-amber-400',
  rose: 'bg-rose-500 dark:bg-rose-400',
};

const actionMeta: Record<ActionFit, {
  label: string;
  heading: string;
  icon: LucideIcon;
  tone: 'emerald' | 'amber' | 'rose';
  className: string;
}> = {
  best: {
    label: 'Evidence-aligned next step',
    heading: 'This action tests the bottleneck the profile actually shows',
    icon: CheckCircle2,
    tone: 'emerald',
    className: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
  },
  investigate: {
    label: 'Useful after one more check',
    heading: 'Collect the missing evidence before changing production',
    icon: TriangleAlert,
    tone: 'amber',
    className: 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-50',
  },
  wrong: {
    label: 'Does not address this profile',
    heading: 'A larger or different compute shape would hide the cause',
    icon: XCircle,
    tone: 'rose',
    className: 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/35 dark:text-rose-50',
  },
};

function isDiagnosticModel(value: unknown): value is DiagnosticModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<DiagnosticModel>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaultScenarioId
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 4
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.detail === 'string'
        && typeof scenario.symptom === 'string'
        && Array.isArray(scenario.phases)
        && scenario.phases.length >= 3
        && scenario.phases.every((phase) => Number.isFinite(phase.seconds) && phase.seconds > 0)
        && Array.isArray(scenario.signals)
        && scenario.signals.length >= 3
        && Array.isArray(scenario.actions)
        && scenario.actions.length >= 3
        && scenario.actions.every((action) => (
          ['best', 'investigate', 'wrong'].includes(action.fit)
          && typeof action.result === 'string'
          && Array.isArray(action.verify)
          && action.verify.length >= 2
        ))
      )),
  );
}

export default function DatabricksJobDiagnosticsLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<DiagnosticModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isDiagnosticModel(payload)) throw new Error('The job-diagnostic model is incomplete.');
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setModel(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load diagnostic scenarios.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Spark evidence lab"
            title="Diagnose the stage before resizing compute"
            description="Loading measured teaching profiles."
            icon={Activity}
            accent="violet"
          />
          <div className="flex min-h-48 items-center justify-center p-6">
            {error ? (
              <div className="text-center">
                <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
                <p className="mt-3 text-sm text-neutral-700 dark:text-neutral-300">{error}</p>
                <button
                  type="button"
                  onClick={() => setReloadKey((value) => value + 1)}
                  className="mt-4 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-900"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
                <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
                Loading Spark profiles
              </div>
            )}
          </div>
        </LearningLab>
      ) : (
        <DiagnosticWorkbench model={model} />
      )}
    </div>
  );
}

function DiagnosticWorkbench({ model }: { model: DiagnosticModel }) {
  const defaultScenario = model.scenarios.find((item) => item.id === model.defaultScenarioId)
    ?? model.scenarios[0];
  const [scenarioId, setScenarioId] = useState(defaultScenario.id);
  const [actionId, setActionId] = useState(defaultScenario.actions[0].id);
  const scenario = model.scenarios.find((item) => item.id === scenarioId) ?? defaultScenario;
  const action = scenario.actions.find((item) => item.id === actionId) ?? scenario.actions[0];
  const actionInfo = actionMeta[action.fit];
  const ActionIcon = actionInfo.icon;

  const summary = useMemo(() => {
    const totalSeconds = scenario.phases.reduce((sum, phase) => sum + phase.seconds, 0);
    const longest = scenario.phases.reduce((current, phase) => (
      phase.seconds > current.seconds ? phase : current
    ), scenario.phases[0]);
    return { totalSeconds, longest };
  }, [scenario]);

  function selectScenario(next: DiagnosticScenario) {
    setScenarioId(next.id);
    setActionId(next.actions[0].id);
  }

  function reset() {
    setScenarioId(defaultScenario.id);
    setActionId(defaultScenario.actions[0].id);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Spark evidence lab"
        title={model.title}
        description={model.description}
        icon={Activity}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Observed run
              </legend>
              <div className="mt-3 grid gap-2">
                {model.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'scan-heavy' ? HardDrive : item.id === 'shuffle-skew' ? Network : item.id === 'driver-bound' ? Server : Database}
                    accent="violet"
                    onClick={() => selectScenario(item)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. First action
              </legend>
              <div className="mt-3 grid gap-2">
                {scenario.actions.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === action.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.fit === 'best' ? CheckCircle2 : item.fit === 'investigate' ? Search : XCircle}
                    accent={item.fit === 'best' ? 'emerald' : item.fit === 'investigate' ? 'amber' : 'rose'}
                    onClick={() => setActionId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="space-y-6" aria-live="polite">
          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Observed symptom</p>
            <h4 className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{scenario.symptom}</h4>
            <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              This is a synthetic, internally consistent Spark profile for diagnosis practice. The durations are observations, not a Databricks benchmark or prediction.
            </p>
          </section>

          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Observed duration"
              value={`${summary.totalSeconds}s`}
              detail="Sum of the displayed phase durations"
              icon={Gauge}
              tone="blue"
            />
            <LabMetric
              label="Longest phase"
              value={summary.longest.label}
              detail={`${summary.longest.seconds}s in this trace`}
              icon={Activity}
              tone="violet"
            />
            <LabMetric
              label="Action quality"
              value={actionInfo.label}
              detail="Judge the action against evidence, then verify on another run"
              icon={ActionIcon}
              tone={actionInfo.tone}
            />
          </div>

          <section className="overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
            <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Run phase breakdown</p>
            </header>
            <div className="space-y-4 p-4">
              {scenario.phases.map((phase) => {
                const width = Math.max(4, (phase.seconds / summary.totalSeconds) * 100);
                return (
                  <div key={phase.id}>
                    <div className="flex items-start justify-between gap-4 text-sm">
                      <div className="min-w-0">
                        <span className="font-semibold text-neutral-950 dark:text-white">{phase.label}</span>
                        <span className="ml-2 text-neutral-500 dark:text-neutral-400">{phase.detail}</span>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums text-neutral-800 dark:text-neutral-200">{phase.seconds}s</span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div className={`h-full rounded-full ${phaseClasses[phase.tone]}`} style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            {scenario.signals.map((signal) => (
              <div key={signal.label} className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">{signal.label}</p>
                <p className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">{signal.value}</p>
                <p className="mt-1 text-xs leading-5 text-neutral-600 dark:text-neutral-400">{signal.detail}</p>
              </div>
            ))}
          </section>

          <section className={`rounded-md border p-5 ${actionInfo.className}`}>
            <div className="flex items-start gap-3">
              <ActionIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase opacity-75">{actionInfo.label}</p>
                <h4 className="mt-1 text-lg font-semibold">{actionInfo.heading}</h4>
                <p className="mt-2 text-sm leading-6 opacity-80">{action.result}</p>
              </div>
            </div>
          </section>

          <section className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
            <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Verification loop</p>
            <ol className="mt-3 space-y-3">
              {action.verify.map((item, index) => (
                <li key={item} className="flex gap-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white dark:bg-white dark:text-neutral-950">
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

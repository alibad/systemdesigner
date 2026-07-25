'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  Braces,
  CheckCircle2,
  CircleAlert,
  CircleX,
  Code2,
  Database,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  Route,
  ShieldCheck,
  UserRoundCheck,
  type LucideIcon,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type BoundaryStage = {
  id: string;
  label: string;
  eyebrow: string;
  detail: string;
  controlIds: string[];
};

type EnforcementPosture = {
  id: string;
  label: string;
  detail: string;
  controls: string[];
};

type AttackScenario = {
  id: string;
  label: string;
  brief: string;
  request: string;
  attackGoal: string;
  requiredControls: string[];
  safeResult: string;
  unsafeResult: string;
};

type RequestBoundaryData = {
  title: string;
  description: string;
  defaultScenarioId: string;
  defaultPostureId: string;
  stages: BoundaryStage[];
  postures: EnforcementPosture[];
  scenarios: AttackScenario[];
};

const BLOCK_ID = 'fundamentals/advanced-web-security-calculator';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isRequestBoundaryData(value: unknown): value is RequestBoundaryData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RequestBoundaryData>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaultScenarioId
      && candidate.defaultPostureId
      && Array.isArray(candidate.stages)
      && candidate.stages.length >= 3
      && candidate.stages.every((stage) => (
        typeof stage.id === 'string'
        && typeof stage.label === 'string'
        && typeof stage.eyebrow === 'string'
        && typeof stage.detail === 'string'
        && isStringArray(stage.controlIds)
      ))
      && Array.isArray(candidate.postures)
      && candidate.postures.length >= 2
      && candidate.postures.every((posture) => (
        typeof posture.id === 'string'
        && typeof posture.label === 'string'
        && typeof posture.detail === 'string'
        && isStringArray(posture.controls)
      ))
      && Array.isArray(candidate.scenarios)
      && candidate.scenarios.length >= 2
      && candidate.scenarios.every((scenario) => (
        typeof scenario.id === 'string'
        && typeof scenario.label === 'string'
        && typeof scenario.brief === 'string'
        && typeof scenario.request === 'string'
        && typeof scenario.attackGoal === 'string'
        && isStringArray(scenario.requiredControls)
        && typeof scenario.safeResult === 'string'
        && typeof scenario.unsafeResult === 'string'
      )),
  );
}

function stageIcon(stageId: string): LucideIcon {
  if (stageId === 'identity') return UserRoundCheck;
  if (stageId === 'route') return Route;
  if (stageId === 'resource') return Database;
  if (stageId === 'interpreter') return Braces;
  return LockKeyhole;
}

function scenarioIcon(scenarioId: string): LucideIcon {
  if (scenarioId.includes('invoice')) return Database;
  if (scenarioId.includes('injection')) return Code2;
  if (scenarioId.includes('script')) return Braces;
  return KeyRound;
}

export default function AdvancedWebSecurityCalculator({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RequestBoundaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No request-boundary scenario file was supplied.');
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
        if (!isRequestBoundaryData(payload)) {
          throw new Error('Request-boundary scenario data is incomplete.');
        }
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (error) {
    return <LoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />;
  }
  if (!data) return <LoadState error={null} onRetry={() => setReloadKey((key) => key + 1)} />;
  return <RequestBoundaryLab data={data} />;
}

function RequestBoundaryLab({ data }: { data: RequestBoundaryData }) {
  const initialScenario = data.scenarios.find((item) => item.id === data.defaultScenarioId)
    ?? data.scenarios[0];
  const initialPosture = data.postures.find((item) => item.id === data.defaultPostureId)
    ?? data.postures[0];
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [postureId, setPostureId] = useState(initialPosture.id);

  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];
  const posture = data.postures.find((item) => item.id === postureId) ?? data.postures[0];

  const result = useMemo(() => {
    const required = new Set(scenario.requiredControls);
    const enforced = new Set(posture.controls);
    const missing = scenario.requiredControls.filter((control) => !enforced.has(control));
    const blocked = missing.length === 0;
    const coverage = Math.round(
      (scenario.requiredControls.filter((control) => enforced.has(control)).length
        / scenario.requiredControls.length) * 100,
    );
    const stages = data.stages.map((stage) => {
      const decisive = stage.controlIds.some((control) => required.has(control));
      const protectedStage = stage.controlIds.some(
        (control) => required.has(control) && enforced.has(control),
      );
      return {
        ...stage,
        status: !decisive ? 'context' : protectedStage ? 'protected' : 'failed',
      } as const;
    });

    return { blocked, coverage, missing, stages };
  }, [data.stages, posture.controls, scenario.requiredControls]);

  function reset() {
    setScenarioId(initialScenario.id);
    setPostureId(initialPosture.id);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Request authority lab"
          title={data.title}
          description={data.description}
          icon={ShieldCheck}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Attack path
                </legend>
                <div className="mt-3 space-y-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.brief}
                      icon={scenarioIcon(item.id)}
                      accent="rose"
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Enforcement posture
                </legend>
                <div className="mt-3 space-y-2">
                  {data.postures.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === posture.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'operation-scoped' ? ShieldCheck : BadgeCheck}
                      accent={item.id === 'operation-scoped' ? 'emerald' : 'amber'}
                      onClick={() => setPostureId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div aria-live="polite" className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-3">
              <LabMetric
                label="Decisive coverage"
                value={`${result.coverage}%`}
                detail={`${scenario.requiredControls.length - result.missing.length} of ${scenario.requiredControls.length} required controls are enforced.`}
                icon={ShieldCheck}
                tone={result.blocked ? 'emerald' : result.coverage >= 50 ? 'amber' : 'rose'}
              />
              <LabMetric
                label="Missing boundaries"
                value={String(result.missing.length)}
                detail={result.missing[0] ?? 'Every control required by this attack path is present.'}
                icon={result.missing.length > 0 ? CircleAlert : CheckCircle2}
                tone={result.missing.length > 0 ? 'rose' : 'emerald'}
              />
              <LabMetric
                label="Observed outcome"
                value={result.blocked ? 'Contained' : 'Compromised'}
                detail={result.blocked ? 'The request stops before harm.' : 'The attack reaches protected data or a side effect.'}
                icon={result.blocked ? LockKeyhole : CircleX}
                tone={result.blocked ? 'emerald' : 'rose'}
              />
            </div>

            <section className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Incoming request
              </p>
              <code className="mt-2 block overflow-x-auto rounded-md bg-neutral-950 px-4 py-3 text-sm text-cyan-200">
                {scenario.request}
              </code>
              <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                <strong className="text-neutral-950 dark:text-white">Attacker goal:</strong>{' '}
                {scenario.attackGoal}
              </p>
            </section>

            <div className="mt-5 grid gap-2 xl:grid-cols-5">
              {result.stages.map((stage, index) => (
                <div key={stage.id} className="min-w-0">
                  <TraceStage stage={stage} />
                  {index < result.stages.length - 1 ? (
                    <div aria-hidden="true" className="mx-auto h-5 w-px bg-neutral-300 xl:hidden dark:bg-neutral-700" />
                  ) : null}
                </div>
              ))}
            </div>

            <section className={`mt-5 rounded-md border p-4 ${
              result.blocked
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
                : 'border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/30'
            }`}>
              <div className="flex items-start gap-3">
                {result.blocked ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
                )}
                <div>
                  <h4 className="font-semibold text-neutral-950 dark:text-white">
                    {result.blocked ? 'The decisive boundary rejects the attack' : 'A valid session crosses too much of the system'}
                  </h4>
                  <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                    {result.blocked ? scenario.safeResult : scenario.unsafeResult}
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

function TraceStage({
  stage,
}: {
  stage: BoundaryStage & { status: 'context' | 'protected' | 'failed' };
}) {
  const Icon = stageIcon(stage.id);
  const styles = {
    context: 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300',
    protected: 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-50',
    failed: 'border-rose-300 bg-rose-50 text-rose-950 ring-1 ring-rose-200 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-50 dark:ring-rose-900',
  };
  const statusLabel = stage.status === 'protected'
    ? 'Enforced'
    : stage.status === 'failed' ? 'Missing' : 'Not decisive here';

  return (
    <div className={`h-full rounded-md border p-3 ${styles[stage.status]}`}>
      <div className="flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="text-xs font-semibold uppercase opacity-75">{stage.eyebrow}</span>
      </div>
      <h4 className="mt-2 text-sm font-semibold">{stage.label}</h4>
      <p className="mt-1 text-xs leading-5 opacity-80">{stage.detail}</p>
      <span className="mt-3 inline-flex rounded border border-current/20 px-2 py-1 text-[11px] font-semibold">
        {statusLabel}
      </span>
    </div>
  );
}

function LoadState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <div className="flex min-h-[320px] items-center justify-center p-6 text-center">
          <div className="max-w-md">
            {error ? (
              <CircleAlert aria-hidden="true" className="mx-auto h-7 w-7 text-rose-500" />
            ) : (
              <Activity aria-hidden="true" className="mx-auto h-7 w-7 animate-pulse text-rose-500 motion-reduce:animate-none" />
            )}
            <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
              {error ? 'Request-boundary data could not be loaded' : 'Loading request boundaries...'}
            </p>
            {error ? (
              <>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-neutral-300 px-3 text-sm font-semibold text-neutral-800 hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-neutral-100 dark:hover:border-neutral-500"
                >
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  Try again
                </button>
              </>
            ) : null}
          </div>
        </div>
      </LearningLab>
    </div>
  );
}

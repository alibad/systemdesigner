'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Crosshair,
  Eye,
  Gauge,
  Layers3,
  LoaderCircle,
  LockKeyhole,
  Network,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bounds = { min: number; max: number; step: number };
type Objective = {
  id: string;
  label: string;
  detail: string;
  minimumTechniques: number;
  evidenceChecksPerExecution: number;
};
type Environment = {
  id: string;
  label: string;
  detail: string;
  targetCount: number;
  production: boolean;
  requiresManualApproval: boolean;
};
type ApprovalMode = {
  id: string;
  label: string;
  detail: string;
  concurrencyCap: number;
  autonomous: boolean;
};
type ScopeModel = {
  title: string;
  description: string;
  defaults: {
    objectiveId: string;
    environmentId: string;
    approvalModeId: string;
    techniqueCount: number;
  };
  bounds: { techniqueCount: Bounds };
  objectives: Objective[];
  environments: Environment[];
  approvalModes: ApprovalMode[];
};

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isScopeModel(value: unknown): value is ScopeModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ScopeModel>;
  const bounds = candidate.bounds?.techniqueCount;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.objectiveId
      && candidate.defaults.environmentId
      && candidate.defaults.approvalModeId
      && isNumber(candidate.defaults.techniqueCount)
      && bounds
      && isNumber(bounds.min)
      && isNumber(bounds.max)
      && isNumber(bounds.step)
      && Array.isArray(candidate.objectives)
      && candidate.objectives.length > 0
      && candidate.objectives.every((objective) => (
        typeof objective.id === 'string'
        && typeof objective.label === 'string'
        && typeof objective.detail === 'string'
        && isNumber(objective.minimumTechniques)
        && isNumber(objective.evidenceChecksPerExecution)
      ))
      && Array.isArray(candidate.environments)
      && candidate.environments.length > 0
      && candidate.environments.every((environment) => (
        typeof environment.id === 'string'
        && typeof environment.label === 'string'
        && typeof environment.detail === 'string'
        && isNumber(environment.targetCount)
        && typeof environment.production === 'boolean'
        && typeof environment.requiresManualApproval === 'boolean'
      ))
      && Array.isArray(candidate.approvalModes)
      && candidate.approvalModes.length > 0
      && candidate.approvalModes.every((mode) => (
        typeof mode.id === 'string'
        && typeof mode.label === 'string'
        && typeof mode.detail === 'string'
        && isNumber(mode.concurrencyCap)
        && typeof mode.autonomous === 'boolean'
      )),
  );
}

export default function AttackSimulationFrameworksCalculator({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<ScopeModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No simulation scope model was supplied.');
      return;
    }

    const controller = new AbortController();
    setError(null);
    setData(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isScopeModel(payload)) throw new Error('The simulation scope model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the scope lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (error) return <LoadError detail={error} />;
  if (!data) return <LoadState />;
  return <SimulationScopeLab data={data} />;
}

function SimulationScopeLab({ data }: { data: ScopeModel }) {
  const [objectiveId, setObjectiveId] = useState(data.defaults.objectiveId);
  const [environmentId, setEnvironmentId] = useState(data.defaults.environmentId);
  const [approvalModeId, setApprovalModeId] = useState(data.defaults.approvalModeId);
  const [techniqueCount, setTechniqueCount] = useState(data.defaults.techniqueCount);

  const objective = data.objectives.find((item) => item.id === objectiveId) ?? data.objectives[0];
  const environment = data.environments.find((item) => item.id === environmentId) ?? data.environments[0];
  const approvalMode = data.approvalModes.find((item) => item.id === approvalModeId) ?? data.approvalModes[0];

  const result = useMemo(() => {
    const concurrentHosts = Math.min(environment.targetCount, approvalMode.concurrencyCap);
    const waves = Math.ceil(environment.targetCount / concurrentHosts);
    const hostActions = environment.targetCount * techniqueCount;
    const evidenceChecks = hostActions * objective.evidenceChecksPerExecution;
    const objectiveCovered = techniqueCount >= objective.minimumTechniques;
    const approvalCovered = !environment.requiresManualApproval || !approvalMode.autonomous;
    const bounded = !environment.production || concurrentHosts < environment.targetCount;

    let status = 'Ready for an authorized rehearsal';
    let explanation = 'The modeled plan covers the objective and limits concurrent target exposure. A real operator must still verify authorization, commands, prerequisites, cleanup, and stop conditions.';
    if (!objectiveCovered) {
      status = 'Hold: objective is under-scoped';
      explanation = `${objective.label} needs at least ${objective.minimumTechniques} linked test steps in this model. Add the missing behavior before treating the run as an end-to-end validation.`;
    } else if (!approvalCovered) {
      status = 'Hold: approval mode exceeds the boundary';
      explanation = `${environment.label} requires human approval in this model. Move to an isolated target group or switch to a reviewed approval mode before execution.`;
    } else if (!bounded && environment.production) {
      status = 'Review: all production targets move together';
      explanation = 'The plan has no smaller concurrency wave than its target group. Reduce concurrency so one failed step cannot affect the whole selected segment at once.';
    }

    return {
      approvalCovered,
      bounded,
      concurrentHosts,
      evidenceChecks,
      explanation,
      hostActions,
      objectiveCovered,
      status,
      waves,
    };
  }, [approvalMode, environment, objective, techniqueCount]);

  function reset() {
    setObjectiveId(data.defaults.objectiveId);
    setEnvironmentId(data.defaults.environmentId);
    setApprovalModeId(data.defaults.approvalModeId);
    setTechniqueCount(data.defaults.techniqueCount);
  }

  const StatusIcon = result.objectiveCovered && result.approvalCovered && result.bounded
    ? CheckCircle2
    : AlertTriangle;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Attack simulation scope lab"
        title={data.title}
        description={data.description}
        icon={Crosshair}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Validation objective
              </legend>
              <div className="mt-3 grid gap-2">
                {data.objectives.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === objective.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'visibility' ? Eye : item.id === 'detection-chain' ? Target : Users}
                    accent="rose"
                    onClick={() => setObjectiveId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Target boundary
              </legend>
              <div className="mt-3 grid gap-2">
                {data.environments.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === environment.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.production ? Network : ShieldCheck}
                    accent={item.production ? 'amber' : 'emerald'}
                    onClick={() => setEnvironmentId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. Approval mode
              </legend>
              <div className="mt-3 grid gap-2">
                {data.approvalModes.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === approvalMode.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.autonomous ? Gauge : LockKeyhole}
                    accent={item.autonomous ? 'amber' : 'blue'}
                    onClick={() => setApprovalModeId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Linked technique steps"
              value={techniqueCount}
              output={`${techniqueCount} step${techniqueCount === 1 ? '' : 's'}`}
              {...data.bounds.techniqueCount}
              lowLabel="Focused check"
              highLabel="Longer chain"
              accent="rose"
              onChange={setTechniqueCount}
            />
          </div>
        )}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <LabMetric
            label="Host-actions"
            value={result.hostActions.toLocaleString()}
            detail={`${environment.targetCount} targets x ${techniqueCount} technique steps`}
            icon={Layers3}
            tone="rose"
          />
          <LabMetric
            label="Concurrent hosts"
            value={result.concurrentHosts.toLocaleString()}
            detail={`${result.waves} execution wave${result.waves === 1 ? '' : 's'}`}
            icon={Gauge}
            tone="amber"
          />
          <LabMetric
            label="Evidence checkpoints"
            value={result.evidenceChecks.toLocaleString()}
            detail="Planned observations, not guaranteed detections"
            icon={ClipboardCheck}
            tone="blue"
          />
          <LabMetric
            label="Human control"
            value={approvalMode.autonomous ? 'Bounded auto' : 'Reviewed'}
            detail={approvalMode.label}
            icon={LockKeyhole}
            tone={result.approvalCovered ? 'emerald' : 'rose'}
          />
        </div>

        <div className={`mt-5 rounded-md border p-4 ${
          result.objectiveCovered && result.approvalCovered && result.bounded
            ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
            : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
        }`}>
          <div className="flex items-start gap-3">
            <StatusIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">{result.status}</p>
              <p className="mt-1 text-sm leading-6 opacity-80">{result.explanation}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <ModelCheck label="Objective covered" pass={result.objectiveCovered} />
          <ModelCheck label="Approval fits scope" pass={result.approvalCovered} />
          <ModelCheck label="Blast radius is split" pass={result.bounded} />
        </div>

        <p className="mt-5 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
          This planning model exposes arithmetic and policy conflicts. It does not estimate security effectiveness or authorize a real operation.
        </p>
      </LearningLabBody>
    </LearningLab>
  );
}

function ModelCheck({ label, pass }: { label: string; pass: boolean }) {
  const Icon = pass ? CheckCircle2 : AlertTriangle;
  return (
    <div className="flex min-h-11 items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
      <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
      <span className="font-medium">{label}</span>
    </div>
  );
}

function LoadState() {
  return (
    <div className="not-prose my-7 flex min-h-72 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 text-neutral-300">
      <div className="flex items-center gap-3 text-sm">
        <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
        Loading the simulation scope model...
      </div>
    </div>
  );
}

function LoadError({ detail }: { detail: string }) {
  return (
    <div className="not-prose my-7 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">The simulation scope lab could not be loaded.</p>
        <p className="mt-1 opacity-80">{detail}</p>
      </div>
    </div>
  );
}

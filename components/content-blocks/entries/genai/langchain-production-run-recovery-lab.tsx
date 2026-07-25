'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  CircleX,
  CloudCog,
  Database,
  FileSearch,
  LoaderCircle,
  RefreshCw,
  RotateCw,
  ServerCog,
  ShieldCheck,
  Siren,
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

type ControlOption = {
  id: string;
  label: string;
  detail: string;
};

type RecoveryIncident = {
  id: string;
  label: string;
  brief: string;
  failureStage: number;
  requiresDurableState: boolean;
  recommendedRetryId: string;
  recommendedDeploymentIds: string[];
  needsStepTraces: boolean;
  effect: string;
  safeOutcome: string;
  unsafeOutcome: string;
};

type RunRecoveryData = {
  title: string;
  description: string;
  defaults: {
    incidentId: string;
    stateId: string;
    retryId: string;
    observabilityId: string;
    deploymentId: string;
  };
  stages: string[];
  stateOptions: ControlOption[];
  retryOptions: ControlOption[];
  observabilityOptions: ControlOption[];
  deploymentOptions: ControlOption[];
  incidents: RecoveryIncident[];
};

type StageStatus = 'complete' | 'failed' | 'recovered' | 'blocked';

const BLOCK_ID = 'genai/langchain-production-run-recovery-lab';

const incidentIcons: Record<string, LucideIcon> = {
  'ambiguous-refund': RefreshCw,
  'model-rate-limit': Activity,
  'approval-deploy': CloudCog,
  'stream-disconnect': ServerCog,
};

function isControlOptions(value: unknown): value is ControlOption[] {
  return Array.isArray(value)
    && value.length > 0
    && value.every((item) => (
      typeof item.id === 'string'
      && typeof item.label === 'string'
      && typeof item.detail === 'string'
    ));
}

function isRunRecoveryData(value: unknown): value is RunRecoveryData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RunRecoveryData>;
  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.incidentId
      && candidate.defaults.stateId
      && candidate.defaults.retryId
      && candidate.defaults.observabilityId
      && candidate.defaults.deploymentId
      && Array.isArray(candidate.stages)
      && candidate.stages.length === 5
      && candidate.stages.every((item) => typeof item === 'string')
      && isControlOptions(candidate.stateOptions)
      && isControlOptions(candidate.retryOptions)
      && isControlOptions(candidate.observabilityOptions)
      && isControlOptions(candidate.deploymentOptions)
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length > 0
      && candidate.incidents.every((item) => (
        typeof item.id === 'string'
        && typeof item.label === 'string'
        && typeof item.brief === 'string'
        && Number.isInteger(item.failureStage)
        && typeof item.requiresDurableState === 'boolean'
        && typeof item.recommendedRetryId === 'string'
        && Array.isArray(item.recommendedDeploymentIds)
        && item.recommendedDeploymentIds.every((id) => typeof id === 'string')
        && typeof item.needsStepTraces === 'boolean'
        && typeof item.effect === 'string'
        && typeof item.safeOutcome === 'string'
        && typeof item.unsafeOutcome === 'string'
      )),
  );
}

export default function LangchainProductionRunRecoveryLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<RunRecoveryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No run recovery model was supplied.');
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
        if (!isRunRecoveryData(payload)) throw new Error('Run recovery data is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (error) {
    return <RecoveryLoadState error={error} onRetry={() => setReloadKey((key) => key + 1)} />;
  }
  if (!data) return <RecoveryLoadState error={null} />;
  return <RunRecoveryLab data={data} />;
}

function RunRecoveryLab({ data }: { data: RunRecoveryData }) {
  const [incidentId, setIncidentId] = useState(data.defaults.incidentId);
  const [stateId, setStateId] = useState(data.defaults.stateId);
  const [retryId, setRetryId] = useState(data.defaults.retryId);
  const [observabilityId, setObservabilityId] = useState(data.defaults.observabilityId);
  const [deploymentId, setDeploymentId] = useState(data.defaults.deploymentId);

  const incident = data.incidents.find((item) => item.id === incidentId) ?? data.incidents[0];

  const result = useMemo(() => {
    const stateSafe = !incident.requiresDurableState || stateId === 'durable';
    const retrySafe = retryId === incident.recommendedRetryId;
    const observable = !incident.needsStepTraces || observabilityId === 'step-traces';
    const deploymentSafe = incident.recommendedDeploymentIds.includes(deploymentId);
    const controls = [stateSafe, retrySafe, observable, deploymentSafe];
    const score = controls.filter(Boolean).length;
    const safe = score === controls.length;

    const duplicateRisk = incident.id === 'ambiguous-refund' && retryId !== 'reconcile'
      ? 'High: second refund'
      : retryId === 'whole-run'
        ? 'Amplified work'
        : 'Controlled';
    const resumePoint = !stateSafe
      ? 'Lost with worker'
      : retrySafe
        ? data.stages[incident.failureStage]
        : 'Uncertain boundary';
    const evidence = observabilityId === 'step-traces'
      ? 'Stage and release identified'
      : 'Root status only';
    const continuity = deploymentSafe
      ? deploymentId === 'split-workers' ? 'Queue survives API churn' : 'Host can drain work'
      : deploymentId === 'scale-zero' ? 'Run may be orphaned' : 'Restart shares one boundary';

    const stages = data.stages.map((label, index): { label: string; status: StageStatus } => {
      if (index < incident.failureStage) return { label, status: 'complete' };
      if (index === incident.failureStage) return { label, status: safe ? 'recovered' : 'failed' };
      return { label, status: safe ? 'recovered' : 'blocked' };
    });

    return {
      continuity,
      deploymentSafe,
      duplicateRisk,
      evidence,
      observable,
      resumePoint,
      retrySafe,
      safe,
      score,
      stages,
      stateSafe,
    };
  }, [data.stages, deploymentId, incident, observabilityId, retryId, stateId]);

  function chooseIncident(next: RecoveryIncident) {
    setIncidentId(next.id);
  }

  function reset() {
    setIncidentId(data.defaults.incidentId);
    setStateId(data.defaults.stateId);
    setRetryId(data.defaults.retryId);
    setObservabilityId(data.defaults.observabilityId);
    setDeploymentId(data.defaults.deploymentId);
  }

  const outcomeTone = result.safe ? 'emerald' : result.score >= 2 ? 'amber' : 'rose';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Run recovery control room"
          title={data.title}
          description={data.description}
          icon={Siren}
          accent="rose"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Inject an incident
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.incidents.map((item) => {
                    const Icon = incidentIcons[item.id] ?? Siren;
                    return (
                      <LabChoice
                        key={item.id}
                        selected={item.id === incident.id}
                        label={item.label}
                        detail={item.brief}
                        icon={Icon}
                        accent="rose"
                        onClick={() => chooseIncident(item)}
                      />
                    );
                  })}
                </div>
              </fieldset>

              <ControlGroup
                label="2. State after restart"
                options={data.stateOptions}
                selectedId={stateId}
                icon={Database}
                accent="violet"
                onSelect={setStateId}
              />
              <ControlGroup
                label="3. Retry boundary"
                options={data.retryOptions}
                selectedId={retryId}
                icon={RotateCw}
                accent="amber"
                onSelect={setRetryId}
              />
              <ControlGroup
                label="4. Trace evidence"
                options={data.observabilityOptions}
                selectedId={observabilityId}
                icon={FileSearch}
                accent="blue"
                onSelect={setObservabilityId}
              />
              <ControlGroup
                label="5. Deployment boundary"
                options={data.deploymentOptions}
                selectedId={deploymentId}
                icon={ServerCog}
                accent="cyan"
                onSelect={setDeploymentId}
              />
            </div>
          )}
        >
          <div className="min-w-0 space-y-6" aria-live="polite">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Recovery posture"
                value={result.safe ? 'Safe to resume' : `${result.score}/4 controls fit`}
                detail={result.safe ? incident.safeOutcome : incident.unsafeOutcome}
                icon={result.safe ? CheckCircle2 : AlertTriangle}
                tone={outcomeTone}
              />
              <LabMetric
                label="Resume point"
                value={result.resumePoint}
                detail={result.stateSafe ? 'Execution state survives the failure.' : 'No durable cursor remains.'}
                icon={Database}
                tone={result.stateSafe ? 'violet' : 'rose'}
              />
              <LabMetric
                label="Duplicate risk"
                value={result.duplicateRisk}
                detail={incident.effect}
                icon={RefreshCw}
                tone={result.duplicateRisk === 'Controlled' ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Trace evidence"
                value={result.evidence}
                detail={result.observable ? 'The failed boundary can be isolated.' : 'Diagnosis cannot separate child stages.'}
                icon={Activity}
                tone={result.observable ? 'blue' : 'amber'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Incident tape
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {incident.label}
                  </h4>
                </div>
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Failure boundary: {data.stages[incident.failureStage]}
                </span>
              </div>

              <ol className="mt-4 grid gap-2 sm:grid-cols-5">
                {result.stages.map((stage, index) => {
                  const styles = stageStyles[stage.status];
                  const Icon = stage.status === 'complete'
                    ? CheckCircle2
                    : stage.status === 'recovered'
                      ? RefreshCw
                      : stage.status === 'failed'
                        ? CircleX
                        : CircleAlert;
                  return (
                    <li key={stage.label} className={`rounded-md border p-3 ${styles.container}`}>
                      <div className="flex items-center gap-2 sm:block">
                        <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 sm:mb-2 ${styles.icon}`} />
                        <div>
                          <span className="block text-xs font-semibold uppercase opacity-70">
                            {index + 1}. {stage.status}
                          </span>
                          <span className="mt-1 block text-sm font-semibold">{stage.label}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <div className="grid gap-3 md:grid-cols-2">
              <section className="rounded-md border border-neutral-200 p-4 dark:border-neutral-800">
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Deployment continuity
                </p>
                <p className="mt-2 text-lg font-semibold text-neutral-950 dark:text-white">
                  {result.continuity}
                </p>
                <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                  {result.deploymentSafe
                    ? 'The selected compute boundary can preserve or drain this class of work.'
                    : 'The selected compute lifecycle conflicts with the run lifetime.'}
                </p>
              </section>

              <section className={`rounded-md border p-4 ${
                result.safe
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                  : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
              }`}>
                <div className="flex items-start gap-3">
                  {result.safe ? (
                    <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  ) : (
                    <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
                  )}
                  <div>
                    <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                      {result.safe ? 'Recovery contract holds' : 'Recovery contract is broken'}
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                      {result.safe ? incident.safeOutcome : incident.unsafeOutcome}
                    </p>
                    {!result.retrySafe ? (
                      <p className="mt-2 text-xs font-semibold text-rose-800 dark:text-rose-200">
                        Retry mismatch: this incident requires {labelFor(data.retryOptions, incident.recommendedRetryId).toLowerCase()}.
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ControlGroup({
  label,
  options,
  selectedId,
  icon,
  accent,
  onSelect,
}: {
  label: string;
  options: ControlOption[];
  selectedId: string;
  icon: LucideIcon;
  accent: 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose' | 'blue';
  onSelect: (id: string) => void;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className="mt-3 grid gap-2">
        {options.map((option) => (
          <LabChoice
            key={option.id}
            selected={option.id === selectedId}
            label={option.label}
            detail={option.detail}
            icon={icon}
            accent={accent}
            onClick={() => onSelect(option.id)}
          />
        ))}
      </div>
    </fieldset>
  );
}

const stageStyles: Record<StageStatus, { container: string; icon: string }> = {
  complete: {
    container: 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  recovered: {
    container: 'border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-50',
    icon: 'text-blue-600 dark:text-blue-400',
  },
  failed: {
    container: 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-50',
    icon: 'text-rose-600 dark:text-rose-400',
  },
  blocked: {
    container: 'border-neutral-200 bg-white text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300',
    icon: 'text-neutral-400',
  },
};

function labelFor(options: ControlOption[], id: string) {
  return options.find((option) => option.id === id)?.label ?? id;
}

function RecoveryLoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-start gap-3">
        {error ? (
          <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
        ) : (
          <LoaderCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-rose-600 motion-reduce:animate-none" />
        )}
        <div>
          <p className="font-semibold text-neutral-950 dark:text-white">
            {error ? 'Recovery lab unavailable' : 'Loading failure scenarios...'}
          </p>
          {error ? <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{error}</p> : null}
          {error && onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-neutral-700 dark:text-neutral-100"
            >
              Try again
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  CloudCog,
  FileCheck2,
  GitPullRequestArrow,
  LockKeyhole,
  RefreshCw,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  UnlockKeyhole,
  Workflow,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'technology/terraform-drift-rollout-lab';
const DEFAULT_DATA_FILE =
  '/api/content/technology/terraform/data/drift-lock-rollout-model.json';

type Incident = {
  id: 'drift' | 'concurrent-run' | 'apply-failure';
  label: string;
  summary: string;
  operatorQuestion: string;
  recovery: string;
};

type StateScope = {
  id: 'platform' | 'domain' | 'service';
  label: string;
  detail: string;
  resourceCount: number;
  ownerCount: number;
};

type ExecutionPolicy = {
  id: 'saved-plan' | 'speculative-then-apply' | 'skip-refresh';
  label: string;
  detail: string;
  refreshes: boolean;
  sameArtifact: boolean;
};

type RolloutModel = {
  title: string;
  description: string;
  defaults: {
    incidentId: Incident['id'];
    scopeId: StateScope['id'];
    locking: boolean;
    executionId: ExecutionPolicy['id'];
  };
  incidents: Incident[];
  stateScopes: StateScope[];
  executionPolicies: ExecutionPolicy[];
  fixtureNote: string;
};

type TraceStep = {
  label: string;
  detail: string;
  status: 'healthy' | 'warning' | 'danger' | 'neutral';
};

type Outcome = {
  headline: string;
  detail: string;
  verdict: 'contained' | 'review' | 'unsafe';
  driftVisibility: string;
  writerSafety: string;
  reviewContinuity: string;
  trace: TraceStep[];
};

function isRolloutModel(value: unknown): value is RolloutModel {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RolloutModel>;

  return Boolean(
    candidate.title
      && candidate.description
      && candidate.defaults?.incidentId
      && candidate.defaults.scopeId
      && typeof candidate.defaults.locking === 'boolean'
      && candidate.defaults.executionId
      && Array.isArray(candidate.incidents)
      && candidate.incidents.length === 3
      && candidate.incidents.every(
        (incident) =>
          typeof incident.id === 'string'
          && typeof incident.label === 'string'
          && typeof incident.summary === 'string'
          && typeof incident.operatorQuestion === 'string'
          && typeof incident.recovery === 'string',
      )
      && Array.isArray(candidate.stateScopes)
      && candidate.stateScopes.length === 3
      && candidate.stateScopes.every(
        (scope) =>
          typeof scope.id === 'string'
          && typeof scope.label === 'string'
          && typeof scope.detail === 'string'
          && Number.isFinite(scope.resourceCount)
          && Number.isFinite(scope.ownerCount),
      )
      && Array.isArray(candidate.executionPolicies)
      && candidate.executionPolicies.length === 3
      && candidate.executionPolicies.every(
        (policy) =>
          typeof policy.id === 'string'
          && typeof policy.label === 'string'
          && typeof policy.detail === 'string'
          && typeof policy.refreshes === 'boolean'
          && typeof policy.sameArtifact === 'boolean',
      )
      && typeof candidate.fixtureNote === 'string',
  );
}

export default function TerraformDriftRolloutLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<RolloutModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isRolloutModel(payload)) {
          throw new Error('The rollout-containment model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the rollout model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Drift and rollout lab"
            title="Load the failure-containment model"
            description="The lesson-owned incidents, state boundaries, and execution policies are loading."
            icon={ShieldAlert}
            accent="rose"
          />
          <LoadState
            error={error}
            onRetry={() => setReloadKey((value) => value + 1)}
          />
        </LearningLab>
      ) : (
        <RolloutLab model={model} />
      )}
    </div>
  );
}

function RolloutLab({ model }: { model: RolloutModel }) {
  const [incidentId, setIncidentId] = useState<Incident['id']>(
    model.defaults.incidentId,
  );
  const [scopeId, setScopeId] = useState<StateScope['id']>(
    model.defaults.scopeId,
  );
  const [locking, setLocking] = useState(model.defaults.locking);
  const [executionId, setExecutionId] = useState<ExecutionPolicy['id']>(
    model.defaults.executionId,
  );

  const incident =
    model.incidents.find((item) => item.id === incidentId) ?? model.incidents[0];
  const scope =
    model.stateScopes.find((item) => item.id === scopeId) ?? model.stateScopes[0];
  const execution =
    model.executionPolicies.find((item) => item.id === executionId)
    ?? model.executionPolicies[0];

  const outcome = useMemo(
    () => calculateOutcome(incident, scope, locking, execution),
    [execution, incident, locking, scope],
  );

  function reset() {
    setIncidentId(model.defaults.incidentId);
    setScopeId(model.defaults.scopeId);
    setLocking(model.defaults.locking);
    setExecutionId(model.defaults.executionId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Drift and rollout lab"
        title={model.title}
        description={model.description}
        icon={ShieldAlert}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Inject an incident
              </legend>
              <div className="mt-3 grid gap-2">
                {model.incidents.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === incident.id}
                    label={item.label}
                    detail={item.summary}
                    icon={incidentIcon(item.id)}
                    accent="rose"
                    onClick={() => setIncidentId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. State boundary
              </legend>
              <div className="mt-3 grid gap-2">
                {model.stateScopes.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scope.id}
                    label={item.label}
                    detail={item.detail}
                    icon={CloudCog}
                    accent="blue"
                    onClick={() => setScopeId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                3. State locking
              </legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <LabChoice
                  selected={locking}
                  label="Locking enabled"
                  detail="Serialize writers when the selected backend supports locks."
                  icon={LockKeyhole}
                  accent="emerald"
                  onClick={() => setLocking(true)}
                />
                <LabChoice
                  selected={!locking}
                  label="Locking disabled"
                  detail="Allow operations to proceed without a shared writer lock."
                  icon={UnlockKeyhole}
                  accent="rose"
                  onClick={() => setLocking(false)}
                />
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                4. Plan and apply policy
              </legend>
              <div className="mt-3 grid gap-2">
                {model.executionPolicies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === execution.id}
                    label={item.label}
                    detail={item.detail}
                    icon={FileCheck2}
                    accent="amber"
                    onClick={() => setExecutionId(item.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      >
        <div className="min-w-0 space-y-6">
          <OutcomeBanner outcome={outcome} />

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Shared state scope"
              value={`${scope.resourceCount} resources`}
              detail={`${scope.ownerCount} owner${scope.ownerCount === 1 ? '' : 's'} in this teaching fixture`}
              icon={CloudCog}
              tone={scope.id === 'platform' ? 'amber' : 'blue'}
            />
            <LabMetric
              label="Drift visibility"
              value={outcome.driftVisibility}
              detail={execution.refreshes ? 'Remote objects are read' : 'Cached state only'}
              icon={ScanSearch}
              tone={execution.refreshes ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Writer safety"
              value={outcome.writerSafety}
              detail={locking ? 'Backend support is still required' : 'No serialization'}
              icon={locking ? LockKeyhole : UnlockKeyhole}
              tone={locking ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Review continuity"
              value={outcome.reviewContinuity}
              detail="Does apply execute the reviewed artifact?"
              icon={GitPullRequestArrow}
              tone={execution.sameArtifact ? 'violet' : 'amber'}
            />
          </div>

          <IncidentTrace steps={outcome.trace} />

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Operator question
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-neutral-950 dark:text-white">
                {incident.operatorQuestion}
              </p>
            </div>
            <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
              <p className="text-xs font-semibold uppercase opacity-70">
                Recovery path
              </p>
              <p className="mt-2 text-sm leading-6 opacity-85">{incident.recovery}</p>
            </div>
          </div>

          <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {model.fixtureNote}
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function calculateOutcome(
  incident: Incident,
  scope: StateScope,
  locking: boolean,
  execution: ExecutionPolicy,
): Outcome {
  const reviewContinuity = execution.sameArtifact ? 'Same artifact' : 'Plan regenerated';
  const writerSafety = locking ? 'Serialized' : 'Concurrent';
  const driftVisibility = execution.refreshes ? 'Visible' : 'Skipped';

  if (incident.id === 'concurrent-run') {
    return {
      headline: locking
        ? 'Run B cannot become a second writer'
        : 'Two runs can act from competing snapshots',
      detail: locking
        ? 'Run A holds the supported backend lock. Run B waits for the configured lock timeout or exits without applying.'
        : `Run A and Run B can both attempt changes across the ${scope.resourceCount}-resource state. Disabling the lock removes writer serialization.`,
      verdict: locking ? 'contained' : 'unsafe',
      driftVisibility,
      writerSafety,
      reviewContinuity,
      trace: [
        {
          label: 'Run A starts',
          detail: `Targets the ${scope.label.toLowerCase()}.`,
          status: 'healthy',
        },
        {
          label: locking ? 'Lock acquired' : 'Lock bypassed',
          detail: locking
            ? 'The backend grants one writer.'
            : 'No shared writer gate protects state.',
          status: locking ? 'healthy' : 'danger',
        },
        {
          label: 'Run B arrives',
          detail: locking ? 'Waits or times out.' : 'Can begin its own apply.',
          status: locking ? 'warning' : 'danger',
        },
        {
          label: locking ? 'Writes serialized' : 'Conflicting operations',
          detail: locking
            ? 'Only one run mutates the shared state at a time.'
            : 'The final state and remote side effects require investigation.',
          status: locking ? 'healthy' : 'danger',
        },
      ],
    };
  }

  if (incident.id === 'apply-failure') {
    return {
      headline: 'The failed apply requires a fresh reconciliation plan',
      detail: `Terraform records completed changes it knows about, releases the state lock, and exits. The ${scope.label.toLowerCase()} limits the graph under one state, but it does not create transactional rollback.`,
      verdict: locking ? 'review' : 'unsafe',
      driftVisibility,
      writerSafety,
      reviewContinuity,
      trace: [
        {
          label: 'Graph starts',
          detail: `${scope.resourceCount} fixture resources share this state boundary.`,
          status: 'healthy',
        },
        {
          label: 'Earlier nodes finish',
          detail: 'Successful remote changes are recorded in state.',
          status: 'neutral',
        },
        {
          label: 'Provider returns error',
          detail: 'Terraform logs the error and stops the apply.',
          status: 'danger',
        },
        {
          label: 'Replan required',
          detail: 'Inspect reality, resolve the cause, and create a new plan.',
          status: 'warning',
        },
      ],
    };
  }

  const detectsDrift = execution.refreshes;
  return {
    headline: detectsDrift
      ? 'The plan surfaces the out-of-band change'
      : 'This plan can miss the out-of-band change',
    detail: detectsDrift
      ? 'Normal planning refreshes the managed object before comparing configuration, prior state, and remote values. Review whether to restore configuration or accept the external change.'
      : 'With -refresh=false, Terraform plans from cached state and does not read the changed remote object. The saved artifact can therefore be incomplete.',
    verdict: detectsDrift ? 'contained' : 'unsafe',
    driftVisibility,
    writerSafety,
    reviewContinuity,
    trace: [
      {
        label: 'Remote object changes',
        detail: 'A managed network rule drifts outside the Terraform workflow.',
        status: 'danger',
      },
      {
        label: detectsDrift ? 'Refresh reads reality' : 'Refresh skipped',
        detail: detectsDrift
          ? 'The provider returns current remote values.'
          : 'The plan uses cached state values.',
        status: detectsDrift ? 'healthy' : 'danger',
      },
      {
        label: detectsDrift ? 'Difference appears' : 'Difference remains hidden',
        detail: detectsDrift
          ? 'The plan exposes the reconciliation decision.'
          : 'The plan may look clean or incomplete.',
        status: detectsDrift ? 'warning' : 'danger',
      },
      {
        label: execution.sameArtifact ? 'Reviewed artifact applies' : 'Apply replans',
        detail: execution.sameArtifact
          ? 'Policy and humans can review the artifact that apply executes.'
          : 'Apply creates a new plan instead of executing the speculative one.',
        status: execution.sameArtifact ? 'healthy' : 'warning',
      },
    ],
  };
}

function OutcomeBanner({ outcome }: { outcome: Outcome }) {
  const styles = {
    contained:
      'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100',
    review:
      'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
    unsafe:
      'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100',
  };
  const Icon =
    outcome.verdict === 'contained'
      ? ShieldCheck
      : outcome.verdict === 'review'
        ? TriangleAlert
        : ShieldAlert;

  return (
    <div className={`rounded-md border p-5 ${styles[outcome.verdict]}`}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0">
          <p className="text-lg font-semibold">{outcome.headline}</p>
          <p className="mt-2 text-sm leading-6 opacity-80">{outcome.detail}</p>
        </div>
      </div>
    </div>
  );
}

function IncidentTrace({ steps }: { steps: TraceStep[] }) {
  const stepStyles: Record<TraceStep['status'], string> = {
    healthy:
      'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
    warning:
      'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
    danger:
      'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100',
    neutral:
      'border-neutral-300 bg-neutral-50 text-neutral-950 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100',
  };

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        Incident trace
      </p>
      <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
        {steps.map((step, index) => (
          <div key={`${step.label}-${index}`} className="contents">
            <div className={`rounded-md border p-3 ${stepStyles[step.status]}`}>
              <span className="text-xs font-semibold uppercase opacity-65">
                Step {index + 1}
              </span>
              <p className="mt-2 text-sm font-semibold">{step.label}</p>
              <p className="mt-1 text-xs leading-5 opacity-75">{step.detail}</p>
            </div>
            {index < steps.length - 1 ? (
              <div className="flex items-center justify-center py-1 text-neutral-400 lg:py-0">
                <ArrowRight aria-hidden="true" className="hidden h-5 w-5 lg:block" />
                <ArrowDown aria-hidden="true" className="h-5 w-5 lg:hidden" />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function incidentIcon(id: Incident['id']) {
  if (id === 'drift') return ScanSearch;
  if (id === 'concurrent-run') return GitPullRequestArrow;
  return TriangleAlert;
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="p-5 md:p-6">
      <div
        className={`rounded-md border p-4 ${
          error
            ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
            : 'border-neutral-200 bg-neutral-50 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300'
        }`}
      >
        <div className="flex items-start gap-3">
          {error ? (
            <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {error ? 'The model could not be loaded' : 'Loading failure scenarios'}
            </p>
            <p className="mt-1 text-sm opacity-80">
              {error ?? 'Preparing drift, lock, and apply-failure paths.'}
            </p>
            {error ? (
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-md border border-current px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <RefreshCw aria-hidden="true" className="h-4 w-4" />
                Retry
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

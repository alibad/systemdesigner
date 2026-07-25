'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileCheck2,
  Fingerprint,
  Hourglass,
  LifeBuoy,
  LoaderCircle,
  LockKeyhole,
  Route,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  XCircle,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID =
  'fundamentals/autonomous-data-governance-evidence-escalation-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/autonomous-data-governance/data/evidence-escalation-model.json';

type FailureScenario = {
  id: string;
  label: string;
  detail: string;
  requiredRole: string;
  deadlineMinutes: number;
  fallback: string;
  impact: string;
  requiresDualControl: boolean;
};

type EscalationRoute = {
  id: string;
  label: string;
  detail: string;
  reviewerRoles: string[];
  reviewMinutes: number;
  containsRequest: boolean;
  signedDecision: boolean;
  dualControl: boolean;
};

type EvidenceBundle = {
  id: string;
  label: string;
  detail: string;
  artifacts: string[];
  independentRetention: boolean;
};

type EvidenceEscalationModel = {
  kind: 'autonomous-governance-evidence-escalation';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    scenarioId: string;
    routeId: string;
    evidenceId: string;
  };
  requiredEvidence: string[];
  scenarios: FailureScenario[];
  routes: EscalationRoute[];
  evidenceBundles: EvidenceBundle[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isEvidenceEscalationModel(
  value: unknown,
): value is EvidenceEscalationModel {
  if (
    !isRecord(value)
    || value.kind !== 'autonomous-governance-evidence-escalation'
    || value.blockId !== BLOCK_ID
    || typeof value.title !== 'string'
    || typeof value.description !== 'string'
    || typeof value.modelNote !== 'string'
    || !isRecord(value.defaults)
    || typeof value.defaults.scenarioId !== 'string'
    || typeof value.defaults.routeId !== 'string'
    || typeof value.defaults.evidenceId !== 'string'
    || !isStringArray(value.requiredEvidence)
    || value.requiredEvidence.length < 5
    || !Array.isArray(value.scenarios)
    || value.scenarios.length < 3
    || !Array.isArray(value.routes)
    || value.routes.length < 3
    || !Array.isArray(value.evidenceBundles)
    || value.evidenceBundles.length < 3
  ) {
    return false;
  }

  const validScenarios = value.scenarios.every((scenario) => (
    isRecord(scenario)
    && typeof scenario.id === 'string'
    && typeof scenario.label === 'string'
    && typeof scenario.detail === 'string'
    && typeof scenario.requiredRole === 'string'
    && typeof scenario.deadlineMinutes === 'number'
    && typeof scenario.fallback === 'string'
    && typeof scenario.impact === 'string'
    && typeof scenario.requiresDualControl === 'boolean'
  ));
  const validRoutes = value.routes.every((route) => (
    isRecord(route)
    && typeof route.id === 'string'
    && typeof route.label === 'string'
    && typeof route.detail === 'string'
    && isStringArray(route.reviewerRoles)
    && typeof route.reviewMinutes === 'number'
    && typeof route.containsRequest === 'boolean'
    && typeof route.signedDecision === 'boolean'
    && typeof route.dualControl === 'boolean'
  ));
  const validBundles = value.evidenceBundles.every((bundle) => (
    isRecord(bundle)
    && typeof bundle.id === 'string'
    && typeof bundle.label === 'string'
    && typeof bundle.detail === 'string'
    && isStringArray(bundle.artifacts)
    && typeof bundle.independentRetention === 'boolean'
  ));

  if (!validScenarios || !validRoutes || !validBundles) return false;

  const defaults = value.defaults as EvidenceEscalationModel['defaults'];
  return (
    value.scenarios.some((item) => item.id === defaults.scenarioId)
    && value.routes.some((item) => item.id === defaults.routeId)
    && value.evidenceBundles.some((item) => item.id === defaults.evidenceId)
  );
}

function scenarioIcon(id: string) {
  if (id === 'low-confidence') return Fingerprint;
  if (id === 'policy-conflict') return AlertTriangle;
  if (id === 'cross-border') return Route;
  return FileCheck2;
}

export default function AutonomousDataGovernanceEvidenceEscalationLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<EvidenceEscalationModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}.`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isEvidenceEscalationModel(payload)) {
          throw new Error('The evidence-escalation contract is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load the escalation model.',
        );
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Evidence and escalation lab"
            title="Keep the request safe while authority changes hands"
            description="Loading governance failures, review routes, and evidence contracts."
            icon={LifeBuoy}
            accent="rose"
          />
          <LearningLabBody>
            <LoadState
              error={error}
              onRetry={() => setReloadKey((value) => value + 1)}
            />
          </LearningLabBody>
        </LearningLab>
      </div>
    );
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <EvidenceEscalationLab model={model} />
    </div>
  );
}

function EvidenceEscalationLab({
  model,
}: {
  model: EvidenceEscalationModel;
}) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [routeId, setRouteId] = useState(model.defaults.routeId);
  const [evidenceId, setEvidenceId] = useState(model.defaults.evidenceId);

  const scenario = model.scenarios.find((item) => item.id === scenarioId)
    ?? model.scenarios[0];
  const route = model.routes.find((item) => item.id === routeId)
    ?? model.routes[0];
  const evidence = model.evidenceBundles.find((item) => item.id === evidenceId)
    ?? model.evidenceBundles[0];

  const result = useMemo(() => {
    const roleReady = route.reviewerRoles.includes(scenario.requiredRole);
    const deadlineReady = route.reviewMinutes <= scenario.deadlineMinutes;
    const containmentReady = route.containsRequest;
    const dualControlReady =
      !scenario.requiresDualControl || route.dualControl;
    const signedDecisionReady = route.signedDecision;
    const missingEvidence = model.requiredEvidence.filter(
      (artifact) => !evidence.artifacts.includes(artifact),
    );
    const evidenceComplete = missingEvidence.length === 0;
    const retentionReady = evidence.independentRetention;
    const ready =
      roleReady
      && deadlineReady
      && containmentReady
      && dualControlReady
      && signedDecisionReady
      && evidenceComplete
      && retentionReady;

    const blockers = [
      !containmentReady
        ? 'The original request can continue changing state while review is open.'
        : null,
      !roleReady
        ? `This route does not include the required ${scenario.requiredRole} role.`
        : null,
      !deadlineReady
        ? `Modeled review is ${route.reviewMinutes} minutes; the deadline is ${scenario.deadlineMinutes}.`
        : null,
      !dualControlReady
        ? 'This critical exception requires two eligible decision authorities.'
        : null,
      !signedDecisionReady
        ? 'The route produces an alert but no signed decision tied to the case.'
        : null,
      missingEvidence.length > 0
        ? `Missing evidence: ${missingEvidence.join(', ')}.`
        : null,
      !retentionReady
        ? 'The observed enforcer can rewrite or lose the only evidence copy.'
        : null,
    ].filter((item): item is string => Boolean(item));

    const stages = [
      {
        label: 'Contain',
        detail: containmentReady ? 'Request frozen' : 'Request still active',
        ready: containmentReady,
      },
      {
        label: 'Explain',
        detail: `${evidence.artifacts.length}/${model.requiredEvidence.length} artifacts`,
        ready: evidenceComplete,
      },
      {
        label: 'Route',
        detail: roleReady ? scenario.requiredRole : 'Wrong authority',
        ready: roleReady && dualControlReady,
      },
      {
        label: 'Decide',
        detail: deadlineReady
          ? `${route.reviewMinutes} min modeled review`
          : 'Deadline missed',
        ready: deadlineReady && signedDecisionReady,
      },
      {
        label: 'Prove',
        detail: retentionReady ? 'Independent retention' : 'Mutable evidence',
        ready: retentionReady,
      },
    ];

    return {
      ready,
      roleReady,
      deadlineReady,
      containmentReady,
      dualControlReady,
      signedDecisionReady,
      evidenceComplete,
      retentionReady,
      missingEvidence,
      blockers,
      stages,
    };
  }, [evidence, model.requiredEvidence, route, scenario]);

  function reset() {
    setScenarioId(model.defaults.scenarioId);
    setRouteId(model.defaults.routeId);
    setEvidenceId(model.defaults.evidenceId);
  }

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Evidence and escalation lab"
        title={model.title}
        description={model.description}
        icon={LifeBuoy}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-6">
            <ChoiceGroup label="1. Inject a governance failure">
              {model.scenarios.map((item) => {
                const Icon = scenarioIcon(item.id);
                return (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={Icon}
                    accent="rose"
                    onClick={() => setScenarioId(item.id)}
                  />
                );
              })}
            </ChoiceGroup>

            <ChoiceGroup label="2. Route the decision">
              {model.routes.map((item) => (
                <LabChoice
                  key={item.id}
                  selected={item.id === route.id}
                  label={item.label}
                  detail={item.detail}
                  icon={item.dualControl ? UsersRound : UserRoundCheck}
                  accent="amber"
                  onClick={() => setRouteId(item.id)}
                />
              ))}
            </ChoiceGroup>

            <ChoiceGroup label="3. Attach decision evidence">
              {model.evidenceBundles.map((item) => (
                <LabChoice
                  key={item.id}
                  selected={item.id === evidence.id}
                  label={item.label}
                  detail={item.detail}
                  icon={item.independentRetention ? ShieldCheck : FileCheck2}
                  accent="violet"
                  onClick={() => setEvidenceId(item.id)}
                />
              ))}
            </ChoiceGroup>
          </div>
        )}
      >
        <div className="space-y-6">
          <div
            className={`rounded-lg border p-5 ${
              result.ready
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-50'
                : result.containmentReady
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50'
                  : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-50'
            }`}
          >
            <div className="flex items-start gap-3">
              {result.ready ? (
                <BadgeCheck aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
              ) : result.containmentReady ? (
                <ShieldAlert aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
              ) : (
                <XCircle aria-hidden="true" className="mt-0.5 h-6 w-6 shrink-0" />
              )}
              <div>
                <p className="text-xs font-semibold uppercase opacity-70">
                  Escalation outcome
                </p>
                <h4 className="mt-1 text-xl font-semibold">
                  {result.ready
                    ? 'Controlled decision path'
                    : result.containmentReady
                      ? 'Safely contained, but incomplete'
                      : 'Uncontrolled escalation'}
                </h4>
                <p className="mt-2 text-sm leading-6 opacity-80">
                  {result.ready
                    ? `${scenario.requiredRole} can decide within the deadline and the signed outcome remains independently provable.`
                    : `Until the path is repaired, apply the declared fallback: ${scenario.fallback}.`}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric
              label="Decision role"
              value={result.roleReady ? 'Eligible' : 'Mismatch'}
              detail={scenario.requiredRole}
              icon={UserRoundCheck}
              tone={result.roleReady ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Review time"
              value={`${route.reviewMinutes} min`}
              detail={`${scenario.deadlineMinutes} min deadline`}
              icon={Clock3}
              tone={result.deadlineReady ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Control"
              value={route.dualControl ? 'Dual' : 'Single'}
              detail={scenario.requiresDualControl ? 'Dual required' : 'Single permitted'}
              icon={UsersRound}
              tone={result.dualControlReady ? 'emerald' : 'amber'}
            />
            <LabMetric
              label="Evidence"
              value={`${evidence.artifacts.length}/${model.requiredEvidence.length}`}
              detail={result.retentionReady ? 'Independent copy' : 'Mutable copy'}
              icon={FileCheck2}
              tone={
                result.evidenceComplete && result.retentionReady
                  ? 'emerald'
                  : 'amber'
              }
            />
          </div>

          <div>
            <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
              Control trace
            </h4>
            <div className="mt-3 grid gap-3 md:grid-cols-5">
              {result.stages.map((stage, index) => (
                <TraceStage
                  key={stage.label}
                  number={index + 1}
                  label={stage.label}
                  detail={stage.detail}
                  ready={stage.ready}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(240px,0.7fr)]">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                <CircleAlert aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                Gaps to close
              </h4>
              {result.blockers.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  {result.blockers.map((blocker) => (
                    <li key={blocker} className="flex gap-2">
                      <XCircle aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                      <span>{blocker}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 flex gap-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  <CheckCircle2 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  Containment, authority, deadline, evidence, and signed outcome
                  form one complete control path.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
              <h4 className="flex items-center gap-2 text-sm font-semibold text-neutral-950 dark:text-white">
                <LockKeyhole aria-hidden="true" className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                Timeout fallback
              </h4>
              <p className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                {scenario.fallback}
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                <Hourglass aria-hidden="true" className="h-4 w-4" />
                {scenario.deadlineMinutes} minute decision window
              </div>
            </div>
          </div>

          <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
            {model.modelNote}
          </p>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function ChoiceGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </legend>
      <div className="mt-3 space-y-2">{children}</div>
    </fieldset>
  );
}

function TraceStage({
  number,
  label,
  detail,
  ready,
}: {
  number: number;
  label: string;
  detail: string;
  ready: boolean;
}) {
  return (
    <div
      className={`relative min-w-0 rounded-md border p-3 ${
        ready
          ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
          : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-current text-xs font-semibold">
          <span className={ready ? 'text-emerald-50' : 'text-rose-50'}>
            {number}
          </span>
        </span>
        <span className="text-xs font-semibold uppercase">{label}</span>
      </div>
      <p className="mt-2 break-words text-xs leading-5 opacity-80">{detail}</p>
    </div>
  );
}

function LoadState({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50">
        <div className="flex items-start gap-3">
          <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h4 className="font-semibold">Escalation model unavailable</h4>
            <p className="mt-1 text-sm opacity-80">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-current px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-32 items-center justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-300">
      <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
      Loading evidence and escalation model
    </div>
  );
}

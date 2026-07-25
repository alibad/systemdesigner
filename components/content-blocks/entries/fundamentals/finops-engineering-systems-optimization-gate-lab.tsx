'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  CloudCog,
  DatabaseZap,
  Gauge,
  History,
  LoaderCircle,
  LockKeyhole,
  Network,
  PauseCircle,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Target,
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

const BLOCK_ID = 'fundamentals/finops-engineering-systems-optimization-gate-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/finops-engineering-systems/data/optimization-gate-model.json';

type Scenario = {
  id: string;
  label: string;
  detail: string;
  monthlyBaselineCost: number;
  eligibleActionIds: string[];
  minimumEvidenceDays: number;
  minimumHeadroomPercent: number;
  requiresRollback: boolean;
  riskLabel: string;
};

type Action = {
  id: string;
  label: string;
  detail: string;
  savingsPercent: number;
  baseRisk: number;
  changeLabel: string;
};

type OptimizationGateModel = {
  kind: 'finops-optimization-gate';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    scenarioId: string;
    actionId: string;
    evidenceDays: number;
    headroomPercent: number;
    ownerAssigned: boolean;
    rollbackReady: boolean;
    verificationReady: boolean;
  };
  scenarios: Scenario[];
  actions: Action[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isOptimizationGateModel(value: unknown): value is OptimizationGateModel {
  if (!isRecord(value) || !isRecord(value.defaults)) return false;

  return (
    value.kind === 'finops-optimization-gate'
    && value.blockId === BLOCK_ID
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && typeof value.modelNote === 'string'
    && typeof value.defaults.scenarioId === 'string'
    && typeof value.defaults.actionId === 'string'
    && typeof value.defaults.evidenceDays === 'number'
    && typeof value.defaults.headroomPercent === 'number'
    && typeof value.defaults.ownerAssigned === 'boolean'
    && typeof value.defaults.rollbackReady === 'boolean'
    && typeof value.defaults.verificationReady === 'boolean'
    && Array.isArray(value.scenarios)
    && value.scenarios.length >= 4
    && value.scenarios.every((scenario) => (
      isRecord(scenario)
      && typeof scenario.id === 'string'
      && typeof scenario.label === 'string'
      && typeof scenario.detail === 'string'
      && typeof scenario.monthlyBaselineCost === 'number'
      && isStringArray(scenario.eligibleActionIds)
      && typeof scenario.minimumEvidenceDays === 'number'
      && typeof scenario.minimumHeadroomPercent === 'number'
      && typeof scenario.requiresRollback === 'boolean'
      && typeof scenario.riskLabel === 'string'
    ))
    && Array.isArray(value.actions)
    && value.actions.length >= 4
    && value.actions.every((action) => (
      isRecord(action)
      && typeof action.id === 'string'
      && typeof action.label === 'string'
      && typeof action.detail === 'string'
      && typeof action.savingsPercent === 'number'
      && typeof action.baseRisk === 'number'
      && typeof action.changeLabel === 'string'
    ))
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export default function FinOpsEngineeringSystemsOptimizationGateLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<OptimizationGateModel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setModel(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isOptimizationGateModel(payload)) {
          throw new Error('The optimization-gate model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the optimization gate.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Optimization gate lab"
            title="Load workload and policy evidence"
            description="Recommendations, service constraints, and change controls are loading."
            icon={ShieldCheck}
            accent="violet"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <OptimizationGateLab model={model} />
      )}
    </div>
  );
}

function OptimizationGateLab({ model }: { model: OptimizationGateModel }) {
  const [scenarioId, setScenarioId] = useState(model.defaults.scenarioId);
  const [actionId, setActionId] = useState(model.defaults.actionId);
  const [evidenceDays, setEvidenceDays] = useState(model.defaults.evidenceDays);
  const [headroomPercent, setHeadroomPercent] = useState(model.defaults.headroomPercent);
  const [ownerAssigned, setOwnerAssigned] = useState(model.defaults.ownerAssigned);
  const [rollbackReady, setRollbackReady] = useState(model.defaults.rollbackReady);
  const [verificationReady, setVerificationReady] = useState(
    model.defaults.verificationReady,
  );

  const scenario = model.scenarios.find((item) => item.id === scenarioId)
    ?? model.scenarios[0];
  const action = model.actions.find((item) => item.id === actionId)
    ?? model.actions[0];

  const result = useMemo(() => {
    if (!scenario || !action) return null;

    const blockers = [
      !scenario.eligibleActionIds.includes(action.id)
        ? `${action.label} does not fit this workload's operating contract.`
        : null,
      evidenceDays < scenario.minimumEvidenceDays
        ? `Demand evidence is ${scenario.minimumEvidenceDays - evidenceDays} day(s) short.`
        : null,
      headroomPercent < scenario.minimumHeadroomPercent
        ? `Capacity headroom is ${scenario.minimumHeadroomPercent - headroomPercent} point(s) below policy.`
        : null,
      !ownerAssigned ? 'No accountable owner is assigned to the change.' : null,
      scenario.requiresRollback && !rollbackReady
        ? 'The rollback or commercial exit path has not been tested.'
        : null,
      !verificationReady
        ? 'No service-level and unit-cost verification is attached.'
        : null,
    ].filter((item): item is string => Boolean(item));

    const grossSavings = scenario.monthlyBaselineCost * (action.savingsPercent / 100);
    const riskPenalty = Math.max(
      0,
      scenario.minimumHeadroomPercent - headroomPercent,
    );
    const modeledRisk = Math.min(5, action.baseRisk + Math.ceil(riskPenalty / 10));

    return {
      approved: blockers.length === 0,
      blockers,
      grossSavings,
      modeledRisk,
      optimizedCost: scenario.monthlyBaselineCost - grossSavings,
    };
  }, [
    action,
    evidenceDays,
    headroomPercent,
    ownerAssigned,
    rollbackReady,
    scenario,
    verificationReady,
  ]);

  if (!scenario || !action || !result) return null;

  const reset = () => {
    setScenarioId(model.defaults.scenarioId);
    setActionId(model.defaults.actionId);
    setEvidenceDays(model.defaults.evidenceDays);
    setHeadroomPercent(model.defaults.headroomPercent);
    setOwnerAssigned(model.defaults.ownerAssigned);
    setRollbackReady(model.defaults.rollbackReady);
    setVerificationReady(model.defaults.verificationReady);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Optimization gate lab"
        title={model.title}
        description={model.description}
        icon={ShieldCheck}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Workload evidence
              </legend>
              <div className="mt-3 grid gap-2">
                {model.scenarios.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === scenario.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'steady-database' ? DatabaseZap : item.id === 'bursty-workers' ? Network : ServerCog}
                    accent="blue"
                    onClick={() => setScenarioId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Demand history"
              value={evidenceDays}
              output={`${evidenceDays} days`}
              min={1}
              max={60}
              step={1}
              accent="violet"
              lowLabel="One observation"
              highLabel="Two months"
              onChange={setEvidenceDays}
            />
            <LabRange
              label="Candidate headroom"
              value={headroomPercent}
              output={`${headroomPercent}%`}
              min={0}
              max={50}
              step={5}
              accent="amber"
              lowLabel="No reserve"
              highLabel="50% reserve"
              onChange={setHeadroomPercent}
            />
          </div>
        )}
      >
        <fieldset>
          <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            2. Proposed optimization
          </legend>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {model.actions.map((item) => (
              <LabChoice
                key={item.id}
                selected={item.id === action.id}
                label={item.label}
                detail={`${item.detail} Modeled gross savings: ${item.savingsPercent}%.`}
                icon={item.id === 'commitment' ? LockKeyhole : item.id === 'spot' ? Sparkles : CloudCog}
                accent={item.baseRisk >= 4 ? 'rose' : item.baseRisk >= 3 ? 'amber' : 'emerald'}
                onClick={() => setActionId(item.id)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
            3. Change contract
          </legend>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <GateToggle
              checked={ownerAssigned}
              label="Named owner"
              detail="An accountable team accepts the experiment and follow-up."
              icon={UserCheck}
              onChange={setOwnerAssigned}
            />
            <GateToggle
              checked={rollbackReady}
              label="Exit path tested"
              detail="Rollback, interruption recovery, or commitment exit is understood."
              icon={History}
              onChange={setRollbackReady}
            />
            <GateToggle
              checked={verificationReady}
              label="Outcome query ready"
              detail="Unit cost and service objectives are evaluated together."
              icon={Target}
              onChange={setVerificationReady}
            />
          </div>
        </fieldset>

        <div
          className={`mt-6 rounded-md border p-4 ${
            result.approved
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
              : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {result.approved ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            ) : (
              <PauseCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                Change decision
              </p>
              <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                {result.approved
                  ? 'Approved for a bounded production experiment'
                  : `Hold: ${result.blockers.length} gate${result.blockers.length === 1 ? '' : 's'} incomplete`}
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                {result.approved
                  ? `Canary ${action.changeLabel.toLowerCase()}, then verify cost and service behavior before expanding.`
                  : result.blockers[0]}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <LabMetric
            label="Gross estimate"
            value={formatCurrency(result.grossSavings)}
            detail={`${action.savingsPercent}% before migration and risk cost`}
            icon={BadgeDollarSign}
            tone="emerald"
          />
          <LabMetric
            label="Modeled spend"
            value={formatCurrency(result.optimizedCost)}
            detail={`From ${formatCurrency(scenario.monthlyBaselineCost)}`}
            icon={CircleDollarSign}
            tone="cyan"
          />
          <LabMetric
            label="Evidence"
            value={`${evidenceDays}/${scenario.minimumEvidenceDays}d`}
            detail="Observed / required demand history"
            icon={CalendarClock}
            tone={evidenceDays >= scenario.minimumEvidenceDays ? 'blue' : 'amber'}
          />
          <LabMetric
            label="Risk"
            value={`${result.modeledRisk}/5`}
            detail={scenario.riskLabel}
            icon={Gauge}
            tone={result.modeledRisk >= 4 ? 'rose' : result.modeledRisk >= 3 ? 'amber' : 'violet'}
          />
        </div>

        <section className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
          <p className="text-sm font-semibold text-neutral-950 dark:text-white">
            Evidence path
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-4">
            <GateStage
              number="1"
              label="Observe"
              detail={`${evidenceDays} demand days`}
              ready={evidenceDays >= scenario.minimumEvidenceDays}
            />
            <GateStage
              number="2"
              label="Constrain"
              detail={`${headroomPercent}% headroom`}
              ready={headroomPercent >= scenario.minimumHeadroomPercent}
            />
            <GateStage
              number="3"
              label="Canary"
              detail={action.changeLabel}
              ready={ownerAssigned && rollbackReady}
            />
            <GateStage
              number="4"
              label="Verify"
              detail="Cost plus service SLO"
              ready={verificationReady}
            />
          </div>
        </section>

        {!result.approved ? (
          <section className="mt-5">
            <div className="flex items-center gap-2 text-rose-800 dark:text-rose-200">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="text-sm font-semibold">Unresolved gates</p>
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-neutral-700 marker:text-rose-600 dark:text-neutral-200 dark:marker:text-rose-300">
              {result.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
            </ul>
          </section>
        ) : null}

        <p className="mt-5 border-t border-neutral-200 pt-4 text-xs leading-5 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          {model.modelNote}
        </p>
      </LearningLabBody>
    </LearningLab>
  );
}

function GateToggle({
  checked,
  label,
  detail,
  icon: Icon,
  onChange,
}: {
  checked: boolean;
  label: string;
  detail: string;
  icon: typeof UserCheck;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`min-h-28 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
        checked
          ? 'border-violet-300 bg-violet-50 text-violet-950 ring-1 ring-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-50 dark:ring-violet-300'
          : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-neutral-600'
      }`}
    >
      <span className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{label}</span>
          <span className="mt-1 block text-xs leading-5 opacity-80">{detail}</span>
        </span>
      </span>
    </button>
  );
}

function GateStage({
  number,
  label,
  detail,
  ready,
}: {
  number: string;
  label: string;
  detail: string;
  ready: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-md border p-3 ${
      ready
        ? 'border-emerald-300 bg-white text-neutral-950 dark:border-emerald-900 dark:bg-neutral-950 dark:text-white'
        : 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
    }`}>
      <div className="flex items-center gap-2">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          ready
            ? 'bg-emerald-700 text-white dark:bg-emerald-300 dark:text-emerald-950'
            : 'bg-rose-700 text-white dark:bg-rose-300 dark:text-rose-950'
        }`}>
          {number}
        </span>
        <span className="text-sm font-semibold">{label}</span>
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
  return (
    <div className="flex min-h-52 items-center justify-center p-6 text-sm text-neutral-600 dark:text-neutral-300">
      {error ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md border border-rose-300 bg-rose-50 px-4 py-3 font-semibold text-rose-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
        >
          {error} Retry
        </button>
      ) : (
        <>
          <LoaderCircle className="mr-2 h-5 w-5 animate-spin" aria-hidden="true" />
          Loading optimization-gate model...
        </>
      )}
    </div>
  );
}

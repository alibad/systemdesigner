'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  Database,
  Gauge,
  Layers3,
  LoaderCircle,
  PackageCheck,
  ReceiptText,
  Scale,
  Tags,
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

const BLOCK_ID = 'fundamentals/finops-engineering-systems-unit-economics-lab';
const DEFAULT_DATA_FILE =
  '/api/content/fundamentals/finops-engineering-systems/data/unit-economics-model.json';

type Workload = {
  id: string;
  label: string;
  detail: string;
  unitLabel: string;
  baseMonthlyUnits: number;
  directMonthlyCost: number;
  sharedMonthlyCost: number;
  targetUnitCost: number;
};

type AllocationPolicy = {
  id: string;
  label: string;
  detail: string;
  directCoveragePercent: number;
  sharedCoveragePercent: number;
  driverQuality: number;
  driverLabel: string;
};

type UnitEconomicsModel = {
  kind: 'finops-unit-economics';
  blockId: typeof BLOCK_ID;
  title: string;
  description: string;
  modelNote: string;
  defaults: {
    workloadId: string;
    allocationPolicyId: string;
    demandPercent: number;
  };
  decisionThresholds: {
    minimumAllocationPercent: number;
    minimumDriverQuality: number;
  };
  workloads: Workload[];
  allocationPolicies: AllocationPolicy[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isUnitEconomicsModel(value: unknown): value is UnitEconomicsModel {
  if (!isRecord(value) || !isRecord(value.defaults) || !isRecord(value.decisionThresholds)) {
    return false;
  }

  return (
    value.kind === 'finops-unit-economics'
    && value.blockId === BLOCK_ID
    && typeof value.title === 'string'
    && typeof value.description === 'string'
    && typeof value.modelNote === 'string'
    && typeof value.defaults.workloadId === 'string'
    && typeof value.defaults.allocationPolicyId === 'string'
    && typeof value.defaults.demandPercent === 'number'
    && typeof value.decisionThresholds.minimumAllocationPercent === 'number'
    && typeof value.decisionThresholds.minimumDriverQuality === 'number'
    && Array.isArray(value.workloads)
    && value.workloads.length >= 3
    && value.workloads.every((workload) => (
      isRecord(workload)
      && typeof workload.id === 'string'
      && typeof workload.label === 'string'
      && typeof workload.detail === 'string'
      && typeof workload.unitLabel === 'string'
      && typeof workload.baseMonthlyUnits === 'number'
      && typeof workload.directMonthlyCost === 'number'
      && typeof workload.sharedMonthlyCost === 'number'
      && typeof workload.targetUnitCost === 'number'
    ))
    && Array.isArray(value.allocationPolicies)
    && value.allocationPolicies.length >= 3
    && value.allocationPolicies.every((policy) => (
      isRecord(policy)
      && typeof policy.id === 'string'
      && typeof policy.label === 'string'
      && typeof policy.detail === 'string'
      && typeof policy.directCoveragePercent === 'number'
      && typeof policy.sharedCoveragePercent === 'number'
      && typeof policy.driverQuality === 'number'
      && typeof policy.driverLabel === 'string'
    ))
  );
}

function formatCurrency(value: number, fractionDigits = 0) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export default function FinOpsEngineeringSystemsUnitEconomicsLab({
  dataFile = DEFAULT_DATA_FILE,
}: {
  dataFile?: string;
}) {
  const [model, setModel] = useState<UnitEconomicsModel | null>(null);
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
        if (!isUnitEconomicsModel(payload)) {
          throw new Error('The unit-economics model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load unit economics.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  return (
    <div data-content-block={BLOCK_ID}>
      {!model ? (
        <LearningLab>
          <LearningLabHeader
            eyebrow="Unit economics lab"
            title="Load the allocation model"
            description="Workloads, allocation policies, and business-unit assumptions are loading."
            icon={Scale}
            accent="cyan"
          />
          <LoadState error={error} onRetry={() => setReloadKey((value) => value + 1)} />
        </LearningLab>
      ) : (
        <UnitEconomicsLab model={model} />
      )}
    </div>
  );
}

function UnitEconomicsLab({ model }: { model: UnitEconomicsModel }) {
  const [workloadId, setWorkloadId] = useState(model.defaults.workloadId);
  const [allocationPolicyId, setAllocationPolicyId] = useState(
    model.defaults.allocationPolicyId,
  );
  const [demandPercent, setDemandPercent] = useState(model.defaults.demandPercent);

  const workload = model.workloads.find((item) => item.id === workloadId)
    ?? model.workloads[0];
  const policy = model.allocationPolicies.find((item) => item.id === allocationPolicyId)
    ?? model.allocationPolicies[0];

  const result = useMemo(() => {
    if (!workload || !policy) return null;

    const demandFactor = demandPercent / 100;
    const businessUnits = Math.round(workload.baseMonthlyUnits * demandFactor);
    const directCost = workload.directMonthlyCost * (0.35 + 0.65 * demandFactor);
    const sharedCost = workload.sharedMonthlyCost;
    const totalCost = directCost + sharedCost;
    const attributedDirect = directCost * (policy.directCoveragePercent / 100);
    const attributedShared = sharedCost * (policy.sharedCoveragePercent / 100);
    const attributedCost = attributedDirect + attributedShared;
    const unallocatedCost = totalCost - attributedCost;
    const allocationPercent = (attributedCost / totalCost) * 100;
    const reportedUnitCost = attributedCost / businessUnits;
    const fullyLoadedUnitCost = totalCost / businessUnits;
    const decisionReady = (
      allocationPercent >= model.decisionThresholds.minimumAllocationPercent
      && policy.driverQuality >= model.decisionThresholds.minimumDriverQuality
    );

    return {
      allocationPercent,
      attributedCost,
      businessUnits,
      decisionReady,
      fullyLoadedUnitCost,
      reportedUnitCost,
      targetMet: fullyLoadedUnitCost <= workload.targetUnitCost,
      totalCost,
      unallocatedCost,
    };
  }, [demandPercent, model.decisionThresholds, policy, workload]);

  if (!workload || !policy || !result) return null;

  const reset = () => {
    setWorkloadId(model.defaults.workloadId);
    setAllocationPolicyId(model.defaults.allocationPolicyId);
    setDemandPercent(model.defaults.demandPercent);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Unit economics lab"
        title={model.title}
        description={model.description}
        icon={Scale}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={(
          <div className="space-y-7">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Product workload
              </legend>
              <div className="mt-3 grid gap-2">
                {model.workloads.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === workload.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'checkout' ? PackageCheck : item.id === 'analytics' ? BarChart3 : Gauge}
                    accent="blue"
                    onClick={() => setWorkloadId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Allocation policy
              </legend>
              <div className="mt-3 grid gap-2">
                {model.allocationPolicies.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={item.id === policy.id}
                    label={item.label}
                    detail={item.detail}
                    icon={item.id === 'invoice-only' ? ReceiptText : item.id === 'tags-only' ? Tags : Database}
                    accent={item.driverQuality >= 3 ? 'emerald' : item.driverQuality >= 2 ? 'amber' : 'rose'}
                    onClick={() => setAllocationPolicyId(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Monthly demand"
              value={demandPercent}
              output={`${demandPercent}%`}
              min={50}
              max={160}
              step={5}
              accent="cyan"
              lowLabel="Half baseline"
              highLabel="1.6x baseline"
              onChange={setDemandPercent}
            />
          </div>
        )}
      >
        <div
          className={`rounded-md border p-4 ${
            result.decisionReady
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
              : 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {result.decisionReady ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                Decision quality
              </p>
              <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">
                {result.decisionReady
                  ? 'This unit cost is ready for product decisions'
                  : 'Treat the reported unit cost as incomplete'}
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                {result.decisionReady
                  ? `${policy.driverLabel} connects spend to ${workload.unitLabel}s with enough allocation coverage to expose the fully loaded cost.`
                  : `${formatCurrency(result.unallocatedCost)} is still outside the product view, so the reported cost can look better than the actual cost to serve.`}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <LabMetric
            label="Fully loaded unit cost"
            value={formatCurrency(result.fullyLoadedUnitCost, 3)}
            detail={`Target ${formatCurrency(workload.targetUnitCost, 3)} per ${workload.unitLabel}`}
            icon={CircleDollarSign}
            tone={result.targetMet ? 'emerald' : 'amber'}
          />
          <LabMetric
            label="Reported unit cost"
            value={formatCurrency(result.reportedUnitCost, 3)}
            detail="Only currently attributed cost"
            icon={ReceiptText}
            tone={result.decisionReady ? 'cyan' : 'rose'}
          />
          <LabMetric
            label="Business units"
            value={formatCompact(result.businessUnits)}
            detail={`${workload.unitLabel}s this month`}
            icon={Target}
            tone="blue"
          />
          <LabMetric
            label="Allocation"
            value={`${result.allocationPercent.toFixed(1)}%`}
            detail={`${formatCurrency(result.unallocatedCost)} remains unallocated`}
            icon={Users}
            tone={result.decisionReady ? 'emerald' : 'amber'}
          />
        </div>

        <section className="mt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-neutral-950 dark:text-white">
                Monthly cost ledger
              </p>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                Attributed and unallocated segments always reconcile to the modeled total.
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
              {formatCurrency(result.totalCost)}
            </span>
          </div>
          <div
            className="mt-3 flex h-7 w-full overflow-hidden rounded-md border border-neutral-300 bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900"
            aria-label={`${result.allocationPercent.toFixed(1)} percent attributed and ${(100 - result.allocationPercent).toFixed(1)} percent unallocated`}
          >
            <div
              className="flex items-center justify-center bg-cyan-600 text-[11px] font-semibold text-white"
              style={{ width: `${result.allocationPercent}%` }}
            >
              {result.allocationPercent >= 30 ? 'Attributed' : null}
            </div>
            <div
              className="flex items-center justify-center bg-amber-300 text-[11px] font-semibold text-amber-950 dark:bg-amber-500 dark:text-neutral-950"
              style={{ width: `${100 - result.allocationPercent}%` }}
            >
              {100 - result.allocationPercent >= 16 ? 'Unallocated' : null}
            </div>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <LedgerStage
              label="Normalize"
              detail="Reconcile provider charges"
              icon={Database}
              active
            />
            <LedgerStage
              label="Allocate"
              detail={policy.driverLabel}
              icon={Layers3}
              active={result.decisionReady}
            />
            <LedgerStage
              label="Divide"
              detail={`By ${workload.unitLabel}`}
              icon={Scale}
              active={result.decisionReady}
            />
          </div>
        </section>

        <p className="mt-5 border-t border-neutral-200 pt-4 text-xs leading-5 text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          {model.modelNote}
        </p>
      </LearningLabBody>
    </LearningLab>
  );
}

function LedgerStage({
  label,
  detail,
  icon: Icon,
  active,
}: {
  label: string;
  detail: string;
  icon: typeof Database;
  active: boolean;
}) {
  return (
    <div className={`flex min-w-0 items-start gap-3 rounded-md border p-3 ${
      active
        ? 'border-cyan-300 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-50'
        : 'border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400'
    }`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-1 break-words text-xs leading-5 opacity-80">{detail}</p>
      </div>
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
          Loading unit-economics model...
        </>
      )}
    </div>
  );
}

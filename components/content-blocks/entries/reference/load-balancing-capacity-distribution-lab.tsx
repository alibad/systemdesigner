'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  Network,
  Route,
  Scale,
  Server,
  ServerOff,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type Bound = { min: number; max: number; step: number };
type Backend = {
  id: string;
  label: string;
  capacityRps: number;
  weight: number;
  profile: string;
};
type Policy = {
  id: string;
  label: string;
  detail: string;
  signal: string;
};
type FleetState = {
  id: string;
  label: string;
  detail: string;
  eligibleBackendIds: string[];
};
type CapacityModel = {
  defaults: { requestRate: number; policy: string; fleetState: string };
  bounds: { requestRate: Bound };
  warningUtilizationPercent: number;
  backends: Backend[];
  policies: Policy[];
  fleetStates: FleetState[];
};

type Allocation = Backend & {
  assignedRps: number;
  eligible: boolean;
  utilizationPercent: number;
};

const number = new Intl.NumberFormat('en-US');

function allocateRequests(
  requestRate: number,
  backends: Backend[],
  eligibleIds: Set<string>,
  policyId: string,
): Allocation[] {
  const eligible = backends.filter((backend) => eligibleIds.has(backend.id));
  const basis = eligible.map((backend) =>
    policyId === 'capacity-weighted' ? backend.weight : 1,
  );
  const totalBasis = basis.reduce((sum, value) => sum + value, 0);
  let assigned = 0;

  return backends.map((backend) => {
    const eligibleIndex = eligible.findIndex((candidate) => candidate.id === backend.id);
    if (eligibleIndex === -1 || totalBasis === 0) {
      return { ...backend, assignedRps: 0, eligible: false, utilizationPercent: 0 };
    }

    const isLast = eligibleIndex === eligible.length - 1;
    const backendRps = isLast
      ? requestRate - assigned
      : Math.round(requestRate * (basis[eligibleIndex] / totalBasis));
    assigned += backendRps;

    return {
      ...backend,
      assignedRps: backendRps,
      eligible: true,
      utilizationPercent: (backendRps / backend.capacityRps) * 100,
    };
  });
}

export default function LoadBalancingCapacityDistributionLab({
  dataFile,
}: {
  dataFile?: string;
}) {
  const [data, setData] = useState<CapacityModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestRate, setRequestRate] = useState(2400);
  const [policyId, setPolicyId] = useState('equal');
  const [fleetStateId, setFleetStateId] = useState('all');

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The capacity distribution model was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);
    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<CapacityModel>;
      })
      .then((model) => {
        if (!model.backends.length || !model.policies.length || !model.fleetStates.length) {
          throw new Error('The capacity distribution model has no routing choices.');
        }
        setData(model);
        setRequestRate(model.defaults.requestRate);
        setPolicyId(model.defaults.policy);
        setFleetStateId(model.defaults.fleetState);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the capacity model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const view = useMemo(() => {
    if (!data) return null;
    const policy = data.policies.find((item) => item.id === policyId) ?? data.policies[0];
    const fleetState =
      data.fleetStates.find((item) => item.id === fleetStateId) ?? data.fleetStates[0];
    const eligibleIds = new Set(fleetState.eligibleBackendIds);
    const allocations = allocateRequests(requestRate, data.backends, eligibleIds, policy.id);
    const eligibleAllocations = allocations.filter((backend) => backend.eligible);
    const eligibleCapacity = eligibleAllocations.reduce(
      (sum, backend) => sum + backend.capacityRps,
      0,
    );
    const overloaded = eligibleAllocations.filter((backend) => backend.utilizationPercent > 100);
    const hottest = eligibleAllocations.reduce<Allocation | null>(
      (current, backend) =>
        !current || backend.utilizationPercent > current.utilizationPercent ? backend : current,
      null,
    );
    const thinMargin = eligibleAllocations.some(
      (backend) => backend.utilizationPercent >= data.warningUtilizationPercent,
    );

    return {
      policy,
      fleetState,
      allocations,
      eligibleCapacity,
      overloaded,
      hottest,
      thinMargin,
      headroom: eligibleCapacity - requestRate,
    };
  }, [data, fleetStateId, policyId, requestRate]);

  if (loadError) return <LabError detail={loadError} />;
  if (!data || !view) return <LabLoading />;

  const reset = () => {
    setRequestRate(data.defaults.requestRate);
    setPolicyId(data.defaults.policy);
    setFleetStateId(data.defaults.fleetState);
  };
  const isOverCapacity = view.headroom < 0;
  const hasHotBackend = view.overloaded.length > 0;
  const statusTone = isOverCapacity || hasHotBackend ? 'rose' : view.thinMargin ? 'amber' : 'emerald';
  const consequence = isOverCapacity
    ? `Demand exceeds the ${number.format(view.eligibleCapacity)} req/s safe capacity of the eligible pool. A routing algorithm can only decide where overload lands; it cannot remove it.`
    : hasHotBackend
      ? `${view.overloaded.map((backend) => backend.label).join(', ')} exceeds its own safe capacity even though the fleet has aggregate headroom. The distribution signal does not match backend capacity.`
      : view.thinMargin
        ? `The pool is within aggregate capacity, but ${view.hottest?.label ?? 'the hottest backend'} has little margin for retries, request-cost variance, or another backend loss.`
        : `Every eligible backend remains below ${data.warningUtilizationPercent}% in this deterministic model. Validate the same claim with real request-cost and latency distributions.`;

  return (
    <div data-content-block="reference/load-balancing-capacity-distribution-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Capacity distribution lab"
          title="See where the routing policy puts pressure"
          description="Distribute one request rate across an unequal fleet. The model preserves total demand and exposes per-backend overload rather than reporting only an average."
          icon={Scale}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-7">
              <LabRange
                label="Incoming demand"
                value={requestRate}
                output={`${number.format(requestRate)} req/s`}
                {...data.bounds.requestRate}
                accent="violet"
                lowLabel="quiet"
                highLabel="overload"
                onChange={setRequestRate}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Distribution policy
                </legend>
                <div className="mt-3 space-y-2">
                  {data.policies.map((policy) => (
                    <LabChoice
                      key={policy.id}
                      selected={view.policy.id === policy.id}
                      label={policy.label}
                      detail={policy.detail}
                      icon={policy.id === 'equal' ? Route : Scale}
                      accent={policy.id === 'equal' ? 'blue' : 'violet'}
                      onClick={() => setPolicyId(policy.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <label htmlFor="load-balancing-fleet-state" className="block">
                <span className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Fleet event
                </span>
                <select
                  id="load-balancing-fleet-state"
                  value={view.fleetState.id}
                  onChange={(event) => setFleetStateId(event.target.value)}
                  className="mt-3 h-11 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-950 outline-none focus-visible:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-400 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                >
                  {data.fleetStates.map((state) => (
                    <option key={state.id} value={state.id}>{state.label}</option>
                  ))}
                </select>
                <span className="mt-2 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  {view.fleetState.detail}
                </span>
              </label>
            </div>
          }
        >
          <div aria-live="polite" className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Eligible capacity"
                value={`${number.format(view.eligibleCapacity)} req/s`}
                detail={`${view.allocations.filter((backend) => backend.eligible).length} of ${data.backends.length} backends can receive new work.`}
                icon={Network}
                tone={isOverCapacity ? 'rose' : 'blue'}
              />
              <LabMetric
                label="Capacity headroom"
                value={view.headroom >= 0 ? `${number.format(view.headroom)} req/s` : `${number.format(Math.abs(view.headroom))} req/s short`}
                detail="Aggregate safe capacity minus incoming demand."
                icon={Gauge}
                tone={isOverCapacity ? 'rose' : view.thinMargin ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Hottest backend"
                value={view.hottest ? `${view.hottest.utilizationPercent.toFixed(0)}%` : 'None'}
                detail={view.hottest ? view.hottest.label : 'No backend is eligible.'}
                icon={Server}
                tone={hasHotBackend ? 'rose' : view.thinMargin ? 'amber' : 'emerald'}
              />
              <LabMetric
                label="Policy signal"
                value={view.policy.label}
                detail={view.policy.signal}
                icon={Route}
                tone="violet"
              />
            </div>

            <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Assigned demand by backend
                </h4>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  Assigned requests always sum to {number.format(requestRate)} req/s. Utilization compares each share with that backend&apos;s safe modeled capacity.
                </p>
              </header>
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {view.allocations.map((backend) => (
                  <BackendPressure key={backend.id} backend={backend} warningAt={data.warningUtilizationPercent} />
                ))}
              </div>
            </section>

            <section
              className={`mt-5 rounded-md border p-5 ${
                statusTone === 'rose'
                  ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
                  : statusTone === 'amber'
                    ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
              }`}
              role="status"
            >
              <div className="flex items-start gap-3">
                {statusTone === 'emerald' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-semibold">Current consequence</p>
                  <p className="mt-1 text-sm leading-6 opacity-90">{consequence}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function BackendPressure({ backend, warningAt }: { backend: Allocation; warningAt: number }) {
  const isOverloaded = backend.utilizationPercent > 100;
  const isWarning = backend.utilizationPercent >= warningAt;
  const barTone = isOverloaded ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {backend.eligible ? (
            <Server aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-300" />
          ) : (
            <ServerOff aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-neutral-500" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">{backend.label}</p>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {backend.profile} - {number.format(backend.capacityRps)} req/s safe capacity
            </p>
          </div>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-neutral-950 dark:text-white">
          {backend.eligible ? `${number.format(backend.assignedRps)} req/s - ${backend.utilizationPercent.toFixed(0)}%` : 'Not eligible'}
        </p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800" aria-hidden="true">
        <div className={`h-full rounded-full ${barTone}`} style={{ width: `${Math.min(100, backend.utilizationPercent)}%` }} />
      </div>
      <p className="mt-2 text-xs font-medium text-neutral-600 dark:text-neutral-300">
        {!backend.eligible ? 'No new work is assigned.' : isOverloaded ? 'Overloaded: assigned demand exceeds safe capacity.' : isWarning ? 'Thin margin: request variance or retries can cross capacity.' : 'Within the modeled operating range.'}
      </p>
    </div>
  );
}

function LabLoading() {
  return (
    <div data-content-block="reference/load-balancing-capacity-distribution-lab">
      <div className="min-h-[720px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900" aria-label="Loading capacity distribution lab" />
    </div>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div data-content-block="reference/load-balancing-capacity-distribution-lab" role="alert" className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100">
      <p className="font-semibold">Capacity distribution lab unavailable</p>
      <p className="mt-2 opacity-80">{detail}</p>
    </div>
  );
}

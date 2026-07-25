'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  GitBranch,
  Network,
  ShieldCheck,
  WifiOff,
  XCircle,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ClientSideId = 'majority' | 'isolated';
type OperationId = 'read' | 'write';
type PolicyId = 'protect-order' | 'keep-responding';

type Option = {
  id: string;
  label: string;
  detail: string;
};

type Side = Option & {
  replicaIds: string[];
};

type Replica = {
  id: string;
  label: string;
  side: ClientSideId;
  version: number;
};

type PartitionModel = {
  defaults: {
    clientSide: ClientSideId;
    operation: OperationId;
    policy: PolicyId;
  };
  record: {
    key: string;
    majorityVersion: number;
    isolatedVersion: number;
  };
  sides: Side[];
  replicas: Replica[];
  operations: Option[];
  policies: Option[];
};

type Outcome = {
  served: boolean;
  response: string;
  responseDetail: string;
  capAvailability: string;
  order: string;
  repair: string;
  consequence: string;
  warning: boolean;
};

function deriveOutcome(
  data: PartitionModel,
  clientSide: ClientSideId,
  operation: OperationId,
  policy: PolicyId,
): Outcome {
  const onMajority = clientSide === 'majority';
  const currentVersion = data.record.majorityVersion;
  const isolatedVersion = data.record.isolatedVersion;

  if (policy === 'protect-order') {
    if (!onMajority) {
      return {
        served: false,
        response: 'Rejected',
        responseDetail: 'The isolated replica cannot prove current authority.',
        capAvailability: 'Sacrificed',
        order: 'Protected',
        repair: 'Retry or route the operation after authority is reachable.',
        consequence:
          operation === 'read'
            ? 'The replica refuses to return version 41 because it cannot prove that no newer write completed elsewhere. The caller receives an explicit unavailable result instead of stale state.'
            : 'The replica refuses the reservation because accepting it could oversell inventory beside a concurrent majority-side write. The caller must retry or enter a pending workflow.',
        warning: true,
      };
    }

    return {
      served: true,
      response: operation === 'read' ? `Version ${currentVersion}` : `Committed v${currentVersion + 1}`,
      responseDetail:
        operation === 'read'
          ? 'The communicating majority can prove the current value.'
          : 'Two replicas acknowledge one authoritative mutation.',
      capAvailability: 'Sacrificed',
      order: 'Protected',
      repair: 'Catch up the isolated replica after communication returns.',
      consequence:
        operation === 'read'
          ? 'This majority-side read succeeds with the current version. The service still gives up CAP availability because the same request would be rejected on the isolated side.'
          : 'This majority-side reservation commits in one order. The isolated side remains unable to accept the operation, so availability is not guaranteed for every non-failing replica.',
      warning: false,
    };
  }

  if (operation === 'read') {
    return {
      served: true,
      response: onMajority ? `Version ${currentVersion}` : `Version ${isolatedVersion}`,
      responseDetail: onMajority
        ? 'The local majority currently has the newest modeled value.'
        : `The response is ${currentVersion - isolatedVersion} version behind the majority.`,
      capAvailability: 'Preserved',
      order: onMajority ? 'Not guaranteed globally' : 'Stale result',
      repair: 'Exchange versions and repair stale replicas after healing.',
      consequence: onMajority
        ? 'The local response happens to be current, but the policy cannot promise one current result across both sides. A client on the isolated side would still receive version 41.'
        : 'The isolated replica responds successfully with version 41. Availability is preserved for this request, but the result is stale relative to version 42 on the majority side.',
      warning: !onMajority,
    };
  }

  return {
    served: true,
    response: onMajority ? `Accepted v${currentVersion + 1}a` : `Accepted v${isolatedVersion + 1}b`,
    responseDetail: 'The selected side records a local branch without remote coordination.',
    capAvailability: 'Preserved',
    order: 'Conflict possible',
    repair: 'Compare causal versions, merge safely, or compensate one accepted intent.',
    consequence: onMajority
      ? 'The majority side accepts a local reservation, while the policy also permits the isolated side to accept another. The service owes a deterministic conflict rule when the partition heals.'
      : 'The isolated side accepts a reservation from old version 41. That successful response can conflict with version 42 and any majority-side reservation, so reconciliation becomes business logic.',
    warning: true,
  };
}

export default function CapTheoremPartitionOperationLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<PartitionModel | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clientSide, setClientSide] = useState<ClientSideId>('majority');
  const [operation, setOperation] = useState<OperationId>('write');
  const [policy, setPolicy] = useState<PolicyId>('protect-order');

  useEffect(() => {
    if (!dataFile) {
      setLoadError('The partition-operation model was not provided.');
      return;
    }

    const controller = new AbortController();
    setLoadError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<PartitionModel>;
      })
      .then((model) => {
        if (model.replicas.length !== 3 || model.sides.length !== 2) {
          throw new Error('The partition-operation model must describe three replicas on two sides.');
        }
        setData(model);
        setClientSide(model.defaults.clientSide);
        setOperation(model.defaults.operation);
        setPolicy(model.defaults.policy);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoadError(error instanceof Error ? error.message : 'Unable to load the partition model.');
      });

    return () => controller.abort();
  }, [dataFile]);

  const outcome = useMemo(
    () => (data ? deriveOutcome(data, clientSide, operation, policy) : null),
    [clientSide, data, operation, policy],
  );

  if (loadError) return <LabError detail={loadError} />;
  if (!data || !outcome) return <LabLoading />;

  const selectedSide = data.sides.find((item) => item.id === clientSide) ?? data.sides[0];
  const selectedOperation = data.operations.find((item) => item.id === operation) ?? data.operations[0];
  const selectedPolicy = data.policies.find((item) => item.id === policy) ?? data.policies[0];
  const reset = () => {
    setClientSide(data.defaults.clientSide);
    setOperation(data.defaults.operation);
    setPolicy(data.defaults.policy);
  };

  return (
    <div data-content-block="reference/cap-theorem-partition-operation-lab">
      <LearningLab>
        <LearningLabHeader
          eyebrow="Partition and operation lab"
          title="Choose what one request observes during a split"
          description="Move the client, change the operation, and select a partition policy. The result separates a local response from the system-wide CAP guarantee."
          icon={GitBranch}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={
            <div className="space-y-6">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Client location
                </legend>
                <div className="mt-3 space-y-2">
                  {data.sides.map((side) => {
                    const sideId = side.id as ClientSideId;
                    return (
                      <LabChoice
                        key={side.id}
                        selected={clientSide === sideId}
                        label={side.label}
                        detail={side.detail}
                        icon={sideId === 'majority' ? Network : WifiOff}
                        accent={sideId === 'majority' ? 'blue' : 'amber'}
                        onClick={() => setClientSide(sideId)}
                      />
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Operation
                </legend>
                <div className="mt-3 space-y-2">
                  {data.operations.map((item) => {
                    const operationId = item.id as OperationId;
                    return (
                      <LabChoice
                        key={item.id}
                        selected={operation === operationId}
                        label={item.label}
                        detail={item.detail}
                        icon={operationId === 'read' ? Activity : Database}
                        accent={operationId === 'read' ? 'cyan' : 'violet'}
                        onClick={() => setOperation(operationId)}
                      />
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Partition policy
                </legend>
                <div className="mt-3 space-y-2">
                  {data.policies.map((item) => {
                    const policyId = item.id as PolicyId;
                    return (
                      <LabChoice
                        key={item.id}
                        selected={policy === policyId}
                        label={item.label}
                        detail={item.detail}
                        icon={policyId === 'protect-order' ? ShieldCheck : Activity}
                        accent={policyId === 'protect-order' ? 'blue' : 'emerald'}
                        onClick={() => setPolicy(policyId)}
                      />
                    );
                  })}
                </div>
              </fieldset>
            </div>
          }
        >
          <div aria-live="polite" className="min-w-0">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="This request"
                value={outcome.response}
                detail={outcome.responseDetail}
                icon={outcome.served ? CheckCircle2 : XCircle}
                tone={outcome.served ? (outcome.warning ? 'amber' : 'emerald') : 'rose'}
              />
              <LabMetric
                label="CAP availability"
                value={outcome.capAvailability}
                detail="Whether every non-failing replica can return a non-error response."
                icon={Activity}
                tone={outcome.capAvailability === 'Preserved' ? 'emerald' : 'amber'}
              />
              <LabMetric
                label="Single-copy order"
                value={outcome.order}
                detail="Whether the policy can promise one current operation order."
                icon={ShieldCheck}
                tone={outcome.order === 'Protected' ? 'blue' : 'rose'}
              />
              <LabMetric
                label="After healing"
                value={policy === 'protect-order' ? 'Catch up' : 'Reconcile'}
                detail={outcome.repair}
                icon={GitBranch}
                tone={policy === 'protect-order' ? 'cyan' : 'violet'}
              />
            </div>

            <section className="mt-5 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900/60">
                <h4 className="text-sm font-semibold text-neutral-950 dark:text-white">
                  Replica state for {data.record.key}
                </h4>
                <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  The client is on the {selectedSide.label.toLowerCase()} and attempts to {selectedOperation.label.toLowerCase()} under the {selectedPolicy.label.toLowerCase()} policy.
                </p>
              </header>
              <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch">
                <ReplicaSide
                  label="Communicating majority"
                  selected={clientSide === 'majority'}
                  replicas={data.replicas.filter((replica) => replica.side === 'majority')}
                />
                <div className="flex min-h-14 items-center justify-center rounded-md border border-dashed border-rose-300 bg-rose-50 px-3 text-center text-xs font-semibold text-rose-800 md:[writing-mode:vertical-rl] dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                  <WifiOff aria-hidden="true" className="mr-2 h-4 w-4 shrink-0 md:mb-2 md:mr-0" />
                  Messages dropped
                </div>
                <ReplicaSide
                  label="Isolated replica"
                  selected={clientSide === 'isolated'}
                  replicas={data.replicas.filter((replica) => replica.side === 'isolated')}
                />
              </div>
            </section>

            <section
              className={`mt-5 rounded-md border p-5 ${
                outcome.warning
                  ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
                  : 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
              }`}
              role="status"
            >
              <div className="flex items-start gap-3">
                {outcome.warning ? (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-sm font-semibold">Visible consequence</p>
                  <p className="mt-1 text-sm leading-6 opacity-90">{outcome.consequence}</p>
                </div>
              </div>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function ReplicaSide({
  label,
  selected,
  replicas,
}: {
  label: string;
  selected: boolean;
  replicas: Replica[];
}) {
  return (
    <div
      className={`rounded-md border p-4 ${
        selected
          ? 'border-violet-400 bg-violet-50 ring-1 ring-violet-400 dark:border-violet-700 dark:bg-violet-950/30'
          : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
        {selected ? (
          <span className="rounded bg-violet-100 px-2 py-1 text-[11px] font-semibold text-violet-800 dark:bg-violet-900 dark:text-violet-100">
            Client here
          </span>
        ) : null}
      </div>
      <div className="mt-3 space-y-2">
        {replicas.map((replica) => (
          <div
            key={replica.id}
            className="flex items-center justify-between gap-3 rounded border border-neutral-200 bg-white px-3 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900"
          >
            <span className="flex items-center gap-2 font-semibold text-neutral-800 dark:text-neutral-200">
              <Database aria-hidden="true" className="h-4 w-4 text-blue-600 dark:text-blue-300" />
              {replica.label}
            </span>
            <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
              version {replica.version}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LabLoading() {
  return (
    <div data-content-block="reference/cap-theorem-partition-operation-lab">
      <div
        className="min-h-[680px] rounded-md border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
        aria-label="Loading partition-operation model"
      />
    </div>
  );
}

function LabError({ detail }: { detail: string }) {
  return (
    <div data-content-block="reference/cap-theorem-partition-operation-lab">
      <div
        className="min-h-48 rounded-md border border-rose-300 bg-rose-50 p-5 text-sm text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100"
        role="alert"
      >
        <p className="font-semibold">Partition-operation model unavailable</p>
        <p className="mt-2 opacity-80">{detail}</p>
      </div>
    </div>
  );
}

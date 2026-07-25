'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  Database,
  Gauge,
  GraduationCap,
  Network,
  Server,
  ShieldCheck,
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

type Topology = {
  id: string;
  label: string;
  detail: string;
  voters: number;
  learners: number;
};

type RequestContract = {
  id: string;
  label: string;
  detail: string;
  requiresQuorum: boolean;
  path: string;
};

type Endpoint = {
  id: string;
  label: string;
  detail: string;
  isolated: boolean;
};

type QuorumModel = {
  kind: 'etcd-quorum-contract';
  blockId: string;
  title: string;
  description: string;
  defaults: {
    topologyId: string;
    requestId: string;
    endpointId: string;
    unavailableVoters: number;
  };
  topologies: Topology[];
  requests: RequestContract[];
  endpoints: Endpoint[];
};

const BLOCK_ID = 'technology/etcd-quorum-contract-lab';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isQuorumModel(value: unknown): value is QuorumModel {
  return Boolean(
    isRecord(value)
      && value.kind === 'etcd-quorum-contract'
      && value.blockId === BLOCK_ID
      && typeof value.title === 'string'
      && typeof value.description === 'string'
      && isRecord(value.defaults)
      && Array.isArray(value.topologies)
      && value.topologies.length >= 2
      && Array.isArray(value.requests)
      && value.requests.length >= 3
      && Array.isArray(value.endpoints)
      && value.endpoints.length >= 2,
  );
}

export default function EtcdQuorumContractLab({ dataFile }: { dataFile?: string }) {
  const [model, setModel] = useState<QuorumModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dataFile) {
      setError('No quorum model was supplied.');
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
        if (!isQuorumModel(payload)) {
          throw new Error('The quorum model is incomplete.');
        }
        setModel(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the quorum lab.');
      });

    return () => controller.abort();
  }, [dataFile]);

  if (!model) {
    return (
      <div data-content-block={BLOCK_ID}>
        <LearningLab>
          <LearningLabHeader
            eyebrow="Quorum contract lab"
            title="Test a coordination request against member loss"
            description="Loading voter, learner, endpoint, and read-consistency contracts."
            icon={Network}
            accent="cyan"
          />
          <div className="flex min-h-48 items-center justify-center p-6 text-sm text-neutral-600 dark:text-neutral-300">
            {error ?? 'Loading quorum model...'}
          </div>
        </LearningLab>
      </div>
    );
  }

  return <QuorumWorkbench model={model} />;
}

function QuorumWorkbench({ model }: { model: QuorumModel }) {
  const [topologyId, setTopologyId] = useState(model.defaults.topologyId);
  const [requestId, setRequestId] = useState(model.defaults.requestId);
  const [endpointId, setEndpointId] = useState(model.defaults.endpointId);
  const [unavailableVoters, setUnavailableVoters] = useState(
    model.defaults.unavailableVoters,
  );

  const topology =
    model.topologies.find((item) => item.id === topologyId) ?? model.topologies[0];
  const request =
    model.requests.find((item) => item.id === requestId) ?? model.requests[0];
  const endpoint =
    model.endpoints.find((item) => item.id === endpointId) ?? model.endpoints[0];

  const result = useMemo(() => {
    const quorum = Math.floor(topology.voters / 2) + 1;
    const liveVoters = Math.max(0, topology.voters - unavailableVoters);
    const hasQuorum = liveVoters >= quorum;
    const serializable = request.id === 'serializable-read';
    const succeeds = serializable || (hasQuorum && !endpoint.isolated);
    const stale = serializable;

    let headline = 'Request can complete with its stated contract.';
    let explanation =
      'The endpoint can reach enough voting members to satisfy the operation.';

    if (serializable) {
      headline = endpoint.isolated
        ? 'Local read can succeed while the endpoint is partitioned.'
        : 'Local read avoids quorum coordination.';
      explanation =
        'Serializable mode may return state that trails the latest quorum-committed revision. The client must explicitly tolerate that staleness.';
    } else if (!hasQuorum) {
      headline = 'The cluster cannot commit or prove a current read.';
      explanation =
        'Fewer voting members are available than the majority requires. Learners do not vote, so adding one does not change this result.';
    } else if (endpoint.isolated) {
      headline = 'This endpoint cannot reach the quorum path.';
      explanation =
        'The cluster may be healthy elsewhere, but a client pinned to the isolated endpoint cannot complete a write or linearizable read until it fails over.';
    }

    return {
      quorum,
      liveVoters,
      hasQuorum,
      succeeds,
      stale,
      headline,
      explanation,
      toleratedFailures: topology.voters - quorum,
    };
  }, [endpoint.isolated, request.id, topology.voters, unavailableVoters]);

  function selectTopology(nextTopology: Topology) {
    setTopologyId(nextTopology.id);
    setUnavailableVoters((current) => Math.min(current, nextTopology.voters));
  }

  function reset() {
    setTopologyId(model.defaults.topologyId);
    setRequestId(model.defaults.requestId);
    setEndpointId(model.defaults.endpointId);
    setUnavailableVoters(model.defaults.unavailableVoters);
  }

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Quorum contract lab"
          title={model.title}
          description={model.description}
          icon={Network}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Voting topology
                </legend>
                <div className="mt-3 space-y-2">
                  {model.topologies.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === topology.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.learners > 0 ? GraduationCap : Users}
                      accent="cyan"
                      onClick={() => selectTopology(item)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Unavailable voting members"
                value={unavailableVoters}
                output={`${unavailableVoters} of ${topology.voters}`}
                min={0}
                max={topology.voters}
                step={1}
                lowLabel="All voters reachable"
                highLabel="No voting path"
                accent="rose"
                onChange={setUnavailableVoters}
              />

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  2. Request contract
                </legend>
                <div className="mt-3 space-y-2">
                  {model.requests.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === request.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'write' ? Database : Gauge}
                      accent={item.id === 'serializable-read' ? 'amber' : 'blue'}
                      onClick={() => setRequestId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  3. Connected endpoint
                </legend>
                <div className="mt-3 space-y-2">
                  {model.endpoints.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === endpoint.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.isolated ? CircleOff : Server}
                      accent={item.isolated ? 'rose' : 'emerald'}
                      onClick={() => setEndpointId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          )}
        >
          <div className="min-w-0 space-y-5" aria-live="polite">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <LabMetric
                label="Majority"
                value={`${result.quorum} of ${topology.voters}`}
                detail="Voting members required"
                icon={Users}
                tone="cyan"
              />
              <LabMetric
                label="Live voters"
                value={String(result.liveVoters)}
                detail={`${result.toleratedFailures} voter failure${result.toleratedFailures === 1 ? '' : 's'} tolerated`}
                icon={Server}
                tone={result.hasQuorum ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Request"
                value={result.succeeds ? 'Completes' : 'Unavailable'}
                detail={request.requiresQuorum ? 'Quorum-bound contract' : 'Local read contract'}
                icon={result.succeeds ? CheckCircle2 : AlertTriangle}
                tone={result.succeeds ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Freshness"
                value={result.stale ? 'May be stale' : 'Current'}
                detail={result.stale ? 'Current at one member' : 'Ordered through consensus'}
                icon={ShieldCheck}
                tone={result.stale ? 'amber' : 'blue'}
              />
            </div>

            <section className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    Member roles
                  </p>
                  <p className="mt-1 text-sm text-neutral-700 dark:text-neutral-200">
                    A learner replicates state but does not vote until promoted.
                  </p>
                </div>
                <span className="rounded-md border border-neutral-200 bg-white px-3 py-1 text-xs font-semibold text-neutral-700 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200">
                  {topology.voters + topology.learners} total members
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                {Array.from({ length: topology.voters }, (_, index) => {
                  const unavailable = index < unavailableVoters;
                  return (
                    <div
                      key={`voter-${index}`}
                      className={`rounded-md border p-3 ${
                        unavailable
                          ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
                          : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                      }`}
                    >
                      {unavailable ? (
                        <CircleOff aria-hidden="true" className="h-5 w-5 text-rose-600 dark:text-rose-300" />
                      ) : (
                        <Server aria-hidden="true" className="h-5 w-5 text-emerald-700 dark:text-emerald-300" />
                      )}
                      <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
                        Voter {index + 1}
                      </p>
                      <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                        {unavailable ? 'Unavailable' : 'Voting'}
                      </p>
                    </div>
                  );
                })}
                {Array.from({ length: topology.learners }, (_, index) => (
                  <div
                    key={`learner-${index}`}
                    className="rounded-md border border-violet-200 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/30"
                  >
                    <GraduationCap aria-hidden="true" className="h-5 w-5 text-violet-700 dark:text-violet-300" />
                    <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
                      Learner {index + 1}
                    </p>
                    <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
                      Non-voting
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section
              className={`rounded-md border p-5 ${
                result.succeeds
                  ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
                  : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.succeeds ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                ) : (
                  <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">
                    Observed contract
                  </p>
                  <h4 className="mt-1 text-base font-semibold text-neutral-950 dark:text-white">
                    {result.headline}
                  </h4>
                  <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-200">
                    {result.explanation}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
              <p className="text-xs font-semibold uppercase text-blue-800 dark:text-blue-200">
                Request path
              </p>
              <p className="mt-2 text-sm font-semibold text-blue-950 dark:text-blue-50">
                {request.path}
              </p>
              <p className="mt-2 text-xs leading-5 text-blue-900/80 dark:text-blue-100/80">
                Writes are constrained by peer round-trip time and durable disk commit.
                Serializable reads trade freshness for a local-member path.
              </p>
            </section>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

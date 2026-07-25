'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  CircleAlert,
  CloudCog,
  Database,
  HardDrive,
  LoaderCircle,
  RadioTower,
  ServerCrash,
  ShieldAlert,
  TriangleAlert,
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
type Scenario = {
  id: string;
  label: string;
  detail: string;
  availableBookies: number;
  ownerBrokerAvailable: boolean;
  replacementBrokerAvailable: boolean;
  metadataQuorumAvailable: boolean;
  failedLayer: 'none' | 'broker' | 'bookie' | 'metadata';
  userImpact: string;
  operatorMove: string;
};
type FailureData = {
  title: string;
  description: string;
  totalBookies: number;
  defaults: {
    scenarioId: string;
    ensemble: number;
    writeQuorum: number;
    ackQuorum: number;
  };
  bounds: {
    ensemble: Bound;
  };
  scenarios: Scenario[];
};

const BLOCK_ID = 'technology/pulsar-failure-topology-lab';

function isBound(value: unknown): value is Bound {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Bound>;
  return [item.min, item.max, item.step].every(
    (number) => typeof number === 'number' && Number.isFinite(number),
  );
}

function isFailureData(value: unknown): value is FailureData {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<FailureData>;
  const defaults = item.defaults;

  return Boolean(
    item.title
      && item.description
      && typeof item.totalBookies === 'number'
      && item.totalBookies >= 3
      && defaults?.scenarioId
      && typeof defaults.ensemble === 'number'
      && typeof defaults.writeQuorum === 'number'
      && typeof defaults.ackQuorum === 'number'
      && isBound(item.bounds?.ensemble)
      && Array.isArray(item.scenarios)
      && item.scenarios.length >= 4
      && item.scenarios.every((scenario) => (
        scenario.id
        && scenario.label
        && scenario.detail
        && typeof scenario.availableBookies === 'number'
        && typeof scenario.ownerBrokerAvailable === 'boolean'
        && typeof scenario.replacementBrokerAvailable === 'boolean'
        && typeof scenario.metadataQuorumAvailable === 'boolean'
        && ['none', 'broker', 'bookie', 'metadata'].includes(scenario.failedLayer)
        && scenario.userImpact
        && scenario.operatorMove
      )),
  );
}

export default function PulsarFailureTopologyLab({ dataFile }: { dataFile?: string }) {
  const [data, setData] = useState<FailureData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!dataFile) {
      setError('No Pulsar failure model was supplied.');
      return;
    }

    const controller = new AbortController();
    setData(null);
    setError(null);

    fetch(dataFile, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with status ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!isFailureData(payload)) throw new Error('The failure model is incomplete.');
        setData(payload);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load the failure lab.');
      });

    return () => controller.abort();
  }, [dataFile, reloadKey]);

  if (!data) {
    return (
      <div
        data-content-block={BLOCK_ID}
        className="not-prose my-7 rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950"
      >
        <div className="flex min-h-40 items-center justify-center text-center">
          {error ? (
            <div>
              <CircleAlert aria-hidden="true" className="mx-auto h-6 w-6 text-rose-500" />
              <p className="mt-3 text-sm font-semibold text-neutral-950 dark:text-white">
                Failure model unavailable
              </p>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{error}</p>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="mt-4 rounded-md bg-neutral-950 px-3 py-2 text-sm font-semibold text-white dark:bg-white dark:text-neutral-950"
              >
                Try again
              </button>
            </div>
          ) : (
            <div>
              <LoaderCircle aria-hidden="true" className="mx-auto h-6 w-6 animate-spin text-violet-600" />
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
                Loading the broker and storage trace...
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <FailureWorkbench data={data} />;
}

function FailureWorkbench({ data }: { data: FailureData }) {
  const [scenarioId, setScenarioId] = useState(data.defaults.scenarioId);
  const [ensemble, setEnsemble] = useState(data.defaults.ensemble);
  const [writeQuorum, setWriteQuorum] = useState(data.defaults.writeQuorum);
  const [ackQuorum, setAckQuorum] = useState(data.defaults.ackQuorum);
  const scenario = data.scenarios.find((item) => item.id === scenarioId) ?? data.scenarios[0];

  const result = useMemo(() => {
    const brokerCanServe = scenario.ownerBrokerAvailable
      || (scenario.replacementBrokerAvailable && scenario.metadataQuorumAvailable);
    const availableForEntry = Math.min(scenario.availableBookies, writeQuorum);
    const ackPossible = availableForEntry >= ackQuorum;
    const publishAccepted = brokerCanServe && ackPossible;
    const brokerRecovered = !scenario.ownerBrokerAvailable
      && scenario.replacementBrokerAvailable
      && scenario.metadataQuorumAvailable;
    const margin = Math.max(0, availableForEntry - ackQuorum);
    const status = publishAccepted
      ? scenario.failedLayer === 'none'
        ? 'healthy'
        : 'degraded'
      : 'blocked';

    let headline = 'The broker can acknowledge a durable BookKeeper entry';
    let explanation = `The write targets ${writeQuorum} bookies and returns success after ${ackQuorum} durable acknowledgments.`;

    if (brokerRecovered && publishAccepted) {
      headline = 'A replacement broker can recover topic ownership and continue';
      explanation = 'The old broker held no unique message data. Metadata coordination selects a new owner, which recovers the managed ledger and cursor state from BookKeeper.';
    } else if (!brokerCanServe) {
      headline = 'No broker can safely take ownership of the topic';
      explanation = scenario.metadataQuorumAvailable
        ? 'The serving broker is unavailable and no replacement broker is ready.'
        : 'The serving broker failed while metadata quorum was unavailable, so another broker cannot safely establish ownership.';
    } else if (!ackPossible) {
      headline = `Only ${availableForEntry} durable writes are possible, below ack quorum ${ackQuorum}`;
      explanation = 'The broker must not report publish success. Clients should apply bounded retry and backpressure while operators restore BookKeeper capacity.';
    } else if (scenario.failedLayer === 'bookie') {
      headline = 'Publishes continue, but the storage layer has less failure margin';
      explanation = `The broker can still collect ${ackQuorum} acknowledgments. BookKeeper should replace the failed bookie and re-form affected ledger ensembles.`;
    }

    return {
      ackPossible,
      availableForEntry,
      brokerCanServe,
      brokerRecovered,
      explanation,
      headline,
      margin,
      publishAccepted,
      status,
    } as const;
  }, [ackQuorum, scenario, writeQuorum]);

  function setEnsembleSafely(value: number) {
    setEnsemble(value);
    setWriteQuorum((current) => Math.min(current, value));
    setAckQuorum((current) => Math.min(current, writeQuorum, value));
  }

  function setWriteQuorumSafely(value: number) {
    setWriteQuorum(value);
    setAckQuorum((current) => Math.min(current, value));
  }

  function reset() {
    setScenarioId(data.defaults.scenarioId);
    setEnsemble(data.defaults.ensemble);
    setWriteQuorum(data.defaults.writeQuorum);
    setAckQuorum(data.defaults.ackQuorum);
  }

  const statusStyle = result.status === 'blocked'
    ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
    : result.status === 'degraded'
      ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100'
      : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100';

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Broker and storage failure lab"
          title={data.title}
          description={data.description}
          icon={ShieldAlert}
          accent="violet"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  1. Inject a failure
                </legend>
                <div className="mt-3 grid gap-2">
                  {data.scenarios.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={item.id === scenario.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.failedLayer === 'broker' ? ServerCrash : item.failedLayer === 'bookie' ? HardDrive : item.failedLayer === 'metadata' ? CloudCog : CheckCircle2}
                      accent={item.failedLayer === 'none' ? 'emerald' : item.failedLayer === 'bookie' ? 'amber' : 'rose'}
                      onClick={() => setScenarioId(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="space-y-6">
                <div>
                  <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                    2. Set the persistence policy
                  </p>
                  <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">
                    Pulsar requires ensemble E &gt;= write quorum W &gt;= ack quorum A.
                  </p>
                </div>
                <LabRange
                  label="Ensemble size (E)"
                  value={ensemble}
                  output={ensemble.toString()}
                  min={data.bounds.ensemble.min}
                  max={Math.min(data.bounds.ensemble.max, data.totalBookies)}
                  step={data.bounds.ensemble.step}
                  lowLabel="Fewer bookies selected"
                  highLabel="Wider placement"
                  accent="blue"
                  onChange={setEnsembleSafely}
                />
                <LabRange
                  label="Write quorum (W)"
                  value={writeQuorum}
                  output={writeQuorum.toString()}
                  min={1}
                  max={ensemble}
                  step={1}
                  lowLabel="Fewer copies per entry"
                  highLabel="More copies per entry"
                  accent="violet"
                  onChange={setWriteQuorumSafely}
                />
                <LabRange
                  label="Ack quorum (A)"
                  value={ackQuorum}
                  output={ackQuorum.toString()}
                  min={1}
                  max={writeQuorum}
                  step={1}
                  lowLabel="Earlier acknowledgment"
                  highLabel="More durable acks"
                  accent="emerald"
                  onChange={setAckQuorum}
                />
              </div>
            </div>
          )}
        >
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Publish result"
                value={result.publishAccepted ? 'Acknowledged' : 'Blocked'}
                detail={result.publishAccepted ? 'Broker can meet the configured durability boundary' : 'Client must not receive a success acknowledgment'}
                icon={result.publishAccepted ? CheckCircle2 : TriangleAlert}
                tone={result.publishAccepted ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Durable acks"
                value={`${result.availableForEntry} available`}
                detail={`${ackQuorum} required before success`}
                icon={HardDrive}
                tone={result.ackPossible ? 'blue' : 'rose'}
              />
              <LabMetric
                label="Topic owner"
                value={scenario.ownerBrokerAvailable ? 'Original' : result.brokerRecovered ? 'Recovered' : 'Unavailable'}
                detail={scenario.metadataQuorumAvailable ? 'Metadata quorum available' : 'Metadata quorum unavailable'}
                icon={RadioTower}
                tone={result.brokerCanServe ? 'violet' : 'rose'}
              />
              <LabMetric
                label="Ack margin"
                value={`${result.margin} bookies`}
                detail="Additional write loss before this entry misses A"
                icon={Database}
                tone={result.margin > 0 ? 'emerald' : 'amber'}
              />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Persistent message path
              </p>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1.35fr_auto_1fr] lg:items-stretch">
                <TopologyNode
                  icon={RadioTower}
                  eyebrow="Client path"
                  title="Producer"
                  detail="Sends to the broker that owns the topic partition."
                  state="active"
                />
                <FlowArrow active={result.brokerCanServe} />
                <TopologyNode
                  icon={scenario.ownerBrokerAvailable ? RadioTower : ServerCrash}
                  eyebrow="Serving layer"
                  title={scenario.ownerBrokerAvailable ? 'Owner broker' : result.brokerRecovered ? 'Replacement broker' : 'No topic owner'}
                  detail={scenario.ownerBrokerAvailable ? 'Routes publish and dispatch traffic.' : result.brokerRecovered ? 'Recovers the managed ledger before serving.' : 'Cannot establish safe ownership.'}
                  state={result.brokerCanServe ? result.brokerRecovered ? 'degraded' : 'active' : 'failed'}
                />
                <FlowArrow active={result.brokerCanServe && result.ackPossible} />
                <div className="rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
                  <div className="flex items-center gap-2">
                    <BookOpenCheck aria-hidden="true" className="h-4 w-4 text-violet-600 dark:text-violet-300" />
                    <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                      BookKeeper
                    </p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-neutral-950 dark:text-white">
                    Ledger ensemble E{ensemble} / W{writeQuorum} / A{ackQuorum}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {Array.from({ length: data.totalBookies }, (_, index) => {
                      const failed = index >= scenario.availableBookies;
                      const selected = index < ensemble;
                      return (
                        <div
                          key={index}
                          className={`rounded-md border px-2 py-2 text-center text-xs font-semibold ${
                            failed
                              ? 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200'
                              : selected
                                ? 'border-violet-200 bg-violet-50 text-violet-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200'
                                : 'border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400'
                          }`}
                        >
                          B{index + 1} {failed ? 'down' : selected ? 'selected' : 'spare'}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <FlowArrow active={result.publishAccepted} />
                <TopologyNode
                  icon={Database}
                  eyebrow="Subscription state"
                  title="Cursor and consumer"
                  detail={result.publishAccepted ? 'Cursor can advance only after application acknowledgment.' : 'No newly acknowledged entry is available to dispatch.'}
                  state={result.publishAccepted ? 'active' : 'blocked'}
                />
              </div>

              <div className={`mt-4 flex items-start gap-3 rounded-md border p-3 ${
                scenario.metadataQuorumAvailable
                  ? 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100'
                  : 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100'
              }`}>
                <CloudCog aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <p className="text-sm leading-6">
                  <strong>Metadata control plane:</strong>{' '}
                  {scenario.metadataQuorumAvailable
                    ? 'ownership and ledger metadata are available for lookup, load balancing, and recovery.'
                    : 'ownership recovery and administrative changes cannot safely reach quorum.'}
                </p>
              </div>
            </div>

            <div className={`rounded-md border p-5 ${statusStyle}`} role="status" aria-live="polite">
              <div className="flex items-start gap-3">
                {result.status === 'healthy' ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : result.status === 'degraded' ? (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">{result.headline}</p>
                  <p className="mt-1 text-sm leading-6 opacity-80">{result.explanation}</p>
                  <p className="mt-3 text-xs font-semibold uppercase opacity-70">User-visible result</p>
                  <p className="mt-1 text-sm leading-6">{scenario.userImpact}</p>
                  <p className="mt-3 text-xs font-semibold uppercase opacity-70">Operator move</p>
                  <p className="mt-1 text-sm leading-6">{scenario.operatorMove}</p>
                </div>
              </div>
            </div>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function FlowArrow({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center" aria-hidden="true">
      <ArrowDown className={`h-5 w-5 lg:hidden ${active ? 'text-violet-500' : 'text-neutral-300 dark:text-neutral-700'}`} />
      <ArrowRight className={`hidden h-5 w-5 lg:block ${active ? 'text-violet-500' : 'text-neutral-300 dark:text-neutral-700'}`} />
    </div>
  );
}

function TopologyNode({
  icon: Icon,
  eyebrow,
  title,
  detail,
  state,
}: {
  icon: typeof RadioTower;
  eyebrow: string;
  title: string;
  detail: string;
  state: 'active' | 'degraded' | 'failed' | 'blocked';
}) {
  const style = state === 'failed' || state === 'blocked'
    ? 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30'
    : state === 'degraded'
      ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
      : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30';
  const iconStyle = state === 'failed' || state === 'blocked'
    ? 'text-rose-600 dark:text-rose-300'
    : state === 'degraded'
      ? 'text-amber-600 dark:text-amber-300'
      : 'text-emerald-600 dark:text-emerald-300';

  return (
    <div className={`rounded-md border p-3 ${style}`}>
      <Icon aria-hidden="true" className={`h-5 w-5 ${iconStyle}`} />
      <p className="mt-3 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        {eyebrow}
      </p>
      <p className="mt-1 text-sm font-semibold text-neutral-950 dark:text-white">{title}</p>
      <p className="mt-2 text-xs leading-5 text-neutral-600 dark:text-neutral-400">{detail}</p>
    </div>
  );
}
